#!/usr/bin/env bash
set -euo pipefail

# Lint skills/ for stale @mysten/* SDK imports that drift across major bumps.
# Flags actual `import ... from '...'` lines; skips migration notes, comments,
# diff/bullet examples, table rows, and lines that explicitly say the API was
# removed / not supported.
#
# Usage: ./scripts/ci/check-skill-consistency.sh [--fix-suggest]

PLUGIN_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SKILLS_DIR="$PLUGIN_ROOT/skills"
ERRORS=0

# Pattern format: regex<TAB>reason<TAB>suggested_fix
PATTERNS=(
  "@mysten/sui/client'	sui 2.x removed this subpath	use '@mysten/sui/grpc' (SuiGrpcClient) or '@mysten/sui/jsonRpc' (SuiJsonRpcClient)"
  "\\{[^}]*\\b(ConnectButton|WalletProvider|SuiClientProvider|ConnectModal|AccountModal)\\b[^}]*\\}\\s+from\\s+'@mysten/dapp-kit-react'	dapp-kit-react 2.x moved UI components to /ui subpath	import from '@mysten/dapp-kit-react/ui'"
  "from '@mysten/sui\\.js	package renamed to @mysten/sui in 2025	use '@mysten/sui/...' subpath imports"
)

# Lines that look like import statements but are actually documentation:
#   //          — commented out
#   - import    — markdown bullet or diff removal
#   + import    — diff addition (still might be valid; we'll not skip these)
#   > ...       — blockquote/callout
#   | ... |     — markdown table row
# Also skip if the line itself contains negative context words.
NEGATIVE_CONTEXT='removed|Removed|REMOVED|not supported|NOT supported|deprecated|Deprecated|legacy|migrate from|Old:|❌'

is_doc_line() {
  local line="$1"
  # Strip leading whitespace
  local trimmed="${line#"${line%%[![:space:]]*}"}"
  case "$trimmed" in
    //*|'- '*|'+ '*|'>'*|'|'*|'*'*) return 0 ;;
  esac
  if echo "$line" | grep -qE "$NEGATIVE_CONTEXT"; then
    return 0
  fi
  return 1
}

echo "=== Checking skill SDK import consistency ==="
echo ""

for entry in "${PATTERNS[@]}"; do
  IFS=$'\t' read -r pattern reason fix <<<"$entry"

  # Find candidate lines (grep -E for extended regex)
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    file="${match%%:*}"
    rest="${match#*:}"
    lineno="${rest%%:*}"
    content="${rest#*:}"

    if is_doc_line "$content"; then
      continue
    fi

    # Only flag lines that contain an actual `import` keyword or `from '...'`
    # at non-comment position
    if ! echo "$content" | grep -qE "(^|[^/])import[[:space:]]|require\\(['\"]@mysten"; then
      # Allow `from '@mysten/...'` standalone too (re-export)
      if ! echo "$content" | grep -qE "^[[:space:]]*from[[:space:]]+'@mysten"; then
        continue
      fi
    fi

    if [[ $ERRORS -eq 0 ]]; then
      echo "STALE SDK IMPORTS FOUND:"
      echo ""
    fi
    echo "  $file:$lineno"
    echo "    $(echo "$content" | sed 's/^[[:space:]]*//')"
    echo "    └─ $reason"
    echo "    └─ fix: $fix"
    echo ""
    ERRORS=$((ERRORS + 1))
  done < <(grep -rnE "$pattern" "$SKILLS_DIR" 2>/dev/null || true)
done

if [[ $ERRORS -eq 0 ]]; then
  echo "OK — no stale @mysten/* imports detected."
  exit 0
else
  echo "FAILED: $ERRORS stale import(s) found."
  echo ""
  echo "If a hit is intentional (e.g. demonstrating an old API), rewrite the line"
  echo "as a comment, table row, blockquote, or include 'removed' / 'deprecated'"
  echo "in the same line so the linter knows it's documentation."
  exit 1
fi
