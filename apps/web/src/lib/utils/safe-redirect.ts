/**
 * Only allow same-site, path-only callback URLs after login.
 * Blocks open redirects such as `?callbackUrl=https://evil.com` or `//evil.com`,
 * and avoids bouncing a freshly signed-in user back to an /auth page.
 */
export function safeCallbackUrl(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(raw)) return fallback;
  if (raw === "/auth" || raw.startsWith("/auth/")) return fallback;
  return raw;
}
