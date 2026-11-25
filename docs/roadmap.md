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
- "Nahlásit chybu" stores a report and hides the item.
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

## R2 — Planner: cover what matters ✅ (2026-11-22)

Done: transparent priority (30 hand-tagged safety points, cases, foundation; `reports/priority.md`); case
prerequisites cut to 1–2; tier C no longer uses the daily new target; minutes-based budget with per-type timing,
expected relearning, 40 % reserved for new material, value-per-minute review selection and visible deferral; max two
failures per point per day; calibration from her observed medians/success rate (server, ≥ 8 samples per type /
≥ 30 reviews); state versioning with lazy rebuild; simulation v2 with matrix. Also fixed two bugs found on the way
(new target growing during the day; first-retrieval wait livelock).

Simulation matrix (11 days; MODEL ESTIMATES — FSRS grading its own predictions; to be checked against her data):

| daily plan | typical learner: minutes/day · tier A · safety · cases | weaker (−20 % accuracy) |
|---|---|---|
| 30 min | 23–45 · 71/297 · 29/30 · 8/12 | 31–50 · 46/297 · 23/30 · 6/12 |
| 45 min | 36–52 (one day 69) · 118/297 · 30/30 · 11/12 | 40–73 · 86/297 · 30/30 · 9/12 |
| 60 min | 44–70 (one day 89) · 164/297 · 30/30 · 12/12 | 49–100 · 124/297 · 30/30 · 11/12 |

Honest compromise: with realistic timing only ~40 % (45 min) to ~55 % (60 min) of tier A can be *introduced* in
11 days; safety points and cases come first, the rest is spread proportionally across criteria. Material she already
knows from the lectures will be cheaper once R3 (ask first) is in — not modelled here. Overruns for a weaker learner
remain until calibration from her real success rate kicks in.

## R3 — Learning flow ✅ (2026-11-23)

Done: ask-first for facts and comparisons (explanation shown after the attempt), explanation-first for concepts,
procedures and cases; production preferred after the first retrieval; honest status definitions (see architecture);
daily counter = answers; hint in a case step counted; stricter partial multi-select; events carry `exerciseType`.
Tests: 69 unit (ask-first, statuses, partial credit, case hint), 14 browser.

Simulation matrix after R2+R3 (11 days, prior knowledge 0.5 — an ASSUMPTION; model estimates):

| daily plan | typical learner: minutes/day · tier A · safety · cases | weaker learner |
|---|---|---|
| 30 min | 18–49 · 65/297 · 28/30 · 8/12 | 21–51 · 46/297 · 23/30 · 6/12 |
| 45 min | 32–58 · 86/297 · 30/30 · 9/12 | 39–70 · 65/297 · 28/30 · 8/12 |
| 60 min | 39–74 · 146/297 · 30/30 · 12/12 | 47–91 · 102/297 · 30/30 · 10/12 |

The honest time model is decisive: realistic per-card times (spoken answers, calculations, cases) mean only about a
third (45 min) to a half (60 min) of tier A can be introduced in 11 days; safety and cases come first. Day-to-day
minutes vary ±30 % around the plan; a weaker learner still overruns until her real success rate calibrates the model.
**Open question for the owner:** with 297 tier-A points far above capacity, should tier A be narrowed in the content
audit (R4) so "tier A" means "realistically coverable core" — or is the priority ordering enough?

## R4 — Content audit ✅ (2026-11-23)

Seven auditor subagents (one per file group, `docs/content-audit.md`) + an independent verifier:
- **Safety & health / legal**: ~230 claims checked against authoritative sources (EFSA, WHO, EU law, SÚKL, SZÚ,
  zákon 110/1997, ADA/ESC/ESPGHAN/NICE/IOC); ~55 corrected — e.g. hypoglycaemia first aid (15–20 g, re-check, nothing
  by mouth if unconscious), warfarin interactions, SGLT2/sulfonylurea caveats, liver/retinol in pregnancy, vitamin D
  supplement limit (SÚKL 2022/2024), forbidden supplement substances (vyhl. 368/2024), caffeine (EFSA 2015), food
  supervision (SZPI/SVS/KHS since 2025; ČOI is not a food supervisor), allergen labelling, organic and GMO rules.
  Logs with source URLs: `docs/audit/G1–G7.md`; verifier (93 confirmed, 2 fixed, 2 softened): `docs/audit/verification.md`.
