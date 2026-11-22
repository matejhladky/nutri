/**
 * Rebuild every cached point state from the event log (the source of truth).
 * Use after a crash mid-write, a scheduler change, or whenever the cache is in doubt.
 *   pnpm db:rebuild            (uses DATABASE_URL, or PGLITE_DIR / .pglite locally)
 */
import { rebuildAllStates } from "../src/server/store";

const n = await rebuildAllStates();
console.log(`Rebuilt ${n} point state(s) from the event log.`);
process.exit(0); // the embedded DB keeps the event loop alive
