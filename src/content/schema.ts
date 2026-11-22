import { z } from "zod";

/** Stable slug ids: lowercase, digits, dots and dashes. Never reuse an id for a different meaning. */
const Slug = z.string().regex(/^[a-z0-9][a-z0-9.-]*$/, "id must be a lowercase slug");

// ---------- Official criteria ----------

export const Method = z.enum(["P", "U", "PR"]);
export const Criterion = z.object({
  id: z.string().regex(/^\d+[a-z]$/),
  method: z.array(Method).min(1),
  label: z.string().min(3),
});
export const Competency = z.object({
  id: z.string(),
  title: z.string(),
  criteria: z.array(Criterion).min(1),
});
export const CriteriaFile = z.object({ competencies: z.array(Competency).min(1) });

// ---------- Exercises ----------

const ExerciseBase = {
  /** Local id, unique within its point. Full id = `${pointId}/${id}`. */
  id: Slug,
  /** Bump when the question/answer changes meaningfully. Progress is kept (it lives on the point). */
  version: z.number().int().positive().default(1),
  prompt: z.string().min(5),
  hint: z.string().optional(),
};

/** Covert retrieval: think → reveal → self-grade (3 buttons). */
export const RevealExercise = z.object({
  ...ExerciseBase,
  type: z.literal("reveal"),
  answer: z.string().min(1),
});

export const ChoiceOption = z.object({
  text: z.string().min(1),
  correct: z.boolean().default(false),
  /** Shown in feedback for this option (why it is right/wrong). */
  why: z.string().optional(),
});
/** Single- or multiple-selection, auto-graded. */
export const ChoiceExercise = z.object({
  ...ExerciseBase,
  type: z.literal("choice"),
  multiple: z.boolean().default(false),
  options: z.array(ChoiceOption).min(2).max(6),
  explanation: z.string().optional(),
});

/** Parameter for numeric exercises: a numeric range or a labelled choice. */
export const NumericParam = z.union([
  z.object({ min: z.number(), max: z.number(), step: z.number().positive() }),
  z.object({ choices: z.array(z.object({ value: z.union([z.string(), z.number()]), label: z.string() })).min(1) }),
]);

/** Calculation, verified by code in src/content/formulas.ts. */
export const NumericExercise = z.object({
  ...ExerciseBase,
  type: z.literal("numeric"),
  /** Name of a formula registered in formulas.ts. */
  formula: z.string(),
  /** Generated client parameters. Prompt may reference them as {name}. */
  params: z.record(z.string(), NumericParam),
  unit: z.string(),
  tolerance: z.object({ abs: z.number().nonnegative().optional(), rel: z.number().nonnegative().optional() }),
  /** Number of decimals to show in the worked solution. */
  decimals: z.number().int().min(0).max(3).default(0),
});

/** Oral-exam rehearsal: answer aloud (typing optional), then tick the key points covered. */
export const ExplainExercise = z.object({
  ...ExerciseBase,
  type: z.literal("explain"),
  keyPoints: z.array(z.string().min(2)).min(2).max(7),
  modelAnswer: z.string().min(10),
});

// ---------- Client cases (practical exam) ----------

/** Numeric step of a case: formula inputs come from the client params or from earlier numeric steps (by step id). */
export const CaseNumericStep = z.object({
  type: z.literal("numeric"),
  /** Step id — later prompts may show its CORRECT result as {id}, so one slip doesn't spoil the rest. */
  id: Slug,
  prompt: z.string().min(5),
  formula: z.string(),
  /** formula input → client param / earlier step id, or a constant. Default: same name. */
  inputs: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  unit: z.string(),
  tolerance: z.object({ abs: z.number().nonnegative().optional(), rel: z.number().nonnegative().optional() }),
  decimals: z.number().int().min(0).max(3).default(0),
  hint: z.string().optional(),
});
export const CaseChoiceStep = z.object({
  type: z.literal("choice"),
  prompt: z.string().min(5),
  multiple: z.boolean().default(false),
  options: z.array(ChoiceOption).min(2).max(6),
  explanation: z.string().optional(),
});
export const CaseExplainStep = z.object({
  type: z.literal("explain"),
  prompt: z.string().min(5),
  keyPoints: z.array(z.string().min(2)).min(2).max(7),
  modelAnswer: z.string().min(10),
});
export const CaseRevealStep = z.object({
  type: z.literal("reveal"),
  prompt: z.string().min(5),
  answer: z.string().min(1),
});
export const CaseStep = z.discriminatedUnion("type", [CaseNumericStep, CaseChoiceStep, CaseExplainStep, CaseRevealStep]);

