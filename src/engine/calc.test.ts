import { beforeAll, describe, expect, it } from "vitest";
import { CaseExercise, type Exercise, type PointWithTopic } from "@/content/schema";
import { content } from "@/lib/content";
import { askedShare, caseCalcOk, caseIsShort, isSolved } from "./calc";
import { evaluate } from "./evaluate";
import { pickExercise } from "./planner";
import { getScheduler, type Scheduler } from "./scheduler";
import { replay } from "./state";
import { Grade, type CaseStepResponse, type StudyEvent } from "./types";

let s: Scheduler;
beforeAll(async () => {
  s = await getScheduler();
});

const kase = CaseExercise.parse({
  id: "pripad",
  type: "case",
  prompt: "Klientka, {weight} kg.",
  params: { sex: { choices: [{ value: "F", label: "žena" }] }, age: { min: 30, max: 30, step: 1 }, height: { min: 165, max: 165, step: 1 }, weight: { min: 70, max: 70, step: 1 }, coef: { choices: [{ value: 0.1, label: "0,1" }] } },
  steps: [
    { type: "numeric", id: "bmr", prompt: "Spočítej BMR.", formula: "bmr-mifflin", unit: "kcal", tolerance: { abs: 10 }, formulaText: "10 × kg + 6,25 × cm − 5 × věk − 161" },
    { type: "numeric", id: "neat", prompt: "BMR = {bmr} kcal. NEAT?", formula: "neat", unit: "kcal", tolerance: { abs: 5 } },
    { type: "choice", prompt: "Kterou rovnici zvolíš, když znáš % tuku?", options: [{ text: "Katch-McArdle", correct: true }, { text: "Harris-Benedict" }] },
  ],
});
const given: CaseStepResponse = { type: "given" };
const right: CaseStepResponse = { type: "choice", selected: [0], guessed: false };
const wrong: CaseStepResponse = { type: "choice", selected: [1], guessed: false };

const ev = (pointId: string, exerciseId: string, outcome: StudyEvent["outcome"], i: number, extra: Partial<StudyEvent> = {}): StudyEvent => ({
  id: `${pointId}-${i}`,
  pointId,
  at: new Date(Date.parse("2026-11-20T10:00:00Z") + i * 86400_000).toISOString(),
  kind: "answer",
  exerciseId,
  grade: outcome === "correct" ? Grade.Good : outcome === "partial" ? Grade.Hard : Grade.Again,
  outcome,
  ...extra,
});

describe("short cases: calculations given, decisions graded", () => {
  it("grades only the asked steps", () => {
    expect(evaluate(kase, { type: "case", seed: 1, steps: [given, given, right] }).outcome).toBe("correct");
    expect(evaluate(kase, { type: "case", seed: 1, steps: [given, given, wrong] }).outcome).toBe("wrong");
    expect(evaluate(kase, { type: "case", seed: 1, steps: [given, given, { type: "dontKnow" }] }).outcome).toBe("unknown");
  });

  it("marks a case whose calculations were all right (even if a decision was wrong)", () => {
    const full = { type: "case" as const, seed: 1, steps: [{ type: "numeric" as const, value: "1420" }, { type: "numeric" as const, value: "142" }, wrong] };
    const e = evaluate(kase, full);
    expect(e.outcome).toBe("partial");
    expect(caseCalcOk(kase, full.steps, e)).toBe(true);
    const slip = { ...full, steps: [{ type: "numeric" as const, value: "1500" }, full.steps[1], right] };
    expect(caseCalcOk(kase, slip.steps, evaluate(kase, slip))).toBe(false);
    // A short run (calculations given) never counts as having calculated.
    expect(caseCalcOk(kase, [given, given, right], evaluate(kase, { type: "case", seed: 1, steps: [given, given, right] }))).toBe(false);
  });

  it("is short only once solved, and only when something is left to decide", () => {
    const states = replay([ev("kaz.x", "pripad", "partial", 0, { calcOk: true })], s);
    expect(caseIsShort(kase, undefined)).toBe(false);
    expect(caseIsShort(kase, states.get("kaz.x"))).toBe(true);
    expect(askedShare(kase)).toBeCloseTo(1 / 3);
    const onlyCalc = CaseExercise.parse({ ...kase, steps: kase.steps.slice(0, 2) });
    expect(caseIsShort(onlyCalc, states.get("kaz.x"))).toBe(false);
  });
});

