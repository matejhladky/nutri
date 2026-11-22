/**
 * Content loading + integrity validation. Pure functions over parsed files, plus a Node loader.
 * Used by scripts/content.ts (build/check) and by tests.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  CriteriaFile,
  TopicFile,
  type ContentBundle,
  type PointWithTopic,
  type TopicFile as TopicFileT,
  type CriteriaFile as CriteriaFileT,
  type CaseExercise,
} from "./schema";
import { formulas, instantiate, instantiateCase } from "./formulas";

export type Issue = { level: "error" | "warn"; where: string; message: string };

export function loadContentFiles(
  root = "content",
  include: (file: string) => boolean = () => true,
): {
  criteria: CriteriaFileT;
  topics: { file: string; data: TopicFileT }[];
  issues: Issue[];
} {
  const issues: Issue[] = [];
  const criteriaRaw = parseYaml(readFileSync(join(root, "criteria.yaml"), "utf8"));
  const criteriaParsed = CriteriaFile.safeParse(criteriaRaw);
  if (!criteriaParsed.success) {
    throw new Error(`criteria.yaml invalid:\n${criteriaParsed.error.message}`);
  }
  const topics: { file: string; data: TopicFileT }[] = [];
  const dir = join(root, "topics");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".yaml") && include(f)).sort()) {
    const raw = parseYaml(readFileSync(join(dir, file), "utf8"));
    const parsed = TopicFile.safeParse(raw);
    if (!parsed.success) {
      for (const iss of parsed.error.issues) {
        issues.push({ level: "error", where: `${file}:${iss.path.join(".")}`, message: iss.message });
      }
      continue;
    }
    topics.push({ file, data: parsed.data });
  }
  return { criteria: criteriaParsed.data, topics, issues };
}

const wordCount = (s: string) => s.trim().split(/\s+/).length;

/** Integrity checks that need no source text. */
export function validateContent(criteria: CriteriaFileT, topics: { file: string; data: TopicFileT }[]): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: "error", where, message });
  const warn = (where: string, message: string) => issues.push({ level: "warn", where, message });

  const criterionIds = new Set(criteria.competencies.flatMap((c) => c.criteria.map((k) => k.id)));
  const criterionMethods = new Map(criteria.competencies.flatMap((c) => c.criteria.map((k) => [k.id, k.method] as const)));
  const topicIds = new Set<string>();
  const pointIds = new Map<string, string>();

  for (const { file, data } of topics) {
    if (topicIds.has(data.topic.id)) err(file, `duplicate topic id ${data.topic.id}`);
    topicIds.add(data.topic.id);
    for (const p of data.points) {
      if (pointIds.has(p.id)) err(`${file}:${p.id}`, `duplicate point id (also in ${pointIds.get(p.id)})`);
      pointIds.set(p.id, file);
    }
  }

  for (const { file, data } of topics) {
    for (const p of data.points) {
      const where = `${file}:${p.id}`;
      for (const c of p.criteria) if (!criterionIds.has(c)) err(where, `unknown criterion ${c}`);
      for (const r of p.prereqs) if (!pointIds.has(r)) err(where, `unknown prereq ${r}`);
      for (const r of p.confusableWith) if (!pointIds.has(r)) err(where, `unknown confusableWith ${r}`);
      if (p.prereqs.includes(p.id)) err(where, "point lists itself as prereq");
      if ((p.status === "course-disputed" || p.status === "supplementary") && !p.note) {
        err(where, `status ${p.status} requires a note`);
      }
      if (wordCount(p.explanation) > 90) warn(where, `explanation has ${wordCount(p.explanation)} words (aim ≤ 80)`);
      if (p.source.anchor && wordCount(p.source.anchor) > 12) warn(where, `anchor has ${wordCount(p.source.anchor)} words (max 12)`);
      const oralOrPractical = p.criteria.some((c) => criterionMethods.get(c)?.some((m) => m === "U" || m === "PR"));
      const hasExplain = p.exercises.some((e) => e.type === "explain" || (e.type === "case" && e.steps.some((st) => st.type === "explain")));
      if (p.tier === "A" && oralOrPractical && !hasExplain) {
        warn(where, "tier-A point with an oral/practical criterion has no explain exercise");
      }
      const p0 = data.topic.pages[0] - 1;
      const p1 = data.topic.pages[1] + 1;
      for (const pg of p.source.pages) {
        if (pg < p0 || pg > p1) warn(where, `source page ${pg} outside topic range ${data.topic.pages.join("–")}`);
      }

      const exIds = new Set<string>();
      for (const ex of p.exercises) {
        const ew = `${where}/${ex.id}`;
        if (exIds.has(ex.id)) err(ew, "duplicate exercise id");
        exIds.add(ex.id);
        if (ex.type === "choice") {
          const correct = ex.options.filter((o) => o.correct).length;
          if (!ex.multiple && correct !== 1) err(ew, `single-choice must have exactly 1 correct option (has ${correct})`);
          if (ex.multiple && correct < 1) err(ew, "multiple-choice needs at least 1 correct option");
          const texts = ex.options.map((o) => o.text.trim().toLowerCase());
          if (new Set(texts).size !== texts.length) err(ew, "duplicate option texts");
          const noWhy = ex.options.filter((o) => !o.correct && !o.why).length;
          if (noWhy) warn(ew, `${noWhy} wrong option(s) without "why"`);
        }
        if (ex.type === "case") issues.push(...validateCase(ex, ew));
        if (ex.type === "numeric") {
          const f = formulas[ex.formula];
          if (!f) {
            err(ew, `unknown formula ${ex.formula}`);
            continue;
          }
          for (const input of f.inputs) if (!(input in ex.params)) err(ew, `formula input ${input} missing in params`);
          for (const m of ex.prompt.matchAll(/\{(\w+)\}/g)) {
            if (!(m[1] in ex.params)) err(ew, `prompt placeholder {${m[1]}} has no param`);
          }
          if (ex.tolerance.abs === undefined && ex.tolerance.rel === undefined) err(ew, "numeric needs a tolerance");
          for (let seed = 1; seed <= 25; seed++) {
            try {
              const inst = instantiate(ex, seed);
              if (!Number.isFinite(inst.answer) || inst.answer <= 0) {
                err(ew, `seed ${seed} gives non-positive/invalid answer ${inst.answer}`);
                break;
              }
            } catch (e) {
              err(ew, `seed ${seed}: ${(e as Error).message}`);
              break;
            }
          }
        }
      }
    }
  }

  // Prerequisite cycles
  const prereqs = new Map<string, string[]>();
  for (const { data } of topics) for (const p of data.points) prereqs.set(p.id, p.prereqs);
  const state = new Map<string, 1 | 2>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      err(id, `prerequisite cycle: ${[...path, id].join(" → ")}`);
      return;
    }
    state.set(id, 1);
    for (const r of prereqs.get(id) ?? []) if (prereqs.has(r)) visit(r, [...path, id]);
    state.set(id, 2);
  };
  for (const id of prereqs.keys()) visit(id, []);

  return issues;
}

