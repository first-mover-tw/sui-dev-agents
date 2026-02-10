#!/usr/bin/env bash
set -euo pipefail

# UserPromptSubmit hook: Warn when mainnet operations are mentioned in prompt
# Reads PROMPT from environment

prompt="${PROMPT:-}"
if echo "$prompt" | grep -qiE '\bmainnet\b.*(publish|upgrade|deploy|migrate)|\b(publish|upgrade|deploy|migrate)\b.*mainnet'; then
  echo "MAINNET OPERATION DETECTED — Please double-check:"
  echo "  1. Contract has been audited"
  echo "  2. Gas budget is appropriate"
  echo "  3. You are using the correct package ID"
  echo "  4. Upgrade policy is set correctly"
fi

exit 0
