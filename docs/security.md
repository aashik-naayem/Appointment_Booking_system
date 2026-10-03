# BookFlow Security Guide

## Multi-Tenant Isolation

The most important security property of BookFlow is that **Tenant A can never access Tenant B's data**.

### How it's enforced

1. **Session-derived tenantId** — `requireTenant()` reads `tenantId` from the verified JWT. The tenant cannot be specified by the frontend.

2. **Every query is scoped** — No database query runs without `WHERE tenantId = ?`.

3. **Resource ownership verification** — `requireOwnedResource(resource, tenantId)` throws `NotFoundError` if the resource doesn't belong to the tenant. Crucially, it returns the **same error** whether the resource doesn't exist or belongs to another tenant — preventing tenant enumeration.

4. **No tenant ID in URL params** — API routes never use URL parameters like `/api/tenants/[tenantId]/appointments`. The tenant is always from the session.

### Testing isolation

```typescript
// Security test from src/__tests__/security/tenant-isolation.test.ts
it("throws NotFoundError for wrong tenant (IDOR prevention)", async () => {
  const resource = { id: "res-1", tenantId: "tenant-B" };
  await expect(requireOwnedResource(resource, "tenant-A")).rejects.toThrow("Not found");
});

it("hides existence from wrong tenant (same error for null vs wrong tenant)", async () => {
  // Both return identical errors — prevents content-based tenant enumeration
  expect(errorForWrongTenant).toBe(errorForNull);
});
```

## Authentication

- **Password hashing**: bcrypt with cost factor 12
- **Brute-force protection**: accounts lock for 15 minutes after 5 failed login attempts
- **JWT rotation**: tokens refresh from DB every 5 minutes
- **Deleted user detection**: soft-deleted users cannot authenticate
- **OAuth account linking**: existing accounts linked by email (with `allowDangerousEmailAccountLinking: true` for Google)

## Session Security

- Sessions use **JWT strategy** (no database session table — better scalability)
- JWT contains minimal claims: `id`, `role`, `tenantId`
- `NEXTAUTH_SECRET` must be 32+ characters, randomly generated
- Secure and HttpOnly cookies in production

## Input Validation

All API inputs are validated with Zod before any business logic runs:

```typescript
const input = createBookingSchema.parse(body); // throws if invalid
```

- String lengths enforced
- Email formats validated and normalized to lowercase
- IDs validated as CUIDs (unguessable, not sequential)
- Numeric bounds enforced (e.g., duration 5–480 minutes)

## Rate Limiting

Two rate limiting strategies:

| Endpoint | Limit | Window |
|---------|-------|--------|
| Booking creation | 10 requests | 1 hour per IP |
| Authentication | 5 requests | 15 minutes per IP |
| Public API | 1000 requests | 1 hour per API key |

Redis (Upstash) with sliding window algorithm. Falls back to in-memory in development.

## Stripe Webhook Security

```typescript
// Verify signature before processing
const event = stripe.webhooks.constructEvent(
  rawBody,        // must be raw Buffer, not parsed JSON
  signature,      // from Stripe-Signature header
  webhookSecret,  // STRIPE_WEBHOOK_SECRET env var
);
```

Idempotency prevents replay attacks — each `eventId` is recorded after processing.

## OAuth Token Storage

Google Calendar OAuth tokens are encrypted at rest using AES-256-GCM:

```typescript
accessToken: encrypt(tokens.access_token)  // iv:authTag:ciphertext
```

Tokens are **never** returned to the client — only the connection status is exposed.

## HTTP Security Headers

Set via `next.config.ts`:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-XSS-Protection: 1; mode=block
```

## Environment Variable Security

- `.env.local` is gitignored
- Secrets accessed via `process.env["VAR_NAME"]` (bracket notation for strict TypeScript)
- `.env.example` documents all variables without real values
- Never log secrets

## Audit Logging

Critical operations are logged to the `AuditLog` table:

- User login/logout
- Stripe webhook processing
- Resource creation/deletion
- API key usage

Logs include: `userId`, `tenantId`, `action`, `resource`, `ipAddress`, `severity`.

## Dependency Security

- GitHub Actions runs `npm audit --audit-level=high` on every push
- GitLeaks scans for accidentally committed secrets
- Exact or pinned versions preferred over open ranges

## Reporting Vulnerabilities

Please report security vulnerabilities to security@bookflow.app. Do not open public issues for security bugs.
