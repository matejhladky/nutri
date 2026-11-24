import { beforeAll, describe, expect, it } from "vitest";
import type { StudyEvent } from "@/engine/types";
import { Grade } from "@/engine/types";

// In-memory embedded Postgres; must be set before the store opens the database.
process.env.PGLITE_DIR = "memory://";
const store = await import("./store");
const { getScheduler } = await import("@/engine/scheduler");
const { replay } = await import("@/engine/state");

const t0 = Date.parse("2026-11-25T10:00:00Z");
const answer = (pointId: string, i: number): StudyEvent => ({
  id: `${pointId}-answer-${i}`,
  pointId,
  at: new Date(t0 + i * 60_000).toISOString(),
  kind: "answer",
  exerciseId: "e1",
  grade: i % 3 === 0 ? Grade.Again : Grade.Good,
  outcome: i % 3 === 0 ? "wrong" : "correct",
});

describe("event store", () => {
  beforeAll(async () => {
    await store.addEvents("l1", [{ id: "warmup", pointId: "warm", at: new Date(t0).toISOString(), kind: "intro" }]);
  });

  it("concurrent submissions for one point leave the cached state equal to a full replay", async () => {
    const evs = Array.from({ length: 12 }, (_, i) => answer("p.race", i + 1));
    // Twelve requests at once (two tabs / devices / retries), each carrying one event.
    await Promise.all(evs.map((e) => store.addEvents("l1", [e])));
    const cached = (await store.getAllStates("l1"))["p.race"];
    const expected = replay(evs, await getScheduler()).get("p.race");
    expect(cached.answers).toBe(12);
    expect(cached).toEqual(expected);
  });

  it("a slow writer holding an older snapshot cannot overwrite a newer cached state", async () => {
    const { getDb } = await import("./db");
    const real = await getDb();
    // Interleaving: A inserts e1 and reads {e1}; B inserts e2, reads {e1,e2} and writes; only then A writes.
    let releaseA!: () => void;
    const aMayWrite = new Promise<void>((r) => (releaseA = r));
    let aHasRead!: () => void;
    const aRead = new Promise<void>((r) => (aHasRead = r));
    let aInFlight = true;
    let stalled = false;
    const wrapped = {
      query: async (text: string, params: unknown[] = []) => {
        const isEventsRead = /FROM events WHERE learner_id = \$1 AND point_id/.test(text) && params[1] === "p.slow";
        const isStateWrite = /point_state/.test(text) && /INSERT|UPDATE/.test(text) && params.includes("p.slow");
        const staleSnapshot = params.some((x) => typeof x === "string" && x.includes('"answers":1,'));
        if (aInFlight && isStateWrite && staleSnapshot) {
          stalled = true;
          await aMayWrite;
        }
        const rows = await real.query(text, params);
        if (aInFlight && isEventsRead && rows.length === 1) aHasRead();
        return rows;
      },
    };
    (globalThis as unknown as { __nutriDb: Promise<unknown> }).__nutriDb = Promise.resolve(wrapped);
    try {
      const e1 = answer("p.slow", 1);
      const e2 = answer("p.slow", 2);
      const a = store.addEvents("l1", [e1]);
      await aRead;
      await store.addEvents("l1", [e2]);
      releaseA();
      await a;
      aInFlight = false;
      expect(stalled).toBe(true); // the race window was really exercised
      const cached = (await store.getAllStates("l1"))["p.slow"];
      expect(cached).toEqual(replay([e1, e2], await getScheduler()).get("p.slow"));
    } finally {
      (globalThis as unknown as { __nutriDb: Promise<unknown> }).__nutriDb = Promise.resolve(real);
    }
  });

  it("re-sending the same events is idempotent", async () => {
    const evs = [answer("p.idem", 1), answer("p.idem", 2)];
    await store.addEvents("l1", evs);
    await store.addEvents("l1", evs);
    await Promise.all([store.addEvents("l1", evs), store.addEvents("l1", [evs[1]])]);
    expect((await store.getAllStates("l1"))["p.idem"].answers).toBe(2);
  });
});

