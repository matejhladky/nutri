/**
 * Durable client-side queue of study events. Events are written here first, then sent to the server.
 * Survives reloads and offline periods; the server insert is idempotent, so re-sending is safe.
 */
import type { PointState, StudyEvent } from "@/engine/types";

const KEY = "nutri.outbox.v1";

function read(): StudyEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as StudyEvent[];
  } catch {
    return [];
  }
}
function write(evs: StudyEvent[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(evs));
  } catch {
    /* storage full / unavailable — events stay in memory only for this flush */
  }
}

export const pendingEvents = (): StudyEvent[] => read();

export function enqueue(ev: StudyEvent) {
  write([...read(), ev]);
}

export class UnauthorizedError extends Error {}

let inflight: Promise<Record<string, PointState>> | null = null;

/** Send all pending events. Resolves with authoritative states for affected points. */
export function flush(): Promise<Record<string, PointState>> {
  if (inflight) return inflight.then(() => flush());
  inflight = (async () => {
    const out: Record<string, PointState> = {};
    for (;;) {
      const batch = read().slice(0, 100);
      if (!batch.length) return out;
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: batch }),
      });
      if (res.status === 401) throw new UnauthorizedError();
      if (!res.ok) throw new Error(`events ${res.status}`);
      const { states } = (await res.json()) as { states: Record<string, PointState> };
      Object.assign(out, states);
      const sent = new Set(batch.map((e) => e.id));
      write(read().filter((e) => !sent.has(e.id)));
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
