/**
 * Calculations without drill: a calculation is practised until it has been solved once, then it gives way to the
 * point's other questions; a solved client case repeats only its decisions (calculation steps shown worked out).
 * Formulas are always shown with the question (formulaText), so nothing here is about memorising them.
 * Pure: shared by the planner, the study screen and the tests.
 */
import type { CaseExercise, Exercise } from "@/content/schema";
import type { CaseStepResponse, Evaluation, PointState } from "./types";

export const isSolved = (st: PointState | undefined, exerciseId: string) => (st?.solved?.[exerciseId] ?? 0) >= 1;

/** A solved case with calculation steps AND something left to decide: repeat it with the calculations given. */
export function caseIsShort(ex: CaseExercise, st: PointState | undefined): boolean {
  return isSolved(st, ex.id) && ex.steps.some((s) => s.type === "numeric") && ex.steps.some((s) => s.type !== "numeric");
}

/** Share of a short case's steps that are still asked (its time relative to a full run). */
export const askedShare = (ex: CaseExercise) => ex.steps.filter((s) => s.type !== "numeric").length / ex.steps.length;

/** Whether this case answer had every calculation step answered (not given) and correct. */
export function caseCalcOk(ex: Exercise, steps: CaseStepResponse[], evaluation: Evaluation): boolean {
  if (ex.type !== "case") return false;
  const calc = ex.steps.flatMap((s, i) => (s.type === "numeric" ? [i] : []));
  return calc.length > 0 && calc.every((i) => steps[i]?.type === "numeric" && evaluation.stepOutcomes?.[i] === "correct");
}
