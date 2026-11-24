import { NextResponse } from "next/server";
import type { LearnerId } from "@/lib/learner";
import { checkPassphrase, createSessionToken, SESSION_COOKIE } from "@/server/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { passphrase?: unknown };
  if (typeof body.passphrase !== "string" || body.passphrase.length > 200) {
    return NextResponse.json({ error: "Zadej heslo." }, { status: 400 });
  }
  let learner: LearnerId | null = null;
  try {
    learner = await checkPassphrase(body.passphrase);
  } catch (e) {
    console.error("login config", (e as Error).message);
    return NextResponse.json({ error: "Přihlášení není na serveru správně nastavené." }, { status: 500 });
  }
  if (!learner) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "Heslo nesedí." }, { status: 401 });
  }
  const { token, maxAge } = await createSessionToken(learner);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return res;
}
