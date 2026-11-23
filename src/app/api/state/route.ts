import { NextResponse } from "next/server";
import { denyUnlessAuthed } from "@/server/http";
import { getAllStates, getObservedTiming, getSettings, getTodayAnswers, openReports } from "@/server/store";
import { pointsById } from "@/lib/content";

const typeOf = (pointId: string, exerciseId: string) => pointsById.get(pointId)?.exercises.find((e) => e.id === exerciseId)?.type;

/** Everything the client needs to plan: point states, settings, reported (hidden) items, her observed timing. */
export async function GET() {
  const denied = await denyUnlessAuthed();
  if (denied) return denied;
  const [states, settings, reports, timing, todayAnswers] = await Promise.all([
    getAllStates(),
    getSettings(),
    openReports(),
    getObservedTiming(typeOf),
    getTodayAnswers(),
  ]);
  return NextResponse.json({ states, settings, reports, timing, todayAnswers, serverTime: new Date().toISOString() });
}
