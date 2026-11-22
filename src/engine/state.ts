/**
 * Point state reducer. The append-only event log is the source of truth; PointState is a cache
 * that can always be rebuilt with `replay`. The same code runs in the browser (optimistic) and
 * on the server (authoritative).
 */
import { review, type Scheduler } from "./scheduler";
import { dayKey } from "./time";
import type { PointState, StudyEvent } from "./types";

/** Bump when PointState's shape or the reducer's logic changes: cached states are then rebuilt from events. */
export const STATE_VERSION = 2;

export function emptyState(pointId: string): PointState {
  return {
    pointId,
    introducedAt: null,
    card: null,
    answers: 0,
    correct: 0,
    lastOutcome: null,
    lastAnsweredAt: null,
    lastExerciseId: null,
    exerciseCounts: {},
    recent: [],
    failDay: null,
    failsThatDay: 0,
    v: STATE_VERSION,
  };
}

export function applyEvent(
  prev: PointState | undefined,
  ev: StudyEvent,
  s: Scheduler,
): PointState {
  const st: PointState = prev
    ? { ...prev, exerciseCounts: { ...prev.exerciseCounts }, recent: [...prev.recent] }
    : emptyState(ev.pointId);

  st.v = STATE_VERSION;
  if (ev.kind === "intro") {
    st.introducedAt ??= ev.at;
    return st;
  }

  // Answer without a prior intro (e.g. practice from the library) also counts as introduction.
  st.introducedAt ??= ev.at;
  if (!ev.grade || !ev.outcome) throw new Error(`answer event ${ev.id} lacks grade/outcome`);
  st.card = review(s, st.card, ev.grade, new Date(ev.at));
  st.answers += 1;
  if (ev.outcome === "correct") st.correct += 1;
  st.lastOutcome = ev.outcome;
  st.lastAnsweredAt = ev.at;
  if (ev.exerciseId) {
    st.lastExerciseId = ev.exerciseId;
    st.exerciseCounts[ev.exerciseId] = (st.exerciseCounts[ev.exerciseId] ?? 0) + 1;
  }
  st.recent = [...st.recent, ev.outcome].slice(-5);
  if (ev.outcome === "wrong" || ev.outcome === "unknown") {
    const d = dayKey(ev.at);
    st.failsThatDay = st.failDay === d ? (st.failsThatDay ?? 0) + 1 : 1;
    st.failDay = d;
  }
  return st;
}

/** Rebuild all point states from events (sorted by time, then id for determinism). */
export function replay(events: StudyEvent[], s: Scheduler): Map<string, PointState> {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const states = new Map<string, PointState>();
  for (const ev of sorted) states.set(ev.pointId, applyEvent(states.get(ev.pointId), ev, s));
  return states;
}

/** Coarse, honest status used by progress views — no percentages. */
export type PointStatus = "new" | "learning" | "weak" | "solid";

export function pointStatus(st: PointState | undefined): PointStatus {
  if (!st || !st.introducedAt) return "new";
  if (!st.card || st.answers === 0) return "learning";
  const lastTwo = st.recent.slice(-2);
  if (st.lastOutcome === "wrong" || st.lastOutcome === "unknown" || (st.card.lapses >= 2 && lastTwo.includes("wrong"))) {
    return "weak";
  }
  // "solid" = recalled successfully after at least a one-day gap.
  if (st.card.scheduleStatus === "review" && st.card.stability >= 2 && st.lastOutcome === "correct") return "solid";
  return "learning";
}