- **Disputed notes**: ~85 rewritten in the three-part form (script · current evidence/regulation · what is actually
  known about the exam); safety-relevant disputes now test correct practice.
- **Tier A narrowed** 297 → 186 by per-criterion quotas (owner decision); every criterion keeps tier A; all 30 safety
  points and 12 cases are A. Two reconciliation promotions (LDL/HDL roles, breastfeeding).
- **Flags** (`pnpm content:flags`, inspection aids): length cues 97 → 2, recognition-only tier A 38 → 0; remaining
  disputed-MCQ / number flags were inspected and dismissed with reasons in the logs.

Simulation after R4 (11 days, prior 0.5, model estimates): 45 min → ≈ 87/186 tier A introduced (typical learner),
60 min → ≈ 133/186; safety 30/30 and cases 11–12/12 except the 30-min / weaker-learner scenarios.

## R5 — Final fixes & educational audit ✅ (2026-11-23)

- **UI:** a failed report keeps the card (retry, error shown); today's answer count comes from the event log
  (server), not localStorage. Explain self-check: target stated up front ("Zkus zmínit N bodů"), key points judged one
  at a time with later ones hidden, then missed points + model answer + note (grading unchanged). A lucky guess
  ("Tipuji") now shows the Výklad. Dnes checked at 390/820/1440/1920 px: no layout fixes needed.
- **Educational audit** (4 read-only reviewers: ch. 1–9, 10–13, 14–25 + cases, cross-cutting design; reports kept
  outside the repo). No wrong keys found in tier A; main weaknesses were test-wise cues, strawman distractors,
  duplicated scenarios and fixed judgement in cases. 89 exercises changed, 21 added, 13 replaced (removed) by 3 non-overlapping editors, then an independent
  verifier (1 must-fix: PAL labels; 12 should-fix) — all applied. Ids kept; changed meaning → new id or version bump.
- **Flags:** `content:flags` gained `absolute-wrong`, `hedge-key`, `longest-key` for the remaining distractor pass.
- **Not done (owner decision):** tier reallocations, new points/cases (capstone, food diary, 8d, DM2), judgement
  variants of cases, exemplar diagnostic conclusion and one-day menu, splitting multi-fact points.

## R6 — Two learners ✅ (2026-11-24)

