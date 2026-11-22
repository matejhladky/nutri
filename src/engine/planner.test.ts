import { describe, expect, it, beforeAll } from "vitest";
import { dailyPlan, nextCard, pickExercise, sweepPick, INTRO_GAP, FIRST_RETRIEVAL_DELAY_MS, NEW_SHARE, type PlannerInput, type SessionItem } from "./planner";
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
    kind: "concept", // explanation-first by default; ask-first kinds are tested explicitly
    tier: "A",
    safety: false,
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

  it("asks the first retrieval only after the intro gap AND the minimum delay", () => {
    const pts = [pt("a1", "A", 0), pt("a2", "A", 1), pt("b1", "B", 0, { criteria: ["2f"] }), pt("c1", "C", 0, { criteria: ["5e"] }), pt("d1", "D", 0, { criteria: ["4a"] })];
    const states = withEvents([intro("a1", NOW)]);
    const session: SessionItem[] = [{ pointId: "a1", kind: "intro", isNew: true }];
    const c1 = nextCard(input(pts, states, { session, beyondGoal: true }));
    expect(c1.kind === "exercise" && c1.pointId === "a1").toBe(false);

    const later: SessionItem[] = [
      ...session,
      ...Array.from({ length: INTRO_GAP }, (_, i) => ({ pointId: `x${i}`, kind: "exercise" as const, isNew: false })),
    ];
    // Enough cards but too little time: still not asked.
    const c2 = nextCard(input(pts, states, { session: later, beyondGoal: true, now: new Date(NOW.getTime() + 60_000) }));
    expect(c2.kind === "exercise" && c2.pointId === "a1").toBe(false);
    const c3 = nextCard(input(pts, states, { session: later, beyondGoal: true, now: new Date(NOW.getTime() + FIRST_RETRIEVAL_DELAY_MS) }));
    expect(c3).toMatchObject({ kind: "exercise", pointId: "a1", reason: "learning" });
  });

  it("a pending first retrieval is not asked early when nothing else is left — the session waits", () => {
    const pts = [pt("a1", "A", 0)];
    const states = withEvents([intro("a1", NOW)]);
    const session: SessionItem[] = [{ pointId: "a1", kind: "intro", isNew: true }];
    expect(nextCard(input(pts, states, { session }))).toEqual({
      kind: "done",
      reason: "wait",
      nextAt: new Date(NOW.getTime() + FIRST_RETRIEVAL_DELAY_MS).toISOString(),
    });
    // In a later session (enough time passed) it is asked straight away.
    expect(nextCard(input(pts, states, { now: new Date(NOW.getTime() + 10 * 60_000) }))).toMatchObject({ kind: "exercise", pointId: "a1" });
  });

  it("after a wrong answer the point is not shown again before its relearning step, in any mode (regression)", () => {
    const pts = [pt("a1", "T", 0)];
    const t = new Date(NOW.getTime() - 3600_000);
    const states = withEvents([intro("a1", t), ans("a1", NOW, Grade.Again)]);
    const session: SessionItem[] = [{ pointId: "a1", kind: "exercise", isNew: false }];
    const soon = new Date(NOW.getTime() + 30_000);
    const due = states.get("a1")!.card!.dueAt;
    for (const extra of [{}, { beyondGoal: true }, { mode: { kind: "topic", topicId: "T" } as const }]) {
      expect(nextCard(input(pts, states, { session, now: soon, ...extra }))).toEqual({ kind: "done", reason: "wait", nextAt: due });
    }
    expect(nextCard(input(pts, states, { session, now: new Date(Date.parse(due)) }))).toMatchObject({ kind: "exercise", pointId: "a1" });
  });

  it("deliberate extra practice skips learning-step points and points answered within the last hour", () => {
    const pts = [pt("a1", "T", 0), pt("a2", "T", 1), pt("a3", "T", 2)];
    const old = new Date(NOW.getTime() - 3 * 86400_000);
    const states = withEvents([
      intro("a1", old), ans("a1", old, Grade.Good), ans("a1", new Date(old.getTime() + 86400_000), Grade.Good), // review state, long ago
      intro("a2", old), ans("a2", old, Grade.Good), ans("a2", new Date(NOW.getTime() - 20 * 60_000), Grade.Good), // answered 20 min ago
      intro("a3", old), ans("a3", new Date(NOW.getTime() - 2 * 3600_000), Grade.Again), // relearning step
    ]);
    const topic = { mode: { kind: "topic", topicId: "T" } as const };
    const c = nextCard(input(pts, states, topic));
    // a3's relearning step (10 min) is overdue → scheduled learning comes first; then only a1 is practice-eligible.
    expect(c).toMatchObject({ kind: "exercise", pointId: "a3", reason: "learning" });
    const afterA3 = withEvents([
      intro("a1", old), ans("a1", old, Grade.Good), ans("a1", new Date(old.getTime() + 86400_000), Grade.Good),
      intro("a2", old), ans("a2", old, Grade.Good), ans("a2", new Date(NOW.getTime() - 20 * 60_000), Grade.Good),
      intro("a3", old), ans("a3", new Date(NOW.getTime() - 2 * 3600_000), Grade.Again), ans("a3", NOW, Grade.Again),
    ]);
    const picks = new Set<string>();
    const r = nextCard(input(pts, afterA3, { ...topic, now: new Date(NOW.getTime() + 60_000) }));
    if (r.kind === "exercise") picks.add(r.pointId);
    expect([...picks]).toEqual(["a1"]);
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

  it("after the goal, 'continue' sweeps the points weakest at the exam; in the final two days instead of new ones", () => {
    const pts = [pt("a1", "A", 0), pt("a2", "A", 1), pt("b1", "B", 0, { tier: "B", criteria: ["2f"] })];
    const long = new Date(NOW.getTime() - 86400_000 * 6);
    const recent = new Date(NOW.getTime() - 86400_000);
    // a1 answered long ago (weaker at the exam), a2 recently; b1 still new.
    const states = withEvents([intro("a1", long), ans("a1", long, Grade.Good), intro("a2", recent), ans("a2", recent, Grade.Good)]);
    const finalDay = new Date("2026-12-02T17:00:00Z");
    const r = (n: Date) => nextCard(input(pts, states, { now: n, examDate: EXAM_DATE, beyondGoal: true }));
    // Final days: no new b1 — due reviews / the sweep keep going instead.
    const fin = r(finalDay);
    expect(fin.kind === "exercise" && ["a1", "a2"].includes(fin.pointId)).toBe(true);
    // The sweep orders by predicted recall at the exam: a1 (answered longer ago) first.
    const sweep = sweepPick(input(pts, states, { examDate: EXAM_DATE }), pts, states);
    expect(sweep?.p.id).toBe("a1");
    // Earlier: beyond the goal, new material still comes first.
    expect(r(NOW)).toEqual({ kind: "intro", pointId: "b1" });
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
    // Right after the intro the first retrieval is scheduled for later, not owed now.
    const justNow = dailyPlan(input(pts, states));
    expect([justNow.learningDue, justNow.laterToday]).toEqual([0, 1]);
    expect(justNow.nextLaterAt).toBe(new Date(NOW.getTime() + FIRST_RETRIEVAL_DELAY_MS).toISOString());
    const plan = dailyPlan(input(pts, states, { now: new Date(NOW.getTime() + 5 * 60_000) }));
    expect(plan.learningDue).toBe(1);
    expect(plan.goalReached).toBe(false);
    const answered = withEvents([intro("a1", NOW), ans("a1", new Date(NOW.getTime() + 60_000), Grade.Good)]);
    expect(dailyPlan(input(pts, answered)).goalReached).toBe(true);
  });

  it("due reviews beyond the time budget are deferred; new material keeps its reserved share", () => {
    const old = new Date(NOW.getTime() - 5 * 86400_000);
    const reviewed = Array.from({ length: 120 }, (_, i) => pt(`r${i}`, "R", i, { criteria: ["1c"] }));
    const fresh = Array.from({ length: 60 }, (_, i) => pt(`n${i}`, "N", i, { criteria: ["2a"] }));
    const evs = reviewed.flatMap((p) => [intro(p.id, old), ans(p.id, old, Grade.Good)]);
    const states = withEvents(evs);
    const plan = dailyPlan(input([...reviewed, ...fresh], states, { dailyMinutes: 30 }));
    expect(plan.dueReviews + plan.deferredReviews).toBe(120);
    expect(plan.deferredReviews).toBeGreaterThan(0);
    expect(plan.dueReviews * 0.5).toBeLessThanOrEqual(30 * (1 - NEW_SHARE) + 1); // ≈ 18 min of reviews
    expect(plan.newTarget).toBeGreaterThan(0);
    // The daily flow never shows a deferred review; "continue" may.
    const shown = new Set<string>();
    let session: SessionItem[] = [];
    for (let i = 0; i < 40; i++) {
      const c = nextCard(input([...reviewed, ...fresh], states, { dailyMinutes: 30, session }));
      if (c.kind !== "exercise" || c.reason !== "review") break;
      shown.add(c.pointId);
      session = [...session, { pointId: c.pointId, kind: "exercise", isNew: false }];
    }
    for (const id of shown) expect(plan.selectedReviewIds).toContain(id);
  });

  it("a safety review is selected before an ordinary one when the budget is tight", () => {
    const old = new Date(NOW.getTime() - 5 * 86400_000);
    const ordinary = Array.from({ length: 60 }, (_, i) => pt(`o${i}`, "O", i));
    const safe = pt("s1", "S", 0, { safety: true });
    const all = [...ordinary, safe];
    const states = withEvents(all.flatMap((p) => [intro(p.id, old), ans(p.id, old, Grade.Good)]));
    const plan = dailyPlan(input(all, states, { dailyMinutes: 10 }));
    expect(plan.deferredReviews).toBeGreaterThan(0);
    expect(plan.selectedReviewIds).toContain("s1");
  });

  it("caps the target by the daily time budget", () => {
    const plan = dailyPlan({ ...input(many(1200), new Map()), dailyMinutes: 30 });
    expect(plan.newTarget).toBe(16); // 30 min / (0.6 intro + 2 × 0.5 choice × 1.25 expected relearning)
  });
});

