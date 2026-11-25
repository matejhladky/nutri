import { describe, expect, it } from "vitest";
import { beforeStudyDayStarts, dayDiff, dayKey, daysUntilExam } from "./time";

describe("study days (04:00–04:00 Europe/Prague)", () => {
  it("counts the night before 04:00 to the previous study day", () => {
    expect(dayKey(new Date("2026-11-26T02:00:00Z"))).toBe("2026-11-25"); // 03:00 Prague
    expect(dayKey(new Date("2026-11-26T03:30:00Z"))).toBe("2026-11-26"); // 04:30 Prague
    expect(dayKey(new Date("2026-07-15T01:30:00Z"))).toBe("2026-07-14"); // 03:30 Prague in summer time
    expect(dayKey(new Date("2026-07-15T02:30:00Z"))).toBe("2026-07-15"); // 04:30
  });

  it("knows when the calendar is already on the next day but the study day is not", () => {
    expect(beforeStudyDayStarts(new Date("2026-11-25T23:30:00Z"))).toBe(true); // 00:30 Prague
    expect(beforeStudyDayStarts(new Date("2026-11-26T02:59:00Z"))).toBe(true); // 03:59
    expect(beforeStudyDayStarts(new Date("2026-11-26T03:00:00Z"))).toBe(false); // 04:00
    expect(beforeStudyDayStarts(new Date("2026-11-25T22:30:00Z"))).toBe(false); // 23:30 the evening before
  });

  it("counts days to the exam by study days", () => {
    expect(dayDiff("2026-11-25", "2026-12-04")).toBe(9);
    expect(daysUntilExam(new Date("2026-11-25T10:00:00Z"), "2026-12-04")).toBe(9);
    expect(daysUntilExam(new Date("2026-11-26T02:00:00Z"), "2026-12-04")).toBe(9); // 03:00: still the 25th
    expect(daysUntilExam(new Date("2026-12-05T10:00:00Z"), "2026-12-04")).toBe(0);
  });
});
