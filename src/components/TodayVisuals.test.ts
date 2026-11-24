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
    expect(html).toContain("za 11 dní");
    expect(html).toContain("pá 4. 12.");
    expect(html).not.toContain("…");
  });

  it("starts at her first study day of the last 14, ignoring older ones", () => {
    const html = path({ "2026-11-10": 3, "2026-11-20": 8, "2026-11-01": 50 }, "2026-12-04");
    expect(columns(html)).toBe(13 + 12);
    expect(html).toContain("út 10. 11.");
  });

  it("puts a gap before a distant exam, says 'zítra' the day before, and disappears on exam day", () => {
    const far = path({}, "2027-02-01");
    expect(far).toContain("…");
    expect(columns(far)).toBe(1 + 20 + 1 + 1);
    expect(path({}, "2026-11-24")).toContain("zítra");
    expect(path({}, "2026-11-23")).toBe("");
  });
});

describe("knowledge map", () => {
  it("draws one square per core point and rings those first met today", () => {
    const core = content.points.filter((p) => p.tier !== "C");
    const st = (introducedAt: string) => ({ introducedAt, answers: 1, lastAnsweredAt: introducedAt }) as unknown as PointState;
    const states = new Map<string, PointState>([
      [core[0].id, st("2026-11-23T09:00:00Z")], // today
      [core[1].id, st("2026-11-20T09:00:00Z")], // earlier
    ]);
    const html = renderToStaticMarkup(createElement(KnowledgeMap, { points: content.points as PointWithTopic[], states, now }));
    expect((html.match(/aspect-square/g) ?? []).length).toBe(core.length);
    expect((html.match(/animate-sprout/g) ?? []).length).toBe(1);
    expect(html).toContain("dnes přibyl <span");
    expect((html.match(/bg-sage-200/g) ?? []).length).toBeGreaterThanOrEqual(2); // both met points are "in progress"
  });
});
