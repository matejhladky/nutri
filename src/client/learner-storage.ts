/**
 * Browser-local learner data (outbox, study session, practice ticks) is kept under per-learner keys, so switching
 * accounts on one device never mixes them. Keys from the single-learner version (no suffix) belonged to learner l1:
 * they are moved to her keys the first time she loads the app, and ignored for anyone else.
 */
import type { LearnerId } from "@/lib/learner";

export const learnerKey = (base: string, learner: LearnerId) => `${base}.${learner}`;

const LEGACY = ["nutri.outbox.v1", "nutri.session.v1", "nutri.priprava.v1"];

export function adoptLegacyStorage(learner: LearnerId) {
  if (learner !== "l1") return;
  try {
    for (const base of LEGACY) {
      const old = localStorage.getItem(base);
      if (old === null) continue;
      const k = learnerKey(base, learner);
      if (localStorage.getItem(k) === null) localStorage.setItem(k, old);
      localStorage.removeItem(base);
    }
  } catch {
    /* storage unavailable */
  }
}
