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

## M2 — Syllabus content + planner v2 ✅ (2026-11-22)

Done:
- Exam date fixed to 2026-12-04; the setting was removed (Nastavení shows it read-only).
- **Whole syllabus authored:** 22 topics (ch. 1–24; ch. 9 merged into 8, ch. 23 into 22), 479 points
  (A 285 / B 158 / C 36), 1 080 exercises (choice 663, reveal 207, explain 183, numeric 27).
  Every criterion meets its floor (written ≥ 6 tier A, oral/practical ≥ 4; `reports/coverage.md`).
- Process per batch: author subagent (`docs/content-authoring.md`) → `content:check` → independent verifier subagent
  (`docs/content-verification.md`) on 100 % of new items → the verifier applied its findings → full check.
  Main finding classes: cross-chapter contradictions with conflicting "correct" answers (vegan children, iron in
  pregnancy, alcohol limits, vitamin D for toddlers, waist limits) → one consistent exam guidance in both notes;
  script vs EU law in labelling (allergens, organic, aroma, GMO) → course-disputed; safety gaps in red flags
  (hypoglycaemia when unconscious, chest pain → 155, DM2 meds) → added with notes; duplicates across chapters merged
  or linked; ~300 missing "why" texts added.
- Supplementary (beyond the script, clearly labelled): gut hormones (2c), client types (11b), red flags (3c),
  IBS, coeliac diagnosis, Czech hospital diet numbers (7g), allergen list, E-number ranges, KHS/ČOI split.
- Formulas: WHR, per-kg dose, FFM, % energy from a macronutrient.
- Planner: confusables symmetric + contrast bonus + "Nezaměň s" in feedback; every prerequisite-ready point competes
  for breadth (before, only the first point per topic did → whole criteria unseen); prerequisites inherit the priority
  of what they unlock. `pnpm simulate real 11 45|60` on the real bank.
- `content:check` warns on wrong options without "why", anchors > 12 words, oral/practical tier-A without explain;
  `--only` for parallel authoring. Verbatim scan: no copied run longer than 23 words (tables/lists only).

Verified: `pnpm validate` green (content:check 0 errors, typecheck, lint, 49 unit tests); `pnpm test:e2e` 6/6;
screenshots of Dnes / Nastavení / Témata at 390 px.

**Workload (simulation, 11 study days from 2026-11-22):** 45 min/day → ~208 new points, every criterion ≥ 60 % of its
tier A introduced (written test needs ≥ 50 % correct per criterion); 60 min/day → ~278, every criterion ≥ 75 %,
only 11 tier-A points never seen. Mean predicted recall on exam day 0.93. **Recommend 60 min/day if she can.**

Known limits / open:
- Content is AI-authored and AI-verified only (no human review, by decision); she can report items in-app.
- Image-only content (figures) is covered only where a verifier rendered the page (ch. 9, Obr. 12.7).

## M3 — Model client cases ✅ (2026-11-22)

Done:
- New exercise type `case`: generated client + 2–8 steps (numeric / choice / explain / reveal) with feedback after each
  step; numeric steps chain on earlier steps' correct, displayed results; graded as a whole; new client per repetition.
  Engine (`instantiateCase`, `evaluateCaseStep`), server schema, validation (inputs/placeholders/25 seeds), UI
  (`CaseView.tsx`), formulas `tef`, `tdee-sum`, `energy-goal`, `macro-fat`.
- Topic "Modelové případy" (`25-modelove-pripady.yaml`): 12 tier-A cases — reduction (components), PAL vs components,
  Mifflin vs Katch, Harris vs Mifflin in obesity, muscle gain with macros, diagnostic conclusion (BMI/WHR), one-day
  plan, energy availability/RED-S, senior protein + fluids, red flags (hyperglycaemia → 155), suspected eating disorder,
  difficult clients (supplementary).
- Verified by an independent reviewer (generated 200 seeds per case: fixed-answer choices hold for every client; one
  ambiguous protein step and systematic length cues fixed).

Verified: `pnpm validate` (52 unit tests incl. case chaining/grading/validation), `pnpm test:e2e` 8/8 (new: a case is
worked through and recorded as one answer), screenshots of a case at 390 px.

## M4 — Pre-exam sweep & polish ✅ (2026-11-22)

