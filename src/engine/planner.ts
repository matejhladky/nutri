/**
 * Study planner: decides WHAT to show next. Pure and deterministic.
 *
 * Priorities (docs/architecture.md):
 *  1. learning steps that are due (incl. first retrieval of a just-introduced point)
 *  2. due reviews (lowest retrievability first) interleaved with
 *  3. new points — chosen for breadth across official criteria (the written test requires ≥ 50 % per criterion),
 *     paced so all tier A/B points are introduced 2 days before the exam
 * Consecutive cards avoid the same topic when an alternative exists; confusable partners are introduced close together.
 */
import type { PointWithTopic, Exercise } from "@/content/schema";
import type { PointState } from "./types";
import { dayKey, daysUntilExam } from "./time";

export type SessionItem = { pointId: string; kind: "intro" | "exercise"; isNew: boolean };

export type PlannerInput = {
  now: Date;
  examDate: string | null;
  points: PointWithTopic[];
  states: Map<string, PointState>;
  /** Cards shown in the current session, oldest first. */
  session: SessionItem[];
  mode: { kind: "daily" } | { kind: "topic"; topicId: string };
  /** Learner chose "Pokračovat" after the daily goal. */
  beyondGoal: boolean;
  dailyMinutes: number;
  retrievability: (st: PointState, now: Date) => number;
};

export type NextCard =
  | { kind: "intro"; pointId: string }
  | { kind: "exercise"; pointId: string; exerciseId: string; reason: "learning" | "review" | "new" | "practice" }
  /** wait = nothing is due right now, but a learning step / first retrieval becomes due later today (at nextAt). */
  | { kind: "done"; reason: "goal-reached" | "nothing-left" | "wait"; nextAt?: string };

export type DailyPlan = {
  daysLeft: number | null;
  dueReviews: number;
  /** First retrievals and learning steps due NOW. */
  learningDue: number;
  /** Learning steps / first retrievals scheduled for later today (not part of "now"). */
  laterToday: number;
  /** When the earliest of those becomes due (ISO), if any. */
  nextLaterAt: string | null;
  newTarget: number;
  newToday: number;
  remainingNew: number;
  estimatedMinutes: number;
  goalReached: boolean;
};

/** First retrieval after an intro: at least this many other cards AND this much time in between. */
export const INTRO_GAP = 3;
export const FIRST_RETRIEVAL_DELAY_MS = 2 * 60_000;
/**
 * Deliberate extra practice (topic practice, pre-exam sweep) never touches points still in a learning step and
 * never repeats a point answered within this window — scheduled spacing is not short-circuited.
 */
export const PRACTICE_MIN_GAP_MS = 60 * 60_000;
const MIN_PER_REVIEW = 0.5;
const MIN_PER_NEW = 1.5;
const TIER_WEIGHT = { A: 1, B: 0.4, C: 0 } as const;
const CONTRAST_BONUS = 1.2;

const isIntroduced = (st: PointState | undefined) => !!st?.introducedAt;
const MIN_PER_CASE = 3;
const isCasePoint = (p: PointWithTopic) => p.exercises.every((e) => e.type === "case" || e.type === "explain") && p.exercises.some((e) => e.type === "case");
const reviewMinutes = (p: PointWithTopic) => (isCasePoint(p) ? MIN_PER_CASE : MIN_PER_REVIEW);

function eligibleForDaily(p: PointWithTopic) {
  return p.tier !== "C";
}

