#!/usr/bin/env bash
# Type-check every TS/TSX code block in skills/**/*.md against real @mysten/* SDKs.
# Fails if NEW files start failing (anything not listed in known-failures.txt).
set -euo pipefail

cd "$(dirname "$0")/snippets"

[ -d node_modules ] || npm install --no-audit --no-fund --silent

node extract.mjs

LOG=$(mktemp)
set +e
npx --no-install tsc --noEmit -p tsconfig.json > "$LOG" 2>&1
set -e

# Files that actually have errors right now
ACTUAL=$(grep -E "error TS" "$LOG" | sed 's|tmp/||; s|(.*||' | sort -u || true)
KNOWN=$(sort -u known-failures.txt)

# Anything in ACTUAL but not in KNOWN is a regression
NEW=$(comm -23 <(echo "$ACTUAL") <(echo "$KNOWN") || true)

if [ -n "${NEW// /}" ]; then
  echo ""
  echo "❌ New type errors in skill code blocks:"
  echo ""
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    echo "  --- $f ---"
    grep "tmp/$f" "$LOG" | sed 's|^tmp/|  |'
  done <<< "$NEW"
  echo ""
  echo "Fix the underlying skills/*.md block, OR (if it's an intentional"
  echo "fragment/pseudo-code) add '// @check:skip' as the first line of the block."
  echo "Do NOT just append to known-failures.txt to silence real errors."
  exit 1
fi

# Anything in KNOWN but not ACTUAL means the baseline is stale (file no longer fails)
STALE=$(comm -13 <(echo "$ACTUAL") <(echo "$KNOWN") || true)
if [ -n "${STALE// /}" ]; then
  echo "ℹ️  known-failures.txt has stale entries (these files now pass):"
  echo "$STALE" | sed 's/^/  /'
  echo "Remove them from scripts/ci/snippets/known-failures.txt."
fi

echo "✅ Snippet type-check passed ($(echo "$ACTUAL" | grep -c . || true) known-failing files, no regressions)."
