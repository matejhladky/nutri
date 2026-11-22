import { describe, expect, it } from "vitest";
import { evaluate } from "./evaluate";
import { Grade } from "./types";
import type { ChoiceExercise, ExplainExercise, NumericExercise, RevealExercise } from "@/content/schema";
import { instantiate } from "@/content/formulas";

const single: ChoiceExercise = {
  id: "c",
  version: 1,
  type: "choice",
  multiple: false,
  prompt: "Otázka?",
  options: [
    { text: "A", correct: true },
    { text: "B", correct: false },
    { text: "C", correct: false },
  ],
};
const multi: ChoiceExercise = {
  ...single,
  multiple: true,
  options: [
    { text: "A", correct: true },
    { text: "B", correct: true },
    { text: "C", correct: false },
  ],
};
const reveal: RevealExercise = { id: "r", version: 1, type: "reveal", prompt: "Otázka?", answer: "x" };
const explain: ExplainExercise = {
  id: "e",
  version: 1,
  type: "explain",
  prompt: "Vysvětli…",
  keyPoints: ["a", "b", "c", "d"],
  modelAnswer: "Vzorová odpověď.",
};
const numeric: NumericExercise = {
  id: "n",
  version: 1,
  type: "numeric",
  formula: "neat",
  prompt: "BMR {bmr}, koef {coef}",
  params: { bmr: { min: 1000, max: 2000, step: 10 }, coef: { choices: [{ value: 0.2, label: "0,2" }] } },
  unit: "kcal",
  tolerance: { abs: 5 },
  decimals: 0,
};

describe("evaluate", () => {
  it("Nevím → unknown / Again", () => {
    expect(evaluate(single, { type: "dontKnow" })).toMatchObject({ outcome: "unknown", grade: Grade.Again });
  });

  it("single choice: correct → Good, guessed correct → Hard, wrong → Again", () => {
    expect(evaluate(single, { type: "choice", selected: [0], guessed: false }).grade).toBe(Grade.Good);
    expect(evaluate(single, { type: "choice", selected: [0], guessed: true }).grade).toBe(Grade.Hard);
    expect(evaluate(single, { type: "choice", selected: [1], guessed: false }).grade).toBe(Grade.Again);
  });

  it("multiple choice: exact → Good, subset without wrong → Hard, any wrong → Again", () => {
    expect(evaluate(multi, { type: "choice", selected: [0, 1], guessed: false }).outcome).toBe("correct");
    expect(evaluate(multi, { type: "choice", selected: [0], guessed: false })).toMatchObject({ outcome: "partial", grade: Grade.Hard });
    expect(evaluate(multi, { type: "choice", selected: [0, 1, 2], guessed: false }).grade).toBe(Grade.Again);
  });

  it("hint caps a correct answer at Hard", () => {
    expect(evaluate(reveal, { type: "reveal", selfGrade: "good" }, { hintUsed: true }).grade).toBe(Grade.Hard);
    expect(evaluate(reveal, { type: "reveal", selfGrade: "again" }, { hintUsed: true }).grade).toBe(Grade.Again);
  });

  it("reveal maps the three self-grades", () => {
    expect(evaluate(reveal, { type: "reveal", selfGrade: "good" }).grade).toBe(Grade.Good);
    expect(evaluate(reveal, { type: "reveal", selfGrade: "hard" }).grade).toBe(Grade.Hard);
    expect(evaluate(reveal, { type: "reveal", selfGrade: "again" }).grade).toBe(Grade.Again);
  });

  it("explain grades by fraction of key points covered", () => {
    expect(evaluate(explain, { type: "explain", covered: [0, 1, 2, 3] }).grade).toBe(Grade.Good);
    expect(evaluate(explain, { type: "explain", covered: [0, 2] }).grade).toBe(Grade.Hard);
    expect(evaluate(explain, { type: "explain", covered: [1] }).grade).toBe(Grade.Again);
    expect(evaluate(explain, { type: "explain", covered: [0, 0, 9] }).grade).toBe(Grade.Again);
  });

  it("numeric checks against the seeded instance and returns the worked solution", () => {
    const inst = instantiate(numeric, 7);
    const ok = evaluate(numeric, { type: "numeric", value: String(inst.answer).replace(".", ","), seed: 7 });
    expect(ok).toMatchObject({ outcome: "correct", grade: Grade.Good });
    expect(ok.steps?.length).toBeGreaterThan(0);
    expect(evaluate(numeric, { type: "numeric", value: String(inst.answer + 50), seed: 7 }).grade).toBe(Grade.Again);
    expect(evaluate(numeric, { type: "numeric", value: "nevím", seed: 7 }).outcome).toBe("wrong");
  });
});

describe("partial credit for multiple choice", () => {
  const four: ChoiceExercise = {
    ...single,
    multiple: true,
    options: [
      { text: "A", correct: true },
      { text: "B", correct: true },
      { text: "C", correct: true },
      { text: "D", correct: false },
    ],
  };
  it("needs at least half of the correct options and no wrong pick", () => {
    expect(evaluate(four, { type: "choice", selected: [0, 1], guessed: false }).outcome).toBe("partial"); // 2 of 3
    expect(evaluate(four, { type: "choice", selected: [0], guessed: false }).outcome).toBe("wrong"); // 1 of 3
    expect(evaluate(four, { type: "choice", selected: [0, 1, 3], guessed: false }).outcome).toBe("wrong"); // wrong pick
  });
});
