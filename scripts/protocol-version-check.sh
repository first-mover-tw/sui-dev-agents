#!/bin/bash
# Query current protocol version from RPC and compare with expected

set -e

EXPECTED_VERSION=119
EXPECTED_SUI_VERSION="1.69"

echo "=== Sui Protocol Version Check ==="
echo ""

# Check sui CLI
if ! command -v sui &> /dev/null; then
    echo "❌ ERROR: sui CLI not found"
    exit 1
fi

# Get active environment
ACTIVE_ENV=$(sui client active-env 2>/dev/null || echo "none")
echo "Active Environment: $ACTIVE_ENV"
echo ""

# Get RPC URL for current environment
RPC_URL=$(sui client active-env --json 2>/dev/null | grep -o '"https\?://[^"]*"' | tr -d '"' || echo "")

if [ -z "$RPC_URL" ]; then
    echo "❌ Could not determine RPC URL for environment: $ACTIVE_ENV"
    exit 1
fi

echo "RPC URL: $RPC_URL"
echo ""

# Query protocol version via sui CLI (JSON-RPC is deprecated, shutting down April 2026)
echo "Querying protocol version..."
echo ""
echo "⚠️  NOTE: JSON-RPC is deprecated and will be removed in April 2026."
echo "   Use gRPC or GraphQL for production applications."
echo ""

PROTOCOL_VERSION=$(sui client protocol-config --json 2>/dev/null | grep -o '"protocolVersion":[0-9]*' | sed 's/"protocolVersion"://' || echo "")

# Fallback: try sui client call
if [ -z "$PROTOCOL_VERSION" ]; then
    PROTOCOL_VERSION=$(sui client envs --json 2>/dev/null | grep -o '"protocol_version":[0-9]*' | head -1 | sed 's/"protocol_version"://' || echo "")
fi

# Fallback: try JSON-RPC (deprecated, will be removed April 2026)
if [ -z "$PROTOCOL_VERSION" ]; then
    echo "⚠️  Falling back to JSON-RPC (deprecated)..."
    PROTOCOL_VERSION=$(curl -s "$RPC_URL" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{
            "jsonrpc": "2.0",
            "id": 1,
            "method": "sui_getLatestSuiSystemState",
            "params": []
        }' | grep -o '"protocolVersion":"[0-9]*"' | sed 's/"protocolVersion":"\([0-9]*\)"/\1/' || echo "")
fi

if [ -z "$PROTOCOL_VERSION" ]; then
    echo "❌ ERROR: Could not fetch protocol version"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check network connection"
    echo "  2. Verify sui CLI is configured: sui client active-env"
    echo "  3. Try: sui client protocol-config"
    exit 1
fi

echo "Current Protocol Version: $PROTOCOL_VERSION"
echo "Expected Protocol Version: $EXPECTED_VERSION"
echo ""

# Compare versions
if [ "$PROTOCOL_VERSION" -eq "$EXPECTED_VERSION" ]; then
    echo "✓ Protocol version matches expected version ($EXPECTED_VERSION)"
    echo "  Your environment is compatible with Sui v$EXPECTED_SUI_VERSION"
elif [ "$PROTOCOL_VERSION" -gt "$EXPECTED_VERSION" ]; then
    echo "⚠️  WARNING: Protocol version ($PROTOCOL_VERSION) is NEWER than expected ($EXPECTED_VERSION)"
    echo ""
    echo "  Your environment is ahead of the expected Sui v$EXPECTED_SUI_VERSION"
    echo "  This plugin was built for Sui v$EXPECTED_SUI_VERSION (Protocol $EXPECTED_VERSION)"
    echo ""
    echo "  Actions:"
    echo "  1. Skills and agents should still work but may not use latest features"
    echo "  2. Consider updating plugin or check for newer version"
    echo "  3. Test skills carefully before production use"
elif [ "$PROTOCOL_VERSION" -lt "$EXPECTED_VERSION" ]; then
    echo "❌ ERROR: Protocol version ($PROTOCOL_VERSION) is OLDER than expected ($EXPECTED_VERSION)"
    echo ""
    echo "  Your environment is behind Sui v$EXPECTED_SUI_VERSION"
    echo "  This plugin requires at least Sui v$EXPECTED_SUI_VERSION (Protocol $EXPECTED_VERSION)"
    echo ""
    echo "  Actions:"
    echo "  1. Update sui CLI: cargo install --locked --git https://github.com/MystenLabs/sui.git --branch $EXPECTED_SUI_VERSION sui"
    echo "  2. Or use a different environment (testnet/mainnet may be on newer protocol)"
    echo "  3. Check: sui client switch --env testnet"
fi

echo ""

# Show sui CLI version for reference
SUI_CLI_VERSION=$(sui --version 2>/dev/null | head -n1 || echo "unknown")
echo "Sui CLI Version: $SUI_CLI_VERSION"
echo ""

echo "=== Protocol Version Check Complete ==="
