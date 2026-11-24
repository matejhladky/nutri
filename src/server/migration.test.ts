import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import type { StudyEvent } from "@/engine/types";
import { Grade } from "@/engine/types";
import { applySchema, type Db } from "./db";

/** The single-learner schema as deployed before learners existed (production today). */
const LEGACY_SCHEMA = [
  `CREATE TABLE events (id TEXT PRIMARY KEY, point_id TEXT NOT NULL, at TIMESTAMPTZ NOT NULL, payload JSONB NOT NULL,
     received_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE INDEX events_point_idx ON events (point_id, at)`,
  `CREATE TABLE point_state (point_id TEXT PRIMARY KEY, state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `ALTER TABLE point_state ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE reports (id SERIAL PRIMARY KEY, point_id TEXT NOT NULL, exercise_id TEXT, message TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved BOOLEAN NOT NULL DEFAULT false)`,
  `CREATE TABLE settings (key TEXT PRIMARY KEY, value JSONB NOT NULL)`,
];

const ev = (pointId: string, i: number): StudyEvent => ({
  id: `legacy-${pointId}-${i}`,
  pointId,
  at: new Date(Date.parse("2026-11-23T10:00:00Z") + i * 60_000).toISOString(),
  kind: "answer",
  exerciseId: "e1",
  grade: Grade.Good,
  outcome: "correct",
});

describe("migration from the single-learner schema", () => {
  it("assigns all existing data to l1, leaves l2 empty, and is idempotent", async () => {
    const pg = new PGlite("memory://");
    const db: Db = { query: async (text, params = []) => (await pg.query(text, params)).rows as never };
    for (const s of LEGACY_SCHEMA) await db.query(s);

    const { replay } = await import("@/engine/state");
    const { getScheduler } = await import("@/engine/scheduler");
    const legacy = [ev("p.a", 1), ev("p.a", 2), ev("p.b", 3)];
    for (const e of legacy) await db.query("INSERT INTO events (id, point_id, at, payload) VALUES ($1, $2, $3, $4)", [e.id, e.pointId, e.at, JSON.stringify(e)]);
    const replayed = replay(legacy, await getScheduler());
    for (const [id, st] of replayed) await db.query("INSERT INTO point_state (point_id, state, version) VALUES ($1, $2, 3)", [id, JSON.stringify(st)]);
    await db.query("INSERT INTO reports (point_id, exercise_id, message) VALUES ('p.a', 'e1', 'typo')");
    await db.query(`INSERT INTO settings (key, value) VALUES ('learner', '{"dailyMinutes": 60}')`);

    await applySchema(db);
    await applySchema(db); // a second cold start changes nothing

    expect(await db.query("SELECT DISTINCT learner_id FROM events")).toEqual([{ learner_id: "l1" }]);
    expect(await db.query("SELECT count(*)::int AS n FROM events")).toEqual([{ n: 3 }]);
    expect(await db.query("SELECT learner_id, point_id, version FROM point_state ORDER BY point_id")).toEqual([
      { learner_id: "l1", point_id: "p.a", version: 3 },
      { learner_id: "l1", point_id: "p.b", version: 3 },
    ]);
    expect(await db.query("SELECT key FROM settings")).toEqual([{ key: "learner:l1" }]);
    // No default left behind: a write that forgets the learner fails instead of landing in l1.
    await expect(db.query("INSERT INTO events (id, point_id, at, payload) VALUES ('x-000001', 'p.a', now(), '{}')")).rejects.toThrow();
    await expect(db.query("INSERT INTO reports (point_id, message) VALUES ('p.a', '')")).rejects.toThrow();

    // The store now sees the old progress as l1's only.
    (globalThis as unknown as { __nutriDb?: Promise<Db> }).__nutriDb = Promise.resolve(db);
    const store = await import("./store");
    const l1 = await store.getAllStates("l1");
    expect(l1["p.a"]).toEqual(replayed.get("p.a"));
    expect(l1["p.b"].answers).toBe(1);
    expect(await store.getAllStates("l2")).toEqual({});
    expect((await store.getSettings("l1")).dailyMinutes).toBe(60);
    expect((await store.getSettings("l2")).dailyMinutes).toBe(45);
    expect(await store.openReports("l1")).toEqual([{ pointId: "p.a", exerciseId: "e1" }]);
    expect(await store.openReports("l2")).toEqual([]);

    // l2 can now study the same point independently (composite key on the cache).
    await store.addEvents("l2", [{ ...ev("p.a", 9), id: "l2-first-answer" }]);
    expect((await store.getAllStates("l2"))["p.a"].answers).toBe(1);
    expect((await store.getAllStates("l1"))["p.a"]).toEqual(replayed.get("p.a"));
  });
});