describe("event validation", () => {
  it("rejects only the malformed events of a batch", () => {
    const good = answer("p.v", 1);
    const { valid, rejected } = store.partitionEvents([
      good,
      { ...answer("p.v", 2), grade: undefined }, // answer without a grade would break replay
      { ...answer("p.v", 3), response: { type: "explain", covered: [0], text: "x".repeat(6000) } }, // over-long text
      "garbage",
    ]);
    expect(valid.map((e) => e.id)).toEqual([good.id]);
    expect(rejected.map((r) => [r.index, r.id])).toEqual([
      [1, "p.v-answer-2"],
      [2, "p.v-answer-3"],
      [3, null],
    ]);
  });
});

describe("state versioning", () => {
  it("rebuilds cached states written by an older reducer when read", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    const e = answer("p.old", 1);
    await store.addEvents("l1", [e]);
    // Simulate a cache row from an older reducer version.
    await db.query("UPDATE point_state SET state = state - 'v' WHERE learner_id = 'l1' AND point_id = $1", ["p.old"]);
    const st = (await store.getAllStates("l1"))["p.old"];
    const { STATE_VERSION } = await import("@/engine/state");
    expect(st.v).toBe(STATE_VERSION);
    expect(st.answers).toBe(1);
  });
});

describe("observed timing", () => {
  it("returns medians per exercise type only with enough samples, and the review success rate", async () => {
    const evs: StudyEvent[] = Array.from({ length: 40 }, (_, i) => ({
      ...answer("p.time", 100 + i),
      exerciseId: i < 30 ? "c" : "x",
      durationMs: i < 30 ? 30_000 + (i % 3) * 6_000 : 90_000,
      outcome: i % 4 === 0 ? "wrong" : "correct",
      grade: i % 4 === 0 ? Grade.Again : Grade.Good,
    }));
    await store.addEvents("l1", evs);
    const t = await store.getObservedTiming("l1", (_p, ex) => (ex === "c" ? "choice" : ex === "x" ? "explain" : undefined));
    expect(t.choice).toBeCloseTo(0.6, 1); // median of 30/36/42 s
    expect(t.explain).toBeCloseTo(1.5, 1); // 10 samples of 90 s
    expect(t.successRate).toBeGreaterThan(0.5);
  });
});

describe("answers per day", () => {
  it("buckets answers by study day (04:00 Prague) over the last 14 days; intros and re-sends don't count", async () => {
    const now = new Date("2027-03-10T10:00:00Z"); // 11:00 Prague
    const ev = (id: string, at: string, kind: "answer" | "intro" = "answer"): StudyEvent =>
      kind === "intro" ? { id, pointId: "p.days", at, kind } : { ...answer("p.days", 1), id, at };
    const evs = [
      ev("days-answer-01", "2027-03-10T03:30:00Z"), // 04:30 Prague — today
      ev("days-answer-02", "2027-03-10T09:00:00Z"),
      ev("days-intro-001", "2027-03-10T09:10:00Z", "intro"),
      ev("days-late-0001", "2027-03-10T02:30:00Z"), // 03:30 Prague — still yesterday's study day
      ev("days-first-001", "2027-02-25T12:00:00Z"), // 13 days ago — the oldest day shown
      ev("days-too-old01", "2027-02-24T12:00:00Z"), // 14 days ago — outside
    ];
    await store.addEvents("l1", evs);
    await store.addEvents("l1", evs); // retried submission
    expect(await store.getAnswersByDay("l1", now)).toEqual({ "2027-03-10": 2, "2027-03-09": 1, "2027-02-25": 1 });
  });
});

