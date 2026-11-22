import "server-only";
/**
 * Learner data access. Events are the source of truth; point_state is a cache rebuilt per point by replay.
 */
import { z } from "zod";
import { getDb, type Db } from "./db";
import { getScheduler, type Scheduler } from "@/engine/scheduler";
import { replay } from "@/engine/state";
import type { PointState, StudyEvent } from "@/engine/types";

const ResponseSchema = z.union([
  z.object({ type: z.literal("dontKnow") }),
  z.object({ type: z.literal("reveal"), selfGrade: z.enum(["again", "hard", "good"]) }),
  z.object({ type: z.literal("choice"), selected: z.array(z.number().int()), guessed: z.boolean() }),
  z.object({ type: z.literal("numeric"), value: z.string().max(50), seed: z.number().int() }),
  z.object({ type: z.literal("explain"), covered: z.array(z.number().int()), text: z.string().max(5000).optional() }),
  z.object({
    type: z.literal("case"),
    seed: z.number().int(),
    steps: z
      .array(
        z.union([
          z.object({ type: z.literal("dontKnow") }),
          z.object({ type: z.literal("numeric"), value: z.string().max(50) }),
          z.object({ type: z.literal("choice"), selected: z.array(z.number().int()), guessed: z.boolean() }),
          z.object({ type: z.literal("explain"), covered: z.array(z.number().int()) }),
          z.object({ type: z.literal("reveal"), selfGrade: z.enum(["again", "hard", "good"]) }),
        ]),
      )
      .max(12),
  }),
]);

export const EventSchema = z.object({
  id: z.string().min(8).max(64),
  pointId: z.string().min(1).max(120),
  at: z.iso.datetime(),
  kind: z.enum(["intro", "answer"]),
  skippedIntro: z.boolean().optional(),
  exerciseId: z.string().max(80).optional(),
  exerciseVersion: z.number().int().optional(),
  outcome: z.enum(["correct", "partial", "wrong", "unknown"]).optional(),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  hintUsed: z.boolean().optional(),
  response: ResponseSchema.optional(),
  durationMs: z.number().int().nonnegative().max(86_400_000).optional(),
}).refine((e) => e.kind !== "answer" || (e.grade !== undefined && e.outcome !== undefined), {
  // replay() cannot apply an answer without a grade — such an event must never reach the log.
  message: "answer event needs grade and outcome",
});

export type RejectedEvent = { index: number; id: string | null; error: string };

/**
 * Validate a batch event by event: one malformed event (an over-long typed answer, an event from an older client)
 * is rejected on its own instead of failing the batch and blocking the client's queue forever.
 */
export function partitionEvents(raw: unknown[]): { valid: StudyEvent[]; rejected: RejectedEvent[] } {
  const valid: StudyEvent[] = [];
  const rejected: RejectedEvent[] = [];
  raw.forEach((item, index) => {
    const r = EventSchema.safeParse(item);
    if (r.success) valid.push(r.data as StudyEvent);
    else {
      const id = typeof (item as { id?: unknown })?.id === "string" ? (item as { id: string }).id : null;
      rejected.push({ index, id, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 300) });
    }
  });
  return { valid, rejected };
}

export const SettingsSchema = z.object({
  dailyMinutes: z.number().int().min(10).max(240),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const DEFAULT_SETTINGS: Settings = { dailyMinutes: 45 };

export async function getAllStates(): Promise<Record<string, PointState>> {
  const db = await getDb();
  const rows = await db.query<{ point_id: string; state: PointState }>("SELECT point_id, state FROM point_state");
  return Object.fromEntries(rows.map((r) => [r.point_id, r.state]));
}

/** Insert events idempotently, then rebuild the cached state of every affected point. */
export async function addEvents(events: StudyEvent[]): Promise<Record<string, PointState>> {
  const db = await getDb();
  for (const ev of events) {
    await db.query("INSERT INTO events (id, point_id, at, payload) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING", [
      ev.id,
      ev.pointId,
      ev.at,
      JSON.stringify(ev),
    ]);
  }
  const s = await getScheduler();
  const out: Record<string, PointState> = {};
  for (const pointId of new Set(events.map((e) => e.pointId))) {
    const st = await rebuildPoint(db, s, pointId);
    if (st) out[pointId] = st;
  }
  return out;
}

/**
 * Recompute one point's cached state from ALL its events and store it with an optimistic version check.
 * The version is read BEFORE the events, so a write succeeds only if no other write happened in between —
 * a writer holding an older snapshot (concurrent tabs/devices/retries) fails, re-reads and retries, and can never
 * overwrite a state that already includes more events. Works with single-statement autocommit (Neon HTTP).
 */
export async function rebuildPoint(db: Db, s: Scheduler, pointId: string): Promise<PointState | undefined> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const cur = await db.query<{ version: number }>("SELECT version FROM point_state WHERE point_id = $1", [pointId]);
    const rows = await db.query<{ payload: StudyEvent }>("SELECT payload FROM events WHERE point_id = $1", [pointId]);
    const st = replay(
      rows.map((r) => r.payload),
      s,
    ).get(pointId);
    if (!st) return undefined;
    const json = JSON.stringify(st);
    const written = cur.length
      ? await db.query(
          `UPDATE point_state SET state = $2, version = version + 1, updated_at = now()
           WHERE point_id = $1 AND version = $3 RETURNING point_id`,
          [pointId, json, cur[0].version],
        )
      : await db.query(
          `INSERT INTO point_state (point_id, state, version, updated_at) VALUES ($1, $2, 1, now())
           ON CONFLICT (point_id) DO NOTHING RETURNING point_id`,
          [pointId, json],
        );
    if (written.length) return st;
    // Lost the race: back off with jitter so concurrent writers don't retry in lock-step.
    await new Promise((r) => setTimeout(r, 5 + Math.random() * 20 * (attempt + 1)));
  }
  throw new Error(`point_state for ${pointId}: too many concurrent updates`);
}

/** Maintenance: rebuild every cached point state from the event log (the source of truth). */
export async function rebuildAllStates(): Promise<number> {
  const db = await getDb();
  const s = await getScheduler();
  const ids = await db.query<{ point_id: string }>("SELECT DISTINCT point_id FROM events");
  for (const { point_id } of ids) await rebuildPoint(db, s, point_id);
  return ids.length;
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.query<{ value: Settings }>("SELECT value FROM settings WHERE key = 'learner'");
  const parsed = SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(rows[0]?.value ?? {}) });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = SettingsSchema.parse({ ...(await getSettings()), ...patch });
  const db = await getDb();
  await db.query(
    `INSERT INTO settings (key, value) VALUES ('learner', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(next)],
  );
  return next;
}

export type OpenReport = { pointId: string; exerciseId: string | null };

export async function addReport(r: { pointId: string; exerciseId: string | null; message: string }): Promise<void> {
  const db = await getDb();
  await db.query("INSERT INTO reports (point_id, exercise_id, message) VALUES ($1, $2, $3)", [r.pointId, r.exerciseId, r.message]);
}

export async function openReports(): Promise<OpenReport[]> {
  const db = await getDb();
  const rows = await db.query<{ point_id: string; exercise_id: string | null }>(
    "SELECT DISTINCT point_id, exercise_id FROM reports WHERE NOT resolved",
  );
  return rows.map((r) => ({ pointId: r.point_id, exerciseId: r.exercise_id }));
}
