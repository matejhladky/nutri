import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, SESSION_COOKIE, verifyAdminToken, verifySessionToken } from "@/server/session";

/**
 * Optimistic gate (pages and API routes check again themselves):
 *  - /admin, /api/admin → admin session only (a learner session never opens them);
 *  - everything else → learner session (an admin session never opens a learner's app or API).
 */
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  const deny = (login: string) =>
    isApi ? NextResponse.json({ error: "unauthorized" }, { status: 401 }) : NextResponse.redirect(new URL(login, req.url));

  if (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/")) {
    if (path === "/admin/login" || path === "/api/admin/login") return NextResponse.next();
    return (await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) ? NextResponse.next() : deny("/admin/login");
  }
  return (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) ? NextResponse.next() : deny("/login");
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest).*)"],
};
