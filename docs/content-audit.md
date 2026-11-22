# Content audit brief (R4)

Risk-based audit of the existing bank. Read with `docs/content-authoring.md` (rules) and
`docs/content-verification.md` (checklist). Each auditor edits **only its assigned topic files** and writes its log to
`docs/audit/<group>.md`.

## 1. Safety & health accuracy (highest priority)

Scope in your files: every point with `safety: true`, and every tier-A point whose criteria include 3c, 7f, 7h, 8b,
8d or 10c, plus any claim about doses, limits, drugs, pregnancy, children, diseases, referral or legislation.

- Check each claim against **authoritative sources** (EFSA, WHO, EU regulations, Czech SZÚ / MZ ČR / SZPI / ČOI,
  professional guidelines such as ESPGHAN, NICE, ADA, ESC). Use web search; prefer primary sources.
- Log per point: claim checked · source (URL) · verdict (`ok` / `corrected` / `disputed` / `could not verify`).
- If wrong or unsafe: correct the content. **In counselling and safety contexts, correctness wins**: the question must
  test correct practice; if the script says otherwise, the note explains the discrepancy (do not reinforce it).
- If you cannot verify a claim: soften it to what is certain, or mark it in the note; never invent precision
  (numbers, phone lines, legal clauses) you could not confirm.

## 2. Disputed points (`course-disputed`)

Rewrite every tier-A note in three parts, in Czech, concise:

> **Skripta:** what the course says (pages). **Současné poznatky / předpisy:** what reliable sources say (name the
> source). **Ke zkoušce:** only what is actually known — we do NOT know the examiner's question bank. Use wording such
> as "Pokud se otázka výslovně ptá na skripta, odpověď skript je …"; never "u zkoušky odpověz …" as if known.

Questions on a disputed point must either say "podle skript" in the prompt (explicitly testing course knowledge) or
have a key that is correct under both readings. For safety-relevant disputes, test the correct practice.

## 3. Narrow tier A to a realistically coverable core (owner decision)

Your group gets **maximum** tier-A counts per primary criterion (see your task). Demote the rest to tier B. Keep A for:
safety-tagged points and cases (always), foundations other points build on, the definitions/classifications/numbers an
examiner of that criterion would most plausibly ask, and practical counselling rules. Demote: second-order detail,
points that overlap another A point, disputed trivia, narrow facts. Log each demotion with a one-line reason.
Never delete content; never change ids.

## 4. Flags (`reports/flags.md`, section for your files) — inspect, then decide

Flags are heuristics, not verdicts.
- `length-cue`: if the correct option stands out by length/qualifiers, rebalance (shorten it, make distractors equally
  specific).
- `number`: confirm the number on the cited page (or neighbouring pages); fix the citation, correct the number, or
  remove it.
- `near-duplicate`: differentiate or drop the weaker exercise.
- `recognition-only`: a point that stays tier A gets one `reveal` (or `explain` for oral criteria) exercise.
- `disputed-mcq`: see §2.

Also replace absurd distractors (options nobody would choose) with plausible misconceptions.

## Rules

- Keep ids stable; bump an exercise's `version` when its meaning changes; max 4 exercises per point.
- Check with `pnpm content:check --only <your files>` until 0 errors (do not run `content:build` or `content:flags`).
- Log format (`docs/audit/<group>.md`): sections *Safety & health*, *Disputed notes*, *Tier changes*, *Flags*, *Other*;
  one line per item.
