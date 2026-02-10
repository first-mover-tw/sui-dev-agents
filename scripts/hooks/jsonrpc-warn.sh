#!/usr/bin/env bash
set -euo pipefail

# PostToolUse hook: Warn if JSON-RPC patterns detected in TS/JS files

f="${TOOL_INPUT_FILE_PATH:-}"
if [[ "$f" == *.ts || "$f" == *.tsx || "$f" == *.js ]]; then
  if grep -n 'jsonrpc.*2\.0\|sui_get\|suix_get\|sui_execute' "$f" 2>/dev/null; then
    echo "WARNING: JSON-RPC usage detected. JSON-RPC is deprecated (removed April 2026). Use @mysten/sui SDK or gRPC instead."
  fi
fi

exit 0
