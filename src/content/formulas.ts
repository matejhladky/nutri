/**
 * Deterministic calculation formulas used by `numeric` exercises.
 * Every formula follows the COURSE method (skripta ch. 2, 15, 17) — not generic textbook variants.
 * Each returns the result plus a worked solution (Czech) shown as feedback.
 */
import type { NumericExercise, NumericParam } from "./schema";

export type ParamValues = Record<string, number | string>;
export type FormulaResult = { value: number; steps: string[] };
export type Formula = {
  label: string;
  inputs: readonly string[];
  compute: (p: ParamValues) => FormulaResult;
};

/** Czech number formatting: decimal comma, no thousands separator noise for small numbers. */
export function fmt(n: number, decimals = 0): string {
  const rounded = Number(n.toFixed(decimals));
  return rounded.toLocaleString("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
    useGrouping: Math.abs(rounded) >= 10000,
  });
}

const num = (p: ParamValues, k: string): number => {
  const v = p[k];
  if (typeof v !== "number") throw new Error(`Parameter ${k} must be a number`);
  return v;
};
const sexOf = (p: ParamValues): "M" | "F" => {
  if (p.sex !== "M" && p.sex !== "F") throw new Error("Parameter sex must be M or F");
  return p.sex;
};

function mifflin(p: ParamValues): FormulaResult {
  const [w, h, a] = [num(p, "weight"), num(p, "height"), num(p, "age")];
  const s = sexOf(p);
  const c = s === "M" ? 5 : -161;
  const value = 10 * w + 6.25 * h - 5 * a + c;
  return {
    value,
    steps: [
      `Mifflin-St Jeor (${s === "M" ? "muži" : "ženy"}): 10 × hmotnost + 6,25 × výška − 5 × věk ${s === "M" ? "+ 5" : "− 161"}`,
      `10 × ${fmt(w)} + 6,25 × ${fmt(h)} − 5 × ${fmt(a)} ${s === "M" ? "+ 5" : "− 161"}`,
      `= ${fmt(10 * w)} + ${fmt(6.25 * h, 2)} − ${fmt(5 * a)} ${s === "M" ? "+ 5" : "− 161"} = ${fmt(value)} kcal`,
    ],
  };
}

function harris(p: ParamValues): FormulaResult {
  const [w, h, a] = [num(p, "weight"), num(p, "height"), num(p, "age")];
  const s = sexOf(p);
  const k = s === "M" ? { w: 13.75, h: 5.003, a: 6.775, c: 66.5 } : { w: 9.563, h: 1.85, a: 4.676, c: 655.1 };
  const value = k.w * w + k.h * h - k.a * a + k.c;
  return {
    value,
    steps: [
      `Harris-Benedict (${s === "M" ? "muži" : "ženy"}): ${fmt(k.w, 3)} × hmotnost + ${fmt(k.h, 3)} × výška − ${fmt(k.a, 3)} × věk + ${fmt(k.c, 1)}`,
      `= ${fmt(k.w * w, 1)} + ${fmt(k.h * h, 1)} − ${fmt(k.a * a, 1)} + ${fmt(k.c, 1)} = ${fmt(value)} kcal`,
    ],
  };
}

function katch(p: ParamValues): FormulaResult {
  const [w, bf] = [num(p, "weight"), num(p, "bodyFat")];
  const ffm = w * (1 - bf / 100);
  const value = 21.6 * ffm + 370;
  return {
    value,
    steps: [
      `Beztuková hmota (FFM) = hmotnost × (1 − podíl tuku) = ${fmt(w)} × (1 − ${fmt(bf / 100, 2)}) = ${fmt(ffm, 1)} kg`,
      `Katch-McArdle: 21,6 × FFM + 370 = 21,6 × ${fmt(ffm, 1)} + 370 = ${fmt(value)} kcal`,
    ],
  };
}

function eat(p: ParamValues): FormulaResult {
  const [w, met, min] = [num(p, "weight"), num(p, "met"), num(p, "minutes")];
  const hours = min / 60;
  const value = w * met * hours;
  return {
    value,
    steps: [
      `EAT = hmotnost (kg) × MET × čas (h)`,
      `${fmt(min)} min = ${fmt(hours, 2)} h`,
      `EAT = ${fmt(w)} × ${fmt(met, 1)} × ${fmt(hours, 2)} = ${fmt(value)} kcal`,
    ],
  };
}

