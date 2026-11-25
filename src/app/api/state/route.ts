import { NextResponse } from "next/server";
import { authLearner } from "@/server/http";
import { getAllStates, getObservedTiming, getSettings, getAnswersByDay, getExtraAnswersToday, openReports } from "@/server/store";
import { buddySummary } from "@/server/buddy";
import { pointsById } from "@/lib/content";
import { dayKey } from "@/engine/time";

const typeOf = (pointId: string, exerciseId: string) => pointsById.get(pointId)?.exercises.find((e) => e.id === exerciseId)?.type;

/**
 * Everything the client needs: point states, settings, reported (hidden) items, her observed timing, recent answers per
 * day, today's answers over plan — and `buddy`: only today's aggregate numbers of the other learner (comparison line).
 */
export async function GET() {
  const auth = await authLearner();
  if ("denied" in auth) return auth.denied;
  const { learner } = auth;
  const now = new Date();
  const [states, settings, reports, timing, answersByDay, extraToday, buddy] = await Promise.all([
    getAllStates(learner),
    getSettings(learner),
    openReports(learner),
    getObservedTiming(learner, typeOf),
    getAnswersByDay(learner, now),
    getExtraAnswersToday(learner, now),
    buddySummary(learner, now),
  ]);
  const todayAnswers = answersByDay[dayKey(now)] ?? 0;
  return NextResponse.json({ states, settings, reports, timing, answersByDay, todayAnswers, extraToday, buddy, serverTime: now.toISOString() });
}
