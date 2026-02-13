---
name: log-checker
description: Debug production issues — ingest fresh logs, check all error/warning sources, analyze root causes, and suggest or create a fix
allowed-tools: Bash(curl*), Bash(git*), Bash(gh*), Bash(npm*), Bash(npx*), Read, Grep, Glob, Edit, Write
---

# Production Debug Workflow

This is the **first thing to do** when debugging any production issue. It ingests fresh Vercel runtime logs, then checks the centralized log store (Vercel Blob) across ALL error and warning sources to build a complete picture of what's happening.

## Prerequisites

The `LOG_API_SECRET` environment variable must be set (same value as in Vercel/GitHub secrets).

Base URL: `https://www.meantforgreatness.org` (or `http://localhost:3000` for local dev).

## Workflow

### Step 1: Ingest Fresh Vercel Logs

Pull the latest Vercel runtime logs into blob storage so we have the most recent data:

```bash
curl -sf -H "Authorization: Bearer $LOG_API_SECRET" \
  "https://www.meantforgreatness.org/api/cron/ingest-vercel-logs"
```

This classifies Vercel logs as error/warn/info and writes them to centralized blob storage. Check the response for `ingested` count and `counts` breakdown.

### Step 2: Check for Errors (last 6 hours)

```bash
curl -sf -H "Authorization: Bearer $LOG_API_SECRET" \
  "https://www.meantforgreatness.org/api/admin/logs?level=error&since=$(date -u -v-6H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '6 hours ago' +%Y-%m-%dT%H:%M:%SZ)&limit=50" | python3 -m json.tool
```

### Step 3: Check for Warnings (last 6 hours)

Warnings include slow DB queries, slow API responses, and auth rejections — critical for debugging performance issues:

```bash
curl -sf -H "Authorization: Bearer $LOG_API_SECRET" \
  "https://www.meantforgreatness.org/api/admin/logs?level=warn&since=$(date -u -v-6H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '6 hours ago' +%Y-%m-%dT%H:%M:%SZ)&limit=50" | python3 -m json.tool
```

### Step 4: Check Specific Source (optional)

If investigating a specific area, filter by source:

```bash
curl -sf -H "Authorization: Bearer $LOG_API_SECRET" \
  "https://www.meantforgreatness.org/api/admin/logs?source=frontend:error&limit=20" | python3 -m json.tool
```

### Step 5: Summarize Findings

- **Group errors by source** — identify which system is failing (frontend, API, DB, Stripe, etc.)
- **Identify patterns** — are these recurring (same error repeated) or one-off?
- **Categorize** — code bug vs transient issue (network timeout, rate limit, browser extension)
- **Check timing** — did errors start after a specific deployment?

If **no errors or warnings** are found, report "All clear" and stop.

### Step 6: Analyze Root Cause

For each error group:

1. Read the error messages, sources, and metadata carefully
2. Use `Grep` and `Read` to find the relevant source files in the repo
3. Trace the code path that produced the error
4. Determine if it's a code bug or a transient/external issue

### Step 7: Fix (only for code bugs)

If errors are caused by bugs in our code:

1. Create a fix branch: `git checkout -b fix/auto-$(date +%Y%m%d)-<short-description>`
2. Make **minimal, surgical** code changes — do NOT remove features or make unrelated changes
3. Verify: `npm run build && npx vitest run`
4. Commit, push, and create a PR:
   ```bash
   git add <files>
   git commit -m "fix: <description>"
   git push -u origin HEAD
   gh pr create --title "fix: <short title>" --body "<details>"
   ```

If errors are **transient** (network timeouts, rate limits, third-party outages, browser extensions), report the analysis but do NOT create a PR.

**Special cases:**
- React hydration errors (#418, #423) — usually caused by browser extensions or dynamic content in server components. Use `suppressHydrationWarning` where appropriate, do NOT convert server components to client components.
- Stripe webhook errors — check if the webhook URL includes `www.` (required to avoid 307 redirects).

## Log Source Reference

### Frontend (Layer 1) — client-side errors sent via `/api/log-client`
| Source | Level | What |
|--------|-------|------|
| `frontend:error` | error | window.onerror, unhandledrejection |
| `frontend:error-boundary` | error | React error boundaries (admin + root) |
| `frontend:pageview` | info | Page navigations |
| `frontend:event` | info | User interactions (donate click, etc.) |

### Middleware (Layer 2) — request-level logging
| Source | Level | What |
|--------|-------|------|
| `request:auth-rejected` | warn | Admin route auth failures (401/redirect) |
| `request:slow` | warn | Middleware took >2s |

### API Routes (Layer 3) — wrapped with `withLogging` HOF
| Source | Level | What |
|--------|-------|------|
| `api:checkout` | warn/error | Stripe checkout slow (>2s) or error |
| `api:webhook:stripe` | warn/error | Stripe webhook slow or error |
| `api:contact` | warn/error | Contact form slow or error |
| `api:class-logs` | warn/error | Class log CRUD slow or error |
| `api:class-logs:analyze` | warn/error | AI photo analysis slow or error |

### Database (Layer 5) — Neon query timing via Proxy
| Source | Level | What |
|--------|-------|------|
| `db:slow-query` | warn | Query took >200ms (includes query preview) |
| `db:error` | error | Query failed |

### Application — direct logger calls
| Source | Level | What |
|--------|-------|------|
| `stripe:checkout` | info/error | Stripe session creation |
| `webhook:stripe` | info/warn/error | Stripe webhook events (payments, refunds, disputes, subscriptions) |
| `webhook:resend` | info/error | Resend email delivery events |
| `contact` | error | Contact form / Resend email errors |
| `ai:photos` | error | Anthropic AI photo analysis failures |
| `geocode` | warn/error | Google geocoding issues |
| `auth` | info | NextAuth sign-in/sign-out events |
| `admin:*` | info/error | Admin operations (invite, class-logs, orphanages) |
| `vercel:runtime` | error/warn/info | Ingested Vercel function logs |
| `monitor` | info/warn | GitHub Actions monitor run results |

## Project Context

- **Stack:** Next.js 16 + React 19 + Drizzle ORM + Neon Postgres + Stripe + Vercel
- **Neon DB:** Project `cold-night-96404029`, schema at `src/db/schema.ts`
- **Logger:** `src/lib/logger.ts` → writes to Vercel Blob storage (path: `logs/{date}/{level}/{source}/{ts}.json`)
- **Log listing:** `src/lib/blob-logs.ts` — reads/filters/paginates from Vercel Blob
- **API routes with timing:** `src/lib/with-logging.ts` — HOF wrapper
- **DB timing:** `src/db/index.ts` — neon() Proxy wrapper
- **Frontend error capture:** `src/components/ErrorReporter.tsx` + `src/app/api/log-client/route.ts`
- **Page views:** `src/components/PageViewTracker.tsx`
- **Build:** `npm run build`
- **Tests:** `npx vitest run`
- See `CLAUDE.md` at repo root for full project context