/** Daily goal: due reviews + paced number of new points. */
export function dailyPlan(input: Omit<PlannerInput, "session" | "mode" | "beyondGoal" | "retrievability">): DailyPlan {
  const { now, examDate, points, states, dailyMinutes } = input;
  const today = dayKey(now);
  let dueReviews = 0;
  let learningDue = 0;
  // Minutes rather than counts: a client case takes several minutes, a flashcard half a minute.
  let dueMinutes = 0;
  let laterToday = 0;
  let nextLater: number | null = null;
  let startLoadMinutes = 0;
  let newToday = 0;
  let remainingA = 0;
  let remainingB = 0;
  for (const p of points) {
    const st = states.get(p.id);
    const introducedToday = !!st?.introducedAt && dayKey(st.introducedAt) === today;
    if (introducedToday) newToday++;
    if (!eligibleForDaily(p)) continue;
    if (!isIntroduced(st)) {
      if (p.tier === "A") remainingA++;
      else remainingB++;
      continue;
    }
    const shortStep = st?.card && (st.card.scheduleStatus === "learning" || st.card.scheduleStatus === "relearning");
    if (!st?.card || (shortStep && dayKey(st.card.dueAt) <= today)) {
      const dueAt = st?.card ? Date.parse(st.card.dueAt) : Date.parse(st!.introducedAt!) + FIRST_RETRIEVAL_DELAY_MS;
      if (dueAt <= now.getTime()) learningDue++;
      else {
        laterToday++;
        if (nextLater === null || dueAt < nextLater) nextLater = dueAt;
      }
      dueMinutes += reviewMinutes(p);
      continue;
    }
    if (introducedToday) continue;
    if (dayKey(st.card.dueAt) <= today) {
      dueReviews++;
      dueMinutes += reviewMinutes(p);
      startLoadMinutes += reviewMinutes(p);
    } else if (st?.lastAnsweredAt && dayKey(st.lastAnsweredAt) === today) {
      startLoadMinutes += reviewMinutes(p);
    }
  }
  const daysLeft = examDate ? daysUntilExam(now, examDate) : null;
  const remainingNew = remainingA + remainingB;
  // Pace against the remaining study days, reserving the last 2 days for review only.
  let paceTarget: number;
  if (daysLeft === null) paceTarget = Math.ceil((remainingNew + newToday) / 14);
  else if (daysLeft > 2) paceTarget = Math.ceil((remainingNew + newToday) / (daysLeft - 2));
  else paceTarget = newToday + remainingA; // final days: only tier A still missing
  // Budget uses the review load at the START of the day, so finishing reviews doesn't unlock extra new points.
  const budgetTarget = Math.max(10, Math.floor((dailyMinutes - startLoadMinutes) / MIN_PER_NEW));
  const newTarget = Math.max(0, Math.min(paceTarget, budgetTarget));
  const estimatedMinutes = Math.round(dueMinutes + Math.max(0, newTarget - newToday) * MIN_PER_NEW);
  return {
    daysLeft,
    dueReviews,
    learningDue,
    laterToday,
    nextLaterAt: nextLater === null ? null : new Date(nextLater).toISOString(),
    newTarget,
    newToday,
    remainingNew,
    estimatedMinutes,
    goalReached: dueReviews === 0 && learningDue === 0 && newToday >= newTarget,
  };
}

