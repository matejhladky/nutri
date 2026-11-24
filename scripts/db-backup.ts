/**
 * Export every table to backups/nutri-<timestamp>.json (gitignored) WITHOUT touching the schema — run it before a
 * deployment that migrates. Reads DATABASE_URL (Neon), or the local PGlite directory (PGLITE_DIR / .pglite).
 *   DATABASE_URL='postgres://…' pnpm db:backup
 */
import { mkdirSync, writeFileSync } from "node:fs";

type Query = (text: string) => Promise<Record<string, unknown>[]>;

let query: Query;
let close = async () => {};
if (process.env.DATABASE_URL) {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);
  query = async (text) => (await sql.query(text)) as Record<string, unknown>[];
} else {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(process.env.PGLITE_DIR ?? ".pglite");
  query = async (text) => (await pg.query<Record<string, unknown>>(text)).rows;
  close = () => pg.close();
}

const tables = (await query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY 1")).map(
  (r) => String(r.table_name),
);
const dump: Record<string, unknown[]> = {};
for (const t of tables) dump[t] = await query(`SELECT * FROM "${t}"`);
await close();

mkdirSync("backups", { recursive: true });
const file = `backups/nutri-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify({ exportedAt: new Date().toISOString(), tables: dump }, null, 1));
console.log(`${file}: ${tables.map((t) => `${t} ${dump[t].length}`).join(", ")}`);
