/** FSRS grades used by the app. Easy (4) is deliberately not used — see docs/architecture.md. */
export const Grade = { Again: 1, Hard: 2, Good: 3 } as const;
export type Grade = (typeof Grade)[keyof typeof Grade];

/** unknown = learner pressed "Nevím". */
export type Outcome = "correct" | "partial" | "wrong" | "unknown";

export type Response =
  | { type: "dontKnow" }
  | { type: "reveal"; selfGrade: "again" | "hard" | "good" }
  /** `selected` are indices into the exercise's ORIGINAL option order (shuffling is a UI concern). */
  | { type: "choice"; selected: number[]; guessed: boolean }
  | { type: "numeric"; value: string; seed: number }
  | { type: "explain"; covered: number[]; text?: string }
  | { type: "case"; seed: number; steps: CaseStepResponse[] };

/** Response to one step of a client case (choice indices refer to the ORIGINAL option order). */
export type CaseStepResponse =
  | { type: "dontKnow" }
  | { type: "numeric"; value: string }
  | { type: "choice"; selected: number[]; guessed: boolean }
  | { type: "explain"; covered: number[] }
  | { type: "reveal"; selfGrade: "again" | "hard" | "good" };

export type Evaluation = {
  outcome: Outcome;
  grade: Grade;
  /** numeric only */
  expected?: number;
  steps?: string[];
  prompt?: string;
  /** case only: outcome per step */
  stepOutcomes?: Outcome[];
};

/** Serialised ts-fsrs card (dates as ISO strings) — what we persist. */
export type MemoryCard = {
  stability: number;
  stabilityFast: number;
  difficulty: number;
  dueAt: string;
  lastReviewAt: string | null;
  state: number;
  scheduleStatus: string;
  cardId: string;
  reps: number;
  lapses: number;
  scheduledDays: number;
  learningStep: number;
};

/** Append-only learner event. The event log is the source of truth; point state is derived from it. */
export type StudyEvent = {
  /** Client-generated UUID — makes submission idempotent. */
  id: string;
  pointId: string;
  at: string;
  kind: "intro" | "answer";
  /** intro: learner pressed "Už to znám" */
  skippedIntro?: boolean;
  exerciseId?: string;
  exerciseVersion?: number;
  outcome?: Outcome;
  grade?: Grade;
  hintUsed?: boolean;
  response?: Response;
  durationMs?: number;
};

export type PointState = {
  pointId: string;
  introducedAt: string | null;
  card: MemoryCard | null;
  answers: number;
  correct: number;
  lastOutcome: Outcome | null;
  lastAnsweredAt: string | null;
  lastExerciseId: string | null;
  exerciseCounts: Record<string, number>;
  /** Most recent outcomes, newest last (max 5). */
  recent: Outcome[];
};
