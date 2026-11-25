/**
 * Point state reducer. The append-only event log is the source of truth; PointState is a cache
 * that can always be rebuilt with `replay`. The same code runs in the browser (optimistic) and
 * on the server (authoritative).
 */
import { review, type Scheduler } from "./scheduler";
import { dayKey } from "./time";
import { Grade, type PointState, type StudyEvent } from "./types";

/** Bump when PointState's shape or the reducer's logic changes: cached states are then rebuilt from events. */
export const STATE_VERSION = 4;

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
    solved: {},
    recent: [],
    failDay: null,
    failsThatDay: 0,
    lastGrade: null,
    productionGood: 0,
    v: STATE_VERSION,
  };
}

export function applyEvent(
  prev: PointState | undefined,
  ev: StudyEvent,
  s: Scheduler,
): PointState {
  const st: PointState = prev
    ? { ...prev, exerciseCounts: { ...prev.exerciseCounts }, solved: { ...prev.solved }, recent: [...prev.recent] }
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
    if (ev.outcome === "correct" || ev.calcOk) st.solved = { ...st.solved, [ev.exerciseId]: (st.solved?.[ev.exerciseId] ?? 0) + 1 };
  }
  st.recent = [...st.recent, ev.outcome].slice(-5);
  st.lastGrade = ev.grade;
  if (ev.grade === Grade.Good && ev.exerciseType && ev.exerciseType !== "choice") st.productionGood = (st.productionGood ?? 0) + 1;
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

/**
 * Coarse, honest status used by progress views — no percentages.
 *  new       never seen
 *  weak      last answer wrong / "Nevím", or repeated lapses with a recent failure ("potřebuje opakovat")
 *  solid     "naučeno": latest answer Good (unaided — not guessed, no hint), at least ~1 day after first exposure,
 *            in review state; and if the point has a recall/explanation/calculation exercise, at least one Good on
 *            such a production exercise (recognition alone is not enough)
 *  learning  everything in between ("rozpracováno")
 */
export type PointStatus = "new" | "learning" | "weak" | "solid";

const DAY_MS = 20 * 3600_000; // "a day later" with some slack for study times

export function pointStatus(st: PointState | undefined, point?: { exercises: { type: string }[] }): PointStatus {
  if (!st || !st.introducedAt) return "new";
  if (!st.card || st.answers === 0) return "learning";
  const lastTwo = st.recent.slice(-2);
  if (st.lastOutcome === "wrong" || st.lastOutcome === "unknown" || (st.card.lapses >= 2 && lastTwo.includes("wrong"))) {
    return "weak";
  }
  const spaced = !!st.lastAnsweredAt && Date.parse(st.lastAnsweredAt) - Date.parse(st.introducedAt) >= DAY_MS;
  const needsProduction = !!point && point.exercises.some((e) => e.type !== "choice");
  const productionOk = !needsProduction || (st.productionGood ?? 0) >= 1;
  if (st.card.scheduleStatus === "review" && st.card.stability >= 2 && st.lastGrade === Grade.Good && spaced && productionOk) return "solid";
  return "learning";
}
