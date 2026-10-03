# BookFlow Architecture

## Overview

BookFlow is a multi-tenant SaaS application built on a monorepo structure. Every architectural decision prioritizes **tenant isolation**, **security**, and **maintainability**.

## Monorepo Structure

```
bookflow/ (Turborepo)
├── apps/web          → Next.js 15 App Router application
├── packages/database → Prisma schema, client, migrations, seed
├── packages/ui       → Shared UI components (optional)
├── packages/config   → Shared configuration (ESLint, TS)
└── docs/             → Documentation
```

## Multi-Tenancy Model

BookFlow uses a **shared database, isolated by tenantId** model (sometimes called "schema-per-tenant lite").

Every tenant-owned entity in the Prisma schema has:
- A required `tenantId` field
- A foreign key to `Tenant`
- Database indexes on `tenantId`

The application enforces isolation at **three layers**:

1. **Session layer** — `requireTenant()` extracts `tenantId` from the verified JWT. The frontend never supplies `tenantId`.
2. **Service layer** — All Prisma queries include `tenantId: ctx.tenant.id` from the session.
3. **Resource ownership** — `requireOwnedResource()` verifies any loaded resource's `tenantId` matches the session before returning it.

```
HTTP Request
    ↓
middleware.ts     → auth check, role check
    ↓
Route Handler     → requireTenant() / requireRole()
    ↓
Service Layer     → all queries scoped with tenantId
    ↓
Database          → row-level tenant isolation
```

## Request Lifecycle

```
Client → Next.js Middleware (auth guard)
       → Route Handler (requireTenant resolves tenant from session)
       → Service Layer (business logic, tenantId-scoped queries)
       → Prisma (generates SQL with WHERE tenantId = ?)
       → PostgreSQL
```

## Authentication

Auth.js v5 (next-auth) manages authentication with two strategies:
- **Credentials** (email + password) — bcrypt hashed, brute-force protection
- **Google OAuth** — account linking supported

Sessions use **JWT strategy** with server-side refresh every 5 minutes to ensure revoked sessions expire quickly.

`tenantId` and `role` are stored in the JWT and refreshed from the database periodically.

## Availability Engine

The availability engine is the most critical component. It:

1. Loads business hours for the requested day
2. Checks holidays
3. Gets all active staff who can perform the service
4. For each staff member, loads their working hours (custom or business default)
5. Generates time slot candidates at service-duration intervals
6. Queries existing appointments for the day
7. Removes conflicting slots
8. Returns only available slots

**Race condition prevention**: When creating an appointment, a second availability check runs inside a database transaction with `SELECT ... FOR UPDATE` semantics — if the slot was just taken, the transaction rolls back.

```typescript
// Simplified inner transaction check
const conflictCount = await tx.appointment.count({
  where: {
    tenantId, staffId,
    startTime: { lt: endTime },  // overlap condition
    endTime: { gt: startTime },
    status: { notIn: ["CANCELLED"] },
  },
});
if (conflictCount >= service.maxConcurrent) throw new Error("Slot taken");
```

## Background Jobs (Inngest)

Long-running or deferred work is handled by Inngest:

| Event | Handler | Description |
|-------|---------|-------------|
| `booking/created` | `onBookingCreated` | Send confirmations, schedule reminders, sync calendar |
| `booking/cancelled` | `onBookingCancelled` | Cancel pending notifications, sync calendar |
| `booking/rescheduled` | `onBookingRescheduled` | Cancel old reminders, create new ones |
| `stripe/webhook` | `onStripeWebhook` | Sync subscription state (idempotent) |
| Cron `* * * * *` | `sendPendingReminders` | Process due notification queue |
| Cron `0 0 * * *` | `generateDailyAnalytics` | Reset monthly counters |

All jobs are **idempotent** — running them twice has no unintended effect.

## Stripe Integration

Subscription state is **never trusted from the frontend**. The only authoritative source is Stripe webhooks.

```
Stripe Event → /api/webhooks/stripe
            → Verify signature (HMAC)
            → Queue via Inngest (ensures retry)
            → processStripeWebhook()
            → Upsert subscription record in DB
```

Webhook processing is idempotent: each `eventId` is recorded in `AuditLog` after processing. If the same event arrives twice, it's skipped.

## Notification Pipeline

```
Booking Created
    ↓
createBookingConfirmationNotifications() → Notification records in DB
scheduleBookingReminders() → Future-dated Notification records
    ↓
Cron (every minute) → Find due notifications → sendNotification()
    ↓
Email (Resend) | SMS (Twilio) | WhatsApp (Twilio)
    ↓
Update Notification.status → SENT / FAILED (with retry count)
```

## Database Design Principles

- **Soft deletes** (`deletedAt`) on Customer, Service, Staff, Appointment
- **Decimal types** for all monetary values (never float)
- **Compound indexes** on `(tenantId, startTime)` for availability queries
- **Booking reference** is a CUID — safe to expose publicly, unguessable
- **Audit log** captures all create/update/delete/login events with IP, userId, and severity

## API Architecture

Route handlers are thin — they only:
1. Authenticate and authorize
2. Validate input (Zod)
3. Call a service function
4. Return a standard response

Business logic lives in `lib/services/`. Database access is always tenant-scoped. This separation makes the codebase easy to test and extend.
