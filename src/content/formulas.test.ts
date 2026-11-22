import { describe, expect, it } from "vitest";
import { formulas, instantiate, parseNumber, withinTolerance, fmt } from "./formulas";
import type { NumericExercise } from "./schema";

const v = (name: string, p: Record<string, number | string>) => formulas[name].compute(p).value;

describe("course formulas", () => {
  it("Mifflin-St Jeor matches the script (men +5, women −161)", () => {
    expect(v("bmr-mifflin", { sex: "M", weight: 80, height: 180, age: 30 })).toBe(800 + 1125 - 150 + 5);
    expect(v("bmr-mifflin", { sex: "F", weight: 60, height: 165, age: 40 })).toBeCloseTo(600 + 1031.25 - 200 - 161);
  });

  it("Harris-Benedict uses the script's coefficients", () => {
    expect(v("bmr-harris", { sex: "M", weight: 80, height: 180, age: 30 })).toBeCloseTo(13.75 * 80 + 5.003 * 180 - 6.775 * 30 + 66.5);
    expect(v("bmr-harris", { sex: "F", weight: 60, height: 165, age: 40 })).toBeCloseTo(9.563 * 60 + 1.85 * 165 - 4.676 * 40 + 655.1);
  });

  it("Katch-McArdle derives FFM from body fat %", () => {
    expect(v("bmr-katch", { weight: 80, bodyFat: 25 })).toBeCloseTo(21.6 * 60 + 370);
  });

  it("reproduces the script's worked examples", () => {
    // p. 171: Josef, 85 kg, tennis 5 MET, 30 min → 212.5 kcal
    expect(v("eat", { weight: 85, met: 5, minutes: 30 })).toBe(212.5);
    // p. 170: BMR 1465 × 0.2 → 293 kcal
    expect(v("neat", { bmr: 1465, coef: 0.2 })).toBe(293);
    // p. 20: melon GI 70, 4 g carbs → 2.8 (script rounds to 3)
    expect(v("glycemic-load", { gi: 70, carbs: 4 })).toBeCloseTo(2.8);
  });

  it("WHR, per-kg dose, FFM and % energy", () => {
    expect(v("whr", { waist: 90, hip: 100 })).toBeCloseTo(0.9);
    expect(formulas.whr.compute({ waist: 90, hip: 100, sex: "F" }).steps[1]).toContain("zvýšené riziko");
    // p. 174: 70 kg × 30–40 ml → 2.1–2.8 l
    expect(v("per-kg", { weight: 70, perKg: 30 })).toBe(2100);
    expect(v("ffm", { weight: 80, bodyFat: 25 })).toBe(60);
    expect(v("macro-percent", { grams: 60, kcalPerG: 9, energy: 2000 })).toBeCloseTo(27);
  });

  it("TDEE by components = BMR + NEAT + EAT + 10 % TEF", () => {
    const p = { sex: "M", weight: 80, height: 180, age: 30, coef: 0.2, met: 6, minutes: 60 };
    const bmr = 1780;
    const sum = bmr + bmr * 0.2 + 80 * 6;
    expect(v("tdee-components", p)).toBeCloseTo(sum * 1.1);
  });

  it("macro split: protein first, fat %, carbohydrates fill the rest", () => {
    // 2000 kcal, 70 kg × 1.6 g = 112 g P (448 kcal), fat 30 % = 600 kcal → carbs (2000-448-600)/4 = 238
    expect(v("macro-carbs", { energy: 2000, weight: 70, proteinPerKg: 1.6, fatPct: 30 })).toBeCloseTo(238);
  });

  it("uses the script's 4.2 kJ per kcal", () => {
    expect(v("kcal-to-kj", { kcal: 100 })).toBe(420);
    expect(v("kj-to-kcal", { kj: 420 })).toBeCloseTo(100);
  });
});

describe("parsing and tolerance", () => {
  it("accepts Czech decimal comma, spaces and units", () => {
    expect(parseNumber("1 780")).toBe(1780);
    expect(parseNumber("2,8")).toBe(2.8);
    expect(parseNumber("1780 kcal")).toBe(1780);
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
  it("applies absolute or relative tolerance", () => {
    expect(withinTolerance(1785, 1780, { abs: 10 })).toBe(true);
    expect(withinTolerance(1795, 1780, { abs: 10 })).toBe(false);
    expect(withinTolerance(4150, 4200, { rel: 0.02 })).toBe(true);
  });
  it("formats numbers the Czech way", () => {
    expect(fmt(2.75, 2)).toBe("2,75");
    expect(fmt(1780)).toBe("1780");
  });
});

describe("instantiate", () => {
  const ex: NumericExercise = {
    id: "x",
    version: 1,
    type: "numeric",
    formula: "bmr-mifflin",
    prompt: "Klient: {sex}, {age} let, {height} cm, {weight} kg.",
    params: {
      sex: { choices: [{ value: "M", label: "muž" }, { value: "F", label: "žena" }] },
      age: { min: 20, max: 60, step: 1 },
      height: { min: 160, max: 190, step: 1 },
      weight: { min: 50, max: 100, step: 1 },
    },
    unit: "kcal",
    tolerance: { abs: 10 },
    decimals: 0,
  };
  it("is deterministic for a seed and fills every placeholder", () => {
    const a = instantiate(ex, 42);
    const b = instantiate(ex, 42);
    expect(a).toEqual(b);
    expect(a.prompt).not.toMatch(/\{/);
    expect(a.steps.length).toBeGreaterThan(0);
  });
  it("keeps parameters inside their ranges", () => {
    for (let s = 1; s < 200; s++) {
      const { params } = instantiate(ex, s);
      expect(params.age).toBeGreaterThanOrEqual(20);
      expect(params.age).toBeLessThanOrEqual(60);
    }
  });
});
