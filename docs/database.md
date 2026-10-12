# Database Design

## Overview

BookFlow uses PostgreSQL 16 with Prisma ORM. The schema is designed for multi-tenancy with strict isolation.

## Core Design Decisions

### Tenant Isolation

Every business entity has a `tenantId` foreign key. All queries include `WHERE tenantId = ?`. There are no cross-tenant joins.

### Soft Deletes

`Appointment`, `Service`, `Staff`, `Customer`, and `User` use soft deletes via `deletedAt`. Queries always filter `deletedAt: null`. This preserves historical data for analytics.

### Monetary Values

All prices, amounts, and commissions use `DECIMAL` type — never `FLOAT`. Prisma maps these to JavaScript `Decimal` objects to avoid floating-point errors.

### UTC Storage

All timestamps are stored in UTC. The `timezone` field on `Tenant` and `Appointment` is used for display-only formatting.

## Entity Relationships

```
Tenant
  ├── User (many) — employees/owners
  ├── Staff (many) — bookable team members
  │     └── StaffService (junction) → Service
  │     └── StaffWorkingHours
  │     └── CalendarConnection
  ├── Service (many)
  │     └── ServiceCategory
  ├── Customer (many)
  ├── Appointment (many)
  │     ├── → Service
  │     ├── → Staff
  │     ├── → Customer
  │     └── Payment (one)
  ├── BusinessHours (7 rows — one per day)
  ├── Holiday (many)
  ├── Subscription (one)
  ├── Notification (many)
  ├── NotificationPreference (many)
  ├── AuditLog (many)
  ├── ApiKey (many)
  └── FeatureFlag (many)
```

## Key Indexes

```sql
-- Availability engine queries
CREATE INDEX ON "Appointment"("tenantId", "startTime");
CREATE INDEX ON "Appointment"("tenantId", "staffId", "startTime");

-- Booking lookup
CREATE UNIQUE INDEX ON "Appointment"("bookingReference");

-- Customer lookup
CREATE UNIQUE INDEX ON "Customer"("tenantId", "email");

-- Auth
CREATE UNIQUE INDEX ON "User"("email");
```

## Appointment Status Flow

```
PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
                   ↘
                    CANCELLED
                    NO_SHOW
                    RESCHEDULED (creates new appointment)
```

## Migrations

Located in `packages/database/prisma/migrations/`.

```bash
# Create new migration
npx prisma migrate dev --name describe_change

# Deploy to production
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

## Useful Queries

```sql
-- Today's appointments for a tenant
SELECT a.*, c.name as customer_name, s.name as service_name
FROM "Appointment" a
JOIN "Customer" c ON c.id = a."customerId"
JOIN "Service" s ON s.id = a."serviceId"
WHERE a."tenantId" = 'tenant_id'
  AND a."startTime" >= CURRENT_DATE
  AND a."startTime" < CURRENT_DATE + INTERVAL '1 day'
  AND a.status NOT IN ('CANCELLED')
ORDER BY a."startTime";

-- Revenue by month
SELECT
  DATE_TRUNC('month', "startTime") AS month,
  SUM("totalAmount") AS revenue,
  COUNT(*) AS bookings
FROM "Appointment"
WHERE "tenantId" = 'tenant_id'
  AND status = 'COMPLETED'
GROUP BY 1
ORDER BY 1;

-- Top customers by spend
SELECT name, email, "totalSpent", "completedBookings"
FROM "Customer"
WHERE "tenantId" = 'tenant_id'
  AND "deletedAt" IS NULL
ORDER BY "totalSpent" DESC
LIMIT 10;
```