/**
 * Model client case: a generated client (seeded params, like numeric exercises) worked through step by step —
 * calculation, judgement, explanation. Graded as a whole from the step outcomes.
 */
export const CaseExercise = z.object({
  ...ExerciseBase,
  type: z.literal("case"),
  /** Client description shown throughout; may reference {param}. */
  prompt: z.string().min(5),
  params: z.record(z.string(), NumericParam).default({}),
  steps: z.array(CaseStep).min(2).max(8),
});

export const Exercise = z.discriminatedUnion("type", [
  RevealExercise,
  ChoiceExercise,
  NumericExercise,
  ExplainExercise,
  CaseExercise,
]);

// ---------- Knowledge points & topics ----------

export const SourceRef = z.object({
  /** PDF page numbers (printed page numbers match PDF indices). */
  pages: z.array(z.number().int().positive()).min(1),
  /** Short phrase (≤ 12 words) that must appear verbatim (modulo whitespace) on one of the pages. */
  anchor: z.string().min(3).optional(),
});

export const PointStatus = z.enum([
  "course", // what the script says
  "course-disputed", // what the script says, with a noted tension/inconsistency (note required)
  "supplementary", // clearly labelled addition beyond the script (note required)
]);

export const Point = z.object({
  id: Slug,
  title: z.string().min(2),
  kind: z.enum(["fact", "concept", "comparison", "procedure"]),
  /** A = core / criterion-critical, B = useful, C = not scheduled in the main flow. */
  tier: z.enum(["A", "B", "C"]),
  /** Wrong knowledge here could harm a client, or the right action is referral. Raises planning priority. */
  safety: z.boolean().default(false),
  status: PointStatus.default("course"),
  criteria: z.array(z.string()).min(1),
  source: SourceRef,
  /** Výklad shown before first retrieval. Concise, paraphrased. */
  explanation: z.string().min(10),
  /** Pozn. — required for course-disputed and supplementary. */
  note: z.string().optional(),
  prereqs: z.array(Slug).default([]),
  confusableWith: z.array(Slug).default([]),
  exercises: z.array(Exercise).min(1).max(4),
});

export const Topic = z.object({
  id: Slug,
  title: z.string(),
  /** Chapter number as in the script (for her orientation; numbering in the script is inconsistent). Absent for
   *  cross-chapter topics such as model client cases. */
  chapter: z.number().int().positive().optional(),
  pages: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  summary: z.string().min(10),
  /** Order in the library. */
  order: z.number().int(),
});

export const TopicFile = z.object({
  topic: Topic,
  points: z.array(Point).min(1),
});

export type CriteriaFile = z.infer<typeof CriteriaFile>;
export type Criterion = z.infer<typeof Criterion>;
export type Competency = z.infer<typeof Competency>;
export type Exercise = z.infer<typeof Exercise>;
export type RevealExercise = z.infer<typeof RevealExercise>;
export type ChoiceExercise = z.infer<typeof ChoiceExercise>;
export type NumericExercise = z.infer<typeof NumericExercise>;
export type ExplainExercise = z.infer<typeof ExplainExercise>;
export type CaseExercise = z.infer<typeof CaseExercise>;
export type CaseStep = z.infer<typeof CaseStep>;
export type CaseNumericStep = z.infer<typeof CaseNumericStep>;
export type NumericParam = z.infer<typeof NumericParam>;
export type Point = z.infer<typeof Point>;
export type Topic = z.infer<typeof Topic>;
export type TopicFile = z.infer<typeof TopicFile>;

/** Compiled bundle consumed by the app (generated/content.json). */
export type PointWithTopic = Point & { topicId: string; order: number };
export type ContentBundle = {
  builtAt: string;
  competencies: Competency[];
  topics: Topic[];
  points: PointWithTopic[];
};
