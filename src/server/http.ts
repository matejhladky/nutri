import "server-only";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { LEARNER_HEADER, type LearnerId } from "@/lib/learner";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/**
 * The signed-in learner, or the response to send instead:
 * 401 without a valid session; 409 when the page that sent the request was rendered for the other learner
 * (stale tab after switching accounts on the same device) — its data must not land in, or come from, this account.
 */
export async function authLearner(): Promise<{ learner: LearnerId } | { denied: NextResponse }> {
  const learner = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!learner) return { denied: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if ((await headers()).get(LEARNER_HEADER) !== learner) {
    return { denied: NextResponse.json({ error: "learner mismatch" }, { status: 409 }) };
  }
  return { learner };
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