Done:
- **Sweep:** after the daily goal, "Pokračovat" practises the introduced points with the lowest predicted recall on exam
  morning (tier A first, no repeats within 10 cards). In the final two days it replaces extra new material
  (Dnes: "Pokračovat: procvičit nejslabší místa"). Planner test added.
- **Realistic time:** daily plan counts a client case as ~3 min (not 0.5); simulation uses 3 min per case.
  `simulate real 11 45` → ~207 new, every criterion ≥ ~55 % of tier A introduced; at 60 min → ~272, ≥ 75 % everywhere.
- **"Co trénovat naživo"** (`/priprava`, linked from Témata): what the app can't train — intake role-play, tape/BIA,
  full calculation on paper, one-day menu, difficult-client role-play, referral, recording oral answers, exam logistics
  to confirm with the examining body. Ticks stored per device.
- Polish: case eyebrow shows the case title; Témata tab active on /priprava; web manifest + icons ("Přidat na plochu").
- Deployment prepared, not executed: `docs/deploy.md` (runbook, smoke check, operating reports/content fixes); the app
  refuses to start on Vercel without `DATABASE_URL`.

Verified: `pnpm validate` (53 unit tests), `pnpm test:e2e` 8/8, screenshots of a session, Pokrok and /priprava at 390 px.

## R1 — Reliability ✅ (2026-11-22, after the independent review)

Reproduced and fixed:
- **Duplicate grading on reload** (answer → reload → same card unanswered → 2nd answer; on a new point this moved the
  next review from tomorrow to +5 days). Now the answer is saved in the session with the event; reload shows feedback.
- **Lost case progress on reload** (back to step 1). Finished steps persist; the case resumes at the same step.
- **Premature repeats** (wrong answer → same point 30 s later in daily/topic/continue modes). Now strictly when due;
  natural stopping point with the time of the next step; extra practice separated (see architecture, planner 1 & 8).
- **Stale `point_state` under concurrent writes** (forced interleaving in a test: 1 answer cached instead of 2).
  Version-checked writes with retry; `pnpm db:rebuild`.
- **Queue blocking**: a malformed event failed the whole batch forever, and on the client even prevented the app from
  loading. Per-event validation + client-side guard.

Tests: unit (planner spacing ×4, store race/idempotency/validation ×4 on in-memory PGlite) — 59 total;
browser (Playwright, mobile + desktop): reload after answering, reload mid-case, malformed queued event — 14 total.

Known limits: the Neon path is still unverified until deployment; cross-device: each device keeps its own session.

## Next (decisions of 2026-11-22)

Deploy as soon as R2-min and the safety audit are done; the rest continues after deployment (content fixes redeploy,
progress is kept).

- **R2 — Planner: cover what matters.** Transparent *priority ranking* (not a binary flag, no fixed count), grounded in
  the official competencies, foundational importance, practical relevance and safety; I propose it, the owner reviews.
  Cases unlock with fewer prerequisites. Fix tier-C counting toward the daily target. Simulation v2: per-type answer
  times, learner-strength variants, report *which* objectives are omitted. Targets are reported, not hard-coded;
  simulated estimates are kept separate from observed outcomes, and timing is calibrated from her real `durationMs`
  once available. **R2-min before deployment:** ranking + case prerequisites + tier-C fix.
- **R4a — Safety audit before deployment.** Tier-A health/safety content (3c, 7h, 7f, 8b, 8d, 10c, red flags,
  supplements, pregnancy) checked against primary sources; disputed notes in the three-part form (script · current
  evidence/regulation · what is actually known about the exam — never claiming the examiner's answer without
  evidence); in counselling/safety contexts correctness first.
- **R3 — Learning flow.** Ask-first for facts and comparisons; worked example first for procedures, calculations,
  cases; recall preferred after the first retrieval; honest status/metric definitions (cards = answers, "upevněno" =
  unaided Good after ≥ 1 day); case-hint grading; partial multi-select rule.
- **R4b — Content audit (incremental).** Automated flags (length cue, numbers not on the cited page, disputed MCQ
  without "podle skript", near-duplicates) are *flags for inspection*, not verdicts; recall item for the 38 MCQ-only
  tier-A points; absurd distractors.