describe("pickExercise", () => {
  it("rotates variants and avoids repeating the last one", () => {
    const exs = [ex("r", "reveal"), ex("c", "choice"), ex("x", "explain")];
    expect(pickExercise(exs, undefined).id).toBe("c"); // early → recognition first
    const st = { exerciseCounts: { c: 1 }, lastExerciseId: "c", answers: 1 } as unknown as PointState;
    // After the first answer: production preferred (explain before reveal), never the same one twice in a row.
    expect(pickExercise(exs, st).id).toBe("x");
    const mature = { exerciseCounts: { c: 1, r: 1, x: 1 }, lastExerciseId: "x", answers: 3 } as unknown as PointState;
    expect(pickExercise(exs, mature).id).toBe("r");
  });
});

describe("same-day relearning", () => {
  it("a point failed twice today rests until tomorrow instead of looping", () => {
    const pts = [pt("a1", "A", 0)];
    const old = new Date(NOW.getTime() - 3 * 86400_000);
    const t1 = new Date(NOW.getTime() - 30 * 60_000);
    const states = withEvents([intro("a1", old), ans("a1", old, Grade.Good), ans("a1", t1, Grade.Again), ans("a1", new Date(t1.getTime() + 11 * 60_000), Grade.Again)]);
    expect(states.get("a1")!.failsThatDay).toBe(2);
    const c = nextCard(input(pts, states, { now: new Date(NOW.getTime() + 3600_000) }));
    expect(c.kind).toBe("done");
    expect(dailyPlan(input(pts, states)).learningDue).toBe(0);
    const tomorrow = new Date(NOW.getTime() + 86400_000);
    expect(nextCard(input(pts, states, { now: tomorrow }))).toMatchObject({ kind: "exercise", pointId: "a1" });
  });
});