A second learner (Danča, a friend of Lucka's) shares the app. Each has her own passphrase (`LEARNER_1/2_PASSPHRASE`), greeting
name and exam date; all personal data is scoped by `learner_id` (events, point state, reports, settings, observed
timing, today's count) and browser storage is per learner. Stale tabs after switching accounts are refused (409) and
reload as the current learner; their queued answers wait for their owner. Existing production data migrates to
learner 1 on first start; learner 2 starts empty. Engine, planner, content and UI unchanged.

Verified: unit tests for token/passphrase handling, per-learner store isolation (same point, reused event id, today's
count, timing, settings, reports, full rebuild) and the migration from the old schema (incl. a dry run on a copy of a
real dev DB); browser tests for separate greeting/date/settings/progress, account switching on one device with a queued
offline answer, and a stale tab of the other learner. Upgrade procedure: `docs/deploy.md`.

## R7 — Study activity ✅ (2026-11-24)

Pokrok opens with the last 14 study days: one sentence for the past 7 days (answers, days with studying, points met for
the first time) and a quiet 14-bar chart (last 7 days darker, today marked, empty days as stubs). Dnes acknowledges
today's answers inside the plan card once she has started, and below it shows the path to the exam (study days so
far sized by answers, today, the days left, the exam) and a map of the syllabus — one square per core point, one bed
per topic, coloured by status, today's new points ringed with a one-off fade-in. Data: answer events per study day from the event log,
scoped to the learner; no new tables. Tests: per-day bucketing (04:00 boundary, 14-day window, intros and re-sends
excluded), date helpers across a month/DST change, the 7-day window for new points, Pokrok/Dnes in the browser,
activity isolation between learners.

## R8 — Admin area ✅ (2026-11-24)

`/admin` behind `ADMIN_PASSPHRASE`: per learner (switch in the header) the path to the exam, scheduled reviews,
activity, statuses, weak points, reports, competencies and topics — the same components and calculations as the app,
read-only on the server. Content explorer: topics → points (Výklad, note, source, criteria, links) → exercises with the
answer key; "Vyzkoušet" opens the real card in a sandbox. Tests: admin/learner tokens not interchangeable, read-only
guard, an overview writes nothing, learners can't open admin, an admin session can't read or write learner APIs,
switching learners shows each one's data, the preview makes no requests and changes no state.

## R9 — Dnes redesign + comparison line ✅ (2026-11-25)

Dnes reworked after two independent design reviews: one dark plan card ("Plán na dnešek", "Ještě …", progress bar in
planned minutes, one caption, button right on desktop), the comparison line with Danča/Lucka right under it (11 states,
emoji, effort only), then on the paper with hairlines: "Do zkoušky zbývá N dní" + a calendar timeline, and the
knowledge map as one 4-row block per topic sorted by status with today's new points dotted. Countdown no longer
duplicated in the sidebar on Dnes. "Upevněno" renamed "Naučeno". Tests: every line state and plural, the server
summary (only aggregates, read-only, per learner), answers over plan, map/timeline markup, browser checks.

## R10 — Calculations without drill ✅ (2026-11-25)

Learner feedback: the formula calculations kept repeating although the formulas need not be known by heart, which was
annoying and slow. Cause: the formula sat behind "Nápověda", using it graded the answer Hard (case step: partial) and
brought the calculation back sooner; cases redid the whole chain every repeat. Now: formulas shown openly with every
calculation (47 of 60; the 13 hints that ARE the tested fact stay as hints); a calculation solved once gives way to the
point's other questions; a solved case repeats only its decisions (calculations shown worked out). Retired "Napiš
rovnici Mifflin-St Jeor"; the Mifflin/Katch explain key points ask for the method, not the constants (v2). Simulation
(9 days, model estimate): calculations 82 → 51 at 45 min/day, 97 → 84 at 60, 91 → 60 at 90; the formula being visible
(fewer failures) is not modelled, so the real effect should be larger. Tests: grading with given steps, solved state
incl. earlier hinted answers, exercise choice, content (every calculation has a formula or a knowledge hint; no
equation asked by heart), browser: formula visible, short case end to end.

## R11 — Plain plan card + "Novinka" notices ✅ (2026-11-26)

Plan card in time and questions only ("Asi 75 minut" / "Ještě asi 67 minut" / "Máš za sebou 24 otázek." / "Pro
dnešek hotovo"; "Kolem 18:30 jich tu ještě pár přibude."); the "se dnes nevejde, přijde zítra" line is gone.
Notices about bigger changes: `src/lib/news.ts` (add an entry to announce one); each learner sees the newest one she
hasn't dismissed, only if she studied before that change; dismissal stored in her settings (`seenNews`, all devices).
First notice: the calculation change (R10).

## Status

All roadmap milestones (M0–M4, R1–R11) are done locally. Not done (owner decision): deployment — runbook in
`docs/deploy.md`; the Neon path is the one untested component. Remaining known limits: content is AI-authored and
AI-verified (no human review); the time model is an estimate until calibrated by her own answers; Czech supplement and
food law changed in 2024–2025 and may change again.
