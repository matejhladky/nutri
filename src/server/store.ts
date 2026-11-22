import "server-only";
/**
 * Learner data access. Events are the source of truth; point_state is a cache rebuilt per point by replay.
 */
import { z } from "zod";
import { getDb } from "./db";
import { getScheduler } from "@/engine/scheduler";
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
});

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

/** Insert events idempotently, then rebuild the state of every affected point. */
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
    const rows = await db.query<{ payload: StudyEvent }>("SELECT payload FROM events WHERE point_id = $1", [pointId]);
    const st = replay(
      rows.map((r) => r.payload),
      s,
    ).get(pointId);
    if (!st) continue;
    await db.query(
      `INSERT INTO point_state (point_id, state, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (point_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
      [pointId, JSON.stringify(st)],
    );
    out[pointId] = st;
  }
  return out;
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