export function nextCard(input: PlannerInput): NextCard {
  const { now, points, states, session, mode } = input;
  const today = dayKey(now);
  const inScope = mode.kind === "topic" ? points.filter((p) => p.topicId === mode.topicId) : points.filter(eligibleForDaily);
  const byId = new Map(points.map((p) => [p.id, p]));
  const last = session.at(-1);
  const lastTopic = last ? byId.get(last.pointId)?.topicId : undefined;
  const introIndex = new Map<string, number>();
  session.forEach((s, i) => s.kind === "intro" && introIndex.set(s.pointId, i));

  // ---- classify introduced points ----
  type Cand = { p: PointWithTopic; st: PointState; due: number };
  const learningReady: Cand[] = []; // short step due now, or first retrieval after the intro gap
  const learningPending: Cand[] = []; // due later today / intro too recent
  const reviews: Cand[] = [];
  for (const p of inScope) {
    const st = states.get(p.id);
    if (!st?.introducedAt) continue;
    if (!st.card) {
      const idx = introIndex.get(p.id);
      const due = Date.parse(st.introducedAt) + FIRST_RETRIEVAL_DELAY_MS;
      const ready = (idx === undefined || session.length - 1 - idx >= INTRO_GAP) && due <= now.getTime();
      (ready ? learningReady : learningPending).push({ p, st, due });
      continue;
    }
    if (dayKey(st.card.dueAt) > today) continue;
    const due = Date.parse(st.card.dueAt);
    const shortStep = st.card.scheduleStatus === "learning" || st.card.scheduleStatus === "relearning";
    if (!shortStep) reviews.push({ p, st, due });
    else (due <= now.getTime() ? learningReady : learningPending).push({ p, st, due });
  }
  const earliest = (xs: Cand[]) => [...xs].sort((a, b) => a.due - b.due)[0];
  const notJustShown = (xs: Cand[]) => xs.filter((c) => c.p.id !== last?.pointId);

  // ---- 1. learning steps ----
  // Ready = genuinely due (time-based), so the last card may repeat if it is the only one; otherwise prefer variety.
  const learnPool = notJustShown(learningReady).length ? notJustShown(learningReady) : learningReady;
  if (learnPool.length) {
    const c = earliest(learnPool);
    return exercise(c.p, c.st, "learning");
  }

  // ---- 2./3. reviews interleaved with new points ----
  const plan = dailyPlan(input);
  // In the final two days "continue" means the sweep below, not more new material.
  const finalDays = plan.daysLeft !== null && plan.daysLeft <= 2;
  const newAllowed = mode.kind === "topic" || (input.beyondGoal && !finalDays) || plan.newToday < plan.newTarget;
  const newCand = newAllowed ? pickNew(inScope, states, lastTopic, mode.kind === "topic") : null;
  const sortedReviews = notJustShown(reviews).sort(
    (a, b) => input.retrievability(a.st, now) - input.retrievability(b.st, now) || a.due - b.due,
  );
  const reviewPick = sortedReviews.find((c) => c.p.topicId !== lastTopic) ?? sortedReviews[0];

  if (reviewPick && newCand) {
    // Roughly one new point per k reviews, k = due reviews / new points still planned today.
    const newRemaining = Math.max(1, plan.newTarget - plan.newToday);
    const k = Math.max(1, Math.round(reviews.length / newRemaining));
    return cardsSinceLastNew(session) >= k ? { kind: "intro", pointId: newCand.id } : exercise(reviewPick.p, reviewPick.st, "review");
  }
  if (reviewPick) return exercise(reviewPick.p, reviewPick.st, "review");
  if (newCand) return { kind: "intro", pointId: newCand.id };

  // ---- 4. deliberate extra practice (only on request: topic practice / "continue" after the goal) ----
  // Never a point in a learning step (its next retrieval is scheduled) nor one answered within the last hour.
  if (mode.kind === "topic") {
    const practice = practiceCandidates(inScope, states, now).sort(
      (a, b) => input.retrievability(a.st, now) - input.retrievability(b.st, now),
    );
    if (practice.length) return exercise(practice[0].p, practice[0].st, "practice");
  } else if (input.beyondGoal) {
    const sweep = sweepPick(input, inScope, states);
    if (sweep) return exercise(sweep.p, sweep.st, "practice");
  }

  // ---- 5. natural stopping point; say when the next scheduled step is due if that is still today ----
  if (learningPending.length) return { kind: "done", reason: "wait", nextAt: new Date(earliest(learningPending).due).toISOString() };
  if (mode.kind === "topic") return { kind: "done", reason: "nothing-left" };
  return { kind: "done", reason: plan.remainingNew === 0 && !anyIntroduced(inScope, states) ? "nothing-left" : "goal-reached" };
}

/** Points eligible for deliberate extra practice: past their learning steps, not answered within PRACTICE_MIN_GAP_MS. */
function practiceCandidates(inScope: PointWithTopic[], states: Map<string, PointState>, now: Date) {
  return inScope
    .map((p) => ({ p, st: states.get(p.id) }))
    .filter(
      (x): x is { p: PointWithTopic; st: PointState } =>
        !!x.st?.card &&
        x.st.card.scheduleStatus === "review" &&
        (!x.st.lastAnsweredAt || now.getTime() - Date.parse(x.st.lastAnsweredAt) >= PRACTICE_MIN_GAP_MS),
    );
}

const anyIntroduced = (ps: PointWithTopic[], states: Map<string, PointState>) => ps.some((p) => states.get(p.id)?.card);

/** Exam morning (Prague), for "how well will this be remembered at the exam". */
export const examMoment = (examDate: string) => new Date(`${examDate}T08:00:00+01:00`);

/**
 * Pre-exam sweep (after the daily goal, on request): the practice-eligible points with the LOWEST predicted recall
 * at the exam, tier A before B at similar recall.
 */
export function sweepPick(input: PlannerInput, inScope: PointWithTopic[], states: Map<string, PointState>) {
  const at = input.examDate ? examMoment(input.examDate) : input.now;
  const target = at > input.now ? at : input.now;
  return practiceCandidates(inScope, states, input.now)
    .map((x) => ({ ...x, key: input.retrievability(x.st, target) + (x.p.tier === "A" ? 0 : 0.05) }))
    .sort((a, b) => a.key - b.key)[0];
}

function cardsSinceLastNew(session: SessionItem[]): number {
  for (let i = session.length - 1, n = 0; i >= 0; i--, n++) if (session[i].isNew) return n;
  return Number.POSITIVE_INFINITY;
}

/**
 * Choose the next new point. Within a topic, points are introduced in authored order (per tier);
 * across topics, breadth wins: score = tier weight × (0.5 + uncovered fraction of the point's primary criterion).
 */
