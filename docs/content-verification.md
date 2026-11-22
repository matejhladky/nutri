# Content verification brief

Used for the independent review pass on every content batch (run as a subagent that did **not** author the batch).
The reviewer reads, it does not edit content files.

## Inputs

- Topic files to review: `content/topics/<files>.yaml` (schema: `src/content/schema.ts`).
- Source text: `source/pages/NNN.txt` — one file per PDF page; printed page number = file number.
  (Run `pnpm extract` if missing.) Read the pages cited in each point's `source.pages`, plus neighbours when context is needed.
- Official criteria: `content/criteria.yaml`.

## For every point and every exercise, check

1. **Grounding** — Is every claim in `explanation`, answers, model answers, key points and option `why` texts supported by the cited pages? Anything not in the script must be in a point with `status: supplementary` (or be uncontroversial framing).
2. **Correct key** — Is the marked answer correct *according to the script*? For `choice`: exactly the right options marked; no distractor that is also defensibly correct; no option that is correct under a reasonable reading of the stem.
3. **Ambiguity** — Could a well-prepared learner reasonably answer differently? Is the stem precise (units, which method, "podle skript" where the script is idiosyncratic)?
4. **Conflicts** — Does the script contradict itself on this point elsewhere (search `source/pages` with grep)? If yes and the point is not `course-disputed` with a note, flag it.
5. **Questionable claims** — Is the script's claim outdated or contrary to mainstream nutrition science? Flag it (the point should then be `course-disputed` with a note); do not silently "correct" it.
6. **Exam relevance & tier** — Is tier A justified (core for the mapped criterion)? Is volatile trivia (statistics, brand names, "trend 2026") being tested? Are the `criteria` mappings sensible?
7. **Language** — Natural, correct Czech; concise; consistent "ty" form; no copied passages longer than a short phrase.
8. **Numeric** — `formula` matches the course method in the prompt (e.g. which BMR equation); tolerance sensible.

## Output

A list of findings, each: `point id / exercise id` · severity (`must-fix` = wrong/ambiguous/unsupported; `should-fix`; `nit`) · problem · proposed fix (concrete replacement text where possible) · evidence (page + short quote).
End with a one-paragraph overall assessment. Do not list items that are fine.
