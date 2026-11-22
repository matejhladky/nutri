import { describe, expect, it, beforeAll } from "vitest";
import { getScheduler, MAX_INTERVAL_DAYS, retrievability, type Scheduler } from "./scheduler";
import { applyEvent, replay, pointStatus } from "./state";
import { Grade, type StudyEvent } from "./types";

let s: Scheduler;
beforeAll(async () => {
  s = await getScheduler();
});

const T0 = "2026-11-22T18:00:00.000Z";
const at = (minutes: number) => new Date(Date.parse(T0) + minutes * 60_000).toISOString();
const answer = (id: string, minutes: number, grade: Grade, outcome: StudyEvent["outcome"] = "correct"): StudyEvent => ({
  id,
  pointId: "p",
  at: at(minutes),
  kind: "answer",
  exerciseId: "e1",
  grade,
  outcome,
});

describe("scheduler via state reducer", () => {
  it("intro sets introducedAt without a memory card", () => {
    const st = applyEvent(undefined, { id: "i", pointId: "p", at: T0, kind: "intro" }, s);
    expect(st.introducedAt).toBe(T0);
    expect(st.card).toBeNull();
    expect(pointStatus(st)).toBe("learning");
  });

  it("first correct retrieval → next check about a day later", () => {
    const st = applyEvent(undefined, answer("a", 0, Grade.Good), s);
    const hours = (Date.parse(st.card!.dueAt) - Date.parse(T0)) / 3600_000;
    expect(hours).toBeGreaterThan(20);
    expect(hours).toBeLessThan(28);
  });

  it("wrong answer → comes back within the session (10 min)", () => {
    const st = applyEvent(undefined, answer("a", 0, Grade.Again, "wrong"), s);
    const minutes = (Date.parse(st.card!.dueAt) - Date.parse(T0)) / 60_000;
    expect(minutes).toBeLessThanOrEqual(15);
    expect(pointStatus(st)).toBe("weak");
  });

  it("never schedules beyond the interval cap", () => {
    let st = applyEvent(undefined, answer("a", 0, Grade.Good), s);
    let t = 0;
    for (let i = 0; i < 6; i++) {
      t = (Date.parse(st.card!.dueAt) - Date.parse(T0)) / 60_000;
      st = applyEvent(st, answer(`b${i}`, t, Grade.Good), s);
      const reviewedAt = new Date(at(t));
      const days = (Date.parse(st.card!.dueAt) - reviewedAt.getTime()) / 86400_000;
      expect(days).toBeLessThanOrEqual(MAX_INTERVAL_DAYS + 1e-9);
    }
    expect(pointStatus(st)).toBe("solid");
  });

  it("replay is deterministic and independent of input order", () => {
    const evs: StudyEvent[] = [
      { id: "i", pointId: "p", at: at(0), kind: "intro" },
      answer("a", 3, Grade.Again, "wrong"),
      answer("b", 15, Grade.Good),
      answer("c", 60 * 26, Grade.Good),
    ];
    const one = replay(evs, s).get("p");
    const two = replay([...evs].reverse(), s).get("p");
    expect(one).toEqual(two);
    expect(one?.answers).toBe(3);
    expect(one?.correct).toBe(2);
    expect(one?.recent).toEqual(["wrong", "correct", "correct"]);
  });

  it("retrievability is 0 for unseen and decays over time", () => {
    expect(retrievability(s, null, new Date(T0))).toBe(0);
    const st = applyEvent(undefined, answer("a", 0, Grade.Good), s);
    const r1 = retrievability(s, st.card, new Date(at(60)));
    const r2 = retrievability(s, st.card, new Date(at(60 * 72)));
    expect(r1).toBeGreaterThan(r2);
  });
});
