/**
 * Thin wrapper around ts-fsrs (FSRS-7). Responsible ONLY for memory state + next due date of a point.
 * What to study next is the planner's job.
 *
 * Settings (see docs/architecture.md):
 *  - learning steps 10 min → 1 day: a first success after reading the explanation is checked again tomorrow
 *  - relearning step 10 min: a lapse comes back in the same session
 *  - desired retention 0.9, no fuzz (deterministic replay)
 *  - intervals capped at 7 days (safety margin on default weights). Deliberately NOT tied to the exam date:
 *    capping to "days left" piles every review onto the last day; a point due after the exam is already
 *    predicted ≥ 90 % recalled on exam day. The planner owns exam-aware decisions.
 */
import { DefaultScheduler } from "ts-fsrs";
import type { Grade, MemoryCard } from "./types";

type FsrsScheduler = Awaited<ReturnType<typeof DefaultScheduler>>;
type FsrsCard = Parameters<FsrsScheduler["review"]>[0]["card"];

export const MAX_INTERVAL_DAYS = 7;

let instance: Promise<FsrsScheduler> | null = null;

export function getScheduler(): Promise<FsrsScheduler> {
  instance ??= DefaultScheduler({
    allowModelOverride: false,
    desiredRetention: 0.9,
    enableShortTerm: true,
    learningSteps: ["10m", "1d"],
    relearningSteps: ["10m"],
    enableFuzz: false,
    maximumInterval: 36500,
  });
  return instance;
}

export type Scheduler = FsrsScheduler;

const toFsrs = (c: MemoryCard): FsrsCard =>
  ({
    ...c,
    dueAt: new Date(c.dueAt),
    lastReviewAt: c.lastReviewAt ? new Date(c.lastReviewAt) : null,
  }) as unknown as FsrsCard;

const fromFsrs = (c: FsrsCard): MemoryCard => {
  const raw = c as unknown as Record<string, unknown>;
  return {
    ...(raw as unknown as MemoryCard),
    dueAt: (raw.dueAt as Date).toISOString(),
    lastReviewAt: raw.lastReviewAt ? (raw.lastReviewAt as Date).toISOString() : null,
  };
};

/** Apply a graded review. `card` null = first retrieval of this point. Deterministic given inputs. */
export function review(
  s: Scheduler,
  card: MemoryCard | null,
  grade: Grade,
  now: Date,
): MemoryCard {
  // newCard()'s declared type omits stabilityFast, but the runtime object has it (FSRS-7).
  const current: FsrsCard = card ? toFsrs(card) : (s.newCard({ now }) as unknown as FsrsCard);
  const next = fromFsrs(s.review({ card: current as never, grade, now }).card as FsrsCard);
  const capMs = now.getTime() + MAX_INTERVAL_DAYS * 86400_000;
  if (Date.parse(next.dueAt) > capMs) {
    next.dueAt = new Date(capMs).toISOString();
    next.scheduledDays = MAX_INTERVAL_DAYS;
  }
  // Stable id per point is not needed (we key by pointId); keep cardId deterministic for replay equality.
  next.cardId = card?.cardId ?? "c";
  return next;
}

/** Probability of recall now (0–1). New/never-reviewed cards → 0. */
export function retrievability(s: Scheduler, card: MemoryCard | null, now: Date): number {
  if (!card || !card.lastReviewAt) return 0;
  const elapsed = Math.max(0, s.chrono.difference(new Date(card.lastReviewAt), now));
  return s.model.forgettingCurve(toFsrs(card) as never, elapsed);
}
