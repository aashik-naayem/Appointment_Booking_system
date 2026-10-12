# Deployment Guide

## Option 1: Vercel + Managed Services (Recommended)

This is the simplest production setup.

### Services needed

- **Vercel** — hosting
- **Neon or Supabase** — PostgreSQL
- **Upstash** — Redis
- **Inngest** — background jobs
- **Resend** — email
- **Stripe** — payments
- **Sentry** — error monitoring

### Steps

1. **Database**: Create a PostgreSQL database on [Neon](https://neon.tech) or [Supabase](https://supabase.com).

2. **Redis**: Create a Redis database on [Upstash](https://upstash.com).

3. **Run migrations**:

   ```bash
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   DATABASE_URL="postgresql://..." npx prisma db seed
   ```

4. **Deploy to Vercel**:

   ```bash
   npm i -g vercel
   vercel --prod
   ```

5. **Set environment variables** in Vercel dashboard (all from `.env.example`).

6. **Configure Stripe webhook**:
   - In Stripe Dashboard → Webhooks → Add endpoint
   - URL: `https://yourapp.vercel.app/api/webhooks/stripe`
   - Events: `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`
   - Copy signing secret to `STRIPE_WEBHOOK_SECRET`

7. **Set up Inngest**:
   - Create app at [inngest.com](https://www.inngest.com)
   - Set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`
   - Register functions at `https://yourapp.vercel.app/api/webhooks/inngest`

---

## Option 2: Docker Self-Hosted

### Production docker-compose

```bash
cp .env.example .env.local
# Fill in all values

docker compose up -d
docker compose exec migrate sh -c "npx prisma migrate deploy"
```

### Nginx reverse proxy (recommended)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Environment Variables Checklist

Before going live, ensure all of these are set:

- [ ] `DATABASE_URL` — production database URL
- [ ] `NEXTAUTH_SECRET` — random 32+ char string (`openssl rand -base64 32`)
- [ ] `NEXTAUTH_URL` — your production domain
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
- [ ] `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` — live keys from Stripe
- [ ] `STRIPE_WEBHOOK_SECRET` — from Stripe webhook settings
- [ ] All `STRIPE_*_PRICE_ID` — your created Stripe price IDs
- [ ] `RESEND_API_KEY` — from Resend dashboard
- [ ] `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER`
- [ ] `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- [ ] `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`
- [ ] `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
- [ ] `ENCRYPTION_KEY` — random 32 char string (for OAuth token encryption)

---

## Stripe Setup

### Create products and prices

```bash
# Use Stripe CLI or Dashboard to create:
stripe products create --name="BookFlow Starter"
stripe prices create --product=prod_xxx --unit-amount=2900 --currency=usd --recurring[interval]=month

# Repeat for Pro ($79) and Business ($149), monthly and yearly
```

### Test webhooks locally

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## Database Backups

For self-hosted PostgreSQL, set up automated backups:

```bash
# Daily backup cron
0 2 * * * pg_dump -U bookflow bookflow | gzip > /backups/bookflow-$(date +%Y%m%d).sql.gz

# Keep last 30 days
find /backups -name "*.sql.gz" -mtime +30 -delete
```

For managed databases (Neon, Supabase), point-in-time recovery is built in.

---

## Monitoring

- **Error monitoring**: Sentry — configure `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`
- **Uptime**: Use UptimeRobot or Checkly to monitor `/api/health`
- **Database**: Enable slow query logging in PostgreSQL
- **Background jobs**: Monitor in the Inngest dashboard
