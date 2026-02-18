# Meant for Greatness — Claude Code Project Memory

## Project Overview
Charity website for English education at Bali orphanages. Next.js 16 + React 19 + Neon Postgres + Stripe + Vercel.

## Debugging Workflow — ALWAYS DO THIS FIRST

When debugging ANY error or issue:

1. **Check centralized logs first** (stored in Vercel Blob, queried via API):
   ```bash
   curl -s -H "Authorization: Bearer $LOG_API_SECRET" \
     "https://www.meantforgreatness.org/api/admin/logs?level=error&limit=20" | python3 -m json.tool
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
- **Logger:** `src/lib/logger.ts` — writes to Vercel Blob storage + console
- **Permissions:** Role-based (admin, teacher_manager, donor_manager) at `src/lib/permissions.ts`
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

## Design System

- **Brand colors** (defined in `globals.css` via `@theme inline`):
  - **green** (primary): `#0A400C` at 700, range 50–900 — headings, CTAs, links
  - **sage** (secondary): `#819067` at 500, range 50–900 — buttons, accents
  - **sand** (neutral): `#F5F5F0` at 50 (cool gray bg), `#A8A598` at 400, range 50–900 — text, borders, backgrounds
- **Logo**: SVG at `public/logo.svg` (dark green text) and `public/logo-white.svg` (cream text for dark backgrounds)
- **Layout**: Public pages use `(public)` route group with Header + Footer; admin pages at `/admin` have their own `AdminShell` layout (no site Header/Footer)

## Lessons Learned

- Always use `printf` not `echo` when piping values to CLI tools (avoids trailing `\n`)
- Stripe webhook URL must include `www.` to avoid 307 redirects
- The `ui_mode: "hosted"` parameter is unnecessary and can cause issues — Stripe defaults to hosted mode
