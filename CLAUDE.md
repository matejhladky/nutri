# Nutri

Study companion for ONE learner preparing for the Czech exam *Výživový poradce* (NSK 69-042-N), ~2 weeks out.
Vision: `docs/vision.md` · Architecture & decisions: `docs/architecture.md` · Roadmap & progress log: `docs/roadmap.md`.

@AGENTS.md

## Commands

- `pnpm extract` — PDF → `source/pages/NNN.txt` (+ outline). Needed for anchor checks and authoring.
- `pnpm content:build` — validate content, write `src/generated/content.json` + `reports/coverage.md`
- `pnpm content:check` — build + verify every anchor phrase exists on its cited page
- `pnpm validate` — content:check, typecheck, lint, unit tests. **Run before every commit.**
- `pnpm simulate [points] [days] [minutes]` — planner workload simulation
- `pnpm dev` — local app

## Hard constraints

- **Never commit** `materials/` (copyrighted PDF), `source/` (verbatim extraction), `.env*`, or secrets. Repo stays private.
- Content is **paraphrased**; anchor phrases ≤ 12 words. No long verbatim passages anywhere in the repo.
- Learner-facing text is **Czech**, informal "ty", feminine forms where addressing her ("Věděla jsem").
- Do not deploy, push, or create external services without the user's explicit approval. Build locally.
- Content is "code": YAML in `content/` is the source of truth; never generate content at runtime.

## Content rules (see `docs/content-verification.md`)

- Teach what the **script** says. Where the script contradicts itself or mainstream science, keep the course answer,
  set `status: course-disputed` and explain in `note`. Additions beyond the script → `status: supplementary`.
- Before finalising a point, grep the WHOLE script (`source/pages`) for the key term — contradictions are usually in another chapter.
- First criterion in `criteria` is the primary one (planner uses it for breadth).
- Tier A = core / criterion-critical; B = useful; C = not scheduled in daily flow (trivia, trends).
- Target total ≈ 250–300 tier-A points (workload simulation: ~45 min/day covers ~250 new points in 14 days).
- Every batch: author → `pnpm content:check` → independent verifier subagent with `docs/content-verification.md` → fix → commit.
- Stable ids. Changing an exercise's meaning → bump its `version`. Never reuse an id for a different meaning.

## Code map

- `src/content/` — schema (zod), formulas (course calculation methods, seeded params), validation
- `src/engine/` — pure, shared client/server: `evaluate` (answer → grade), `scheduler` (ts-fsrs wrapper),
  `state` (event-log reducer), `planner` (what next), `time` (study-day boundaries, Europe/Prague 04:00)
- Engine code must stay pure and deterministic (no Date.now() inside; pass `now`).
