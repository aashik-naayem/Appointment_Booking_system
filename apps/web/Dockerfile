# ============================================================
# BookFlow Web — Multi-stage Dockerfile
# Build from the repository root:
#   docker build -f apps/web/Dockerfile -t bookflow-web .
# ============================================================

FROM node:20-alpine AS base
# openssl + libc6-compat are required by the Prisma query engine on Alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ============================================================
# Install dependencies (cached until a package.json/lockfile changes)
# ============================================================
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
# --ignore-scripts: Prisma's postinstall is run explicitly below via `prisma generate`
RUN npm ci --ignore-scripts

# ============================================================
# Build the application
# ============================================================
FROM base AS builder
WORKDIR /app
# Whole workspace incl. any nested node_modules (apps/web/node_modules may or may not exist)
COPY --from=deps /app ./
# .dockerignore keeps host node_modules/.next out so this does not clobber the above
COPY . .

# Generate Prisma client (output: packages/database/src/generated/client)
RUN npx prisma generate --schema=./packages/database/prisma/schema.prisma

ENV NEXT_TELEMETRY_DISABLED=1
# Build-time placeholders only; real values are provided at runtime
ENV SKIP_ENV_VALIDATION=true
WORKDIR /app/apps/web
RUN npm run build

# ============================================================
# Production runner
# ============================================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone output mirrors the monorepo layout because of outputFileTracingRoot
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