describe("a calculation solved once gives way to the point's other questions", () => {
  const calc: Exercise = { id: "vypocet", version: 1, type: "numeric", prompt: "Spočítej", formula: "bmi", params: {}, unit: "", tolerance: { abs: 0.1 }, decimals: 1 };
  const choice: Exercise = { id: "kategorie", version: 1, type: "choice", prompt: "?", multiple: false, options: [{ text: "a", correct: true }, { text: "b", correct: false }] };
  const explain: Exercise = { id: "vysvetli", version: 1, type: "explain", prompt: "Vysvětli", keyPoints: ["a", "b"], modelAnswer: "Vzor odpovědi" };

  it("keeps asking an unsolved calculation, then stops once it was right", () => {
    const wrongOnce = replay([ev("p", "kategorie", "correct", 0), ev("p", "vypocet", "wrong", 1)], s).get("p");
    expect(isSolved(wrongOnce, "vypocet")).toBe(false);
    // the planner still rotates to it (least used first; last one is skipped)
    const later = replay([ev("p", "kategorie", "correct", 0), ev("p", "vypocet", "wrong", 1), ev("p", "vysvetli", "correct", 2)], s).get("p");
    expect(pickExercise([calc, choice, explain], later).id).toBe("vypocet");

    const solved = replay([ev("p", "kategorie", "correct", 0), ev("p", "vypocet", "correct", 1), ev("p", "vysvetli", "correct", 2)], s).get("p");
    for (let i = 0; i < 5; i++) expect(pickExercise([calc, choice, explain], solved).id).not.toBe("vypocet");
  });

  it("counts earlier answers given with the hint (correct, graded Hard) as solved", () => {
    const st = replay([ev("p", "vypocet", "correct", 0, { grade: Grade.Hard, hintUsed: true })], s).get("p");
    expect(isSolved(st, "vypocet")).toBe(true);
  });

  it("still asks a calculation when the point has nothing else", () => {
    const st = replay([ev("p", "vypocet", "correct", 0)], s).get("p");
    expect(pickExercise([calc], st).id).toBe("vypocet");
  });
});

describe("content: formulas are shown, never asked by heart", () => {
  const points = content.points as PointWithTopic[];
  type Calc = { id: string; c: { formulaText?: string; hint?: string } };
  const calcs: Calc[] = points.flatMap((p): Calc[] =>
    p.exercises.flatMap((e): Calc[] =>
      e.type === "numeric" ? [{ id: `${p.id}/${e.id}`, c: e }] : e.type === "case" ? e.steps.flatMap((st, i): Calc[] => (st.type === "numeric" ? [{ id: `${p.id}#${i + 1}`, c: st }] : [])) : [],
    ),
  );

  it("every calculation shows its formula, unless the hint is the fact being tested", () => {
    expect(calcs.length).toBeGreaterThan(50);
    expect(calcs.filter((x) => !x.c.formulaText && !x.c.hint).map((x) => x.id)).toEqual([]);
    expect(calcs.filter((x) => x.c.formulaText).length).toBeGreaterThan(40);
  });

  it("no question asks to write an equation from memory, and explanations don't require the constants", () => {
    const all = points.flatMap((p) => p.exercises.map((e) => ({ id: `${p.id}/${e.id}`, e })));
    expect(all.filter(({ e }) => /napiš.*rovnici/i.test(e.prompt)).map((x) => x.id)).toEqual([]);
    const mifflin = points.find((p) => p.id === "en.bmr-mifflin")!;
    const katch = points.find((p) => p.id === "en.bmr-katch")!;
    for (const e of [...mifflin.exercises, ...katch.exercises]) if (e.type === "explain") expect(e.keyPoints.join(" ")).not.toMatch(/6,25|161|21,6|370/);
  });
});
