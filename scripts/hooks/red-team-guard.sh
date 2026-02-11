#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook (Bash): Suggest red-team testing before deploy/publish/upgrade
# Reads TOOL_INPUT from environment (contains the command string)

cmd="${TOOL_INPUT_COMMAND:-}"

if echo "$cmd" | grep -qE 'sui client (publish|upgrade)'; then
  echo "WARN: Deploy operation detected. Consider running /sui-red-team before deploying to catch vulnerabilities."
fi

exit 0
