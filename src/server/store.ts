import "server-only";
/**
 * Learner data access. Events are the source of truth; point_state is a cache rebuilt per point by replay.
 * Every function is scoped to one learner: no query reads or writes another learner's rows.
 */
import { z } from "zod";
import { getDb, type Db } from "./db";
import { getScheduler, type Scheduler } from "@/engine/scheduler";
import { replay, STATE_VERSION } from "@/engine/state";
import { dayDiff, dayKey } from "@/engine/time";
import type { PointState, StudyEvent } from "@/engine/types";
import type { Timing } from "@/engine/planner";
import type { LearnerId } from "@/lib/learner";

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
          z.object({ type: z.literal("given") }),
          z.object({ type: z.literal("numeric"), value: z.string().max(50), hint: z.boolean().optional() }),
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
  exerciseType: z.enum(["choice", "reveal", "explain", "numeric", "case"]).optional(),
  outcome: z.enum(["correct", "partial", "wrong", "unknown"]).optional(),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  hintUsed: z.boolean().optional(),
  response: ResponseSchema.optional(),
  durationMs: z.number().int().nonnegative().max(86_400_000).optional(),
  extra: z.boolean().optional(),
  calcOk: z.boolean().optional(),
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

export async function getAllStates(learner: LearnerId): Promise<Record<string, PointState>> {
  const db = await getDb();
  const rows = await db.query<{ point_id: string; state: PointState }>("SELECT point_id, state FROM point_state WHERE learner_id = $1", [
    learner,
  ]);
  const out: Record<string, PointState> = {};
  let s: Scheduler | null = null;
  for (const r of rows) {
    if (r.state.v === STATE_VERSION) out[r.point_id] = r.state;
    else {
      // Produced by an older reducer: rebuild from the event log (the source of truth) and re-cache.
      s ??= await getScheduler();
      const st = await rebuildPoint(db, s, learner, r.point_id);
      if (st) out[r.point_id] = st;
    }
  }
  return out;
}

/**
 * Insert events idempotently, then rebuild the cached state of every affected point. An id that already exists is
 * ignored — also when it belongs to the other learner, whose log therefore can never be changed from here.
 */
export async function addEvents(learner: LearnerId, events: StudyEvent[]): Promise<Record<string, PointState>> {
  const db = await getDb();
  for (const ev of events) {
    await db.query(
      "INSERT INTO events (id, learner_id, point_id, at, payload) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
      [ev.id, learner, ev.pointId, ev.at, JSON.stringify(ev)],
    );
  }
  const s = await getScheduler();
  const out: Record<string, PointState> = {};
  for (const pointId of new Set(events.map((e) => e.pointId))) {
    const st = await rebuildPoint(db, s, learner, pointId);
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
export async function rebuildPoint(db: Db, s: Scheduler, learner: LearnerId, pointId: string): Promise<PointState | undefined> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const cur = await db.query<{ version: number }>("SELECT version FROM point_state WHERE learner_id = $1 AND point_id = $2", [
      learner,
      pointId,
    ]);
    const rows = await db.query<{ payload: StudyEvent }>("SELECT payload FROM events WHERE learner_id = $1 AND point_id = $2", [
      learner,
      pointId,
    ]);
    const st = replay(
      rows.map((r) => r.payload),
      s,
    ).get(pointId);
    if (!st) return undefined;
    const json = JSON.stringify(st);
    const written = cur.length
      ? await db.query(
          `UPDATE point_state SET state = $3, version = version + 1, updated_at = now()
           WHERE learner_id = $1 AND point_id = $2 AND version = $4 RETURNING point_id`,
          [learner, pointId, json, cur[0].version],
        )
      : await db.query(
          `INSERT INTO point_state (learner_id, point_id, state, version, updated_at) VALUES ($1, $2, $3, 1, now())
           ON CONFLICT (learner_id, point_id) DO NOTHING RETURNING point_id`,
          [learner, pointId, json],
        );
    if (written.length) return st;
    // Lost the race: back off with jitter so concurrent writers don't retry in lock-step.
    await new Promise((r) => setTimeout(r, 5 + Math.random() * 20 * (attempt + 1)));
  }
  throw new Error(`point_state for ${pointId}: too many concurrent updates`);
}

/**
 * Her observed timing (median minutes per exercise type, from answer durations) and review success rate, for
 * calibrating the planner's time budget. Only types with enough samples are returned; the planner falls back to its
 * model defaults otherwise — observed data is kept separate from model assumptions.
 */
export async function getObservedTiming(
  learner: LearnerId,
  typeOf: (pointId: string, exerciseId: string) => string | undefined,
  from?: Db,
): Promise<Timing> {
  const db = from ?? (await getDb());
  const rows = await db.query<{ payload: StudyEvent }>(
    "SELECT payload FROM events WHERE learner_id = $1 AND payload->>'kind' = 'answer' ORDER BY at DESC LIMIT 400",
    [learner],
  );
  const byType = new Map<string, number[]>();
  let reviews = 0;
  let ok = 0;
  for (const { payload: e } of rows) {
    const type = e.exerciseId ? typeOf(e.pointId, e.exerciseId) : undefined;
    // Ignore walk-aways (> 10 min) — they are pauses, not answering time.
    if (type && e.durationMs && e.durationMs < 600_000) byType.set(type, [...(byType.get(type) ?? []), e.durationMs / 60_000]);
    if (e.outcome && e.outcome !== "unknown") {
      reviews++;
      if (e.outcome === "correct") ok++;
    }
  }
  const out: Timing = {};
  for (const [type, xs] of byType) {
    if (xs.length < 8) continue;
    const sorted = [...xs].sort((a, b) => a - b);
    (out as Record<string, number>)[type] = Math.round(sorted[Math.floor(sorted.length / 2)] * 100) / 100;
  }
  if (reviews >= 30) out.successRate = Math.round((ok / reviews) * 100) / 100;
  return out;
}

