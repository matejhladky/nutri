import { NextResponse } from "next/server";
import { denyUnlessAuthed } from "@/server/http";
import { getAllStates, getSettings, openReports } from "@/server/store";

/** Everything the client needs to plan: point states, settings, reported (hidden) items. */
export async function GET() {
  const denied = await denyUnlessAuthed();
  if (denied) return denied;
  const [states, settings, reports] = await Promise.all([getAllStates(), getSettings(), openReports()]);
  return NextResponse.json({ states, settings, reports, serverTime: new Date().toISOString() });
}
