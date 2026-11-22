/**
 * Single-learner access: one passphrase (APP_PASSPHRASE) → signed, httpOnly session cookie.
 * Signature = HMAC-SHA256(SESSION_SECRET, expiry). Web Crypto only, so it works in proxy and route handlers.
 */
export const SESSION_COOKIE = "nutri_session";
export const SESSION_DAYS = 90;

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

export async function checkPassphrase(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSPHRASE;
  if (!expected) throw new Error("APP_PASSPHRASE is not configured");
  return safeEqual(input.trim(), expected);
}

export async function createSessionToken(now = Date.now()): Promise<{ token: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 86400;
  const exp = String(now + maxAge * 1000);
  return { token: `${exp}.${await hmac(secret(), exp)}`, maxAge };
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  try {
    return await safeEqual(sig, await hmac(secret(), exp));
  } catch {
    return false;
  }
}
