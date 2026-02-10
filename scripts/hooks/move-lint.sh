#!/usr/bin/env bash
set -euo pipefail

# PostToolUse hook: Auto-verify Move syntax after editing .move files
# Receives TOOL_INPUT_FILE_PATH from environment

f="${TOOL_INPUT_FILE_PATH:-}"
if [[ "$f" == *.move ]]; then
  sui move build --skip-fetch-latest-git-deps 2>&1 | tail -5
fi

exit 0
