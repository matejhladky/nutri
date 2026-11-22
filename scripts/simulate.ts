/**
 * Planner workload simulation on the REAL content bank (src/generated/content.json — run `pnpm content:build` first).
 *
 *   pnpm simulate [days=11] [minutes=45] [accuracy=1] [--detail]   one scenario; --detail lists omitted points
 *   pnpm simulate matrix [days=11]                                 30/45/60 min × typical/weaker learner
 *
 * Everything printed here is a MODEL ESTIMATE, not observed learning:
 *  - answer time per card = DEFAULT_TIMING by exercise type (src/engine/planner.ts); intro 0.6 min
 *  - P(correct) = max(0.25, R × accuracy), with R = FSRS-predicted recall (0.8 × accuracy for a first retrieval
 *    after an explanation; PRIOR × accuracy for an ask-first question on a new point — an ASSUMPTION about how much
 *    she already knows from the lectures, default 0.5, override with PRIOR=0.3 pnpm simulate …)
 *    — FSRS grading its own predictions, so "recall at exam" is optimistic by construction
 *  - she studies until the daily goal (capped at 1.6 × the nominal minutes), never beyond
 * Use it to compare planner policies and to see WHAT gets left out; calibrate with her real durations later.
 */
import { readFileSync } from "node:fs";
import { getScheduler, retrievability } from "../src/engine/scheduler";
import { applyEvent } from "../src/engine/state";
import { DEFAULT_TIMING, examMoment, nextCard, type SessionItem } from "../src/engine/planner";
import { Grade, type PointState, type StudyEvent } from "../src/engine/types";
import { rng } from "../src/content/formulas";
import type { ContentBundle, PointWithTopic } from "../src/content/schema";

const bundle = JSON.parse(readFileSync("src/generated/content.json", "utf8")) as ContentBundle;
const points: PointWithTopic[] = bundle.points;
const EXAM = "2026-12-04";
const START = new Date("2026-11-23T17:00:00Z");
const s = await getScheduler();
const PRIOR = Number(process.env.PRIOR ?? 0.5);

type Result = { minutes: number[]; seenA: number; totalA: number; safety: [number, number]; cases: [number, number]; expRecall: number; omitted: PointWithTopic[] };

function run(days: number, minutes: number, accuracy: number): Result {
  const rand = rng(7);
  const states = new Map<string, PointState>();
  const byId = new Map(points.map((p) => [p.id, p]));
  let evId = 0;
  const apply = (ev: Omit<StudyEvent, "id">) => {
    const e = { ...ev, id: String(evId++) } as StudyEvent;
    states.set(e.pointId, applyEvent(states.get(e.pointId), e, s));
  };
  const used: number[] = [];
  for (let d = 0; d < days; d++) {
    let now = new Date(START.getTime() + d * 86400_000);
    const session: SessionItem[] = [];
    let sec = 0;
    for (let guard = 0; guard < 3000 && sec < minutes * 60 * 1.6; guard++) {
      const c = nextCard({ now, examDate: EXAM, points, states, session, mode: { kind: "daily" }, beyondGoal: false, dailyMinutes: minutes, retrievability: (st, t) => retrievability(s, st.card, t) });
      if (c.kind === "done") {
        // A pending learning step later today: she comes back for it (a short second sitting).
        if (c.reason === "wait" && c.nextAt) {
          now = new Date(Date.parse(c.nextAt) + 1000);
          continue;
        }
        break;
      }
      if (c.kind === "intro") {
        apply({ pointId: c.pointId, at: now.toISOString(), kind: "intro" });
        session.push({ pointId: c.pointId, kind: "intro", isNew: true });
        sec += DEFAULT_TIMING.intro * 60;
      } else {
        const st = states.get(c.pointId);
        const ex = byId.get(c.pointId)!.exercises.find((e) => e.id === c.exerciseId)!;
        const r = st?.card ? retrievability(s, st.card, now) : c.reason === "new" ? PRIOR : 0.8;
        const ok = rand() < Math.max(0.25, r * accuracy);
        apply({ pointId: c.pointId, at: now.toISOString(), kind: "answer", exerciseId: c.exerciseId, grade: ok ? Grade.Good : Grade.Again, outcome: ok ? "correct" : "wrong" });
        session.push({ pointId: c.pointId, kind: "exercise", isNew: c.reason === "new" });
        sec += DEFAULT_TIMING[ex.type] * 60;
      }
      now = new Date(now.getTime() + 20_000);
    }
    used.push(Math.round(sec / 60));
  }
  const A = points.filter((p) => p.tier === "A");
  const seen = (p: PointWithTopic) => !!states.get(p.id)?.introducedAt;
  const at = examMoment(EXAM);
  const safety = points.filter((p) => p.safety);
  const cases = points.filter((p) => p.exercises.some((e) => e.type === "case"));
  return {
    minutes: used,
    seenA: A.filter(seen).length,
    totalA: A.length,
    safety: [safety.filter(seen).length, safety.length],
    cases: [cases.filter(seen).length, cases.length],
    expRecall: A.reduce((n, p) => n + (states.get(p.id)?.card ? retrievability(s, states.get(p.id)!.card, at) : 0), 0),
    omitted: A.filter((p) => !seen(p)),
  };
}

const line = (label: string, r: Result) =>
  `${label.padEnd(26)} min/day ${r.minutes.join(",").padEnd(42)} tier A ${r.seenA}/${r.totalA}  safety ${r.safety.join("/")}  cases ${r.cases.join("/")}  ≈${r.expRecall.toFixed(0)} tier A recalled (model)`;

const args = process.argv.slice(2);
if (args[0] === "matrix") {
  const days = Number(args[1] ?? 11);
  console.log(`Simulated ${days} days to ${EXAM}, prior knowledge ${PRIOR}; model estimates only (see header).`);
  for (const acc of [1, 0.8]) for (const m of [30, 45, 60]) console.log(line(`${m} min, ${acc === 1 ? "typical" : "weaker"} learner`, run(days, m, acc)));
} else {
  const [days, minutes, accuracy] = [Number(args[0] ?? 11), Number(args[1] ?? 45), Number(args[2] ?? 1)];
  const r = run(days, minutes, accuracy);
  console.log(`Simulated ${days} days, ${minutes} min/day planned, accuracy ×${accuracy}; model estimates only (see header).`);
  console.log(line("result", r));
  const byCrit = new Map<string, PointWithTopic[]>();
  for (const p of r.omitted) byCrit.set(p.criteria[0], [...(byCrit.get(p.criteria[0]) ?? []), p]);
  console.log(`Tier-A points never introduced: ${r.omitted.length} — by criterion: ${[...byCrit].sort().map(([c, ps]) => `${c}(${ps.length})`).join(" ") || "none"}`);
  if (args.includes("--detail")) for (const [c, ps] of [...byCrit].sort()) console.log(`  ${c}: ${ps.map((p) => `${p.id}${p.safety ? " [bezpečnost]" : ""}`).join(", ")}`);
}
process.exit(0);
