import { NextResponse } from "next/server";
import { checkPassphrase, createSessionToken, SESSION_COOKIE } from "@/server/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { passphrase?: unknown };
  if (typeof body.passphrase !== "string" || body.passphrase.length > 200) {
    return NextResponse.json({ error: "Zadej heslo." }, { status: 400 });
  }
  let ok = false;
  try {
    ok = await checkPassphrase(body.passphrase);
  } catch {
    return NextResponse.json({ error: "Přihlášení není na serveru nastavené (APP_PASSPHRASE)." }, { status: 500 });
  }
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "Heslo nesedí." }, { status: 401 });
  }
  const { token, maxAge } = await createSessionToken();
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
