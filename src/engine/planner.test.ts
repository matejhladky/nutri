import { describe, expect, it, beforeAll } from "vitest";
import { dailyPlan, nextCard, pickExercise, INTRO_GAP, type PlannerInput, type SessionItem } from "./planner";
import { getScheduler, retrievability, type Scheduler } from "./scheduler";
import { applyEvent } from "./state";
import { Grade, type PointState, type StudyEvent } from "./types";
import type { PointWithTopic, Exercise } from "@/content/schema";
import { EXAM_DATE } from "@/lib/exam";

let s: Scheduler;
beforeAll(async () => {
  s = await getScheduler();
});

const ex = (id: string, type: Exercise["type"] = "reveal"): Exercise =>
  type === "choice"
    ? { id, version: 1, type, prompt: "Otázka?", multiple: false, options: [{ text: "a", correct: true }, { text: "b", correct: false }] }
    : type === "explain"
      ? { id, version: 1, type, prompt: "Vysvětli", keyPoints: ["a", "b"], modelAnswer: "Vzor odpovědi" }
      : { id, version: 1, type: "reveal", prompt: "Otázka?", answer: "x" };

function pt(id: string, topicId: string, order: number, opts: Partial<PointWithTopic> = {}): PointWithTopic {
  return {
    id,
    title: id,
    kind: "fact",
    tier: "A",
    status: "course",
    criteria: ["1c"],
    source: { pages: [1] },
    explanation: "Vysvětlení bodu.",
    prereqs: [],
    confusableWith: [],
    exercises: [ex("e1"), ex("e2", "choice")],
    topicId,
    order,
    ...opts,
  };
}

const NOW = new Date("2026-11-22T17:00:00Z"); // 18:00 Prague
const EXAM = "2026-12-06"; // 14 study days incl. today

function input(points: PointWithTopic[], states: Map<string, PointState>, extra: Partial<PlannerInput> = {}): PlannerInput {
  return {
    now: NOW,
    examDate: EXAM,
    points,
    states,
    session: [],
    mode: { kind: "daily" },
    beyondGoal: false,
    dailyMinutes: 45,
    retrievability: (st, now) => retrievability(s, st.card, now),
    ...extra,
  };
}

const intro = (pointId: string, at: Date): StudyEvent => ({ id: `i-${pointId}`, pointId, at: at.toISOString(), kind: "intro" });
const ans = (pointId: string, at: Date, grade: Grade): StudyEvent => ({
  id: `a-${pointId}-${at.getTime()}`,
  pointId,
  at: at.toISOString(),
  kind: "answer",
  exerciseId: "e1",
  grade,
  outcome: grade === Grade.Again ? "wrong" : "correct",
});

function withEvents(evs: StudyEvent[]): Map<string, PointState> {
  const m = new Map<string, PointState>();
  for (const e of evs) m.set(e.pointId, applyEvent(m.get(e.pointId), e, s));
  return m;
}

