/**
 * Helpers for deciding whether an optional integration is *really* configured.
 *
 * `.env.example` ships placeholder values such as `https://...upstash.io`, `...`
 * and `your-google-client-id`. A placeholder is non-empty, so a plain truthiness
 * check treats it as "configured" and the integration then fails at runtime
 * (e.g. every call to Upstash throws, which used to turn sign-up into a 500).
 */
const PLACEHOLDER_PATTERN = /(\.\.\.|…|your-|<[^>]+>|changeme|change-me|example\.com|xxxx)/i;

export function isConfigured(value: string | undefined | null): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && !PLACEHOLDER_PATTERN.test(trimmed);
}

export function isGoogleAuthConfigured(): boolean {
  return (
    isConfigured(process.env["GOOGLE_CLIENT_ID"]) &&
    isConfigured(process.env["GOOGLE_CLIENT_SECRET"])
  );
}

export function isRedisConfigured(): boolean {
  return (
    isConfigured(process.env["UPSTASH_REDIS_REST_URL"]) &&
    isConfigured(process.env["UPSTASH_REDIS_REST_TOKEN"]) &&
    /^https?:\/\//.test(process.env["UPSTASH_REDIS_REST_URL"] ?? "")
  );
}
