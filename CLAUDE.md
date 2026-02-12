# Meant for Greatness — Claude Code Project Memory

## Project Overview
Charity website for English education at Bali orphanages. Next.js 16 + React 19 + Neon Postgres + Stripe + Vercel.

## Debugging Workflow — ALWAYS DO THIS FIRST

When debugging ANY error or issue:

1. **Check centralized logs first:**
   ```bash
   curl -s -H "Authorization: Bearer $LOG_API_SECRET" \
     "https://www.meantforgreatness.org/api/admin/logs?level=error&limit=20" | python3 -m json.tool
   ```
   Or query the Neon DB directly:
   ```sql
   SELECT * FROM app_logs WHERE level = 'error' ORDER BY created_at DESC LIMIT 20;
   ```
   Neon project ID: `cold-night-96404029`

2. **Check Vercel logs** if needed (the `vercel:logs` skill or `npx vercel logs`).

3. **Check Stripe dashboard** for payment-specific issues.

The centralized logs capture: Stripe checkout/webhooks, contact form/email (Resend), AI photo analysis (Anthropic), geocoding, admin operations, and all server-side errors.

## Key Architecture

- **DB:** Neon Postgres (`cold-night-96404029`), schema at `src/db/schema.ts`
- **ORM:** Drizzle ORM, config at `drizzle.config.ts`
- **Auth:** NextAuth v5 with Google OAuth, JWT sessions
- **Payments:** Stripe checkout + webhooks at `/api/webhooks/stripe`
- **Logger:** `src/lib/logger.ts` — writes to `app_logs` table + console
- **Permissions:** Role-based (admin, teacher, teacher_manager, donor_manager) at `src/lib/permissions.ts`
- **Monitor:** GitHub Actions runs every 6h, checks Vercel + centralized logs, auto-fixes with Claude

## Common Commands

```bash
npm run build          # Build
npx vitest run         # Tests
npx drizzle-kit generate && npx drizzle-kit migrate  # DB migrations
npx vercel --prod      # Deploy to production
```

## Environment Variables

Critical env vars (all in Vercel):
- `DATABASE_URL` — Neon Postgres connection string
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe
- `NEXT_PUBLIC_BASE_URL` — Must be `https://www.meantforgreatness.org` (no trailing newline!)
- `LOG_API_SECRET` — Bearer token for logs API (also in GitHub secrets)
- `CRON_SECRET` — Vercel cron auth

## Lessons Learned

- Always use `printf` not `echo` when piping values to CLI tools (avoids trailing `\n`)
- Stripe webhook URL must include `www.` to avoid 307 redirects
- The `ui_mode: "hosted"` parameter is unnecessary and can cause issues — Stripe defaults to hosted mode
