# Deployment runbook (not yet executed — needs the owner's approval and accounts)

Target: private GitHub repo → Vercel (Hobby) → Neon Postgres (free, via the Vercel Marketplace). One learner, one
passphrase. Nothing here costs money on the free tiers; check the current tier limits before creating anything.

## Before the first deploy

1. **Repo hygiene** (already enforced by `.gitignore`): `materials/` (course PDF), `source/` (extracted text), `.env*`,
   `.pglite*/` must never be committed. Check: `git ls-files | grep -E "materials|source/|\.env|pglite"` → empty.
2. **Private GitHub repo:** `gh repo create nutri --private --source . --push` (the repo must stay private: it contains
   paraphrased course content).
3. **Vercel project:** import the repo. Framework Next.js, defaults are fine: `pnpm build` runs `content:build`
   (needs only `content/`, not the PDF) then `next build`. Node 24, pnpm 11 via `packageManager`.
4. **Neon:** Vercel → Storage → add Neon (Marketplace) and connect it to the project; it sets `DATABASE_URL`.
   Tables are created automatically on first request (`src/server/db.ts`).
5. **Environment variables** (Production):
   - `APP_PASSPHRASE` — a passphrase she can type on a phone but nobody guesses (e.g. 4 random words). Send it to her
     privately.
   - `SESSION_SECRET` — `openssl rand -base64 32`.
   - `DATABASE_URL` — set by the Neon integration. Without it the app refuses to start on Vercel (no silent local DB).
6. Deploy.

## Smoke check after deploying (5 min)

- Open the URL on a phone → login with the passphrase → Dnes shows days left and today's plan.
- Answer ~5 cards, reload mid-card → the same card comes back.
- Open the app on a second device (or private window) → same progress after login.
- `curl -i https://<url>/api/state` without cookie → `401`.
- Témata → "Modelové případy" → work one case to the end.
- On her phone: browser menu → "Přidat na plochu" so it opens like an app.

## Operating it

- **Content fixes:** edit `content/topics/*.yaml` → `pnpm validate` → commit → push → Vercel redeploys. Her progress is
  kept (it is stored per point; exercise edits never lose it; bump an exercise `version` if its meaning changes).
- **Her reports ("Nahlásit problém"):** Neon SQL editor: `SELECT * FROM reports WHERE NOT resolved ORDER BY created_at;`
  fix the item, deploy, then `UPDATE reports SET resolved = true WHERE id = …;` (the item reappears for her).
- **Backup / inspection:** Neon keeps point-in-time history; the `events` table is the source of truth and
  `point_state` can be rebuilt from it.
- **Rotate access:** change `APP_PASSPHRASE` (new logins) and `SESSION_SECRET` (logs out every device), redeploy.

## Known limits

- Login is a single shared passphrase with a small delay after a wrong attempt; no lockout. Use a strong passphrase.
- No offline install (PWA); the in-page outbox keeps answers given during short connection drops.
