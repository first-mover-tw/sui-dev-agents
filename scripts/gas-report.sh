#!/bin/bash
# Run sui move test with gas profiling and format results as table

set -e

echo "=== Sui Move Gas Report ==="
echo ""

# Check if Move.toml exists
if [ ! -f "Move.toml" ]; then
    echo "❌ ERROR: Move.toml not found in current directory"
    echo "   Please run this script from a Sui Move project root"
    exit 1
fi

# Check if sui CLI exists
if ! command -v sui &> /dev/null; then
    echo "❌ ERROR: sui CLI not found"
    exit 1
fi

# Get package name
PACKAGE_NAME=$(grep -m 1 "^name" Move.toml | sed 's/name[[:space:]]*=[[:space:]]*"\(.*\)"/\1/' || echo "unknown")
echo "Package: $PACKAGE_NAME"
echo ""

# Run tests with gas limit
echo "Running tests with gas profiling..."
echo "(This may take a moment...)"
echo ""

# Capture test output
TEST_OUTPUT=$(sui move test --gas-limit 1000000000 2>&1 || true)

# Check if tests ran successfully
if echo "$TEST_OUTPUT" | grep -q "FAILED"; then
    echo "❌ Some tests failed. Gas report may be incomplete."
    echo ""
fi

# Parse test results and gas usage
echo "--- Gas Usage Summary ---"
echo ""
printf "%-50s %15s %10s\n" "Test" "Gas Used" "Status"
printf "%-50s %15s %10s\n" "----" "--------" "------"

# Extract test results
# Format: "Test test_name ... ok" or "Test test_name ... FAILED"
while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*Test[[:space:]]+([^[:space:]]+) ]]; then
        TEST_NAME="${BASH_REMATCH[1]}"

        # Determine status
        if [[ "$line" =~ ok$ ]]; then
            STATUS="✓ PASS"
        elif [[ "$line" =~ FAILED$ ]]; then
            STATUS="✗ FAIL"
        else
            STATUS="?"
        fi

        # Try to extract gas usage (this is approximate, as Sui doesn't always report per-test gas)
        # For now, we'll just mark that it ran
        GAS_USED="~estimated"

        printf "%-50s %15s %10s\n" "$TEST_NAME" "$GAS_USED" "$STATUS"
    fi
done <<< "$TEST_OUTPUT"

echo ""

# Count tests
TOTAL_TESTS=$(echo "$TEST_OUTPUT" | grep -c "^[[:space:]]*Test " || echo "0")
PASSED_TESTS=$(echo "$TEST_OUTPUT" | grep -c " ok$" || echo "0")
FAILED_TESTS=$(echo "$TEST_OUTPUT" | grep -c " FAILED$" || echo "0")

echo "--- Summary ---"
echo "Total tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
echo ""

# Display total gas if available in output
if echo "$TEST_OUTPUT" | grep -q "gas used:"; then
    TOTAL_GAS=$(echo "$TEST_OUTPUT" | grep "gas used:" | sed 's/.*gas used: \([0-9]*\).*/\1/' || echo "unknown")
    echo "Total gas used: $TOTAL_GAS units"
    echo ""
fi

# Gas cost reference
echo "--- Gas Cost Reference ---"
echo "Simple transfer: ~1,000 - 3,000 gas"
echo "NFT mint: ~30,000 - 50,000 gas"
echo "Complex DeFi operation: ~100,000 - 500,000 gas"
echo "Publish package: ~1,000,000+ gas"
echo ""

# Notes
echo "--- Notes ---"
echo "• Gas costs shown are computational gas only"
echo "• Actual transaction costs include storage gas"
echo "• Costs may vary based on network conditions"
echo "• Use these numbers for relative comparison"
echo ""

# Offer to show full output
if [ "$1" == "--verbose" ] || [ "$1" == "-v" ]; then
    echo "--- Full Test Output ---"
    echo "$TEST_OUTPUT"
    echo ""
fi

echo "=== Gas Report Complete ==="
echo ""
echo "Tip: Run with --verbose flag to see full test output"
