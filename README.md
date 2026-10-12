# BookFlow

**The modern booking platform for service businesses.**

[![CI](https://github.com/yourusername/bookflow/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/bookflow/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)

BookFlow is a production-quality, multi-tenant SaaS booking platform built with Next.js 15, Prisma, PostgreSQL, and Stripe. Designed for barbers, salons, clinics, photographers, consultants, and other service professionals.

> **Portfolio project** demonstrating full-stack engineering, SaaS architecture, multi-tenancy, payments, integrations, testing, and DevOps.

---

## Screenshots

> _Add screenshots here — dashboard, booking page, calendar, analytics_

| Dashboard                                    | Booking Page                             | Analytics                                    |
| -------------------------------------------- | ---------------------------------------- | -------------------------------------------- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Booking](docs/screenshots/booking.png) | ![Analytics](docs/screenshots/analytics.png) |

---

## Features

### For Service Businesses

- **Public booking page** with custom branding and real-time availability
- **Dashboard** with today's schedule, revenue, and KPIs
- **Calendar** — day/week/month views with drag-and-drop rescheduling
- **Customer CRM** — history, notes, total spend, VIP/blacklist management
- **Staff management** — individual calendars, commission tracking, working hours
- **Service management** — pricing, duration, buffer times, categories
- **Automated reminders** — email, SMS, and WhatsApp
- **Google Calendar sync** for staff
- **Online payments** via Stripe (deposits or full)
- **Analytics** — revenue, bookings, peak hours, staff performance

### SaaS Platform

- **Multi-tenant architecture** — complete data isolation between businesses
- **Three subscription tiers** — Starter, Pro, Business
- **Stripe billing** — checkout, customer portal, upgrade/downgrade
- **Super admin panel** — tenant management, platform analytics
- **Feature flags** per plan

---

## Tech Stack

| Layer            | Technology                              |
| ---------------- | --------------------------------------- |
| Framework        | Next.js 15 (App Router) + TypeScript    |
| Styling          | Tailwind CSS + shadcn/ui                |
| Data Fetching    | TanStack Query v5                       |
| Database         | PostgreSQL + Prisma ORM                 |
| Authentication   | Auth.js v5 (Credentials + Google OAuth) |
| Validation       | Zod                                     |
| Payments         | Stripe                                  |
| Email            | Resend                                  |
| SMS/WhatsApp     | Twilio                                  |
| Calendar         | Google Calendar API                     |
| Caching          | Upstash Redis                           |
| Rate Limiting    | Upstash Ratelimit                       |
| Background Jobs  | Inngest                                 |
| Error Monitoring | Sentry                                  |
| Unit Tests       | Vitest + Testing Library                |
| E2E Tests        | Playwright                              |
| Containerization | Docker + Docker Compose                 |
| CI/CD            | GitHub Actions                          |

---

## Architecture

```
bookflow/
├── apps/
│   └── web/                    # Next.js 15 application
│       ├── src/
│       │   ├── app/            # App Router pages & API routes
│       │   │   ├── (auth)/     # Login, register, forgot-password
│       │   │   ├── (dashboard)/# Protected dashboard routes
│       │   │   ├── admin/      # Super admin panel
│       │   │   ├── api/        # API route handlers
│       │   │   ├── book/[slug] # Public booking pages
│       │   │   └── onboarding/ # New user onboarding flow
│       │   ├── components/     # React components
│       │   ├── lib/
│       │   │   ├── auth/       # Auth.js configuration
│       │   │   ├── db/         # Redis client
│       │   │   ├── integrations/  # Stripe, Google Calendar
│       │   │   ├── jobs/       # Inngest background functions
│       │   │   ├── permissions/   # Auth guards, RBAC, tenant isolation
│       │   │   ├── services/   # Business logic layer
│       │   │   ├── utils/      # API helpers, crypto, rate limiting
│       │   │   └── validations/   # Zod schemas
│       │   └── __tests__/     # Unit, integration, security tests
│       ├── e2e/                # Playwright E2E tests
│       └── Dockerfile
├── packages/
│   └── database/               # Prisma schema + migrations
│       └── prisma/
│           ├── schema.prisma   # Full data model
│           ├── migrations/     # Migration history
│           └── seed.ts         # Demo data
├── docs/                       # Documentation
├── .github/workflows/          # CI/CD
├── docker-compose.yml          # Production stack
├── docker-compose.dev.yml      # Development databases only
└── .env.example                # Environment variable template
```

See [docs/architecture.md](docs/architecture.md) for a detailed architecture walkthrough.

---

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 16 (or use Docker)

### 1. Clone and install

```bash
git clone https://github.com/yourusername/bookflow.git
cd bookflow
npm install
npm run db:generate
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your actual values (one file, in the project root)
```

### 3. Start development databases

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 4. Run database migrations and seed

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed demo data
npm run db:seed
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Docker Setup (Full Stack)

Run the entire application with one command:

```bash
# Copy and configure environment
cp .env.example .env.local

# Start all services (app + postgres + redis)
docker compose up -d

# View logs
docker compose logs -f web

# Stop
docker compose down
```

The application will be available at http://localhost:3000.

---

## Environment Variables

See [`.env.example`](.env.example) for all required variables with descriptions.

Required for full functionality:

| Variable                | Description                        |
| ----------------------- | ---------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string       |
| `NEXTAUTH_SECRET`       | 32+ character secret for sessions  |
| `STRIPE_SECRET_KEY`     | Stripe API key                     |
| `STRIPE_WEBHOOK_SECRET` | For webhook signature verification |
| `RESEND_API_KEY`        | For transactional email            |
| `ENCRYPTION_KEY`        | For encrypting OAuth tokens        |

---

## Database

### Migrations

```bash
# Create a new migration
npm run db:migrate

# Deploy to production
npx prisma migrate deploy

# Open Prisma Studio
npm run db:studio
```

### Seed Data

```bash
npm run db:seed
```

**Demo credentials after seeding:**

| Role             | Email                    | Password   |
| ---------------- | ------------------------ | ---------- |
| Owner (PRO plan) | `demo@bookflow.app`      | `Demo1234` |
| Admin            | `admin@helixsalon.com`   | `Demo1234` |
| Skin Spa Owner   | `owner@clearskinspa.com` | `Demo1234` |

**Public booking pages:**

- `/book/helix-hair-studio`
- `/book/clearskin-spa`

---

## Testing

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:coverage

# E2E tests (requires running server)
npm run test:e2e

# Watch mode
npm run test:watch
```

### Test Coverage

- **Unit:** Availability engine, role permissions, encryption, Zod schemas, subscription limits
- **Integration:** Stripe webhook processing, tenant isolation
- **Security:** Cross-tenant IDOR prevention, role hierarchy
- **E2E:** Full booking flow (register → book → dashboard → cancel)

---

## Subscription Plans

| Feature            | Starter ($29/mo) | Pro ($79/mo) | Business ($149/mo) |
| ------------------ | :--------------: | :----------: | :----------------: |
| Staff members      |        1         |  Unlimited   |     Unlimited      |
| Bookings/month     |        50        |  Unlimited   |     Unlimited      |
| Email reminders    |        ✓         |      ✓       |         ✓          |
| SMS/WhatsApp       |        —         |      ✓       |         ✓          |
| Advanced analytics |        —         |      ✓       |         ✓          |
| Custom branding    |        —         |      ✓       |         ✓          |
| Google Calendar    |        ✓         |      ✓       |         ✓          |
| Public API         |        —         |      —       |         ✓          |
| White-label        |        —         |      —       |         ✓          |

All plans include a **14-day free trial**.

---

## API Documentation

See [docs/api.md](docs/api.md) for full API reference.

Key endpoints:

```
GET  /api/availability        Public slot availability
POST /api/appointments        Create booking (public)
GET  /api/appointments        List appointments (authenticated)
PATCH /api/appointments/:id   Update/cancel/reschedule
GET  /api/services            List services
POST /api/services            Create service
GET  /api/staff               List staff
POST /api/staff               Add staff member
GET  /api/customers           Customer CRM
GET  /api/analytics           Business analytics
POST /api/billing/checkout    Start Stripe checkout
POST /api/billing/portal      Stripe customer portal
POST /api/webhooks/stripe     Stripe webhooks
POST /api/webhooks/inngest    Background job processing
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import into Vercel
3. Set environment variables
4. Deploy

### Self-hosted

```bash
# Build
npm run build

# Start
npm run start
```

See [docs/deployment.md](docs/deployment.md) for full deployment guide.

---

## Security

- **Tenant isolation** enforced at every database query layer
- **JWT sessions** with server-side refresh
- **Bcrypt** password hashing (cost factor 12)
- **Zod** validation on all inputs
- **Rate limiting** on auth and booking endpoints
- **Stripe webhook signature** verification
- **Encrypted OAuth tokens** at rest (AES-256-GCM)
- **Secure headers** (X-Frame-Options, CSP, etc.)
- **Audit logging** for critical operations
- **Role-based access control** (SUPER_ADMIN > OWNER > ADMIN > STAFF)

See [docs/security.md](docs/security.md) for the full security guide.

---

## Roadmap

- [ ] Real-time updates via Server-Sent Events
- [ ] PWA support
- [ ] i18n (internationalization)
- [ ] CSV/iCal export
- [ ] Custom domain support
- [ ] AI-powered slot suggestions
- [ ] No-show prediction
- [ ] Outlook Calendar integration
- [ ] Recurring appointments
- [ ] Package/membership bookings

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](LICENSE).
