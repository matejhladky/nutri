import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadContentFiles, validateContent, checkAnchors, normalizeForMatch, bundle } from "./validate";
import type { TopicFile } from "./schema";

describe("real content", () => {
  it("loads and passes integrity validation", () => {
    const { criteria, topics, issues } = loadContentFiles();
    expect(issues).toEqual([]);
    expect(validateContent(criteria, topics).filter((i) => i.level === "error")).toEqual([]);
    const b = bundle(criteria, topics);
    expect(b.points.length).toBeGreaterThan(0);
    expect(new Set(b.points.map((p) => p.id)).size).toBe(b.points.length);
  });
});

const topic = (anchor: string, overrides: Partial<TopicFile["points"][number]> = {}): { file: string; data: TopicFile } => ({
  file: "t.yaml",
  data: {
    topic: { id: "t", title: "T", chapter: 1, pages: [1, 2], summary: "Shrnutí tématu.", order: 1 },
    points: [
      {
        id: "t.p",
        title: "P",
        kind: "fact",
        tier: "A",
        safety: false,
        status: "course",
        criteria: ["1c"],
        source: { pages: [1], anchor },
        explanation: "Vysvětlení bodu.",
        prereqs: [],
        confusableWith: [],
        exercises: [
          { id: "c", version: 1, type: "choice", multiple: false, prompt: "Otázka?", options: [{ text: "a", correct: true }, { text: "b", correct: true }] },
        ],
        ...overrides,
      },
    ],
  },
});

describe("validators catch problems", () => {
  const { criteria } = loadContentFiles();

  it("single-choice with two correct options is an error", () => {
    const errs = validateContent(criteria, [topic("x")]).filter((i) => i.level === "error");
    expect(errs.some((e) => e.message.includes("exactly 1 correct"))).toBe(true);
  });

  it("disputed point without a note is an error; unknown criterion too", () => {
    const errs = validateContent(criteria, [topic("x", { status: "course-disputed", criteria: ["99z"] })]);
    expect(errs.some((e) => e.message.includes("requires a note"))).toBe(true);
    expect(errs.some((e) => e.message.includes("unknown criterion"))).toBe(true);
  });

  it("anchor check finds real phrases (modulo whitespace/bullets) and rejects invented ones", () => {
    const dir = mkdtempSync(join(tmpdir(), "nutri-pages-"));
    writeFileSync(join(dir, "001.txt"), "●​ Sacharidy jsou\n   hlavní   zdroj energie.\n");
    expect(checkAnchors([topic("sacharidy jsou hlavní zdroj")], dir)).toEqual([]);
    const bad = checkAnchors([topic("bílkoviny jsou hlavní zdroj")], dir);
    expect(bad[0]?.level).toBe("error");
  });

  it("normalizeForMatch collapses whitespace and strips bullets", () => {
    expect(normalizeForMatch("●​  A\n  b ")).toBe("a b");
  });
});
