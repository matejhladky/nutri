# Roadmap & progress log

Exam ≈ 2026-12-06 (user estimate "about 2 weeks" on 2026-11-22; she will confirm the date in the app).
Constraint: **local only** until the user approves deployment (Vercel + Neon, private GitHub repo).

## M0 — Foundation & pilot slice ✅ (2026-11-22)

Done:
- Repo, Next.js 16 scaffold, `.gitignore` excluding `materials/`, `source/`, env files.
- `pnpm extract` (259 pages; printed page = PDF index), official criteria (`content/criteria.yaml`, 11 competencies / 50 criteria).
- Schema, formulas (course methods), validation, coverage report.
- Engine: evaluate, scheduler, state reducer/replay, planner + simulation script.
- Pilot content: Sacharidy (ch. 2), Metabolismus sacharidů (11.5), Energetická bilance (ch. 15), Nastavení jídelníčku (ch. 17)
  — 64 points / 118 exercises, all 4 types; independent verification pass done, all must/should-fix items applied.

Verified: `pnpm validate` green (content:check, typecheck, lint, 44 unit tests); `pnpm simulate` workload stable.

Findings to carry forward:
- Script contradicts itself across chapters (polysaccharide boundary, "mléčný cukr", glycolysis product, fat targets,
  glycogen amounts). Always grep the whole script.
- 45 min/day ≈ 250 new points in 14 days → keep bank ≈ 250–300 tier A.

## M1 — Usable study loop (local) ⏳ next

Acceptance:
- Dnes screen (days left, today's goal, one *Začít/Pokračovat* button) → session → cards for all 4 types → feedback
  (explanation, source page, disputed note) → suggests stopping at goal, *Pokračovat* continues.
- Persistence: Postgres via Drizzle (PGlite locally, Neon-ready); events idempotent; reload/resume mid-session; retry queue.
- Passphrase auth (signed httpOnly cookie). Exam date + daily minutes settable (minimal).
- "Nahlásit problém" stores a report and hides the item.
- Playwright smoke: log in → 10 cards → reload → continue → state persisted. Manual check at 390 px and desktop.

## M2 — Syllabus content + planner v2 (after M1)

Batches (each verified): (1) ch. 1, 3–9 written comp. 1; (2) ch. 10–11 rest comp. 2; (3) ch. 12, 14 comp. 3/4/9;
(4) ch. 16, 18–21 comp. 5–7; (5) ch. 13, 22–24 comp. 7h/8/10/11. Goal: every criterion ≥ 4–6 tier-A points.
Planner: confusable pairs near each other; tune pacing from real usage.

## M3 — Témata, Pokrok, client cases · M4 — Refinement & pre-exam sweep

See `docs/architecture.md` and the plan in the initial review.
