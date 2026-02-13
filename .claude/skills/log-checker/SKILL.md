---
name: log-checker
description: Ingest latest Vercel logs, analyze errors, and create a fix PR
allowed-tools: Bash(curl*), Bash(git*), Bash(gh*), Bash(npm*), Bash(npx*), Read, Grep, Edit, Write
---

# Log Checker

Ingest recent Vercel runtime logs, check for errors in the centralized log store, and if errors are found, analyze root causes and create a fix PR.

## Prerequisites

The `LOG_API_SECRET` environment variable must be set (same value as in Vercel/GitHub secrets).

## Workflow

### Step 1: Trigger Log Ingest

Pull the latest Vercel runtime logs into blob storage:

```bash
curl -sf -H "Authorization: Bearer $LOG_API_SECRET" \
  "https://www.meantforgreatness.org/api/cron/ingest-vercel-logs"
```

If running locally, use `http://localhost:3000` instead.

### Step 2: Check for Errors

Fetch recent errors from the centralized log API:

```bash
curl -sf -H "Authorization: Bearer $LOG_API_SECRET" \
  "https://www.meantforgreatness.org/api/admin/logs?level=error&since=$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)&limit=50"
```

### Step 3: Analyze

- If **no errors** are found, report "All clear" and stop.
- If **errors are found**, analyze each one:
  1. Read the error messages, sources, and metadata
  2. Identify the relevant source files in the repo using `Grep` and `Read`
  3. Determine root causes (code bug vs. transient issue like network timeout)

### Step 4: Fix (only for code bugs)

If errors are caused by bugs in our code:

1. Create a fix branch: `git checkout -b fix/auto-$(date +%Y%m%d)-<short-description>`
2. Make the necessary code changes
3. Verify the fix: `npm run build && npx vitest run`
4. Commit, push, and create a PR:
   ```bash
   git add <files>
   git commit -m "fix: <description of what was broken and how it's fixed>"
   git push -u origin HEAD
   gh pr create --title "fix: <short title>" --body "<details of errors and fix>"
   ```

If errors are **transient** (network timeouts, rate limits, third-party outages), report the analysis but do NOT create a PR.

## Project Context

- **Neon DB:** Project `cold-night-96404029`, schema at `src/db/schema.ts`
- **Logger:** `src/lib/logger.ts` writes to Vercel Blob storage
- **Log sources:** `vercel:runtime`, `webhook:stripe`, `webhook:resend`, `stripe:checkout`, `contact`, `ai:photos`, `geocode`, `auth`
- **Build:** `npm run build`
- **Tests:** `npx vitest run`
- See `CLAUDE.md` at repo root for full project context