export function pickNew(
  inScope: PointWithTopic[],
  states: Map<string, PointState>,
  lastTopic: string | undefined,
  includeAllTiers: boolean,
): PointWithTopic | null {
  const introducedIds = new Set([...states.values()].filter((s) => s.introducedAt).map((s) => s.pointId));
  // Coverage per criterion among tier-A points.
  const total = new Map<string, number>();
  const covered = new Map<string, number>();
  for (const p of inScope) {
    if (p.tier !== "A") continue;
    const c = p.criteria[0];
    total.set(c, (total.get(c) ?? 0) + 1);
    if (introducedIds.has(p.id)) covered.set(c, (covered.get(c) ?? 0) + 1);
  }
  // Frontier: every not-introduced point whose prerequisites are introduced. (Only the first point per topic would
  // hide whole criteria that sit later in a long topic — simulation showed 2a/2c/4c never reached.) Authored order
  // survives as the tie-break, so within one criterion points still come in topic order.
  const inScopeIds = new Set(inScope.map((q) => q.id));
  const frontier: PointWithTopic[] = [];
  for (const p of inScope) {
    if (introducedIds.has(p.id)) continue;
    if (!includeAllTiers && p.tier === "C") continue;
    if (p.prereqs.every((r) => introducedIds.has(r) || !inScopeIds.has(r))) frontier.push(p);
  }
  if (!frontier.length) return null;
  // Contrast learning: a point whose confusable partner is already known is introduced a bit sooner.
  const partners = confusablePartners(inScope);
  const score = (p: PointWithTopic) => {
    const c = p.criteria[0];
    const t = total.get(c) ?? 0;
    const uncovered = t ? 1 - (covered.get(c) ?? 0) / t : 0.5;
    const contrast = [...(partners.get(p.id) ?? [])].some((q) => introducedIds.has(q)) ? CONTRAST_BONUS : 1;
    return (TIER_WEIGHT[p.tier] || 0.1) * (0.5 + uncovered) * contrast;
  };
  // A prerequisite inherits the priority of the points it unlocks (a tier-B "map of the digestive tract" must not
  // hold back the tier-A digestion points behind it).
  const byId = new Map(inScope.map((q) => [q.id, q]));
  const effective = new Map<string, number>();
  const boost = (id: string, s: number, depth: number) => {
    if (depth > 10 || introducedIds.has(id) || (effective.get(id) ?? -1) >= s) return;
    effective.set(id, s);
    for (const r of byId.get(id)?.prereqs ?? []) boost(r, s, depth + 1);
  };
  for (const p of inScope) {
    if (introducedIds.has(p.id) || (!includeAllTiers && p.tier === "C")) continue;
    boost(p.id, score(p), 0);
  }
  const ranked = frontier
    .map((p, i) => ({ p, s: effective.get(p.id) ?? score(p), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i);
  const best = ranked[0];
  if (best.p.topicId === lastTopic) {
    const alt = ranked.find((r) => r.p.topicId !== lastTopic && r.s >= best.s * 0.9);
    if (alt) return alt.p;
  }
  return best.p;
}

/** Symmetric confusable relation (authors may list a pair in one direction only). */
export function confusablePartners(points: PointWithTopic[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!m.has(a)) m.set(a, new Set());
    m.get(a)!.add(b);
  };
  for (const p of points) {
    for (const q of p.confusableWith) {
      add(p.id, q);
      add(q, p.id);
    }
  }
  return m;
}

function exercise(p: PointWithTopic, st: PointState, reason: "learning" | "review" | "new" | "practice"): NextCard {
  return { kind: "exercise", pointId: p.id, exerciseId: pickExercise(p.exercises, st).id, reason };
}

/**
 * Rotate exercise variants: least-used first, never the same one twice in a row when there is a choice.
 * Early (fewer than 2 answers) prefer recognition/self-check forms; later prefer production forms.
 */
export function pickExercise(exercises: Exercise[], st: PointState | undefined): Exercise {
  if (exercises.length === 1) return exercises[0];
  const early = !st || st.answers < 2;
  const pref = early ? ["choice", "reveal", "numeric", "case", "explain"] : ["case", "explain", "numeric", "reveal", "choice"];
  const candidates = exercises.filter((e) => e.id !== st?.lastExerciseId);
  return [...candidates].sort(
    (a, b) =>
      (st?.exerciseCounts[a.id] ?? 0) - (st?.exerciseCounts[b.id] ?? 0) || pref.indexOf(a.type) - pref.indexOf(b.type),
  )[0];
}
