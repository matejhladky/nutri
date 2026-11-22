# Roadmap & progress log

Exam: **2026-12-04** (confirmed by the user; hard-coded in `src/lib/exam.ts`).
Constraint: **local only** until the user approves deployment (Vercel + Neon, private GitHub repo). The user chose to
finish the whole app (M2–M4) before she starts using it.

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

## M1 — Usable study loop (local) ✅ (2026-11-22)

Done: login, Dnes, study session (intro + 4 exercise types, feedback, worked solutions, disputed notes, report button),
thin Témata (list, topic page, topic practice) and Pokrok (per competency, weak points), Nastavení (exam date,
daily minutes, logout). Persistence via PGlite/Neon, outbox, session resume.

Verified: `pnpm validate` (45 unit tests) and `pnpm test:e2e` (6 tests, Pixel 7 + desktop): login → study → reload
resumes the same card → events on server; offline answers sync after reconnect; 401 without session. Visual check of
all screens at 390 px and 1280 px.

Not done yet: deployment (needs approval + accounts), content beyond the 4 pilot chapters, client cases.

Original acceptance:
- Dnes screen (days left, today's goal, one *Začít/Pokračovat* button) → session → cards for all 4 types → feedback
  (explanation, source page, disputed note) → suggests stopping at goal, *Pokračovat* continues.
- Persistence: Postgres via Drizzle (PGlite locally, Neon-ready); events idempotent; reload/resume mid-session; retry queue.
- Passphrase auth (signed httpOnly cookie). Exam date + daily minutes settable (minimal).
- "Nahlásit problém" stores a report and hides the item.
- Playwright smoke: log in → 10 cards → reload → continue → state persisted. Manual check at 390 px and desktop.

## M2 — Syllabus content + planner v2 (in progress)

Done:
- Exam date fixed to 2026-12-04; the setting was removed (Nastavení shows it read-only).
- Planner: confusable partners are symmetric; a point whose partner is already known gets a ×1.2 contrast bonus.
  Feedback shows "Nezaměň s …" (known partners) whenever the Výklad is shown.
- `pnpm content:check --only a.yaml,b.yaml` lets parallel authors validate their own files against committed content.
- Authoring brief: `docs/content-authoring.md`.

Budget: `pnpm simulate 450 11 45` → ~210 new points fit (60 min → ~275) ⇒ ≈ 210–230 tier-A points in total.

Batches (author subagent → content:check → verifier subagent → fixes → commit):
1. ch. 1, 3–5 (1a, 1b, 1d) · 2. ch. 6–9 (1e, 1f) · 3. ch. 10–11 (2a–2e, 2g) · 4. ch. 12 (4a–4c, 9a–9d)
5. ch. 13 (8a–8e) · 6. ch. 14, 24 (3a–3c, 5b, 10a, 11a, 11b) · 7. ch. 16, 18, 19 (7e, 7b, 7c, 6a)
8. ch. 20, 21 (7d, 7f, 6c) · 9. ch. 22, 23 (7h, 7g, 3c, 10c, 10d)

Acceptance: 0 criteria without tier A; written criteria ≥ 6 A, others ≥ 4 A (or a documented reason); verifier on
100 % of items.

## M3 — Témata, Pokrok, client cases · M4 — Refinement & pre-exam sweep

See `docs/architecture.md` and the plan in the initial review.
