import { describe, expect, it } from "vitest";
import { CaseExercise } from "@/content/schema";
import { instantiateCase } from "@/content/formulas";
import { evaluate } from "./evaluate";
import { Grade } from "./types";

const ex = CaseExercise.parse({
  id: "redukce",
  type: "case",
  prompt: "Klientka, {age} let, {height} cm, {weight} kg, sedavé zaměstnání.",
  params: {
    sex: { choices: [{ value: "F", label: "žena" }] },
    age: { min: 30, max: 30, step: 1 },
    height: { min: 165, max: 165, step: 1 },
    weight: { min: 70, max: 70, step: 1 },
    coef: { choices: [{ value: 0.1, label: "0,1" }] },
  },
  steps: [
    { type: "numeric", id: "bmr", prompt: "BMR (Mifflin)?", formula: "bmr-mifflin", unit: "kcal", tolerance: { abs: 10 } },
    { type: "numeric", id: "neat", prompt: "BMR = {bmr} kcal. NEAT?", formula: "neat", unit: "kcal", tolerance: { abs: 5 } },
    {
      type: "choice",
      prompt: "Kterou rovnici zvolíš, když znáš % tuku?",
      options: [{ text: "Katch-McArdle", correct: true }, { text: "Harris-Benedict", why: "Nepracuje s FFM." }],
    },
    { type: "explain", prompt: "Vysvětli klientce…", keyPoints: ["první bod", "druhý bod"], modelAnswer: "Vzorová odpověď." },
  ],
});

// Mifflin, woman 70 kg / 165 cm / 30 y: 700 + 1031.25 − 150 − 161 = 1420.25
describe("client cases", () => {
  it("chains numeric steps using the displayed (rounded) earlier result", () => {
    const inst = instantiateCase(ex, 1);
    expect(inst.prompt).toBe("Klientka, 30 let, 165 cm, 70 kg, sedavé zaměstnání.");
    const [bmr, neat] = inst.steps;
    expect(bmr.type === "numeric" && bmr.answer).toBeCloseTo(1420.25);
    expect(neat.prompt).toBe("BMR = 1420 kcal. NEAT?");
    expect(neat.type === "numeric" && neat.answer).toBeCloseTo(142); // 1420 × 0.1, not 1420.25 × 0.1
  });

  it("grades the case from its steps", () => {
    const all = evaluate(ex, {
      type: "case",
      seed: 1,
      steps: [
        { type: "numeric", value: "1 420" },
        { type: "numeric", value: "142" },
        { type: "choice", selected: [0], guessed: false },
        { type: "explain", covered: [0, 1] },
      ],
    });
    expect(all).toMatchObject({ outcome: "correct", grade: Grade.Good, stepOutcomes: ["correct", "correct", "correct", "correct"] });

    const half = evaluate(ex, {
      type: "case",
      seed: 1,
      steps: [{ type: "numeric", value: "1600" }, { type: "numeric", value: "142" }, { type: "choice", selected: [0], guessed: true }, { type: "explain", covered: [0] }],
    });
    // wrong 0 + correct 1 + guessed ½ + half explain ½ = 2 / 4
    expect(half).toMatchObject({ outcome: "partial", grade: Grade.Hard });

    const none = evaluate(ex, { type: "case", seed: 1, steps: [{ type: "dontKnow" }, { type: "dontKnow" }, { type: "dontKnow" }, { type: "dontKnow" }] });
    expect(none).toMatchObject({ outcome: "unknown", grade: Grade.Again });
  });

  it("a hint in a numeric step caps that step at partial", () => {
    const r = evaluate(ex, {
      type: "case",
      seed: 1,
      steps: [
        { type: "numeric", value: "1420", hint: true },
        { type: "numeric", value: "142" },
        { type: "choice", selected: [0], guessed: false },
        { type: "explain", covered: [0, 1] },
      ],
    });
    expect(r.stepOutcomes?.[0]).toBe("partial");
    expect(r).toMatchObject({ outcome: "partial", grade: Grade.Hard });
  });

  it("validates step references", async () => {
    const { validateContent } = await import("@/content/validate");
    const bad = CaseExercise.parse({ ...ex, steps: [{ ...ex.steps[1] }, ex.steps[2]] }); // NEAT before BMR exists
    const topics = [
      {
        file: "t.yaml",
        data: {
          topic: { id: "t", title: "T", pages: [1, 2] as [number, number], summary: "Souhrn tématu.", order: 1 },
          points: [
            {
              id: "t.p", title: "P", kind: "procedure" as const, tier: "A" as const, safety: false, status: "course" as const, criteria: ["5e"],
              source: { pages: [1] }, explanation: "Vysvětlení.", prereqs: [], confusableWith: [], exercises: [bad],
            },
          ],
        },
      },
    ];
    const criteria = { competencies: [{ id: "5", title: "x", criteria: [{ id: "5e", method: ["PR" as const], label: "BMR" }] }] };
    const issues = validateContent(criteria, topics).filter((i) => i.level === "error");
    expect(issues.map((i) => i.message).join(" ")).toMatch(/bmr.*not available|placeholder \{bmr\}/);
  });
});
