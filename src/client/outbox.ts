/**
 * Durable client-side queue of study events, one per learner. Events are written here first, then sent to the server.
 * Survives reloads and offline periods; the server insert is idempotent, so re-sending is safe.
 * The queue is keyed by learner and every request names that learner: if the device's session now belongs to the other
 * learner, the server answers 409 and the events stay queued until their own learner signs in here again.
 */
import type { PointState, StudyEvent } from "@/engine/types";
import { LEARNER_HEADER, type LearnerId } from "@/lib/learner";
import { learnerKey } from "./learner-storage";

const key = (learner: LearnerId) => learnerKey("nutri.outbox.v1", learner);

function read(learner: LearnerId): StudyEvent[] {
  try {
    return JSON.parse(localStorage.getItem(key(learner)) ?? "[]") as StudyEvent[];
  } catch {
    return [];
  }
}
function write(learner: LearnerId, evs: StudyEvent[]) {
  try {
    localStorage.setItem(key(learner), JSON.stringify(evs));
  } catch {
    /* storage full / unavailable — events stay in memory only for this flush */
  }
}

export const pendingEvents = (learner: LearnerId): StudyEvent[] => read(learner);

export function enqueue(learner: LearnerId, ev: StudyEvent) {
  write(learner, [...read(learner), ev]);
}

export class UnauthorizedError extends Error {}
/** The session on this device now belongs to the other learner (signed in from another tab). */
export class LearnerChangedError extends Error {}

/** fetch() for the API on behalf of one learner; maps 401 / 409 to the errors above. */
export async function apiFetch(learner: LearnerId, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set(LEARNER_HEADER, learner);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) throw new UnauthorizedError();
  if (res.status === 409) throw new LearnerChangedError();
  return res;
}

const REJECTED_KEY = "nutri.rejected.v1";
function keepRejected(items: { event: StudyEvent | undefined; error: string }[]) {
  console.warn("Server rejected study events", items);
  try {
    const prev = JSON.parse(localStorage.getItem(REJECTED_KEY) ?? "[]") as unknown[];
    localStorage.setItem(REJECTED_KEY, JSON.stringify([...prev, ...items].slice(-50)));
  } catch {
    /* diagnostics only */
  }
}

const inflight = new Map<LearnerId, Promise<Record<string, PointState>>>();

/** Send all of this learner's pending events. Resolves with authoritative states for affected points. */
export function flush(learner: LearnerId): Promise<Record<string, PointState>> {
  const running = inflight.get(learner);
  if (running) return running.then(() => flush(learner));
  const p = (async () => {
    const out: Record<string, PointState> = {};
    for (;;) {
      const batch = read(learner).slice(0, 100);
      if (!batch.length) return out;
      const res = await apiFetch(learner, "/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: batch }),
      });
      if (!res.ok) throw new Error(`events ${res.status}`);
      const { states, rejected = [] } = (await res.json()) as { states: Record<string, PointState>; rejected?: { index: number; error: string }[] };
      Object.assign(out, states);
      // Every event in the batch is settled: stored, or rejected as invalid (kept aside for diagnosis, not retried).
      if (rejected.length) keepRejected(rejected.map((r) => ({ event: batch[r.index], error: r.error })));
      const sent = new Set(batch.map((e) => e.id));
      write(learner, read(learner).filter((e) => !sent.has(e.id)));
    }
  })().finally(() => inflight.delete(learner));
  inflight.set(learner, p);
  return p;
}
