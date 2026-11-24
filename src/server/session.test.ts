import { beforeEach, describe, expect, it } from "vitest";
import { checkAdminPassphrase, checkPassphrase, createAdminToken, createSessionToken, verifyAdminToken, verifySessionToken } from "./session";

const env = process.env as Record<string, string | undefined>;

beforeEach(() => {
  env.SESSION_SECRET = "test-secret-0123456789abcdef";
  env.LEARNER_1_PASSPHRASE = "jarni louka";
  env.LEARNER_2_PASSPHRASE = "modra konvice";
});

describe("learner sessions", () => {
  it("each passphrase identifies exactly its learner", async () => {
    expect(await checkPassphrase("jarni louka")).toBe("l1");
    expect(await checkPassphrase(" modra konvice ")).toBe("l2");
    expect(await checkPassphrase("jarni")).toBeNull();
    expect(await checkPassphrase("")).toBeNull();
  });

  it("refuses an ambiguous or missing configuration", async () => {
    env.LEARNER_2_PASSPHRASE = "jarni louka";
    await expect(checkPassphrase("jarni louka")).rejects.toThrow();
    delete env.LEARNER_1_PASSPHRASE;
    delete env.LEARNER_2_PASSPHRASE;
    await expect(checkPassphrase("cokoli")).rejects.toThrow();
  });

  it("only learner 2 configured: learner 1 cannot log in, and her old sessions stop working", async () => {
    const { token } = await createSessionToken("l1");
    delete env.LEARNER_1_PASSPHRASE;
    expect(await checkPassphrase("jarni louka")).toBeNull();
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("the token names its learner and cannot be re-pointed at the other one", async () => {
    const { token } = await createSessionToken("l1");
    expect(await verifySessionToken(token)).toBe("l1");
    expect(await verifySessionToken((await createSessionToken("l2")).token)).toBe("l2");
    expect(await verifySessionToken(token.replace(/^l1\./, "l2."))).toBeNull();
    expect(await verifySessionToken(token.replace(/^l1\./, "admin."))).toBeNull();
  });

  it("rejects expired tokens, another secret, and the old single-learner format", async () => {
    const now = Date.now();
    const { token } = await createSessionToken("l2", now);
    expect(await verifySessionToken(token, now + 91 * 86400_000)).toBeNull();
    env.SESSION_SECRET = "a-rotated-secret-0123456789";
    expect(await verifySessionToken(token, now)).toBeNull();
    // "<expiry>.<HMAC(secret, expiry)>" — exactly what the single-learner version issued, signed with the current secret.
    const exp = String(now + 86400_000);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(exp))).toString("base64url");
    expect(await verifySessionToken(`${exp}.${sig}`, now)).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
  });
});

describe("admin session", () => {
  beforeEach(() => {
    env.ADMIN_PASSPHRASE = "spravce zahrady";
  });

  it("only the admin passphrase opens the admin area, and it is not a learner login", async () => {
    expect(await checkAdminPassphrase("spravce zahrady")).toBe(true);
    expect(await checkAdminPassphrase("jarni louka")).toBe(false); // learner 1
    expect(await checkPassphrase("spravce zahrady")).toBeNull();
  });

  it("admin and learner tokens are never interchangeable", async () => {
    const admin = (await createAdminToken()).token;
    const learner = (await createSessionToken("l1")).token;
    expect(await verifyAdminToken(admin)).toBe(true);
    expect(await verifySessionToken(admin)).toBeNull();
    expect(await verifyAdminToken(learner)).toBe(false);
    expect(await verifyAdminToken(admin.replace(/^admin\./, "l1."))).toBe(false);
  });

  it("is off without ADMIN_PASSPHRASE, and refuses a passphrase shared with a learner", async () => {
    const admin = (await createAdminToken()).token;
    delete env.ADMIN_PASSPHRASE;
    expect(await verifyAdminToken(admin)).toBe(false);
    await expect(checkAdminPassphrase("cokoli")).rejects.toThrow();
    env.ADMIN_PASSPHRASE = "jarni louka";
    await expect(checkAdminPassphrase("jarni louka")).rejects.toThrow();
    await expect(checkPassphrase("jarni louka")).rejects.toThrow();
  });
});
