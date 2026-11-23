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
    await store.addEvents([{ id: "warmup", pointId: "warm", at: new Date(t0).toISOString(), kind: "intro" }]);
  });

  it("concurrent submissions for one point leave the cached state equal to a full replay", async () => {
    const evs = Array.from({ length: 12 }, (_, i) => answer("p.race", i + 1));
    // Twelve requests at once (two tabs / devices / retries), each carrying one event.
    await Promise.all(evs.map((e) => store.addEvents([e])));
    const cached = (await store.getAllStates())["p.race"];
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
        const isEventsRead = /FROM events WHERE point_id/.test(text) && params[0] === "p.slow";
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
      const a = store.addEvents([e1]);
      await aRead;
      await store.addEvents([e2]);
      releaseA();
      await a;
      aInFlight = false;
      expect(stalled).toBe(true); // the race window was really exercised
      const cached = (await store.getAllStates())["p.slow"];
      expect(cached).toEqual(replay([e1, e2], await getScheduler()).get("p.slow"));
    } finally {
      (globalThis as unknown as { __nutriDb: Promise<unknown> }).__nutriDb = Promise.resolve(real);
    }
  });

  it("re-sending the same events is idempotent", async () => {
    const evs = [answer("p.idem", 1), answer("p.idem", 2)];
    await store.addEvents(evs);
    await store.addEvents(evs);
    await Promise.all([store.addEvents(evs), store.addEvents([evs[1]])]);
    expect((await store.getAllStates())["p.idem"].answers).toBe(2);
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
    await store.addEvents([e]);
    // Simulate a cache row from an older reducer version.
    await db.query("UPDATE point_state SET state = state - 'v' WHERE point_id = $1", ["p.old"]);
    const st = (await store.getAllStates())["p.old"];
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
    await store.addEvents(evs);
    const t = await store.getObservedTiming((_p, ex) => (ex === "c" ? "choice" : ex === "x" ? "explain" : undefined));
    expect(t.choice).toBeCloseTo(0.6, 1); // median of 30/36/42 s
    expect(t.explain).toBeCloseTo(1.5, 1); // 10 samples of 90 s
    expect(t.successRate).toBeGreaterThan(0.5);
  });
});

describe("today's answers", () => {
  it("counts answers of the current study day (04:00 Prague) from the event log, intros excluded", async () => {
    const now = new Date("2026-11-26T10:00:00Z"); // 11:00 Prague
    const ev = (id: string, at: string, kind: "answer" | "intro" = "answer"): StudyEvent =>
      kind === "intro" ? { id, pointId: "p.today", at, kind } : { ...answer("p.today", 1), id, at };
    await store.addEvents([
      ev("today-answer-1", "2026-11-26T03:30:00Z"), // 04:30 Prague — today
      ev("today-answer-2", "2026-11-26T09:00:00Z"),
      ev("today-intro-01", "2026-11-26T09:10:00Z", "intro"),
      ev("yesterday-late", "2026-11-26T02:30:00Z"), // 03:30 Prague — still yesterday's study day
    ]);
    expect(await store.getTodayAnswers(now)).toBe(2);
  });
});
