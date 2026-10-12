# Changes in this fix pass

## Root cause of `prisma generate` failing

`package-lock.json` resolved two different `@prisma/client` versions: 7.10.0 at the root
(auto-installed as a peer dependency of `@auth/prisma-adapter`) and 5.22.0 under
`packages/database`. The `prisma` CLI is 5.22.0, so `prisma generate` could not resolve a
matching client.

Fix: root `package.json` `overrides` pin `@prisma/client` and `prisma` to 5.22.0,
`apps/web` declares `@prisma/client`, and the lockfile was regenerated (single Prisma version).

## One-time setup after unzipping

1. Delete every `node_modules` folder and run `npm install`.
2. `npm run db:generate`
3. Start the databases: `docker compose -f docker-compose.dev.yml up -d`
4. Create the initial migration (the repo has none yet):
   `cd packages/database && npx prisma migrate dev --name init`, then commit `prisma/migrations`.
5. `npm run db:seed`, then `npm run dev`

## Other fixes

- Decimal values were passed from server pages to client components (runtime crash); added
  `lib/utils/serialize.ts` and used it on the dashboard, services, billing, settings, staff and
  public booking pages.
- Invalid Prisma `where` inside to-one includes (`book/[slug]`, `availability.ts`).
- `scheduleBookingReminders` never loaded `service` (runtime crash).
- `registerSchema.omit` failed because the schema was wrapped in `.refine`.
- Stripe: removed hard-coded `apiVersion` that did not match the installed SDK; fixed payload casts.
- API error mapping now matches the messages actually thrown (400 instead of 500).
- Booking creation runs in a Serializable transaction (race-safe double-booking guard).
- `requireOwnedResource` now throws the default `NotFoundError` message.
- `seed.ts` imported the Prisma client from the wrong path.
- `ENCRYPTION_KEY` shorter than 32 bytes now throws instead of being zero-padded.
- Tests: fixed `vi.mock` hoisting, `next-auth` resolution under Vitest; added a key-length test.
- Docker: rewritten Dockerfile (`npm ci`, no fragile `COPY` of `apps/web/node_modules`, OpenSSL for
  Alpine), added `.dockerignore`, removed a mount of a missing `scripts/init-db.sql`, removed
  obsolete `version:` keys.
- Prisma `binaryTargets` now include `linux-musl-openssl-3.0.x` for the Alpine image.
- Whole repo formatted with Prettier so the CI `format:check` step passes.

## Known gaps (not changed)

- `.env.example` references `/api/integrations/google-calendar/callback`, but that route is not
  implemented, so Google Calendar OAuth cannot complete yet.
- `docker-compose.yml` sets `REDIS_URL`, but the app uses Upstash REST variables.
- `npm audit` reports vulnerabilities in deprecated transitive dependencies; review before production.
