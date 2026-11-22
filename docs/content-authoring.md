# Content authoring brief

How to write a topic batch. The verification counterpart is `docs/content-verification.md`.

## Read first

- `CLAUDE.md`: hard constraints and content rules.
- `src/content/schema.ts`: the YAML schema (Topic, Point, 4 exercise types).
- `content/topics/02-sacharidy.yaml` and `content/topics/15-energeticka-bilance.yaml`: style exemplars (numeric
  exercises are in the latter).
- `content/criteria.yaml`: official exam criteria. Method P = written test, U = oral, PR = practical.
- Source: `source/pages/NNN.txt`, one file per page; the printed page number equals the file number. The outline is in
  `source/outline.json`.

## The learner and the exam

- One adult learner who attended the lectures and has the script.
- Exam: 2026-12-04 (~11 study days left), Czech national qualification *Výživový poradce*. Every criterion must be
  passed:
  - **Written test** (competencies 1–4): 75 MCQs; she needs ≥ 80 % overall and ≥ 50 % in each criterion.
  - **Oral** (U): explaining topics in her own words.
  - **Practical** (PR): simulated clients.
- The total bank budget is small (≈ 210–230 tier-A points for the whole syllabus), so each tier-A point must earn its
  place. Prefer **what an examiner would ask**: definitions, classifications, functions, sources, recommended intakes,
  deficiency/excess signs, differences between confusable things, and practical counselling rules.

## Points

- **One atomic, testable idea per point.** The title is short, the `kind` is fact / concept / comparison / procedure.
- **`explanation`** (Výklad): ≤ 80 words, paraphrased in plain Czech, shown before the first question. It must contain
  everything the exercises ask.
- **`tier`:**
  - A = core / criterion-critical.
  - B = useful detail (≤ ~40 % of the batch).
  - C = not scheduled (only if worth showing in the library).
- **`criteria`:** primary first. Use the criterion that the examiner would file the question under.
- **`source`:** `pages` cited (where it is actually stated) + `anchor`, a ≤ 12-word phrase copied **exactly** from one
  of the cited pages. Diacritics, hyphenation and line breaks are normalised by the checker, but the words must match.
  Choose a distinctive phrase and avoid table fragments.
- **`status`:**
  - `course` (default).
  - `course-disputed` + `note` when the script contradicts itself (grep the WHOLE script: `grep -ril "term" source/pages`)
    or is clearly outdated or contrary to mainstream science. Keep the course answer as the correct answer; the note says
    what the tension is and what to answer at the exam.
  - `supplementary` + `note` for a necessary addition that is not in the script. Use it rarely.
- **Never test volatile trivia:** survey percentages, market statistics, brand names, prices, "trend 2026" claims.
  Mechanistic marketing claims in "Pro praxi" boxes are at most course-disputed tier B.
- `prereqs`: only within your own files or the committed files.
- `confusableWith`: pairs she is likely to mix up (vitamin A vs D deficiency, LDL vs HDL, …). Link both directions.
- **Ids:** `<prefix>.<slug>` (lowercase, dashes); exercise ids are short slugs unique within a point. Never reuse an id
  for something different.

## Exercises (1–4 per point; aim for 2)

- **`choice`:** the main written-exam format.
  - 3–5 options, exactly 1 correct (or `multiple: true` with ≥ 1 correct; use for "which of these…" lists).
  - Every wrong option has a short `why`.
  - Distractors are plausible: the confusable concept, a wrong number from a neighbouring line of the script, a
    common misconception. Never "all of the above", never trick wording.
  - Avoid option-length giveaways: the correct option must not be the longest and most qualified.
  - Do not put the answer in the stem.
  - Write "podle skript" when the script's answer is idiosyncratic.
- **`reveal`:** a question → a concise answer (1–3 lines), self-graded. Use for production ("Vyjmenuj…", "Čím se liší…").
- **`explain`:** oral rehearsal.
  - `prompt` as an examiner would phrase it, 3–5 `keyPoints` (short, checkable), `modelAnswer` of 2–5 sentences.
  - **Every tier-A point under an oral (U) or practical (PR) criterion gets one.**
- **`numeric`:** only with a formula already registered in `src/content/formulas.ts` (do NOT edit that file). If you
  think a new formula is needed, describe it in your final report instead.
- Prompts address her informally ("ty"). Self-reference uses the feminine form.
- Czech must be natural and correct.

## Copyright

Paraphrase everything. No sentence copied from the script except the anchor phrase (≤ 12 words). No long lists copied
verbatim.

## Checking

Run `pnpm content:check --only <your-file>.yaml[,<file2>.yaml]`. It checks your files against the committed content,
writes nothing, and prints tier-A counts per criterion. Leave it with **0 errors**. Fix warnings unless you have a
reason.

Do not edit any file other than your own topic files. Do not run git commands that modify the repo.

## Final report (your last message)

- Files written, number of points by tier, tier A by primary criterion.
- Every `course-disputed` / `supplementary` point with a one-line reason.
- Contradictions you found elsewhere in the script that affect other chapters (with pages).
- Things in your chapters you deliberately left out and why. Formulas you would need.

## Client cases (`type: case`) — practical exam

A case is one exercise: a generated client (`params`, same syntax as numeric exercises) shown in `prompt`, then 2–8
`steps` worked through one at a time with immediate feedback. Graded as a whole (each step correct 1 / partial ½;
all → Good, ≥ ½ → Hard). Each repetition gets a new seed = a new client with the same procedure.

```yaml
- id: pripad
  type: case
  prompt: "Klientka, {age} let, {height} cm, {weight} kg, kancelářská práce, 3× týdně {minutes} min jógy ({met} MET)…"
  params:
    sex: { choices: [{ value: F, label: žena }] }
    age: { min: 25, max: 55, step: 1 }
    # …
  steps:
    - type: numeric           # id = name of the result; later prompts may show it as {bmr} (CORRECT value, rounded)
      id: bmr
      prompt: "Spočítej BMR podle Mifflin-St Jeor."
      formula: bmr-mifflin    # inputs default to same-named params/earlier steps
      unit: kcal
      tolerance: { abs: 15 }
    - type: numeric
      id: neat
      prompt: "BMR = {bmr} kcal. Spočítej NEAT (koeficient {coef})."
      formula: neat           # inputs bmr, coef → found in scope
      unit: kcal
      tolerance: { abs: 10 }
    - type: numeric
      id: cil
      prompt: "TDEE = {tdee} kcal. Jaký příjem nastavíš pro redukci s deficitem {pct} %?"
      formula: energy-goal
      inputs: { tdee: tdee, pct: pct }   # explicit mapping or constants, e.g. { coef: 0.2 }
      unit: kcal
      tolerance: { rel: 0.02 }
    - type: choice            # options/why like a choice exercise (no id)
    - type: explain           # keyPoints + modelAnswer
    - type: reveal            # answer
```

Formulas for chains: `bmr-mifflin`, `bmr-harris`, `bmr-katch`, `ffm`, `neat`, `eat`, `tef` (bmr, neat, eat),
`tdee-sum` (bmr, neat, eat, tef), `tdee-pal` (bmr, pal), `energy-goal` (tdee, pct), `per-kg` (weight, perKg),
`macro-fat` (energy, fatPct), `macro-carbs` (energy, weight, proteinPerKg, fatPct), `bmi`, `whr`,
`energy-availability`, `macro-percent`. Choose param ranges so every seed gives a realistic client.
Keep the **course method** (ch. 15/17). The case's point `explanation` (Výklad) summarises the procedure; `prereqs`
list the component points (e.g. `en.bmr-mifflin`, `en.neat`, `jid.makra-postup`).
