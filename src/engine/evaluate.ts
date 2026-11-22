/**
 * Answer evaluation: (exercise, response) → outcome + FSRS grade.
 *
 * Rules (docs/architecture.md):
 *  - "Nevím" → unknown / Again
 *  - wrong → Again
 *  - correct but guessed, or hint used → Hard
 *  - partially correct → Hard
 *  - correct → Good
 *  - explain: all key points → Good, ≥ half → Hard, otherwise Again
 */
import type { Exercise } from "@/content/schema";
import { instantiate, parseNumber, withinTolerance } from "@/content/formulas";
import { Grade, type Evaluation, type Outcome, type Response } from "./types";

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
      if (ex.multiple && !wrongPicked && selected.size > 0) return { outcome: "partial" };
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
      const covered = new Set(r.covered.filter((i) => i >= 0 && i < ex.keyPoints.length)).size;
      const frac = covered / ex.keyPoints.length;
      return { outcome: frac === 1 ? "correct" : frac >= 0.5 ? "partial" : "wrong" };
    }
  }
}
