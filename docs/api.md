# BookFlow API Reference

## Authentication

All authenticated endpoints require a valid session cookie (set by Auth.js after login).

Public endpoints (booking flow) do not require authentication but are rate-limited.

## Response Format

All responses follow a consistent structure:

```json
// Success
{ "data": { ... }, "meta": { "page": 1, "total": 100 } }

// Error
{ "error": "Human-readable message" }

// Validation error
{ "error": "Validation failed", "errors": { "field": ["message"] } }
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / business logic error |
| 401 | Unauthenticated |
| 403 | Forbidden (wrong role or tenant) |
| 404 | Not found |
| 409 | Conflict (e.g. email already exists) |
| 422 | Validation failed |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

## Public Endpoints

### GET /api/availability

Get available time slots for a date.

**Query parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `tenantId` | ✓ | Business tenant ID |
| `serviceId` | ✓ | Service CUID |
| `date` | ✓ | Date in `YYYY-MM-DD` format |
| `staffId` | — | Specific staff member CUID |
| `timezone` | — | IANA timezone (defaults to tenant timezone) |

**Response:**
```json
{
  "data": [
    {
      "startTime": "2026-09-15T14:00:00.000Z",
      "endTime": "2026-09-15T15:00:00.000Z",
      "displayStart": "2026-09-15T10:00:00-04:00",
      "displayEnd": "11:00",
      "available": true,
      "staffId": "clxxx",
      "staffName": "Sarah Johnson"
    }
  ]
}
```

### POST /api/appointments

Create a booking (public — rate limited to 10/hour per IP).

**Request body:**
```json
{
  "tenantId": "clxxx",
  "serviceId": "clxxx",
  "staffId": "clxxx",
  "startTime": "2026-09-15T14:00:00.000Z",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "+15551234567",
  "customerNotes": "First time visit",
  "timezone": "America/New_York"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "clxxx",
    "bookingReference": "ABCDEF12",
    "status": "CONFIRMED",
    "startTime": "2026-09-15T14:00:00.000Z"
  }
}
```

---

## Authenticated Endpoints

### Appointments

#### GET /api/appointments
List appointments for current tenant.

Query params: `page`, `pageSize`, `status`, `staffId`, `dateFrom`, `dateTo`, `search`

#### GET /api/appointments/:id
Get single appointment with full details, notifications, and payment.

#### PATCH /api/appointments/:id
Update appointment. Set `action` field to control behavior:

```json
{ "action": "cancel", "reason": "Customer request" }
{ "action": "reschedule", "startTime": "...", "staffId": "..." }
{ "action": "complete" }
{ "action": "no-show" }
{ "action": null, "status": "CONFIRMED", "internalNotes": "..." }
```

### Services

#### GET /api/services — List all services
#### POST /api/services — Create service
#### GET /api/services/:id — Get service
#### PATCH /api/services/:id — Update service
#### DELETE /api/services/:id — Soft-delete service

**Create service body:**
```json
{
  "name": "Haircut",
  "description": "...",
  "duration": 60,
  "bufferTime": 10,
  "price": 85.00,
  "depositAmount": null,
  "categoryId": "clxxx",
  "isActive": true,
  "requiresStaff": true,
  "staffIds": ["clxxx", "clyyy"]
}
```

### Staff

#### GET /api/staff — List staff
#### POST /api/staff — Add staff member
#### GET /api/staff/:id — Get staff with details
#### PATCH /api/staff/:id — Update staff
#### DELETE /api/staff/:id — Remove staff

#### GET /api/staff/:id/working-hours — Get working hours
#### PUT /api/staff/:id/working-hours — Set working hours

```json
{
  "workingHours": [
    { "dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "18:00", "isWorking": true },
    { "dayOfWeek": "SUNDAY", "startTime": "09:00", "endTime": "17:00", "isWorking": false }
  ]
}
```

### Customers

#### GET /api/customers — List customers (paginated)
Query: `search`, `status`, `page`, `pageSize`

#### GET /api/customers/:id — Customer profile + appointment history
#### PATCH /api/customers/:id — Update customer (status, notes)

### Analytics

#### GET /api/analytics
Query: `period` — `7d`, `30d`, `90d`, `12m`

Returns: overview stats, top services, top staff, bookings over time, revenue over time, peak hours.

### Business Settings

#### GET /api/tenants — Get current tenant
#### PATCH /api/tenants — Update tenant settings

#### GET /api/tenants/business-hours — Get business hours
#### PUT /api/tenants/business-hours — Set business hours

#### GET /api/tenants/holidays — List holidays
#### POST /api/tenants/holidays — Add holiday
#### DELETE /api/tenants/holidays?id= — Remove holiday

### Billing

#### POST /api/billing/checkout
Start Stripe Checkout session.
```json
{ "plan": "PRO", "interval": "monthly" }
```
Returns: `{ "data": { "url": "https://checkout.stripe.com/..." } }`

#### POST /api/billing/portal
Open Stripe Customer Portal.
Returns: `{ "data": { "url": "https://billing.stripe.com/..." } }`

### Webhooks

#### POST /api/webhooks/stripe
Stripe webhook receiver. Verifies signature, queues processing via Inngest.

#### POST /api/webhooks/inngest
Inngest background job handler.
