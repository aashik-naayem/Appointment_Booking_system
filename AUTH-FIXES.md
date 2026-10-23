# Login fix pass

## Why login was failing

The login code itself was mostly sound. The failures came from the environment, plus several
bugs that hid the real cause or broke the flow right after login.

| #   | Problem                                                                                                                                                                                                                                                            | Effect                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 1   | **Database unreachable / not migrated / no users.** Any DB error inside `authorize()` makes Auth.js return the opaque `"Configuration"` error. The login page showed _"Invalid email or password"_ for every error except one that could never match.              | You see "Invalid email or password" even though the real cause is "PostgreSQL isn't running". |
| 2   | **Placeholder Upstash values in `.env.local`** (`https://...upstash.io`, `...`). They are non-empty, so the app created a Redis client that fails on every call.                                                                                                   | `POST /api/auth/register` returned 500, so no new account could be created.                   |
| 3   | `throw new Error("AccountLocked")` is never delivered to the browser (only `CredentialsSignin` subclasses are).                                                                                                                                                    | The "account locked" message never appeared.                                                  |
| 4   | **Lockout counter never reset after the lock expired.**                                                                                                                                                                                                            | After 5 bad passwords + 15 min, a single typo locked you out again instantly.                 |
| 5   | **Post-onboarding redirect loop.** The JWT kept `tenantId = null` after the tenant was created, so `/dashboard` redirected back to `/onboarding`. The 5-minute refresh used JWT `iat`, which Auth.js resets on every cookie re-issue, so it effectively never ran. | Newly registered users could not reach the dashboard.                                         |
| 6   | Soft-deleted users could still log in with a password. Unknown emails skipped bcrypt (timing leak).                                                                                                                                                                | Security.                                                                                     |
| 7   | An error while writing the audit log (`events.signIn`) would abort the login.                                                                                                                                                                                      | Fragility.                                                                                    |
| 8   | `useSearchParams()` without `<Suspense>`; unvalidated `callbackUrl` (open redirect); Google button shown with fake credentials; emails with a trailing space rejected; `requireAuth()` redirects inside API routes became HTTP 500.                                | Build failure / UX / security.                                                                |

## What changed

- `lib/auth/credentials.ts` (new): credential check + lockout rules, no framework imports, unit-tested.
- `lib/auth/errors.ts` (new): `AccountLockedError` (surfaces as `code: "account_locked"`).
- `lib/auth/index.ts`: uses the above; JWT now re-reads role/tenant from the DB when stale (own `refreshedAt`
  timestamp) **or when the user has no tenant yet**; DB errors are logged as `[auth] ...`; audit log can't break login;
  Google provider registered only when real credentials exist; logout audit event.
- `lib/auth/auth.config.ts`: `trustHost: true`. `types/next-auth.d.ts`: `refreshedAt`.
- `app/auth/login/page.tsx` + `login-form.tsx`: Suspense wrapper; distinct messages for wrong password / locked /
  server error; sanitised `callbackUrl`; Google button only when configured.
- `app/auth/register/page.tsx`, `app/auth/error/page.tsx`, `api/auth/register/route.ts`: Google gating, clearer messages,
  race-safe duplicate-email handling (409).
- `lib/utils/env.ts`, `lib/db/redis.ts`, `lib/utils/rate-limit.ts`: placeholder values are treated as "not configured";
  a Redis outage falls back to the in-memory limiter instead of failing the request.
- `lib/utils/api.ts`: redirects thrown by `requireAuth()` become 401/403 JSON in API routes.
- `lib/validations/auth.ts`: emails are trimmed before validation.
- `.env.example`: Upstash and Google are blank by default. `next.config.ts`: exposes `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`.
- `packages/database/scripts/auth-doctor.ts` + `npm run auth:doctor`: checks env, DB connection, tables, users, lockouts;
  `--unlock <email>` and `--set-password <email> <password>` helpers.
- Tests: `credentials.test.ts` (9), `auth-helpers.test.ts` (8). Full suite: 108 passing; `tsc --noEmit` clean.

## Database check

The migration `20261010200930_init` was applied to a clean PostgreSQL 16 and the `User`, `Account`, `Session`,
`VerificationToken` and `AuditLog` tables match `schema.prisma` (22 tables created, enum `AuditAction` includes
`LOGIN`/`LOGOUT`). The schema is not the problem.

## What you need to do on your machine

1. Make sure PostgreSQL is running and matches `DATABASE_URL` (`bookflow` / your password / `localhost:5432` / db `bookflow`).
   - Docker: `docker compose -f docker-compose.dev.yml up -d`
   - No Docker: install PostgreSQL for Windows, then in `psql` as `postgres`:
     `CREATE ROLE bookflow LOGIN CREATEDB PASSWORD 'password';` and `CREATE DATABASE bookflow OWNER bookflow;`
     (`CREATEDB` is needed because `prisma migrate dev` uses a shadow database.)
2. In `.env.local`, clear the placeholder lines (the code now ignores them, but blank is cleaner):
   `UPSTASH_REDIS_REST_URL=`, `UPSTASH_REDIS_REST_TOKEN=`, `GOOGLE_CLIENT_ID=`, `GOOGLE_CLIENT_SECRET=`
3. From the project root:
   ```powershell
   npm run db:migrate      # applies the init migration
   npm run db:seed         # demo@bookflow.app / Demo1234
   npm run auth:doctor     # should end with "No blocking problems found."
   npm run dev
   ```
4. Locked out after too many attempts? `npm run auth:doctor -- --unlock you@example.com`
