/**
 * Answer evaluation: (exercise, response) → outcome + FSRS grade.
 *
 * Rules (docs/architecture.md):
 *  - "Nevím" → unknown / Again
 *  - wrong → Again
 *  - correct but guessed, or hint used → Hard
 *  - partially correct → Hard (multi-select: no wrong pick and at least half of the correct options)
 *  - correct → Good
 *  - explain: all key points → Good, ≥ half → Hard, otherwise Again
 *  - case: each step scored (correct 1, partial ½); all correct → Good, ≥ half → Hard, otherwise Again
 */
import type { CaseStep, Exercise } from "@/content/schema";
import { instantiate, instantiateCase, parseNumber, withinTolerance, type CaseStepInstance } from "@/content/formulas";
import { Grade, type CaseStepResponse, type Evaluation, type Outcome, type Response } from "./types";

const gradeFor: Record<Outcome, Grade> = {
  correct: Grade.Good,
  partial: Grade.Hard,
  wrong: Grade.Again,
  unknown: Grade.Again,
};

export function evaluate(ex: Exercise, res: Response, opts: { hintUsed?: boolean } = {}): Evaluation {
  const result = evaluateRaw(ex, res);
  let grade = gradeFor[result.outcome];
  const softened = opts.hintUsed || (res.type === "choice" && res.guessed);
  if (softened && grade === Grade.Good) grade = Grade.Hard;
  return { ...result, grade };
}

function evaluateRaw(ex: Exercise, res: Response): Omit<Evaluation, "grade"> {
  if (res.type === "dontKnow") return { outcome: "unknown" };
  if (res.type !== ex.type) throw new Error(`Response type ${res.type} does not match exercise type ${ex.type}`);

  switch (ex.type) {
    case "reveal": {
      const r = res as Extract<Response, { type: "reveal" }>;
      return { outcome: r.selfGrade === "good" ? "correct" : r.selfGrade === "hard" ? "partial" : "wrong" };
    }
    case "choice": {
      const r = res as Extract<Response, { type: "choice" }>;
      const correct = new Set(ex.options.flatMap((o, i) => (o.correct ? [i] : [])));
      const selected = new Set(r.selected);
      const wrongPicked = [...selected].some((i) => !correct.has(i));
      const missed = [...correct].filter((i) => !selected.has(i)).length;
      if (!wrongPicked && missed === 0) return { outcome: "correct" };
      if (ex.multiple && !wrongPicked && correct.size - missed >= correct.size / 2) return { outcome: "partial" };
      return { outcome: "wrong" };
    }
    case "numeric": {
      const r = res as Extract<Response, { type: "numeric" }>;
      const inst = instantiate(ex, r.seed);
      const value = parseNumber(r.value);
      const ok = value !== null && withinTolerance(value, inst.answer, ex.tolerance);
      return { outcome: ok ? "correct" : "wrong", expected: inst.answer, steps: inst.steps, prompt: inst.prompt };
    }
    case "explain": {
      const r = res as Extract<Response, { type: "explain" }>;
      return { outcome: explainOutcome(r.covered, ex.keyPoints.length) };
    }
    case "case": {
      const r = res as Extract<Response, { type: "case" }>;
      const inst = instantiateCase(ex, r.seed);
      const stepOutcomes = ex.steps.map((step, i) => evaluateCaseStep(step, inst.steps[i], r.steps[i] ?? { type: "dontKnow" }));
      if (stepOutcomes.every((o) => o === "unknown")) return { outcome: "unknown", stepOutcomes };
      const score = stepOutcomes.reduce((a, o) => a + (o === "correct" ? 1 : o === "partial" ? 0.5 : 0), 0) / stepOutcomes.length;
      return { outcome: score === 1 ? "correct" : score >= 0.5 ? "partial" : "wrong", stepOutcomes };
    }
  }
}

const explainOutcome = (coveredIdx: number[], total: number): Outcome => {
  const frac = new Set(coveredIdx.filter((i) => i >= 0 && i < total)).size / total;
  return frac === 1 ? "correct" : frac >= 0.5 ? "partial" : "wrong";
};

/** Outcome of one case step. A guessed correct choice counts as partial. */
export function evaluateCaseStep(step: CaseStep, inst: CaseStepInstance, res: CaseStepResponse): Outcome {
  if (res.type === "dontKnow") return "unknown";
  if (res.type !== step.type) return "wrong";
  switch (step.type) {
    case "numeric": {
      const r = res as Extract<CaseStepResponse, { type: "numeric" }>;
      const value = parseNumber(r.value);
      const expected = inst.type === "numeric" ? inst.answer : NaN;
      const ok = value !== null && withinTolerance(value, expected, step.tolerance);
      return ok ? (r.hint ? "partial" : "correct") : "wrong"; // a hint caps the step at partial, as everywhere else
    }
    case "choice": {
      const r = res as Extract<CaseStepResponse, { type: "choice" }>;
      const correct = new Set(step.options.flatMap((o, i) => (o.correct ? [i] : [])));
      const wrongPicked = r.selected.some((i) => !correct.has(i));
      const missed = [...correct].some((i) => !r.selected.includes(i));
      if (!wrongPicked && !missed) return r.guessed ? "partial" : "correct";
      const hit = r.selected.filter((i) => correct.has(i)).length;
      return step.multiple && !wrongPicked && hit >= correct.size / 2 ? "partial" : "wrong";
    }
    case "explain":
      return explainOutcome((res as Extract<CaseStepResponse, { type: "explain" }>).covered, step.keyPoints.length);
    case "reveal": {
      const g = (res as Extract<CaseStepResponse, { type: "reveal" }>).selfGrade;
      return g === "good" ? "correct" : g === "hard" ? "partial" : "wrong";
    }
  }
}
