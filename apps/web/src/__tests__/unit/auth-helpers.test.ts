import { describe, it, expect, afterEach } from "vitest";
import { safeCallbackUrl } from "@/lib/utils/safe-redirect";
import { isConfigured, isRedisConfigured, isGoogleAuthConfigured } from "@/lib/utils/env";
import { loginSchema } from "@/lib/validations/auth";

describe("safeCallbackUrl", () => {
  it("keeps normal in-app paths", () => {
    expect(safeCallbackUrl("/appointments?x=1")).toBe("/appointments?x=1");
  });
  it("falls back for empty / external / protocol-relative URLs", () => {
    expect(safeCallbackUrl(null)).toBe("/dashboard");
    expect(safeCallbackUrl("https://evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("//evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("/\\evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("javascript:alert(1)")).toBe("/dashboard");
  });
  it("never sends a signed-in user back to an auth page", () => {
    expect(safeCallbackUrl("/auth/login")).toBe("/dashboard");
  });
});

describe("placeholder detection", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("treats .env.example placeholders as not configured", () => {
    expect(isConfigured("https://...upstash.io")).toBe(false);
    expect(isConfigured("...")).toBe(false);
    expect(isConfigured("your-google-client-id")).toBe(false);
    expect(isConfigured("")).toBe(false);
    expect(isConfigured(undefined)).toBe(false);
  });
  it("accepts real-looking values", () => {
    expect(isConfigured("abc123.apps.googleusercontent.com")).toBe(true);
  });
  it("does not enable Redis / Google with placeholder env", () => {
    process.env["UPSTASH_REDIS_REST_URL"] = "https://...upstash.io";
    process.env["UPSTASH_REDIS_REST_TOKEN"] = "...";
    process.env["GOOGLE_CLIENT_ID"] = "your-google-client-id";
    process.env["GOOGLE_CLIENT_SECRET"] = "your-google-client-secret";
    expect(isRedisConfigured()).toBe(false);
    expect(isGoogleAuthConfigured()).toBe(false);
  });
  it("enables Redis with real values", () => {
    process.env["UPSTASH_REDIS_REST_URL"] = "https://eu1-fancy-12345.upstash.io";
    process.env["UPSTASH_REDIS_REST_TOKEN"] = "AXabCdEf0123456789";
    expect(isRedisConfigured()).toBe(true);
  });
});

describe("loginSchema email normalisation", () => {
  it("trims whitespace (phone keyboards append a space) and lowercases", () => {
    const r = loginSchema.safeParse({ email: "  Demo@BookFlow.app ", password: "x" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("demo@bookflow.app");
  });
});