describe("nextCard", () => {
  it("starts with an intro of a new point", () => {
    const pts = [pt("a1", "A", 0), pt("b1", "B", 0, { criteria: ["2f"] })];
    const c = nextCard(input(pts, new Map()));
    expect(c.kind).toBe("intro");
  });

  it("asks the first retrieval only after the intro gap", () => {
    const pts = [pt("a1", "A", 0), pt("a2", "A", 1), pt("b1", "B", 0, { criteria: ["2f"] }), pt("c1", "C", 0, { criteria: ["5e"] }), pt("d1", "D", 0, { criteria: ["4a"] })];
    const states = withEvents([intro("a1", NOW)]);
    const session: SessionItem[] = [{ pointId: "a1", kind: "intro", isNew: true }];
    const c1 = nextCard(input(pts, states, { session, beyondGoal: true }));
    expect(c1.kind === "exercise" && c1.pointId === "a1").toBe(false);

    const later: SessionItem[] = [
      ...session,
      ...Array.from({ length: INTRO_GAP }, (_, i) => ({ pointId: `x${i}`, kind: "exercise" as const, isNew: false })),
    ];
    const c2 = nextCard(input(pts, states, { session: later, beyondGoal: true }));
    expect(c2).toMatchObject({ kind: "exercise", pointId: "a1", reason: "learning" });
  });

  it("asks a pending first retrieval immediately if nothing else is left", () => {
    const pts = [pt("a1", "A", 0)];
    const states = withEvents([intro("a1", NOW)]);
    const c = nextCard(input(pts, states, { session: [{ pointId: "a1", kind: "intro", isNew: true }] }));
    expect(c).toMatchObject({ kind: "exercise", pointId: "a1" });
  });

  it("a point introduced in an earlier session is retrieved right away", () => {
    const pts = [pt("a1", "A", 0), pt("a2", "A", 1)];
    const states = withEvents([intro("a1", new Date(NOW.getTime() - 3600_000))]);
    expect(nextCard(input(pts, states))).toMatchObject({ kind: "exercise", pointId: "a1" });
  });

  it("introduces points in authored order within a topic and respects prerequisites", () => {
    const pts = [pt("a1", "A", 0), pt("a2", "A", 1, { prereqs: ["a1"] })];
    const c = nextCard(input(pts, new Map()));
    expect(c).toEqual({ kind: "intro", pointId: "a1" });
  });

  it("prefers breadth: a criterion with no coverage beats one already started", () => {
    const pts = [
      pt("a1", "A", 0, { criteria: ["1c"] }),
      pt("a2", "A", 1, { criteria: ["1c"] }),
      pt("b1", "B", 0, { criteria: ["2f"] }),
    ];
    const earlier = new Date(NOW.getTime() - 86400_000 * 2);
    const states = withEvents([intro("a1", earlier), ans("a1", earlier, Grade.Good)]);
    // a1 due tomorrow-ish already reviewed; next new should be b1 (uncovered criterion) not a2.
    const c = nextCard(input(pts, states, { beyondGoal: true }));
    expect(c).toEqual({ kind: "intro", pointId: "b1" });
  });

  it("a low-tier prerequisite inherits the priority of the tier-A point it unlocks", () => {
    const pts = [
      pt("x1", "X", 0, { criteria: ["1e"] }),
      pt("y1", "Y", 0, { tier: "B", criteria: ["2a"] }),
      pt("y2", "Y", 1, { criteria: ["2a"], prereqs: ["y1"] }),
      pt("z1", "Z", 0, { tier: "B", criteria: ["1f"] }),
    ];
    const earlier = new Date(NOW.getTime() - 86400_000 * 2);
    const states = withEvents([intro("x1", earlier), ans("x1", earlier, Grade.Good)]);
    // y1 (B) comes before z1 (B) because it unlocks tier-A y2 — also when z1 is authored first.
    expect(nextCard(input(pts, states, { beyondGoal: true }))).toEqual({ kind: "intro", pointId: "y1" });
    const reordered = [pts[0], pts[3], pts[1], pts[2]];
    expect(nextCard(input(reordered, states, { beyondGoal: true }))).toEqual({ kind: "intro", pointId: "y1" });
  });

  it("introduces the confusable partner of a known point sooner (contrast)", () => {
    const pts = [
      pt("a1", "A", 0, { criteria: ["1e"] }),
      pt("b1", "B", 0, { criteria: ["1f"] }),
      pt("c1", "C", 0, { criteria: ["1f"], confusableWith: ["a1"] }),
    ];
    const earlier = new Date(NOW.getTime() - 86400_000 * 2);
    const states = withEvents([intro("a1", earlier), ans("a1", earlier, Grade.Good)]);
    // b1 and c1 score equally on breadth; c1 wins because its partner a1 is known (relation listed on c1 only).
    expect(nextCard(input(pts, states, { beyondGoal: true }))).toEqual({ kind: "intro", pointId: "c1" });
    const noPartner = pts.map((p) => ({ ...p, confusableWith: [] }));
    expect(nextCard(input(noPartner, states, { beyondGoal: true }))).toEqual({ kind: "intro", pointId: "b1" });
  });

  it("does not schedule tier C points in the daily flow, but does in topic practice", () => {
    const pts = [pt("c1", "A", 0, { tier: "C" })];
    expect(nextCard(input(pts, new Map())).kind).toBe("done");
    expect(nextCard(input(pts, new Map(), { mode: { kind: "topic", topicId: "A" } }))).toEqual({ kind: "intro", pointId: "c1" });
  });

  it("returns a due review before new material when reviews dominate", () => {
    const pts = [pt("a1", "A", 0), pt("b1", "B", 0, { criteria: ["2f"] })];
    const past = new Date(NOW.getTime() - 86400_000 * 3);
    const states = withEvents([intro("a1", past), ans("a1", past, Grade.Good)]);
    // session just showed a new card → next should be the review
    const session: SessionItem[] = [{ pointId: "zz", kind: "intro", isNew: true }];
    expect(nextCard(input(pts, states, { session }))).toMatchObject({ kind: "exercise", pointId: "a1", reason: "review" });
  });

  it("stops at the daily goal and continues when asked", () => {
    const pts = Array.from({ length: 30 }, (_, i) => pt(`a${i}`, "A", i));
    // introduce today exactly the paced target
    const plan0 = dailyPlan(input(pts, new Map()));
    const evs: StudyEvent[] = [];
    for (let i = 0; i < plan0.newTarget; i++) {
      const t = new Date(NOW.getTime() - 60_000 * (100 - i));
      evs.push(intro(`a${i}`, t), ans(`a${i}`, t, Grade.Good));
    }
    const states = withEvents(evs);
    const plan = dailyPlan(input(pts, states));
    expect(plan.newToday).toBe(plan0.newTarget);
    expect(plan.goalReached).toBe(true);
    expect(nextCard(input(pts, states))).toEqual({ kind: "done", reason: "goal-reached" });
    expect(nextCard(input(pts, states, { beyondGoal: true })).kind).toBe("intro");
  });

  it("avoids the same topic twice in a row when possible", () => {
    const pts = [pt("a1", "A", 0), pt("b1", "B", 0)];
    const session: SessionItem[] = [{ pointId: "a0", kind: "exercise", isNew: false }];
    const withA0 = [pt("a0", "A", -1), ...pts];
    const past = new Date(NOW.getTime() - 86400_000 * 5);
    const states = withEvents([intro("a0", past), ans("a0", past, Grade.Good)]);
    const c = nextCard(input(withA0, states, { session, beyondGoal: true }));
    expect(c).toEqual({ kind: "intro", pointId: "b1" });
  });
});

