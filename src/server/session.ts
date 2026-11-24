/**
 * Two-learner access: each learner's passphrase (LEARNER_n_PASSPHRASE) → signed, httpOnly session cookie that names her.
 * Token = "<learner>.<expiry>.<HMAC-SHA256(SESSION_SECRET, "<learner>.<expiry>")>". Web Crypto only, so it works in
 * proxy and route handlers. Tokens of the earlier single-learner format ("<expiry>.<sig>") are never accepted.
 */
import { isLearnerId, LEARNER_IDS, type LearnerId } from "@/lib/learner";
import { learnerPassphrase } from "./learners";

export const SESSION_COOKIE = "nutri_session";
export const SESSION_DAYS = 90;
/** Admin (read-only overview + content explorer): its own passphrase, cookie and token kind — never a learner session. */
export const ADMIN_COOKIE = "nutri_admin";
export const ADMIN_DAYS = 30;
const adminPassphrase = () => process.env.ADMIN_PASSPHRASE?.trim() || undefined;

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("base64url");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is missing or too short (≥ 16 chars)");
  return s;
}

/** Constant-time string comparison via digests. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/**
 * The learner whose passphrase this is, or null. Compares against every configured passphrase (no early exit).
 * Throws when nothing is configured or two learners share a passphrase (identity would be ambiguous).
 */
export async function checkPassphrase(input: string): Promise<LearnerId | null> {
  const configured = LEARNER_IDS.flatMap((id) => {
    const p = learnerPassphrase(id);
    return p ? [{ id, p }] : [];
  });
  if (!configured.length) throw new Error("LEARNER_1_PASSPHRASE is not configured");
  assertDistinct();
  const hits = await Promise.all(configured.map((c) => safeEqual(input.trim(), c.p)));
  return configured.find((_, i) => hits[i])?.id ?? null;
}

export async function createSessionToken(learner: LearnerId, now = Date.now()): Promise<{ token: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 86400;
  const body = `${learner}.${now + maxAge * 1000}`;
  return { token: `${body}.${await hmac(secret(), body)}`, maxAge };
}

/** The learner this session belongs to, or null (missing, malformed, expired, forged, or learner no longer configured). */
export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<LearnerId | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [learner, exp, sig] = parts;
  if (!isLearnerId(learner) || !learnerPassphrase(learner) || !/^\d+$/.test(exp) || Number(exp) < now || !sig) return null;
  try {
    return (await safeEqual(sig, await hmac(secret(), `${learner}.${exp}`))) ? learner : null;
  } catch {
    return null;
  }
}

/** Every configured passphrase (both learners, admin) must be different, or identity would be ambiguous. */
function assertDistinct() {
  const all = [...LEARNER_IDS.map(learnerPassphrase), adminPassphrase()].filter(Boolean);
  if (new Set(all).size !== all.length) throw new Error("Learner and admin passphrases must all differ");
}

/** True only for the admin passphrase. Throws when ADMIN_PASSPHRASE is missing or not unique. */
export async function checkAdminPassphrase(input: string): Promise<boolean> {
  const expected = adminPassphrase();
  if (!expected) throw new Error("ADMIN_PASSPHRASE is not configured");
  assertDistinct();
  return safeEqual(input.trim(), expected);
}

export async function createAdminToken(now = Date.now()): Promise<{ token: string; maxAge: number }> {
  const maxAge = ADMIN_DAYS * 86400;
  const body = `admin.${now + maxAge * 1000}`;
  return { token: `${body}.${await hmac(secret(), body)}`, maxAge };
}

/** Valid admin session? (A learner token never is: its first part is a learner id, not "admin".) */
export async function verifyAdminToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token || !adminPassphrase()) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [kind, exp, sig] = parts;
  if (kind !== "admin" || !/^\d+$/.test(exp) || Number(exp) < now || !sig) return false;
  try {
    return await safeEqual(sig, await hmac(secret(), `admin.${exp}`));
  } catch {
    return false;
  }
}
