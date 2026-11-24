import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkAdminPassphrase, createAdminToken } from "@/server/session";

/** Admin login: sets only the admin cookie; a learner session in the same browser is left as it is. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { passphrase?: unknown };
  if (typeof body.passphrase !== "string" || body.passphrase.length > 200) {
    return NextResponse.json({ error: "Zadej heslo." }, { status: 400 });
  }
  let ok = false;
  try {
    ok = await checkAdminPassphrase(body.passphrase);
  } catch (e) {
    console.error("admin login config", (e as Error).message);
    return NextResponse.json({ error: "Přístup do správy není na serveru nastavený." }, { status: 500 });
  }
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Heslo nesedí." }, { status: 401 });
  }
  const { token, maxAge } = await createAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  return res;
}
