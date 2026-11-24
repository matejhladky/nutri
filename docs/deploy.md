# Deployment runbook (not yet executed — needs the owner's approval and accounts)

Target: private GitHub repo → Vercel (Hobby) → Neon Postgres (free, via the Vercel Marketplace). Two learners, each
with her own passphrase. Nothing here costs money on the free tiers; check the current tier limits before creating anything.

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
   - `LEARNER_1_PASSPHRASE`, `LEARNER_2_PASSPHRASE` — one per learner, different, easy to type on a phone but
     unguessable (e.g. 4 random words). Send each privately to its owner only. Optional: `LEARNER_n_NAME` (greeting,
     vocative; defaults "Lucko" / "Dančo") and `LEARNER_n_EXAM_DATE` (YYYY-MM-DD, default 2026-12-04).
   - `ADMIN_PASSPHRASE` — opens `/admin` (read-only overview of both learners, content explorer with a sandboxed
     preview). Different from both learner passphrases; leave unset to turn the admin area off. Optional
     `LEARNER_n_LABEL` = the name shown there (nominative; defaults "Lucka" / "Danča").
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
- **Reports ("Nahlásit chybu"):** Neon SQL editor: `SELECT * FROM reports WHERE NOT resolved ORDER BY created_at;`
  (`learner_id` says who) — fix the item, deploy, then `UPDATE reports SET resolved = true WHERE id = …;` (the item
  reappears for that learner; a report only ever hides the item for the learner who sent it).
- **Backup / inspection:** Neon keeps point-in-time history (and a branch is an instant copy);
  `DATABASE_URL='…' pnpm db:backup` exports every table to `backups/` locally. The `events` table is the source of
  truth and `point_state` can be rebuilt from it.
- **Rotate access:** change a learner's `LEARNER_n_PASSPHRASE` (her new logins) and `SESSION_SECRET` (logs out every
  device of both), redeploy. Removing a learner's passphrase also ends her existing sessions.

## Upgrade: one learner → two (2026-11-24)

Existing data (events, point states, reports, settings) is assigned to learner 1 automatically on the first request
after deploying (`src/server/db.ts`, one atomic statement; nothing is deleted). Learner 2 starts empty.

1. **Back up:** Neon console → Branches → create a branch from `main` ("before-two-learners"); optionally also
   `DATABASE_URL='…' pnpm db:backup` locally.
2. **Env (Production):** add `LEARNER_1_PASSPHRASE` (a NEW passphrase for Lucka), `LEARNER_2_PASSPHRASE`, optionally
   `LEARNER_2_NAME` / `LEARNER_2_EXAM_DATE`; replace `SESSION_SECRET` with a new value; delete `APP_PASSPHRASE`.
3. Push → Vercel deploys (or Redeploy). Old cookies are invalid twice over (new token format, new secret).
4. **Check** (Neon SQL editor): `SELECT learner_id, count(*) FROM events GROUP BY 1;` → only `l1`, same total as
   before. Log in with each passphrase: learner 1 sees her progress and "Ahoj Lucko", learner 2 an empty plan.
5. Rollback if needed: redeploy the previous commit and restore from the branch (the old code cannot read the
   migrated tables).

## Known limits

- Login is a passphrase per learner with a small delay after a wrong attempt; no lockout. Use strong passphrases.
- No offline install (PWA); the in-page outbox keeps answers given during short connection drops.
