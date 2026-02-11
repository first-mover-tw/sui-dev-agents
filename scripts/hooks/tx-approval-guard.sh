#!/usr/bin/env bash
# tx-approval-guard: Intercept direct `sui client` signing commands via Bash.
# Ensures agents cannot bypass MCP wallet tools to execute transactions directly.
# This is a PreToolUse hook for the Bash tool.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Match sui client commands that execute transactions (not dry-run, not read-only)
if echo "$COMMAND" | grep -qE 'sui\s+client\s+(publish|call|transfer-sui|transfer|upgrade|pay|merge-coin|split-coin|pay-all-sui|pay-sui)' ; then
  # Allow if it's a dry-run
  if echo "$COMMAND" | grep -q '\-\-dry-run'; then
    exit 0
  fi

  cat <<EOF
⚠️  TX APPROVAL GUARD
━━━━━━━━━━━━━━━━━━━━
A direct \`sui client\` transaction command was detected.

Prefer using MCP wallet tools (sui_wallet_transfer, sui_wallet_call, sui_wallet_publish)
which provide dry-run preview before execution.

If you still want to proceed with the direct CLI command, the user must approve below.

Command: $(echo "$COMMAND" | head -c 200)
EOF
  exit 0
fi

exit 0
