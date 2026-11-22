/**
 * Content pipeline.
 *   pnpm content:build  — validate schema + integrity, write src/generated/content.json and reports/coverage.md
 *   pnpm content:check  — build + verify anchor phrases against extracted source pages (needs `pnpm extract`)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { loadContentFiles, validateContent, checkAnchors, bundle, coverageReport, type Issue } from "../src/content/validate";

const mode = process.argv[2] ?? "build";

const { criteria, topics, issues: loadIssues } = loadContentFiles();
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

const b = bundle(criteria, topics);
mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/content.json", JSON.stringify(b));
mkdirSync("reports", { recursive: true });
writeFileSync("reports/coverage.md", coverageReport(b));
const ex = b.points.reduce((n, p) => n + p.exercises.length, 0);
console.log(`OK: ${b.topics.length} topics, ${b.points.length} points, ${ex} exercises (${warns.length} warnings)`);