function neat(p: ParamValues): FormulaResult {
  const [bmr, k] = [num(p, "bmr"), num(p, "coef")];
  const value = bmr * k;
  return {
    value,
    steps: [`NEAT = BMR × koeficient aktivity = ${fmt(bmr)} × ${fmt(k, 2)} = ${fmt(value)} kcal`],
  };
}

/** TDEE by components (course variant 1): BMR (Mifflin) + NEAT + EAT + TEF (10 % of the sum). */
function tdeeComponents(p: ParamValues): FormulaResult {
  const b = mifflin(p);
  const bmr = b.value;
  const n = bmr * num(p, "coef");
  const e = num(p, "weight") * num(p, "met") * (num(p, "minutes") / 60);
  const tef = 0.1 * (bmr + n + e);
  const value = bmr + n + e + tef;
  return {
    value,
    steps: [
      `1) BMR (Mifflin-St Jeor) = ${fmt(bmr)} kcal`,
      `2) NEAT = ${fmt(bmr)} × ${fmt(num(p, "coef"), 2)} = ${fmt(n)} kcal`,
      `3) EAT = ${fmt(num(p, "weight"))} × ${fmt(num(p, "met"), 1)} × ${fmt(num(p, "minutes") / 60, 2)} h = ${fmt(e)} kcal`,
      `4) TEF = 10 % × (BMR + NEAT + EAT) = 0,1 × ${fmt(bmr + n + e)} = ${fmt(tef)} kcal`,
      `TDEE = ${fmt(bmr)} + ${fmt(n)} + ${fmt(e)} + ${fmt(tef)} = ${fmt(value)} kcal`,
    ],
  };
}

function tdeePal(p: ParamValues): FormulaResult {
  const [bmr, pal] = [num(p, "bmr"), num(p, "pal")];
  const value = bmr * pal;
  return { value, steps: [`TDEE = BMR × PAL = ${fmt(bmr)} × ${fmt(pal, 3)} = ${fmt(value)} kcal`] };
}

function kcalToKj(p: ParamValues): FormulaResult {
  const kcal = num(p, "kcal");
  const value = kcal * 4.2;
  return { value, steps: [`1 kcal ≈ 4,2 kJ (dle skript)`, `${fmt(kcal)} × 4,2 = ${fmt(value)} kJ`] };
}

function kjToKcal(p: ParamValues): FormulaResult {
  const kj = num(p, "kj");
  const value = kj / 4.2;
  return {
    value,
    steps: [`1 kJ ≈ 0,24 kcal (tj. děleno 4,2)`, `${fmt(kj)} : 4,2 = ${fmt(value)} kcal`],
  };
}

function energyFromMacros(p: ParamValues): FormulaResult {
  const [c, pr, f] = [num(p, "carbs"), num(p, "protein"), num(p, "fat")];
  const value = 4 * c + 4 * pr + 9 * f;
  return {
    value,
    steps: [
      `Sacharidy i bílkoviny 4 kcal/g, tuky 9 kcal/g`,
      `${fmt(c)} × 4 + ${fmt(pr)} × 4 + ${fmt(f)} × 9 = ${fmt(4 * c)} + ${fmt(4 * pr)} + ${fmt(9 * f)} = ${fmt(value)} kcal`,
    ],
  };
}

/** Course method (ch. 17.4): protein first (g/kg), then fat (% of energy), carbohydrates fill the rest. */
function macroCarbs(p: ParamValues): FormulaResult {
  const [energy, w, ppk, fatPct] = [num(p, "energy"), num(p, "weight"), num(p, "proteinPerKg"), num(p, "fatPct")];
  const protein = w * ppk;
  const fatKcal = (energy * fatPct) / 100;
  const fat = fatKcal / 9;
  const carbKcal = energy - protein * 4 - fatKcal;
  const value = carbKcal / 4;
  return {
    value,
    steps: [
      `1) Bílkoviny: ${fmt(w)} kg × ${fmt(ppk, 1)} g/kg = ${fmt(protein)} g = ${fmt(protein * 4)} kcal`,
      `2) Tuky: ${fmt(fatPct)} % z ${fmt(energy)} kcal = ${fmt(fatKcal)} kcal = ${fmt(fat)} g (: 9)`,
      `3) Sacharidy doplní zbytek: ${fmt(energy)} − ${fmt(protein * 4)} − ${fmt(fatKcal)} = ${fmt(carbKcal)} kcal`,
      `${fmt(carbKcal)} : 4 = ${fmt(value)} g sacharidů`,
    ],
  };
}

