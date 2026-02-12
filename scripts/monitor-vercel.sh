#!/bin/bash
# ──────────────────────────────────────────────────────────────
# Vercel Error Monitor
# Polls Vercel runtime logs for errors, then hands them to
# Claude Code to analyze and create a fix PR automatically.
#
# Safety: Uses --allowedTools to restrict Claude to only the
# specific operations needed. No dangerous skip-permissions.
# ──────────────────────────────────────────────────────────────

set -euo pipefail

PROJECT_DIR="/Users/tarushaggarwal/Claude/meantforgreatness"
LOG_DIR="$PROJECT_DIR/scripts/logs"
ERROR_LOG="$LOG_DIR/errors.log"
SEEN_FILE="$LOG_DIR/seen-errors.txt"
ANALYSIS_LOG="$LOG_DIR/analysis-$(date +"%Y-%m-%d_%H-%M-%S").log"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

mkdir -p "$LOG_DIR"
touch "$SEEN_FILE"

echo "[$TIMESTAMP] Checking Vercel logs for errors..."

# Fetch recent runtime logs from Vercel
# Use timeout to prevent hanging (vercel logs can stream forever)
RAW_LOGS=$(timeout 15 npx vercel logs https://meantforgreatness.vercel.app 2>/dev/null || true)

if [ -z "$RAW_LOGS" ]; then
  echo "[$TIMESTAMP] No logs retrieved. Skipping."
  exit 0
fi

# Filter for error-level entries (stderr, 500s, uncaught exceptions)
ERRORS=$(echo "$RAW_LOGS" | grep -iE "(error|ERR|500|exception|unhandled|fatal|ENOENT|TypeError|ReferenceError)" || true)

if [ -z "$ERRORS" ]; then
  echo "[$TIMESTAMP] No errors found. All clear."
  exit 0
fi

# De-duplicate: create a hash of the error content to avoid re-processing
ERROR_HASH=$(echo "$ERRORS" | md5 -q 2>/dev/null || echo "$ERRORS" | md5sum | cut -d' ' -f1)

if grep -q "$ERROR_HASH" "$SEEN_FILE" 2>/dev/null; then
  echo "[$TIMESTAMP] Errors already seen and processed. Skipping."
  exit 0
fi

# Save errors and mark as seen
echo "$ERRORS" > "$ERROR_LOG"
echo "$ERROR_HASH $TIMESTAMP" >> "$SEEN_FILE"

echo "[$TIMESTAMP] Found new errors! Passing to Claude Code for analysis..."
echo "──────────────────"
echo "$ERRORS"
echo "──────────────────"

# ──────────────────────────────────────────────────────────────
# Hand off to Claude Code with SAFE permissions
#
# --allowedTools restricts Claude to ONLY these operations:
#   Read              → read source files to understand the code
#   Edit              → make targeted fixes to source files
#   Bash(npm test)    → run tests to verify fixes
#   Bash(git checkout -b *) → create a fix branch
#   Bash(git add *)   → stage changes
#   Bash(git commit *) → commit the fix
#   Bash(git push *)  → push the branch
#   Bash(gh pr create *) → open a PR for review
#   Bash(git diff *)  → inspect changes
#   Bash(git status)  → check repo state
#
# Claude CANNOT:
#   ✗ Run arbitrary bash commands
#   ✗ Delete files or force-push
#   ✗ Access the network (no curl, wget, etc.)
#   ✗ Modify .env files or secrets
#   ✗ Install packages
# ──────────────────────────────────────────────────────────────

cd "$PROJECT_DIR"
claude -p \
  --allowedTools "Read,Edit,Bash(npm test),Bash(npm run test),Bash(git checkout -b *),Bash(git add *),Bash(git commit *),Bash(git push *),Bash(gh pr create *),Bash(git diff *),Bash(git status)" \
  "You are an automated error-fixing agent. Here are production errors from Vercel logs:

\`\`\`
$ERRORS
\`\`\`

Please:
1. Analyze these errors and identify the root cause
2. Find the relevant source files in this repo
3. Create a fix on a new branch (use format: fix/auto-YYYY-MM-DD-description)
4. Run tests to verify the fix works
5. Push the branch and create a PR with a clear description of what broke and how you fixed it

If the errors are transient (network timeouts, rate limits, etc.) and not caused by our code, just log your analysis and do NOT create a PR." \
  2>&1 | tee "$ANALYSIS_LOG"

echo ""
echo "[$TIMESTAMP] Done. Analysis saved to $ANALYSIS_LOG"
