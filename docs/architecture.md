# Architecture & decisions

## Overview

```
materials/skrpita.pdf ──pnpm extract──▶ source/pages/NNN.txt (gitignored)
                                               │ (authoring + anchor check)
content/criteria.yaml, content/topics/*.yaml ──pnpm content:build──▶ src/generated/content.json + reports/coverage.md
                                                                          │ (bundled into the app)
Browser: planner + evaluate + scheduler (same pure engine) ──events──▶ server ──▶ Postgres (events = source of truth)
```

- **Stack:** Next.js 16 (App Router, TS), Tailwind 4, ts-fsrs 6 (FSRS-7), zod 4, Vitest. Planned: Drizzle + Neon
  Postgres (PGlite locally), passphrase auth with a signed cookie, Playwright smoke test.
- **Content is static and versioned** in the repo; the database stores only learner data.

## Content model (two entities)

- **Topic** ≈ a script chapter (how she knows the material from lectures): title, chapter, page range, summary.
- **Point** (*poznatek*) — one atomic, testable idea: `kind` (fact/concept/comparison/procedure), `tier` (A/B/C),
  `status` (course / course-disputed / supplementary + `note`), `criteria` (first = primary), `source` (pages + ≤ 12-word
  anchor phrase that must appear on the page), `explanation` (Výklad, ≤ 80 words), optional `prereqs`, `confusableWith`,
  and 1–4 **exercises**.
- No separate learning-objective layer or concept graph: for ~500 points they duplicated each other.

### Exercise types (interaction types, not content styles)

| type | interaction | grading |
|---|---|---|
| `reveal` | think → reveal → *Nevěděla / S námahou / Věděla* | self-grade → Again / Hard / Good |
| `choice` | single or multiple selection, optional *Tipuji* | auto; guessed or hint → Hard; multi partial (no wrong picks) → Hard |
| `numeric` | typed number; parameters generated from a seed | `src/content/formulas.ts` computes answer + worked solution; tolerance |
| `explain` | answer aloud (typing optional) → tick key points covered | all → Good, ≥ ½ → Hard, else Again |

*Nevím* → Again everywhere. A hint caps the grade at Hard. No Easy grade (14-day horizon). Comparison, misconception and
scenario questions are written in these four forms; client cases will be sequences of them.

## Learner state

- **Events** (`intro`, `answer`) are append-only with client-generated UUIDs (idempotent submit). **Point state is a
  cache** rebuilt by `replay(events)`; the same reducer runs in the browser (optimistic) and on the server.
- **Scheduling unit = point**, not exercise. Exercises of a point rotate (least used, never the same twice in a row;
  recognition early, production later). Fixing an exercise therefore never loses progress.

## Scheduler (`src/engine/scheduler.ts`)

ts-fsrs `DefaultScheduler`: desired retention 0.9, learning steps `10m, 1d`, relearning `10m`, no fuzz,
`allowModelOverride: false` (otherwise FSRS-7 skips the steps and the first success jumps to ~5 days).
**Interval cap 7 days, not tied to the exam date** — capping to "days left" piled every review onto the final day in
simulation (360 reviews on day 14). A point due after the exam is already predicted ≥ 90 % recalled on exam day.

## Planner (`src/engine/planner.ts`)

1. Due learning steps; a just-introduced point is retrieved after ≥ 3 other cards (or immediately if nothing else).
2. Due reviews (lowest retrievability first) interleaved with new points (≈ 1 new per k reviews).
3. New points: per topic in authored order (separately per tier), prerequisites respected; across topics ranked by
   `tier weight × (0.5 + uncovered fraction of primary criterion)` → breadth across criteria.
4. Daily new target = min(pace, budget): pace = remaining A+B ÷ (days left − 2); final 2 days only missing tier A.
   Budget = (daily minutes − start-of-day review load × 0.5 min) ÷ 1.5 min, at least 10.
5. Never two consecutive cards from the same topic when an alternative exists. Topic mode = same engine filtered to one
   topic, no daily cap, then extra practice on weakest points.
6. Study day = 04:00–04:00 Europe/Prague.

**Simulation** (`pnpm simulate 500 14 45`): steady ~40 min/day, no final spike, mean predicted recall on exam day ≈ 0.93,
but only ~240 new points fit in 14 days at 45 min/day (≈ 320 at 60 min). ⇒ keep the bank focused (≈ 250–300 tier A).

## Content pipeline

Extraction and validation are deterministic; generation is authored in Claude Code sessions, so the committed YAML is
the reproducible artifact. Per batch: author from `source/pages` → `pnpm content:check` (schema, ids, references,
MCQ keys, numeric instantiation over 25 seeds, anchors on cited pages, prerequisite cycles) → independent verifier
subagent (`docs/content-verification.md`) → fix → commit. In-app "Nahlásit problém" (planned) hides a reported item
until reviewed.

## Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-11-22 | Compressed plan: usable loop ~day 2, syllabus ~day 5–6, library/progress thin and late | 2-week deadline |
| 2026-11-22 | Topic + Point model; 4 interaction types | simplest model covering written/oral/practical |
| 2026-11-22 | Schedule per point; event log as source of truth | sibling-card pile-up; safe content edits; replay |
| 2026-11-22 | FSRS-7, steps 10m/1d, no Easy, 7-day cap independent of exam | see Scheduler; simulation evidence |
| 2026-11-22 | Budget computed from start-of-day review load | otherwise finishing reviews unlocked extra new points |
| 2026-11-22 | Course method for calculations (BMR + NEAT coef + MET·kg·h + 10 % TEF; 1 kcal = 4.2 kJ) | exam follows the course |