describe("dailyPlan pacing", () => {
  const many = (n: number, tier: "A" | "B" = "A") => Array.from({ length: n }, (_, i) => pt(`${tier}${i}`, "T", i, { tier }));

  it("spreads new points over the days left minus two review days", () => {
    const plan = dailyPlan(input(many(120), new Map()));
    expect(plan.daysLeft).toBe(14);
    expect(plan.newTarget).toBe(10); // 120 / 12 = 10
  });

  it("in the final two days only missing tier-A points are new", () => {
    const pts = [...many(5, "A"), ...many(20, "B")];
    const plan = dailyPlan({ ...input(pts, new Map()), now: new Date("2026-12-04T17:00:00Z") });
    expect(plan.daysLeft).toBe(2);
    expect(plan.newTarget).toBe(5);
  });

  it("with the real exam date (4 Dec), 2 Dec is review-only apart from missing tier A", () => {
    const pts = [...many(3, "A"), ...many(10, "B")];
    const plan = dailyPlan({ ...input(pts, new Map()), examDate: EXAM_DATE, now: new Date("2026-12-02T09:00:00Z") });
    expect(plan.daysLeft).toBe(2);
    expect(plan.newTarget).toBe(3);
  });

  it("counts owed first retrievals; the goal is not reached until they are answered", () => {
    const pts = [pt("a1", "A", 0)];
    const states = withEvents([intro("a1", NOW)]);
    const plan = dailyPlan(input(pts, states));
    expect(plan.learningDue).toBe(1);
    expect(plan.goalReached).toBe(false);
    const answered = withEvents([intro("a1", NOW), ans("a1", new Date(NOW.getTime() + 60_000), Grade.Good)]);
    expect(dailyPlan(input(pts, answered)).goalReached).toBe(true);
  });

  it("caps the target by the daily time budget", () => {
    const plan = dailyPlan({ ...input(many(1200), new Map()), dailyMinutes: 30 });
    expect(plan.newTarget).toBe(20); // 30 min / 1.5
  });
});

describe("pickExercise", () => {
  it("rotates variants and avoids repeating the last one", () => {
    const exs = [ex("r", "reveal"), ex("c", "choice"), ex("x", "explain")];
    expect(pickExercise(exs, undefined).id).toBe("c"); // early → recognition first
    const st = { exerciseCounts: { c: 1 }, lastExerciseId: "c", answers: 1 } as unknown as PointState;
    expect(pickExercise(exs, st).id).toBe("r");
    const mature = { exerciseCounts: { c: 1, r: 1 }, lastExerciseId: "r", answers: 3 } as unknown as PointState;
    expect(pickExercise(exs, mature).id).toBe("x");
  });
});
