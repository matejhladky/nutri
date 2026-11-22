/**
 * Planner simulation: a synthetic learner studies every day until the daily goal, at full-syllabus scale.
 * Reports per-day workload and final coverage, to sanity-check pacing before real use.
 *
 *   pnpm simulate [points=500] [days=14] [minutes=45]
 *   pnpm simulate real [days] [minutes]   — use the built content bank (src/generated/content.json)
 */
import { getScheduler, retrievability } from "../src/engine/scheduler";
import { applyEvent } from "../src/engine/state";
import { dailyPlan, nextCard, type SessionItem } from "../src/engine/planner";
import { Grade, type PointState, type StudyEvent } from "../src/engine/types";
import { rng } from "../src/content/formulas";
import type { PointWithTopic } from "../src/content/schema";
import { dayKey } from "../src/engine/time";
import { readFileSync } from "node:fs";

const REAL = process.argv[2] === "real";
const N = REAL ? 0 : Number(process.argv[2] ?? 500);
const DAYS = Number(process.argv[3] ?? 14);
const MINUTES = Number(process.argv[4] ?? 45);
const SEC_PER_CARD = { intro: 30, exercise: 25, case: 180 };

const rand = rng(1);
const criteria = ["1a", "1b", "1c", "1d", "1e", "1f", "2a", "2b", "2d", "2e", "2f", "2g", "3a", "3b", "4a", "4b", "4c", "5e", "7h", "8a"];
const synthetic: PointWithTopic[] = Array.from({ length: N }, (_, i) => ({
  id: `p${i}`,
  title: `p${i}`,
  kind: "fact",
  tier: rand() < 0.65 ? "A" : rand() < 0.85 ? "B" : "C",
  status: "course",
  criteria: [criteria[Math.floor(i / (N / criteria.length))] ?? "1a"],
  source: { pages: [1] },
  explanation: "x",
  prereqs: [],
  confusableWith: [],
  exercises: [{ id: "e", version: 1, type: "reveal", prompt: "Otázka?", answer: "x" }],
  topicId: `t${Math.floor(i / 20)}`,
  order: i % 20,
}));

const points: PointWithTopic[] = REAL
  ? (JSON.parse(readFileSync("src/generated/content.json", "utf8")) as { points: PointWithTopic[] }).points
  : synthetic;

const start = new Date("2026-11-22T17:00:00Z");
const exam = new Date(start.getTime() + DAYS * 86400_000);
const examDate = dayKey(exam);

const s = await getScheduler();
const states = new Map<string, PointState>();
let evId = 0;
const apply = (ev: Omit<StudyEvent, "id">) => {
  const e = { ...ev, id: String(evId++) } as StudyEvent;
  states.set(e.pointId, applyEvent(states.get(e.pointId), e, s));
};

console.log(`Simulating ${N} points (${points.filter((p) => p.tier !== "C").length} A/B), ${DAYS} days, ${MINUTES} min/day budget`);
console.log("day | daysLeft | due | newTarget | cards | new | minutes");
for (let d = 0; d < DAYS; d++) {
  let now = new Date(start.getTime() + d * 86400_000);
  const plan = dailyPlan({ now, examDate, points, states, dailyMinutes: MINUTES });
  const session: SessionItem[] = [];
  let seconds = 0;
  let newCount = 0;
  for (let guard = 0; guard < 2000; guard++) {
    const c = nextCard({
      now,
      examDate,
      points,
      states,
      session,
      mode: { kind: "daily" },
      beyondGoal: false,
      dailyMinutes: MINUTES,
      retrievability: (st, t) => retrievability(s, st.card, t),
    });
    if (c.kind === "done") break;
    if (c.kind === "intro") {
      apply({ pointId: c.pointId, at: now.toISOString(), kind: "intro" });
      session.push({ pointId: c.pointId, kind: "intro", isNew: true });
      seconds += SEC_PER_CARD.intro;
      newCount++;
    } else {
      const st = states.get(c.pointId)!;
      const r = st.card ? retrievability(s, st.card, now) : 0.75;
      const correct = rand() < Math.max(0.35, r);
      apply({
        pointId: c.pointId,
        at: now.toISOString(),
        kind: "answer",
        exerciseId: c.exerciseId,
        grade: correct ? Grade.Good : Grade.Again,
        outcome: correct ? "correct" : "wrong",
      });
      session.push({ pointId: c.pointId, kind: "exercise", isNew: false });
      const ex = points.find((q) => q.id === c.pointId)?.exercises.find((e) => e.id === c.exerciseId);
      seconds += ex?.type === "case" ? SEC_PER_CARD.case : SEC_PER_CARD.exercise;
    }
    now = new Date(now.getTime() + 25_000);
  }
  console.log(
    `${String(d + 1).padStart(3)} | ${String(plan.daysLeft).padStart(8)} | ${String(plan.dueReviews).padStart(3)} | ${String(plan.newTarget).padStart(9)} | ${String(session.length).padStart(5)} | ${String(newCount).padStart(3)} | ${Math.round(seconds / 60)}`,
  );
}

const ab = points.filter((p) => p.tier !== "C");
const introduced = ab.filter((p) => states.get(p.id)?.introducedAt).length;
const rAtExam = ab
  .map((p) => states.get(p.id))
  .filter((st): st is PointState => !!st?.card)
  .map((st) => retrievability(s, st.card, exam));
const avgR = rAtExam.reduce((a, b) => a + b, 0) / Math.max(1, rAtExam.length);
const aLeft = points.filter((p) => p.tier === "A" && !states.get(p.id)?.introducedAt).length;
console.log(`\nIntroduced ${introduced}/${ab.length} A/B points; tier-A never seen: ${aLeft}; mean predicted recall on exam day: ${avgR.toFixed(2)}`);

// Coverage of tier-A points per primary criterion at exam time (written test needs ≥ 50 % per criterion).
const byCrit = new Map<string, { total: number; seen: number }>();
for (const p of points) {
  if (p.tier !== "A") continue;
  const c = byCrit.get(p.criteria[0]) ?? { total: 0, seen: 0 };
  c.total++;
  if (states.get(p.id)?.introducedAt) c.seen++;
  byCrit.set(p.criteria[0], c);
}
const weak = [...byCrit].filter(([, c]) => c.seen / c.total < 0.75).map(([k, c]) => `${k} ${c.seen}/${c.total}`);
console.log(`Criteria with < 75 % of tier A seen: ${weak.length ? weak.join(", ") : "none"}`);