describe("two learners", () => {
  const sum = (st: Record<string, { answers: number }>) => Object.values(st).reduce((n, s) => n + s.answers, 0);

  it("keep separate states for the same point, and neither sees the other's points", async () => {
    await store.addEvents("l1", [answer("p.both", 1), answer("p.both", 2), answer("p.both", 4)]);
    await store.addEvents("l2", [{ ...answer("p.both", 1), id: "l2-p.both-1" }]);
    const [a, b] = [await store.getAllStates("l1"), await store.getAllStates("l2")];
    expect(a["p.both"].answers).toBe(3);
    expect(b["p.both"].answers).toBe(1);
    expect(b["p.race"]).toBeUndefined(); // written by l1 earlier in this file
    expect(Object.keys(b)).toEqual(["p.both"]);
  });

  it("an event id that already belongs to the other learner changes nothing for either of them", async () => {
    const own = answer("p.mine", 1);
    await store.addEvents("l1", [own]);
    const before1 = await store.getAllStates("l1");
    const before2 = await store.getAllStates("l2");
    // Same id, replayed by l2 (stale queue / forged): different point and outcome.
    const states = await store.addEvents("l2", [{ ...own, pointId: "p.mine", outcome: "wrong", grade: Grade.Again }]);
    expect(states).toEqual({}); // nothing of l2's was derived from it
    expect(await store.getAllStates("l1")).toEqual(before1);
    expect(await store.getAllStates("l2")).toEqual(before2);
  });

  it("today's answers, observed timing, settings and reports are per learner", async () => {
    const now = new Date("2026-11-27T10:00:00Z");
    const before1 = await store.getAnswersByDay("l1", now);
    await store.addEvents("l2", [{ ...answer("p.t2", 1), id: "l2-today-1", at: "2026-11-27T09:00:00Z" }]);
    expect(await store.getAnswersByDay("l1", now)).toEqual(before1);
    expect((await store.getAnswersByDay("l2", now))["2026-11-27"]).toBe(1);

    // l1 has ≥ 30 timed answers from the timing test above; l2 has too few for any calibration.
    const typeOf = () => "choice";
    expect((await store.getObservedTiming("l1", typeOf)).successRate).toBeDefined();
    expect(await store.getObservedTiming("l2", typeOf)).toEqual({});

    await store.saveSettings("l2", { dailyMinutes: 90 });
    expect((await store.getSettings("l2")).dailyMinutes).toBe(90);
    expect((await store.getSettings("l1")).dailyMinutes).toBe(45);

    await store.addReport("l2", { pointId: "p.rep", exerciseId: "e1", message: "" });
    expect(await store.openReports("l2")).toEqual([{ pointId: "p.rep", exerciseId: "e1" }]);
    expect(await store.openReports("l1")).toEqual([]);
  });

  it("a full rebuild keeps each learner's states", async () => {
    const [a, b] = [await store.getAllStates("l1"), await store.getAllStates("l2")];
    await store.rebuildAllStates();
    expect(sum(await store.getAllStates("l1"))).toBe(sum(a));
    expect(sum(await store.getAllStates("l2"))).toBe(sum(b));
    expect(await store.getAllStates("l2")).toEqual(b);
  });
});

describe("admin: read-only", () => {
  it("the read-only view refuses anything but a single SELECT", async () => {
    const { getDb, readOnly } = await import("./db");
    const ro = readOnly(await getDb());
    await expect(ro.query("SELECT 1 AS x")).resolves.toEqual([{ x: 1 }]);
    for (const sql of [
      "INSERT INTO settings (key, value) VALUES ('x', '{}')",
      "UPDATE point_state SET version = 0",
      "DELETE FROM events",
      "  update events set point_id = 'x'",
      "WITH d AS (DELETE FROM events RETURNING *) SELECT 1",
      "SELECT 1; DELETE FROM events",
    ])
      await expect(ro.query(sql)).rejects.toThrow(/read-only/);
  });

  it("an overview shows the learner's data and writes nothing, not even a stale cache refresh", async () => {
    const { getDb } = await import("./db");
    const { learnerOverview } = await import("./admin");
    const db = await getDb();
    await store.addEvents("l2", [{ ...answer("p.adm", 1), id: "l2-adm-1" }]);
    await store.addReport("l2", { pointId: "p.adm", exerciseId: "e1", message: "nejasné" });
    await db.query("UPDATE point_state SET state = state - 'v' WHERE learner_id = 'l2' AND point_id = 'p.adm'"); // stale cache row
    const snapshot = async () =>
      JSON.stringify(
        await Promise.all(
          ["events", "point_state", "reports", "settings"].map((t) => db.query(`SELECT * FROM ${t} ORDER BY 1, 2`)),
        ),
      );
    const before = await snapshot();
    const view = await learnerOverview("l2");
    expect(await snapshot()).toBe(before);
    expect(view.states["p.adm"].answers).toBe(1); // replayed in memory
    expect(view.reports.map((r) => r.message)).toContain("nejasné");
    expect(view.states["p.race"]).toBeUndefined(); // l1's point
    const l1 = await learnerOverview("l1");
    expect(l1.states["p.race"].answers).toBe(12);
    expect(l1.reports).toEqual([]);
  });
});
