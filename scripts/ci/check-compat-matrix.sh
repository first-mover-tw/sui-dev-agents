#!/usr/bin/env bash
# Verifies banner ↔ matrix ↔ snippets/package.json consistency.
# See docs/superpowers/specs/2026-05-21-sui-compat-matrix-design.md
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
exec node "$SCRIPT_DIR/check-compat-matrix.mjs" --root "$REPO_ROOT"
