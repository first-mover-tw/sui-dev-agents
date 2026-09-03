#!/usr/bin/env bash
# Check every ```move block in skills/ and rules/ against the vendored framework
# symbol index. See scripts/ci/move-symbols/check-move-symbols.mjs for the rules.
set -euo pipefail
exec node "$(dirname "$0")/move-symbols/check-move-symbols.mjs" "$@"
