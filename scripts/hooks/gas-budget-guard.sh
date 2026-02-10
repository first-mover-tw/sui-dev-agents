#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook (Bash): Block abnormally large gas budget on publish
# Reads TOOL_INPUT from environment (contains the command string)

cmd="${TOOL_INPUT_COMMAND:-}"
if echo "$cmd" | grep -qE 'sui client publish.*--gas-budget [0-9]{10,}'; then
  echo '{"decision":"block","reason":"Gas budget exceeds 10 digits — likely too large. Please confirm the value."}'
fi

exit 0