/** Normalise text for anchor matching: lowercase, strip bullets/zero-width chars, collapse whitespace. */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[​‌‍﻿]/g, "")
    .replace(/[●○•▪■◦]/g, " ")
    .replace(/[„“”"]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Verify that every anchor phrase appears on (one of) its cited pages. Requires source/pages. */
function validateCase(ex: CaseExercise, ew: string): Issue[] {
  const out: Issue[] = [];
  const err = (m: string) => out.push({ level: "error", where: ew, message: m });
  const warn = (m: string) => out.push({ level: "warn", where: ew, message: m });
  const known = new Set(Object.keys(ex.params));
  const placeholders = (t: string, at: string) => {
    for (const m of t.matchAll(/\{(\w+)\}/g)) if (!known.has(m[1])) err(`${at}: placeholder {${m[1]}} is neither a client param nor an earlier step`);
  };
  placeholders(ex.prompt, "case prompt");
  ex.steps.forEach((st, i) => {
    const at = `step ${i + 1}`;
    placeholders(st.prompt, at);
    if (st.type === "numeric") {
      if (known.has(st.id)) err(`${at}: step id ${st.id} clashes with a param or earlier step`);
      const f = formulas[st.formula];
      if (!f) err(`${at}: unknown formula ${st.formula}`);
      else
        for (const input of f.inputs) {
          const src = st.inputs[input] ?? input;
          if (typeof src === "string" && !known.has(src)) err(`${at}: formula input ${input} → ${src} not available`);
        }
      if (st.tolerance.abs === undefined && st.tolerance.rel === undefined) err(`${at}: numeric step needs a tolerance`);
      known.add(st.id);
    }
    if (st.type === "choice") {
      const correct = st.options.filter((o) => o.correct).length;
      if (!st.multiple && correct !== 1) err(`${at}: single-choice must have exactly 1 correct option (has ${correct})`);
      if (st.multiple && correct < 1) err(`${at}: multiple-choice needs at least 1 correct option`);
      const noWhy = st.options.filter((o) => !o.correct && !o.why).length;
      if (noWhy) warn(`${at}: ${noWhy} wrong option(s) without "why"`);
    }
  });
  if (out.some((i) => i.level === "error")) return out;
  for (let seed = 1; seed <= 25; seed++) {
    try {
      const inst = instantiateCase(ex, seed);
      const bad = inst.steps.find((s) => s.type === "numeric" && (!Number.isFinite(s.answer) || s.answer <= 0));
      if (bad) {
        err(`seed ${seed}: a numeric step gives a non-positive/invalid answer`);
        break;
      }
    } catch (e) {
      err(`seed ${seed}: ${(e as Error).message}`);
      break;
    }
  }
  return out;
}

export function checkAnchors(topics: { file: string; data: TopicFileT }[], pagesDir = "source/pages"): Issue[] {
  const issues: Issue[] = [];
  if (!existsSync(pagesDir)) {
    return [{ level: "warn", where: pagesDir, message: "source pages missing — run `pnpm extract`; anchor check skipped" }];
  }
  const cache = new Map<number, string>();
  const page = (n: number) => {
    if (!cache.has(n)) {
      const f = join(pagesDir, `${String(n).padStart(3, "0")}.txt`);
      cache.set(n, existsSync(f) ? normalizeForMatch(readFileSync(f, "utf8")) : "");
    }
    return cache.get(n)!;
  };
  for (const { file, data } of topics) {
    for (const p of data.points) {
      const where = `${file}:${p.id}`;
      if (!p.source.anchor) {
        issues.push({ level: "warn", where, message: "no anchor phrase" });
        continue;
      }
      const pages = [...p.source.pages].sort((a, b) => a - b);
      const joined = pages.map(page).join(" ");
      if (!joined.includes(normalizeForMatch(p.source.anchor))) {
        // Help the author: is it somewhere else in the script?
        let foundOn: number | null = null;
        for (let n = 1; n <= 400 && foundOn === null; n++) {
          const t = page(n);
          if (!t) break;
          if (t.includes(normalizeForMatch(p.source.anchor))) foundOn = n;
        }
        issues.push({
          level: "error",
          where,
          message: `anchor not found on pages ${pages.join(",")}${foundOn ? ` (found on page ${foundOn})` : " (not found anywhere)"}: "${p.source.anchor}"`,
        });
      }
    }
  }
  return issues;
}

export function bundle(criteria: CriteriaFileT, topics: { file: string; data: TopicFileT }[]): ContentBundle {
  const sorted = [...topics].sort((a, b) => a.data.topic.order - b.data.topic.order);
  const points: PointWithTopic[] = [];
  for (const { data } of sorted) {
    data.points.forEach((p, i) => points.push({ ...p, topicId: data.topic.id, order: i }));
  }
  return {
    builtAt: new Date().toISOString(),
    competencies: criteria.competencies,
    topics: sorted.map((t) => t.data.topic),
    points,
  };
}

/** Markdown coverage report: criteria × points/exercises, gaps, disputed items. */
export function coverageReport(b: ContentBundle): string {
  const lines: string[] = [];
  const byCrit = new Map<string, PointWithTopic[]>();
  for (const p of b.points) for (const c of p.criteria) byCrit.set(c, [...(byCrit.get(c) ?? []), p]);
  const exCount = b.points.reduce((n, p) => n + p.exercises.length, 0);
  const types = new Map<string, number>();
  for (const p of b.points) for (const e of p.exercises) types.set(e.type, (types.get(e.type) ?? 0) + 1);
  const tiers = { A: 0, B: 0, C: 0 };
  for (const p of b.points) tiers[p.tier]++;

  lines.push("# Coverage report", "", "_Generated by `pnpm content:build` — do not edit._", "");
  lines.push(
    `**${b.topics.length} topics · ${b.points.length} points (A ${tiers.A} / B ${tiers.B} / C ${tiers.C}) · ${exCount} exercises** (` +
      [...types].map(([t, n]) => `${t} ${n}`).join(", ") +
      ")",
    "",
  );
  lines.push("| Criterion | Method | Points A | Points B | Exercises | Status |", "|---|---|---|---|---|---|");
  let gaps = 0;
  for (const comp of b.competencies) {
    for (const c of comp.criteria) {
      const ps = byCrit.get(c.id) ?? [];
      const a = ps.filter((p) => p.tier === "A").length;
      const bb = ps.filter((p) => p.tier === "B").length;
      const ex = ps.reduce((n, p) => n + p.exercises.length, 0);
      const target = c.method.includes("P") ? 6 : 4;
      const status = a === 0 ? "❌ gap" : a < target ? `⚠️ < ${target} A` : "✅";
      if (a === 0) gaps++;
      lines.push(`| ${c.id} ${c.label.slice(0, 60)} | ${c.method.join("+")} | ${a} | ${bb} | ${ex} | ${status} |`);
    }
  }
  lines.push("", `Criteria without any tier-A point: **${gaps}**`, "");
  const flagged = b.points.filter((p) => p.status !== "course");
  lines.push("## Disputed / supplementary points", "");
  if (flagged.length === 0) lines.push("_None._");
  for (const p of flagged) lines.push(`- **${p.id}** (${p.status}, s. ${p.source.pages.join(", ")}): ${p.note}`);
  lines.push("");
  return lines.join("\n");
}
