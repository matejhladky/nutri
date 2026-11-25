import "server-only";
/**
 * Today's numbers of the OTHER learner for the comparison line on Dnes. Read-only (readOnly db: nothing is written,
 * not even a cache refresh), and only these aggregates leave the server — never her states, answers or topics.
 */
import type { Buddy } from "@/lib/buddy";
import type { LearnerId } from "@/lib/learner";
import { pointsById, visiblePoints } from "@/lib/content";
import { dailyPlan } from "@/engine/planner";
import { getScheduler, retrievability } from "@/engine/scheduler";
import { dayKey } from "@/engine/time";
import { getDb, readOnly } from "./db";
import { getLearner, learnerLabel, learnerLabelWith, learnerPassphrase } from "./learners";
import { getAnswersByDay, getExtraAnswersToday, getObservedTiming, getSettings, listReports, readStates } from "./store";

export const otherLearner = (id: LearnerId): LearnerId => (id === "l1" ? "l2" : "l1");

const typeOf = (pointId: string, exerciseId: string) => pointsById.get(pointId)?.exercises.find((e) => e.id === exerciseId)?.type;

/** The other learner's day, or null when there is no other learner (no passphrase configured). */
export async function buddySummary(me: LearnerId, now = new Date()): Promise<Buddy | null> {
  const her = otherLearner(me);
  if (!learnerPassphrase(her)) return null;
  const db = readOnly(await getDb());
  const [states, settings, reports, timing, byDay, extra, s] = await Promise.all([
    readStates(her, db),
    getSettings(her, db),
    listReports(her, db),
    getObservedTiming(her, typeOf, db),
    getAnswersByDay(her, now, 7, db),
    getExtraAnswersToday(her, now, db),
    getScheduler(),
  ]);
  const plan = dailyPlan({
    now,
    examDate: getLearner(her).examDate,
    points: visiblePoints(reports.filter((r) => !r.resolved)),
    states: new Map(Object.entries(states)),
    dailyMinutes: settings.dailyMinutes,
    timing,
    retrievability: (st, at) => retrievability(s, st.card, at),
  });
  return {
    label: learnerLabel(her),
    labelWith: learnerLabelWith(her),
    answers: byDay[dayKey(now)] ?? 0,
    extra,
    planDone: plan.goalReached,
    days7: Object.values(byDay).filter((n) => n > 0).length,
  };
}
