#!/bin/bash
# Install sui-dev-agents rules to ~/.claude/rules/

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
TARGET="$HOME/.claude/rules"

echo "Installing sui-dev-agents rules..."
echo "Source: $PLUGIN_DIR/rules"
echo "Target: $TARGET"
echo ""

# Create target directories
mkdir -p "$TARGET/sui-move"
mkdir -p "$TARGET/common"

# Copy rules files
echo "Copying sui-move rules..."
cp "$PLUGIN_DIR/rules/sui-move/"*.md "$TARGET/sui-move/" 2>/dev/null || true

echo "Copying common rules..."
cp "$PLUGIN_DIR/rules/common/"*.md "$TARGET/common/" 2>/dev/null || true

echo ""
echo "✓ Rules installed successfully to $TARGET"
echo ""
echo "Installed files:"
ls -1 "$TARGET/sui-move/"*.md 2>/dev/null | sed 's|.*/|  - sui-move/|'
ls -1 "$TARGET/common/"*.md 2>/dev/null | sed 's|.*/|  - common/|'
echo ""
echo "These rules will be automatically loaded by Claude Code."
