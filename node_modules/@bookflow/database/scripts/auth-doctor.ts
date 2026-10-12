/**
 * Login diagnostics for BookFlow.
 *
 *   npm run auth:doctor                                   # full check
 *   npm run auth:doctor -- --unlock you@example.com       # clear a lockout / failed-attempt counter
 *   npm run auth:doctor -- --set-password you@example.com NewPass123
 *
 * Reads ../../.env.local (same as the other db:* scripts). Never prints secrets.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/client";

const PLACEHOLDER = /(\.\.\.|…|your-|<[^>]+>|changeme|change-me|xxxx)/i;
const isReal = (v?: string) => !!v && v.trim() !== "" && !PLACEHOLDER.test(v);

const ok = (m: string) => console.log(`  \u2713 ${m}`);
const warn = (m: string) => console.log(`  ! ${m}`);
const bad = (m: string) => {
  problems++;
  console.log(`  \u2717 ${m}`);
};
let problems = 0;

function checkEnv() {
  console.log("\n1) Environment");
  const url = process.env["NEXTAUTH_URL"] ?? process.env["AUTH_URL"];
  const secret = process.env["NEXTAUTH_SECRET"] ?? process.env["AUTH_SECRET"];

  if (!isReal(secret))
    bad("NEXTAUTH_SECRET (or AUTH_SECRET) is missing - logins cannot be signed.");
  else if (secret!.length < 32) warn("NEXTAUTH_SECRET is shorter than 32 characters.");
  else ok("NEXTAUTH_SECRET is set");

  if (!url)
    warn("NEXTAUTH_URL is not set (fine on localhost, required behind a proxy / in production).");
  else ok(`NEXTAUTH_URL = ${url}  (must match the address in your browser bar exactly)`);

  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) bad("DATABASE_URL is missing.");
  else {
    try {
      const u = new URL(dbUrl);
      ok(
        `DATABASE_URL -> ${u.hostname}:${u.port || "5432"}/${u.pathname.slice(1)} (user ${u.username})`,
      );
    } catch {
      bad(
        "DATABASE_URL is not a valid URL (special characters in the password must be URL-encoded).",
      );
    }
  }

  const redisOk =
    isReal(process.env["UPSTASH_REDIS_REST_URL"]) &&
    isReal(process.env["UPSTASH_REDIS_REST_TOKEN"]);
  if (redisOk) ok("Upstash Redis configured");
  else if (process.env["UPSTASH_REDIS_REST_URL"] || process.env["UPSTASH_REDIS_REST_TOKEN"])
    warn(
      "Upstash values look like placeholders - they are now ignored (in-memory rate limiting is used).",
    );
  else ok("Upstash Redis not configured (in-memory rate limiting is used)");

  if (isReal(process.env["GOOGLE_CLIENT_ID"]) && isReal(process.env["GOOGLE_CLIENT_SECRET"]))
    ok("Google OAuth configured");
  else
    warn(
      "Google OAuth not configured - 'Continue with Google' is hidden. Email/password still works.",
    );
}

async function checkDb(prisma: PrismaClient) {
  console.log("\n2) Database");
  try {
    await prisma.$queryRaw`SELECT 1`;
    ok("Connected to PostgreSQL");
  } catch (e) {
    bad("Cannot connect to PostgreSQL. This alone makes every login fail.");
    console.log(
      `     ${String((e as Error).message)
        .split("\n")
        .filter(Boolean)
        .slice(-2)
        .join(" | ")}`,
    );
    console.log(
      "     -> Start Postgres (e.g. `docker compose -f docker-compose.dev.yml up -d`, or a local install)",
    );
    console.log("        and make sure DATABASE_URL points at it.");
    return false;
  }

  try {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    const names = new Set(tables.map((t) => t.table_name));
    const required = ["User", "Account", "Session", "VerificationToken", "AuditLog", "Tenant"];
    const missing = required.filter((t) => !names.has(t));
    if (missing.length) {
      bad(`Missing tables: ${missing.join(", ")}. Run:  npm run db:migrate`);
      return false;
    }
    ok(`Auth tables exist (${names.size} tables in schema)`);
  } catch (e) {
    bad(`Could not inspect tables: ${(e as Error).message}`);
    return false;
  }
  return true;
}

async function checkUsers(prisma: PrismaClient) {
  console.log("\n3) Users");
  const total = await prisma.user.count();
  if (total === 0) {
    bad(
      "The User table is empty - there is nobody to log in as. Run `npm run db:seed` or register a new account.",
    );
    return;
  }
  ok(`${total} user(s)`);

  const users = await prisma.user.findMany({
    take: 20,
    orderBy: { createdAt: "asc" },
    select: {
      email: true,
      role: true,
      password: true,
      tenantId: true,
      failedLoginCount: true,
      lockedUntil: true,
      deletedAt: true,
    },
  });
  const now = new Date();
  for (const u of users) {
    const flags = [
      u.password ? "password" : "NO PASSWORD (OAuth-only)",
      u.tenantId ? "tenant" : "no tenant yet",
      u.deletedAt ? "DELETED" : "",
      u.lockedUntil && u.lockedUntil > now ? `LOCKED until ${u.lockedUntil.toISOString()}` : "",
      u.failedLoginCount > 0 ? `${u.failedLoginCount} failed attempt(s)` : "",
    ].filter(Boolean);
    console.log(`     ${u.email.padEnd(32)} ${u.role.padEnd(11)} ${flags.join(", ")}`);
  }

  const demo = await prisma.user.findUnique({ where: { email: "demo@bookflow.app" } });
  if (demo?.password) {
    const works = await bcrypt.compare("Demo1234", demo.password);
    if (works) ok("Seeded demo account works: demo@bookflow.app / Demo1234");
    else warn("demo@bookflow.app exists but the password is not Demo1234.");
  }
}

async function unlock(prisma: PrismaClient, email: string) {
  const r = await prisma.user.updateMany({
    where: { email: email.toLowerCase() },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
  console.log(r.count ? `Unlocked ${email}.` : `No user found with email ${email}.`);
}

async function setPassword(prisma: PrismaClient, email: string, password: string) {
  if (password.length < 8) throw new Error("Use at least 8 characters.");
  const hash = await bcrypt.hash(password, 12);
  const r = await prisma.user.updateMany({
    where: { email: email.toLowerCase() },
    data: { password: hash, failedLoginCount: 0, lockedUntil: null },
  });
  console.log(
    r.count
      ? `Password updated and account unlocked for ${email}.`
      : `No user found with email ${email}.`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const prisma = new PrismaClient({ log: ["error"] });
  try {
    const iUnlock = args.indexOf("--unlock");
    const iSet = args.indexOf("--set-password");
    if (iUnlock !== -1) return await unlock(prisma, args[iUnlock + 1] ?? "");
    if (iSet !== -1) return await setPassword(prisma, args[iSet + 1] ?? "", args[iSet + 2] ?? "");

    console.log("BookFlow auth doctor");
    checkEnv();
    if (await checkDb(prisma)) await checkUsers(prisma);
    console.log(problems ? `\n${problems} problem(s) found.\n` : "\nNo blocking problems found.\n");
    process.exitCode = problems ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
