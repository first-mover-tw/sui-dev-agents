#!/bin/bash
# Check Sui development environment setup and display summary

set -e

echo "=== Sui Development Environment Check ==="
echo ""

# Check if sui CLI exists
if ! command -v sui &> /dev/null; then
    echo "❌ ERROR: sui CLI not found"
    echo "   Please install Sui CLI: https://docs.sui.io/guides/developer/getting-started/sui-install"
    exit 1
fi
echo "✓ Sui CLI found"

# Get version
SUI_VERSION=$(sui --version 2>/dev/null | head -n1 || echo "unknown")
echo "  Version: $SUI_VERSION"
echo ""

# Get active environment
echo "--- Active Environment ---"
ACTIVE_ENV=$(sui client active-env 2>/dev/null || echo "none")
echo "  Environment: $ACTIVE_ENV"

# Get active address
ACTIVE_ADDRESS=$(sui client active-address 2>/dev/null || echo "none")
echo "  Address: $ACTIVE_ADDRESS"
echo ""

# Check gas balance if we have an active address
if [ "$ACTIVE_ADDRESS" != "none" ]; then
    echo "--- Gas Balance ---"
    GAS_OUTPUT=$(sui client gas 2>/dev/null || echo "")

    if [ -z "$GAS_OUTPUT" ]; then
        echo "  ❌ Could not fetch gas balance"
    else
        # Parse gas objects and calculate total
        TOTAL_GAS=0
        GAS_COUNT=0

        while IFS= read -r line; do
            # Look for balance in MIST
            if [[ "$line" =~ [[:space:]]([0-9]+)[[:space:]]*$ ]]; then
                BALANCE="${BASH_REMATCH[1]}"
                TOTAL_GAS=$((TOTAL_GAS + BALANCE))
                GAS_COUNT=$((GAS_COUNT + 1))
            fi
        done <<< "$GAS_OUTPUT"

        # Convert MIST to SUI (1 SUI = 1,000,000,000 MIST)
        SUI_BALANCE=$(echo "scale=4; $TOTAL_GAS / 1000000000" | bc 2>/dev/null || echo "0")

        echo "  Gas objects: $GAS_COUNT"
        echo "  Total balance: $SUI_BALANCE SUI ($TOTAL_GAS MIST)"

        # Warn if low balance
        if (( $(echo "$SUI_BALANCE < 0.1" | bc -l) )); then
            echo "  ⚠️  WARNING: Low gas balance. Get testnet SUI from:"
            echo "     https://discord.com/channels/916379725201563759/1037811694564560966"
        fi
    fi
    echo ""
fi

# Check for Move.toml in current directory
echo "--- Project Check ---"
if [ -f "Move.toml" ]; then
    echo "  ✓ Move.toml found"

    # Extract package name
    PACKAGE_NAME=$(grep -m 1 "^name" Move.toml | sed 's/name[[:space:]]*=[[:space:]]*"\(.*\)"/\1/' || echo "unknown")
    echo "  Package: $PACKAGE_NAME"

    # Check for sources directory
    if [ -d "sources" ]; then
        MOVE_FILES=$(find sources -name "*.move" | wc -l | tr -d ' ')
        echo "  Move files: $MOVE_FILES"
    fi
else
    echo "  ℹ️  No Move.toml in current directory"
    echo "     Not in a Sui Move project"
fi
echo ""

# List available environments
echo "--- Available Environments ---"
sui client envs 2>/dev/null | tail -n +2 || echo "  Could not list environments"
echo ""

echo "=== Environment Check Complete ==="