/**
 * Answers per study day (04:00–04:00 Europe/Prague) for the last `days` study days including today, from the event
 * log, any device. Intros are not answers; each stored event counts once (ids are unique, re-sends are ignored).
 * Days without answers are omitted.
 */
export async function getAnswersByDay(learner: LearnerId, now = new Date(), days = 14, from?: Db): Promise<Record<string, number>> {
  const db = from ?? (await getDb());
  const rows = await db.query<{ at: string | Date }>(
    "SELECT at FROM events WHERE learner_id = $1 AND payload->>'kind' = 'answer' AND at > $2",
    [learner, new Date(now.getTime() - (days + 1) * 86400_000).toISOString()],
  );
  const today = dayKey(now);
  const out: Record<string, number> = {};
  for (const r of rows) {
    const d = dayKey(new Date(r.at));
    const ago = dayDiff(d, today);
    if (ago >= 0 && ago < days) out[d] = (out[d] ?? 0) + 1;
  }
  return out;
}

/** Answers given today (study day) after the plan was already complete — "nad plán". */
export async function getExtraAnswersToday(learner: LearnerId, now = new Date(), from?: Db): Promise<number> {
  const db = from ?? (await getDb());
  const rows = await db.query<{ at: string | Date }>(
    "SELECT at FROM events WHERE learner_id = $1 AND payload->>'kind' = 'answer' AND payload->>'extra' = 'true' AND at > $2",
    [learner, new Date(now.getTime() - 30 * 3600_000).toISOString()],
  );
  const today = dayKey(now);
  return rows.filter((r) => dayKey(new Date(r.at)) === today).length;
}

/** Maintenance: rebuild every cached point state from the event log (the source of truth). */
export async function rebuildAllStates(): Promise<number> {
  const db = await getDb();
  const s = await getScheduler();
  const ids = await db.query<{ learner_id: LearnerId; point_id: string }>("SELECT DISTINCT learner_id, point_id FROM events");
  for (const { learner_id, point_id } of ids) await rebuildPoint(db, s, learner_id, point_id);
  return ids.length;
}

const settingsKey = (learner: LearnerId) => `learner:${learner}`;

export async function getSettings(learner: LearnerId, from?: Db): Promise<Settings> {
  const db = from ?? (await getDb());
  const rows = await db.query<{ value: Settings }>("SELECT value FROM settings WHERE key = $1", [settingsKey(learner)]);
  const parsed = SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(rows[0]?.value ?? {}) });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(learner: LearnerId, patch: Partial<Settings>): Promise<Settings> {
  const next = SettingsSchema.parse({ ...(await getSettings(learner)), ...patch });
  const db = await getDb();
  await db.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [settingsKey(learner), JSON.stringify(next)],
  );
  return next;
}

export type OpenReport = { pointId: string; exerciseId: string | null };

export async function addReport(learner: LearnerId, r: { pointId: string; exerciseId: string | null; message: string }): Promise<void> {
  const db = await getDb();
  await db.query("INSERT INTO reports (learner_id, point_id, exercise_id, message) VALUES ($1, $2, $3, $4)", [
    learner,
    r.pointId,
    r.exerciseId,
    r.message,
  ]);
}

/** Items this learner reported (hidden for her only; the other learner still sees them). */
export async function openReports(learner: LearnerId): Promise<OpenReport[]> {
  const db = await getDb();
  const rows = await db.query<{ point_id: string; exercise_id: string | null }>(
    "SELECT DISTINCT point_id, exercise_id FROM reports WHERE learner_id = $1 AND NOT resolved",
    [learner],
  );
  return rows.map((r) => ({ pointId: r.point_id, exerciseId: r.exercise_id }));
}

/**
 * Point states for reading only (admin): cached rows, and any written by an older reducer replayed in memory from the
 * event log — nothing is written back.
 */
export async function readStates(learner: LearnerId, db: Db): Promise<Record<string, PointState>> {
  const rows = await db.query<{ point_id: string; state: PointState }>("SELECT point_id, state FROM point_state WHERE learner_id = $1", [
    learner,
  ]);
  const out: Record<string, PointState> = {};
  const stale: string[] = [];
  for (const r of rows) {
    if (r.state.v === STATE_VERSION) out[r.point_id] = r.state;
    else stale.push(r.point_id);
  }
  if (stale.length) {
    const evs = await db.query<{ payload: StudyEvent }>("SELECT payload FROM events WHERE learner_id = $1 AND point_id = ANY($2)", [learner, stale]);
    const replayed = replay(
      evs.map((e) => e.payload),
      await getScheduler(),
    );
    for (const id of stale) {
      const st = replayed.get(id);
      if (st) out[id] = st;
    }
  }
  return out;
}

export type ReportRow = { id: number; pointId: string; exerciseId: string | null; message: string; createdAt: string; resolved: boolean };

/** All of a learner's reports, newest first (admin). */
export async function listReports(learner: LearnerId, db: Db): Promise<ReportRow[]> {
  const rows = await db.query<{ id: number; point_id: string; exercise_id: string | null; message: string; created_at: string | Date; resolved: boolean }>(
    "SELECT id, point_id, exercise_id, message, created_at, resolved FROM reports WHERE learner_id = $1 ORDER BY created_at DESC",
    [learner],
  );
  return rows.map((r) => ({
    id: r.id,
    pointId: r.point_id,
    exerciseId: r.exercise_id,
    message: r.message,
    createdAt: new Date(r.created_at).toISOString(),
    resolved: r.resolved,
  }));
}