function glycemicLoad(p: ParamValues): FormulaResult {
  const [gi, carbs] = [num(p, "gi"), num(p, "carbs")];
  const value = (gi * carbs) / 100;
  const band = value <= 10 ? "nízká (do 10)" : value <= 20 ? "střední (10–20)" : "vysoká (nad 20)";
  return {
    value,
    steps: [`GN = GI × g sacharidů / 100 = ${fmt(gi)} × ${fmt(carbs)} / 100 = ${fmt(value, 1)}`, `Glykemická nálož je ${band}.`],
  };
}

function energyAvailability(p: ParamValues): FormulaResult {
  const [intake, exercise, ffm] = [num(p, "intake"), num(p, "exercise"), num(p, "ffm")];
  const value = (intake - exercise) / ffm;
  return {
    value,
    steps: [
      `ED = (příjem − výdej na pohyb) / FFM`,
      `(${fmt(intake)} − ${fmt(exercise)}) / ${fmt(ffm)} = ${fmt(intake - exercise)} / ${fmt(ffm)} = ${fmt(value, 1)} kcal/kg FFM`,
      `Optimum: ženy ~45, muži ~40 kcal/kg FFM.`,
    ],
  };
}

function bmi(p: ParamValues): FormulaResult {
  const [w, h] = [num(p, "weight"), num(p, "height")];
  const m = h / 100;
  const value = w / (m * m);
  return { value, steps: [`BMI = hmotnost (kg) / výška² (m) = ${fmt(w)} / ${fmt(m, 2)}² = ${fmt(value, 1)}`] };
}

/** p. 152: WHR = waist / hip; risk above 0.90 (men) / 0.85 (women). `sex` optional. */
function whr(p: ParamValues): FormulaResult {
  const [waist, hip] = [num(p, "waist"), num(p, "hip")];
  const value = waist / hip;
  const steps = [`WHR = obvod pasu / obvod boků = ${fmt(waist)} / ${fmt(hip)} = ${fmt(value, 2)}`];
  if (p.sex === "M" || p.sex === "F") {
    const limit = p.sex === "M" ? 0.9 : 0.85;
    steps.push(
      `Hranice rizika pro ${p.sex === "M" ? "muže" : "ženy"}: nad ${fmt(limit, 2)} → ${value > limit ? "zvýšené riziko (abdominální obezita)" : "v pásmu bez zvýšeného rizika"}.`,
    );
  }
  return { value, steps };
}

/** Generic per-kilogram dose: protein g/kg, fluids ml/kg, carbohydrates g/kg, caffeine mg/kg … */
function perKg(p: ParamValues): FormulaResult {
  const [w, d] = [num(p, "weight"), num(p, "perKg")];
  const value = w * d;
  return { value, steps: [`Množství = hmotnost × dávka na kg = ${fmt(w)} kg × ${fmt(d, 2)} = ${fmt(value)}`] };
}

/** Fat-free mass from weight and body-fat %. */
function ffm(p: ParamValues): FormulaResult {
  const [w, bf] = [num(p, "weight"), num(p, "bodyFat")];
  const fatKg = (w * bf) / 100;
  const value = w - fatKg;
  return {
    value,
    steps: [
      `Tuk = ${fmt(w)} kg × ${fmt(bf)} % = ${fmt(fatKg, 1)} kg`,
      `FFM (beztuková hmota) = ${fmt(w)} − ${fmt(fatKg, 1)} = ${fmt(value, 1)} kg`,
    ],
  };
}

/** Share of energy from one macronutrient: grams × kcal/g ÷ total energy × 100. `kcalPerG` is 4 or 9. */
function macroPercent(p: ParamValues): FormulaResult {
  const [g, k, e] = [num(p, "grams"), num(p, "kcalPerG"), num(p, "energy")];
  const kcal = g * k;
  const value = (kcal / e) * 100;
  return {
    value,
    steps: [
      `${fmt(g)} g × ${fmt(k)} kcal/g = ${fmt(kcal)} kcal`,
      `${fmt(kcal)} / ${fmt(e)} kcal × 100 = ${fmt(value, 1)} % energie`,
    ],
  };
}