describe("ask-first policy for new points", () => {
  it("facts and comparisons start with a question; concepts and procedures with the explanation", () => {
    const fact = pt("f1", "F", 0, { kind: "fact" });
    const cmp = pt("c1", "C", 0, { kind: "comparison", criteria: ["2f"] });
    const proc = pt("p1", "P", 0, { kind: "procedure", criteria: ["5e"] });
    expect(nextCard(input([fact], new Map()))).toMatchObject({ kind: "exercise", pointId: "f1", reason: "new", exerciseId: "e2" }); // recognition first
    expect(nextCard(input([cmp], new Map()))).toMatchObject({ kind: "exercise", pointId: "c1", reason: "new" });
    expect(nextCard(input([proc], new Map()))).toEqual({ kind: "intro", pointId: "p1" });
  });

  it("a failed first question is retried after its learning step, not immediately", () => {
    const fact = pt("f1", "F", 0, { kind: "fact" });
    const states = withEvents([ans("f1", NOW, Grade.Again)]);
    expect(states.get("f1")!.introducedAt).toBe(NOW.toISOString());
    const c = nextCard(input([fact], states, { now: new Date(NOW.getTime() + 60_000), session: [{ pointId: "f1", kind: "exercise", isNew: true }] }));
    expect(c).toMatchObject({ kind: "done", reason: "wait" });
  });
});
