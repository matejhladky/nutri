/**
 * Content pipeline.
 *   pnpm content:build  — validate schema + integrity, write src/generated/content.json and reports/coverage.md
 *   pnpm content:check  — build + verify anchor phrases against extracted source pages (needs `pnpm extract`)
 *   pnpm content:check --only 03-tuky.yaml,04-bilkoviny.yaml
 *       — check only the listed topic files against the committed ones; writes nothing (safe for parallel authors)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { loadContentFiles, validateContent, checkAnchors, bundle, coverageReport, type Issue } from "../src/content/validate";

const mode = process.argv[2] ?? "build";

const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > 0 ? new Set(process.argv[onlyArg + 1].split(",").map((f) => f.replace(/^.*\//, ""))) : null;
const committed = only
  ? new Set(execFileSync("git", ["ls-files", "content/topics"], { encoding: "utf8" }).split("\n").map((f) => f.replace(/^.*\//, "")))
  : null;
const keep = (file: string) => !only || only.has(file) || committed!.has(file);

const loaded = loadContentFiles(undefined, keep);
const { criteria, topics, issues: loadIssues } = loaded;
const issues: Issue[] = [...loadIssues, ...validateContent(criteria, topics)];
if (mode === "check") issues.push(...checkAnchors(topics));

const errors = issues.filter((i) => i.level === "error");
const warns = issues.filter((i) => i.level === "warn");
for (const i of warns) console.warn(`warn  ${i.where}: ${i.message}`);
for (const i of errors) console.error(`ERROR ${i.where}: ${i.message}`);

if (errors.length) {
  console.error(`\n${errors.length} error(s). Content not written.`);
  process.exit(1);
}
if (only) {
  const mine = topics.filter((t) => only.has(t.file));
  const pts = mine.flatMap((t) => t.data.points);
  const tiers = ["A", "B", "C"].map((t) => `${t} ${pts.filter((p) => p.tier === t).length}`).join(" / ");
  const perCrit = new Map<string, number>();
  for (const p of pts) if (p.tier === "A") perCrit.set(p.criteria[0], (perCrit.get(p.criteria[0]) ?? 0) + 1);
  console.log(`OK (only ${[...only].join(", ")}): ${pts.length} points (${tiers}), ${pts.reduce((n, p) => n + p.exercises.length, 0)} exercises`);
  console.log(`Tier A by primary criterion: ${[...perCrit].sort().map(([c, n]) => `${c}:${n}`).join(" ")}`);
  process.exit(0);
}

const b = bundle(criteria, topics);
mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/content.json", JSON.stringify(b));
mkdirSync("reports", { recursive: true });
writeFileSync("reports/coverage.md", coverageReport(b));
const ex = b.points.reduce((n, p) => n + p.exercises.length, 0);
console.log(`OK: ${b.topics.length} topics, ${b.points.length} points, ${ex} exercises (${warns.length} warnings)`);