export const formulas: Record<string, Formula> = {
  "bmr-mifflin": { label: "BMR Mifflin-St Jeor", inputs: ["sex", "weight", "height", "age"], compute: mifflin },
  "bmr-harris": { label: "BMR Harris-Benedict", inputs: ["sex", "weight", "height", "age"], compute: harris },
  "bmr-katch": { label: "BMR Katch-McArdle", inputs: ["weight", "bodyFat"], compute: katch },
  eat: { label: "EAT pomocí MET", inputs: ["weight", "met", "minutes"], compute: eat },
  neat: { label: "NEAT koeficientem", inputs: ["bmr", "coef"], compute: neat },
  "tdee-components": {
    label: "TDEE po složkách",
    inputs: ["sex", "weight", "height", "age", "coef", "met", "minutes"],
    compute: tdeeComponents,
  },
  "tdee-pal": { label: "TDEE = BMR × PAL", inputs: ["bmr", "pal"], compute: tdeePal },
  "kcal-to-kj": { label: "kcal → kJ", inputs: ["kcal"], compute: kcalToKj },
  "kj-to-kcal": { label: "kJ → kcal", inputs: ["kj"], compute: kjToKcal },
  "energy-from-macros": { label: "Energie z makroživin", inputs: ["carbs", "protein", "fat"], compute: energyFromMacros },
  "macro-carbs": { label: "Sacharidy jako zbytek", inputs: ["energy", "weight", "proteinPerKg", "fatPct"], compute: macroCarbs },
  "glycemic-load": { label: "Glykemická nálož", inputs: ["gi", "carbs"], compute: glycemicLoad },
  "energy-availability": { label: "Energetická dostupnost", inputs: ["intake", "exercise", "ffm"], compute: energyAvailability },
  bmi: { label: "BMI", inputs: ["weight", "height"], compute: bmi },
  whr: { label: "WHR (pas/boky)", inputs: ["waist", "hip"], compute: whr },
  "per-kg": { label: "Dávka na kg hmotnosti", inputs: ["weight", "perKg"], compute: perKg },
  ffm: { label: "Beztuková hmota (FFM)", inputs: ["weight", "bodyFat"], compute: ffm },
  "macro-percent": { label: "Podíl energie z makroživiny", inputs: ["grams", "kcalPerG", "energy"], compute: macroPercent },
};

// ---------- Parameter generation (seeded, reproducible) ----------

/** mulberry32 PRNG — tiny, deterministic. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(param: NumericParam, rand: () => number): { value: number | string; label: string } {
  if ("choices" in param) {
    const c = param.choices[Math.floor(rand() * param.choices.length)];
    return { value: c.value, label: c.label };
  }
  const steps = Math.floor((param.max - param.min) / param.step);
  const v = Number((param.min + Math.floor(rand() * (steps + 1)) * param.step).toFixed(6));
  const decimals = (String(param.step).split(".")[1] ?? "").length;
  return { value: v, label: fmt(v, decimals) };
}

export type NumericInstance = {
  seed: number;
  params: ParamValues;
  prompt: string;
  answer: number;
  steps: string[];
};

/** Instantiate a numeric exercise for a given seed: fill parameters, render prompt, compute answer. */
export function instantiate(ex: NumericExercise, seed: number): NumericInstance {
  const formula = formulas[ex.formula];
  if (!formula) throw new Error(`Unknown formula ${ex.formula}`);
  const rand = rng(seed);
  const params: ParamValues = {};
  const labels: Record<string, string> = {};
  for (const [name, spec] of Object.entries(ex.params)) {
    const { value, label } = pick(spec, rand);
    params[name] = value;
    labels[name] = label;
  }
  const prompt = ex.prompt.replace(/\{(\w+)\}/g, (m, k: string) => labels[k] ?? m);
  const { value, steps } = formula.compute(params);
  return { seed, params, prompt, answer: value, steps };
}

/** Parse a learner-typed number: accepts decimal comma, spaces, trailing units. */
export function parseNumber(input: string): number | null {
  const cleaned = input
    .replace(/\s| /g, "")
    .replace(/(kcal|kj|g|kg|%)$/i, "")
    .replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

export function withinTolerance(value: number, expected: number, tol: { abs?: number; rel?: number }): boolean {
  const diff = Math.abs(value - expected);
  if (tol.abs !== undefined && diff <= tol.abs) return true;
  if (tol.rel !== undefined && diff <= Math.abs(expected) * tol.rel) return true;
  return tol.abs === undefined && tol.rel === undefined ? diff < 1e-9 : false;
}
