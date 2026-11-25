import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PointWithTopic } from "@/content/schema";
import type { PointState } from "@/engine/types";
import { content } from "@/lib/content";
import { ExamPath, KnowledgeMap } from "./TodayVisuals";

const now = new Date("2026-11-23T10:00:00Z"); // Monday 23. 11., 11:00 Prague
const path = (answersByDay: Record<string, number>, examDate: string) =>
  renderToStaticMarkup(createElement(ExamPath, { answersByDay, examDate, now }));
const columns = (html: string) => (html.match(/<li/g) ?? []).length;

describe("path to the exam", () => {
  it("starts today for a new learner and ends with the exam", () => {
    const html = path({}, "2026-12-04");
    expect(columns(html)).toBe(12); // today + 10 days between + the exam
    expect(html).toContain("Do zkoušky zbývá <strong");
    expect(html).toContain("11 dní");
    expect(html).toContain("zkouška");
    expect(html).toContain("Zkouška pá 4. 12."); // screen-reader summary
    expect(html).not.toContain("…");
  });

  it("starts at her first study day of the last 14, ignoring older ones", () => {
    const html = path({ "2026-11-10": 3, "2026-11-20": 8, "2026-11-01": 50 }, "2026-12-04");
    expect(columns(html)).toBe(13 + 12);
    expect(html.indexOf(">út<")).toBeGreaterThan(-1); // first column = Tuesday 10. 11.
    expect(html).toContain("Za posledních 14 dní jsi studovala 2 dny");
  });

  it("puts a gap before a distant exam, says 'zítra' the day before, and disappears on exam day", () => {
    const far = path({}, "2027-02-01");
    expect(far).toContain("…");
    expect(columns(far)).toBe(1 + 20 + 1 + 1);
    expect(path({}, "2026-11-24")).toContain("zbývá <strong");
    expect(path({}, "2026-11-25")).toContain("zbývají <strong"); // 2 dny
    expect(path({}, "2026-11-23")).toBe("");
  });
});

describe("knowledge map", () => {
  it("draws one square per core point in one block per topic, sorted by status, and dots those first met today", () => {
    const core = content.points.filter((p) => p.tier !== "C");
    const st = (introducedAt: string) => ({ introducedAt, answers: 1, lastAnsweredAt: introducedAt }) as unknown as PointState;
    const states = new Map<string, PointState>([
      [core[0].id, st("2026-11-23T09:00:00Z")], // today
      [core[1].id, st("2026-11-20T09:00:00Z")], // earlier
    ]);
    const html = renderToStaticMarkup(createElement(KnowledgeMap, { points: content.points as PointWithTopic[], states, now }));
    expect((html.match(/rounded-\[2px\]( animate-sprout)?" style/g) ?? []).length).toBe(core.length);
    expect((html.match(/grid-rows-\[repeat\(4,7px\)\]/g) ?? []).length).toBe(new Set(core.map((p) => p.topicId)).size);
    expect((html.match(/animate-sprout/g) ?? []).length).toBe(1);
    expect(html).toContain("radial-gradient"); // today's new one: a dot on its status colour, not a separate state
    expect(html).toContain("z toho 1 dnes nový");
    expect(html).toMatch(/aria-label="Mapa poznatků po tématech: 0 naučeno, 2 rozpracováno, 0 k opakování, \d+ zatím neprobráno; z toho 1 dnes nový\."/);
    expect((html.match(/background:var\(--color-sage-200\)/g) ?? []).length).toBeGreaterThanOrEqual(2); // the earlier one + the legend: "in progress"
  });
});
