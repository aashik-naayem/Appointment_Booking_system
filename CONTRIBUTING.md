# Contributing to BookFlow

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/bookflow.git`
3. Install dependencies: `npm install`
4. Start dev databases: `docker compose -f docker-compose.dev.yml up -d`
5. Copy env: `cp .env.example .env.local` and fill in values
6. Run migrations: `npm run db:migrate`
7. Seed data: `npm run db:seed`
8. Start dev server: `npm run dev`

## Code Standards

### TypeScript
- Strict mode enabled — no `any` without justification
- All functions must have typed parameters and return types
- Use `const` and arrow functions for utilities

### Security
- **Never** put `tenantId` in URL params — always from session
- **Always** call `requireTenant()` or `requireAuth()` in route handlers
- **Always** use Zod to validate external input before using it

### Architecture
- Business logic goes in `lib/services/`, not in route handlers
- Route handlers should be under ~50 lines
- Use `handleApiError()` for consistent error responses
- Jobs must be idempotent

## Testing

- Write tests for new business logic (availability, pricing, permissions)
- Security tests are mandatory for any auth/isolation changes
- Run `npm run test` before submitting a PR

## PR Process

1. Create a branch: `git checkout -b feature/your-feature`
2. Make changes
3. Run: `npm run lint && npm run typecheck && npm run test`
4. Commit with conventional commits: `feat: add X`, `fix: Y`, `docs: Z`
5. Push and open a PR against `develop`

## Commit Format

```
feat: add Google Calendar disconnect endpoint
fix: prevent double-booking in high concurrency
docs: update API reference for /api/availability
test: add security tests for tenant isolation
chore: upgrade Prisma to 5.22
```
