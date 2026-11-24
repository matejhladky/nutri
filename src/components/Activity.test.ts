import { describe, expect, it } from "vitest";
import type { PointWithTopic } from "@/content/schema";
import type { PointState } from "@/engine/types";
import { newPointsLastWeek, recentDays } from "./Activity";

describe("recent study days", () => {
  it("lists 14 study days oldest first, fills empty days, and uses Czech dates across a month and DST change", () => {
    const now = new Date("2026-11-03T02:30:00Z"); // 03:30 Prague: still the study day of Monday 2. 11.
    const days = recentDays({ "2026-11-02": 5, "2026-10-25": 2, "2026-10-19": 9 }, now, 14);
    expect(days).toHaveLength(14);
    expect(days.map((d) => d.key)).toEqual([
      "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26",
      "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02",
    ]);
    expect(days.at(-1)).toMatchObject({ answers: 5, ago: 0, weekday: 1, date: "2. 11." });
    expect(days[5]).toMatchObject({ key: "2026-10-25", answers: 2, weekday: 0 }); // the clock-change Sunday
    expect(days.filter((d) => d.answers === 0)).toHaveLength(12); // 19. 10. is outside the window
  });
});

describe("new points in the last 7 days", () => {
  it("counts points first met in the last 7 study days, today included", () => {
    const now = new Date("2026-11-26T10:00:00Z");
    const pts = ["a", "b", "c", "d", "e"].map((id) => ({ id }) as PointWithTopic);
    const st = (introducedAt: string | null) => ({ introducedAt }) as PointState;
    const states = new Map<string, PointState>([
      ["a", st("2026-11-26T09:00:00Z")], // today
      ["b", st("2026-11-20T10:00:00Z")], // 6 days ago — in
      ["c", st("2026-11-19T10:00:00Z")], // 7 days ago — out
      ["d", st(null)], // not met yet
      ["x", st("2026-11-26T09:00:00Z")], // not a (visible) content point
    ]);
    expect(newPointsLastWeek(pts, states, now)).toBe(2);
  });
});
