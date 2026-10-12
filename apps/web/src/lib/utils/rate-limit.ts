/**
 * Rate limiting using Upstash Redis
 * Falls back to in-memory rate limiting if Redis is not configured.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/db/redis";
import type { NextRequest } from "next/server";

// Rate limiters
let bookingRateLimit: Ratelimit | null = null;
let authRateLimit: Ratelimit | null = null;
let apiRateLimit: Ratelimit | null = null;

if (redis) {
  bookingRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      parseInt(process.env["RATE_LIMIT_BOOKING_MAX"] ?? "10", 10),
      "1 h",
    ),
    prefix: "ratelimit:booking",
  });

  authRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      parseInt(process.env["RATE_LIMIT_AUTH_MAX"] ?? "5", 10),
      "15 m",
    ),
    prefix: "ratelimit:auth",
  });

  apiRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, "1 h"),
    prefix: "ratelimit:api",
  });
}

// In-memory fallback (development only)
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

function inMemoryRateLimit(
  key: string,
  max: number,
  windowMs: number,
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const record = inMemoryStore.get(key);

  if (!record || record.resetAt < now) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: max - 1, reset: now + windowMs };
  }

  record.count++;
  return {
    success: record.count <= max,
    remaining: Math.max(0, max - record.count),
    reset: record.resetAt,
  };
}

type LimitResult = { success: boolean; remaining: number; reset: number };

/**
 * Run an Upstash limiter, but never let a Redis outage (bad credentials, network error)
 * take sign-up / booking down: fall back to the in-memory limiter instead.
 */
async function runLimiter(
  limiter: Ratelimit,
  key: string,
  fallback: () => LimitResult,
): Promise<LimitResult> {
  try {
    const result = await limiter.limit(key);
    return { success: result.success, remaining: result.remaining, reset: result.reset };
  } catch (error) {
    console.error("[rate-limit] Redis unavailable, using in-memory fallback:", error);
    return fallback();
  }
}

export async function checkBookingRateLimit(request: NextRequest): Promise<{
  success: boolean;
  remaining: number;
  reset: number;
}> {
  const ip = getClientIp(request);
  const key = `booking:${ip}`;

  if (bookingRateLimit) {
    return runLimiter(bookingRateLimit, key, () => inMemoryRateLimit(key, 10, 60 * 60 * 1000));
  }

  return inMemoryRateLimit(key, 10, 60 * 60 * 1000);
}

export async function checkAuthRateLimit(request: NextRequest): Promise<{
  success: boolean;
  remaining: number;
  reset: number;
}> {
  const ip = getClientIp(request);
  const key = `auth:${ip}`;

  if (authRateLimit) {
    return runLimiter(authRateLimit, key, () => inMemoryRateLimit(key, 5, 15 * 60 * 1000));
  }

  return inMemoryRateLimit(key, 5, 15 * 60 * 1000);
}

export async function checkApiRateLimit(apiKey: string): Promise<{
  success: boolean;
  remaining: number;
  reset: number;
}> {
  if (apiRateLimit) {
    return runLimiter(apiRateLimit, apiKey, () =>
      inMemoryRateLimit(`api:${apiKey}`, 1000, 60 * 60 * 1000),
    );
  }

  return inMemoryRateLimit(`api:${apiKey}`, 1000, 60 * 60 * 1000);
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
