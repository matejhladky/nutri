import "server-only";
/**
 * Minimal SQL adapter. Neon (serverless HTTP) when DATABASE_URL is set, otherwise embedded PGlite
 * persisted in PGLITE_DIR (default .pglite/). Schema is created idempotently on first use.
 */
export type Db = { query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]> };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS events (
     id TEXT PRIMARY KEY,
     learner_id TEXT NOT NULL,
     point_id TEXT NOT NULL,
     at TIMESTAMPTZ NOT NULL,
     payload JSONB NOT NULL,
     received_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS point_state (
     learner_id TEXT NOT NULL,
     point_id TEXT NOT NULL,
     state JSONB NOT NULL,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (learner_id, point_id)
   )`,
  // Optimistic-concurrency version for the point_state cache (see store.ts rebuildPoint).
  `ALTER TABLE point_state ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS reports (
     id SERIAL PRIMARY KEY,
     learner_id TEXT NOT NULL,
     point_id TEXT NOT NULL,
     exercise_id TEXT,
     message TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     resolved BOOLEAN NOT NULL DEFAULT false
   )`,
  // Per-learner settings live under the key 'learner:<id>'.
  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value JSONB NOT NULL
   )`,
  /*
   * Migration from the single-learner schema: everything recorded so far belongs to learner l1 (Lucka); l2 starts
   * empty. One statement = one transaction, so it applies completely or not at all; the advisory lock serialises
   * concurrent cold starts and each step is skipped once done. The temporary column default only back-fills existing
   * rows and is dropped at once, so a future insert without a learner fails loudly instead of landing in l1.
   */
  `DO $$
   BEGIN
     PERFORM pg_advisory_xact_lock(694200421);
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema() AND table_name = 'events' AND column_name = 'learner_id') THEN
       ALTER TABLE events ADD COLUMN learner_id TEXT NOT NULL DEFAULT 'l1';
       ALTER TABLE events ALTER COLUMN learner_id DROP DEFAULT;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema() AND table_name = 'point_state' AND column_name = 'learner_id') THEN
       ALTER TABLE point_state ADD COLUMN learner_id TEXT NOT NULL DEFAULT 'l1';
       ALTER TABLE point_state ALTER COLUMN learner_id DROP DEFAULT;
       ALTER TABLE point_state DROP CONSTRAINT point_state_pkey;
       ALTER TABLE point_state ADD PRIMARY KEY (learner_id, point_id);
     END IF;
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema() AND table_name = 'reports' AND column_name = 'learner_id') THEN
       ALTER TABLE reports ADD COLUMN learner_id TEXT NOT NULL DEFAULT 'l1';
       ALTER TABLE reports ALTER COLUMN learner_id DROP DEFAULT;
     END IF;
     IF EXISTS (SELECT 1 FROM settings WHERE key = 'learner') AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'learner:l1') THEN
       UPDATE settings SET key = 'learner:l1' WHERE key = 'learner';
     END IF;
   END $$`,
  `DROP INDEX IF EXISTS events_point_idx`,
  `CREATE INDEX IF NOT EXISTS events_learner_point_idx ON events (learner_id, point_id, at)`,
];

/** Create the schema and migrate an older one (idempotent). */
export async function applySchema(db: Db): Promise<void> {
  for (const stmt of SCHEMA) await db.query(stmt);
}

const g = globalThis as unknown as { __nutriDb?: Promise<Db> };

async function create(): Promise<Db> {
  let db: Db;
  if (process.env.DATABASE_URL) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL);
    db = { query: async (text, params = []) => (await sql.query(text, params)) as never };
  } else {
    // Serverless hosts have a read-only, per-instance filesystem: an embedded DB there would lose data silently.
    if (process.env.VERCEL) throw new Error("DATABASE_URL is not set (required on Vercel; PGlite is for local use only).");
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite(process.env.PGLITE_DIR ?? ".pglite");
    await pg.waitReady;
    db = { query: async (text, params = []) => (await pg.query(text, params)).rows as never };
  }
  await applySchema(db);
  return db;
}

/**
 * A view of the database that can only read: any statement other than a single plain SELECT is refused before it
 * reaches the server. The admin area uses nothing else.
 */
export function readOnly(db: Db): Db {
  return {
    query: (text, params) => {
      const sql = text.trim();
      if (!/^select\b/i.test(sql) || sql.replace(/;\s*$/, "").includes(";")) {
        return Promise.reject(new Error("read-only database: only a single SELECT is allowed"));
      }
      return db.query(text, params);
    },
  };
}

export function getDb(): Promise<Db> {
  g.__nutriDb ??= create().catch((e) => {
    g.__nutriDb = undefined;
    throw e;
  });
  return g.__nutriDb;
}
