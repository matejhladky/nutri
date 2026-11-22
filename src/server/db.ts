import "server-only";
/**
 * Minimal SQL adapter. Neon (serverless HTTP) when DATABASE_URL is set, otherwise embedded PGlite
 * persisted in PGLITE_DIR (default .pglite/). Schema is created idempotently on first use.
 */
export type Db = { query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]> };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS events (
     id TEXT PRIMARY KEY,
     point_id TEXT NOT NULL,
     at TIMESTAMPTZ NOT NULL,
     payload JSONB NOT NULL,
     received_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS events_point_idx ON events (point_id, at)`,
  `CREATE TABLE IF NOT EXISTS point_state (
     point_id TEXT PRIMARY KEY,
     state JSONB NOT NULL,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS reports (
     id SERIAL PRIMARY KEY,
     point_id TEXT NOT NULL,
     exercise_id TEXT,
     message TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     resolved BOOLEAN NOT NULL DEFAULT false
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value JSONB NOT NULL
   )`,
];

const g = globalThis as unknown as { __nutriDb?: Promise<Db> };

async function create(): Promise<Db> {
  let db: Db;
  if (process.env.DATABASE_URL) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL);
    db = { query: async (text, params = []) => (await sql.query(text, params)) as never };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite(process.env.PGLITE_DIR ?? ".pglite");
    await pg.waitReady;
    db = { query: async (text, params = []) => (await pg.query(text, params)).rows as never };
  }
  for (const stmt of SCHEMA) await db.query(stmt);
  return db;
}

export function getDb(): Promise<Db> {
  g.__nutriDb ??= create().catch((e) => {
    g.__nutriDb = undefined;
    throw e;
  });
  return g.__nutriDb;
}
