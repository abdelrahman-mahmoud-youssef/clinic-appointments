# Deploying to Railway

This is a pnpm monorepo with two deployable apps (`apps/api`, `apps/web`) that
share `packages/shared`. On Railway you run **four** things: Postgres, Redis, the
API service, and the web service. Build/start commands live in the repo
(`apps/api/railway.json`, `apps/web/railway.json`); secrets live in the Railway UI.

## 0. Prerequisites

- Repo pushed to GitHub.
- A Railway account + a new empty project.

## 1. Add the datastores

In the Railway project:

1. **New → Database → PostgreSQL.**
2. **New → Database → Redis.**

Both come with connection strings exposed as variables you reference later
(`${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`). The double-booking
exclusion constraint needs the `btree_gist` extension — the API's first
migration runs `CREATE EXTENSION IF NOT EXISTS btree_gist`, and Railway's
Postgres allows it, so there's nothing manual to do.

## 2. Create the API service

1. **New → GitHub Repo →** pick this repo. Name it `api`.
2. **Settings → Config-as-code →** set the path to `apps/api/railway.json`.
   That file provides:
   - Build: `pnpm --filter @clinic/shared build && pnpm --filter @clinic/api build`
   - Start: `pnpm --filter @clinic/api run start:prod`
     (`start:prod` = `prisma migrate deploy && node dist/main` — migrations run
     on every deploy, which is idempotent.)
3. **Settings → Variables:**

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` |
   | `JWT_SECRET` | a long random string (NOT `change-me`) |

   `PORT` is injected by Railway; the API already reads it.
4. Deploy. Once it's up, **Settings → Networking → Generate Domain** and copy the
   public URL (e.g. `https://api-production-xxxx.up.railway.app`).

## 3. Seed the first users (one time)

The database is empty after migration, so no one can log in yet. Run the seed
once via the API service's shell / one-off command:

```
pnpm --filter @clinic/api exec prisma db seed
```

(Check `apps/api/prisma/seed.ts` for the seeded accounts/passwords.)

## 4. Create the web service

1. **New → GitHub Repo →** same repo. Name it `web`.
2. **Settings → Config-as-code →** set the path to `apps/web/railway.json`.
3. **Settings → Variables:**

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | the API domain from step 2.4 |

   ⚠️ This is **build-time**. Next.js inlines `NEXT_PUBLIC_*` at build, so it must
   be set *before* the web build. If you change it later, trigger a **rebuild**,
   not just a restart.
4. Deploy, then **Generate Domain** for the web service — that's your app URL.

## 5. Log in

Open the web domain and log in with a seeded account. Book an appointment to
confirm the API, Postgres, and Redis are all wired up.

---

## Gotchas we already handled

- **`Cannot find native binding` / `@tailwindcss/oxide` build failure.**
  Tailwind v4's oxide needs a platform-specific native binary
  (`@tailwindcss/oxide-linux-x64-gnu` on Railway). Because the lockfile was
  generated on Windows, a frozen `pnpm install` on Railway's Linux box only
  fetched the win32 binary and skipped the Linux one, so the build couldn't find
  the binding. Fixed by `pnpm.supportedArchitectures` in the **root
  `package.json`** (`os: [current, linux]`, `cpu: [current, x64, arm64]`), which
  tells pnpm to fetch the Linux/arm binaries too. The repo-root `.npmrc`
  (`node-linker=hoisted`) is a secondary aid that flattens `node_modules` so the
  binary resolves cleanly. The decisive fix, because Railway caches the install
  layer and neither of the above busts that cache, is a fresh install **inside
  the web build command** (`apps/web/railway.json`):
  `pnpm install --no-frozen-lockfile --force && ...build`. Build commands run
  every deploy (unlike the cached install layer), so this guarantees the Linux
  oxide binary is fetched into the final image right before `next build`.
- **Empty database.** `start:prod` runs `prisma migrate deploy` on boot, so the
  schema + exclusion constraint are created automatically on first deploy.
- **Web port.** `apps/web` start script is `next start -p ${PORT:-3001}`, so it
  binds Railway's injected `$PORT` (a hardcoded port fails Railway's healthcheck).
- **Prisma client.** `apps/api` has a `postinstall: prisma generate`, so the
  client is generated during install with no extra build step.

## Optional hardening (not required to run)

- **Restrict CORS.** The API currently reflects any origin (`app.enableCors()`).
  To lock it to the web domain, change `main.ts` to
  `app.enableCors({ origin: process.env.WEB_ORIGIN })` and add a `WEB_ORIGIN` var
  pointing at the web service's URL.
- **Rotate `JWT_SECRET`** if it was ever committed or shared.
