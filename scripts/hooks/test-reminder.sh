#!/usr/bin/env bash
set -euo pipefail

# Stop hook: Remind to run tests if .move files were modified but not tested
# Checks git status for modified .move files

if command -v git >/dev/null 2>&1; then
  modified_move=$(git diff --name-only HEAD 2>/dev/null | grep '\.move$' || true)
  if [[ -n "$modified_move" ]]; then
    echo "Reminder: The following .move files were modified — consider running 'sui move test':"
    echo "$modified_move" | head -10
  fi
fi

# Also check for test_only code in sources/
if grep -rn '#\[test_only\]' sources/ 2>/dev/null | head -3; then
  echo "Warning: test_only code found in sources/"
fi

exit 0
