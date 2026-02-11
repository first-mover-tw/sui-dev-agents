---
name: sui-tester
description: Use when testing SUI Move contracts, setting up test suites, running gas benchmarks, or implementing property-based tests. Triggers on test creation, test strategy planning, or quality assurance tasks.
---

# SUI Tester

**Complete testing solution for SUI Move contracts and frontend applications.**

## Overview

This skill provides comprehensive testing across all layers:
- **Unit Tests** - Test individual Move functions
- **Integration Tests** - Test module interactions
- **E2E Tests** - Test complete user journeys (frontend + contract)
- **Property-Based Tests** - Test invariants with random inputs
- **Gas Benchmarks** - Measure and track gas consumption

## SUI v1.65 Testing Updates (Protocol 110)

**Key changes affecting testing (February 2026):**
- **Regex Test Filtering:** Test filtering uses regex. Use `sui move test --filter "regex_pattern"` for precise test selection.
- **poseidon_bn254:** Available on all networks. Add tests for ZK-related functions using `sui::poseidon::poseidon_bn254`.
- **TxContext Flexible Positioning:** `TxContext` can be in any argument position. Update integration tests if they assume last-position TxContext.
- **gRPC Data Access:** Integration tests should use gRPC client (GA) instead of JSON-RPC (deprecated, removed April 2026).

## Quick Start

```bash
# Run all tests
sui move test

# Run with coverage
sui move test --coverage

# Generate coverage report
sui move coverage summary

# Run specific test (now uses regex!)
sui move test --filter "test_create_listing"

# Run all tests matching pattern
sui move test --filter "test_.*listing"
```

## Test Types

### 1. Move Unit Tests

```move
#[test]
fun test_create_listing() {
    let seller = @0xA;
    let mut scenario = test_scenario::begin(seller);
    
    // Create and verify listing
    let listing = create_listing(nft, 1000, ctx);
    assert!(price(&listing) == 1000, 0);
    
    test_scenario::end(scenario);
}
```

### 2. Integration Tests

Test cross-module interactions (marketplace + royalty).

### 3. Frontend E2E Tests

```typescript
test('complete buy flow', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.click('button:has-text("Connect Wallet")');
    // ... complete user journey
});
```

### 4. Property-Based Tests

```move
#[test]
fun property_price_distribution() {
    // Test invariant: total = seller + royalty + fee
    let iterations = 100;
    // ... verify invariant holds
}
```

### 5. Gas Benchmarks

```bash
sui move test --gas-profile
```

## Test Coverage

**Target:** >90% code coverage for core modules

### Quick Coverage Check

```bash
sui move test --coverage
sui move coverage summary
```

### Automated Coverage Analysis Tools

This skill includes Python scripts in `scripts/` for detailed coverage analysis:

```bash
# Location (relative to plugin install path)
SCRIPTS=<plugin_path>/skills/sui-tester/scripts

# Step 1: Run tests with coverage
cd /path/to/move/package
sui move test --coverage --trace

# Step 2: Source-level analysis (primary tool)
# Uses PTY to capture colored output, identifies exact uncovered segments
python3 $SCRIPTS/analyze_source.py -m <module_name>
python3 $SCRIPTS/analyze_source.py -m <module_name> -o coverage.md        # Markdown report
python3 $SCRIPTS/analyze_source.py -m <module_name> --json                # JSON output

# Step 3: LCOV statistics (function/line/branch breakdown)
sui move coverage lcov
python3 $SCRIPTS/analyze_lcov.py lcov.info -s sources/ --issues-only

# Step 4: Low-level bytecode analysis (optional)
sui move coverage bytecode --module <name> | python3 $SCRIPTS/parse_bytecode.py

# Step 5: Piped source analysis (alternative to analyze_source.py)
script -q /dev/null sui move coverage source --module <name> | python3 $SCRIPTS/parse_source.py
```

### Coverage Improvement Workflow

1. **Analyze** — Run `analyze_source.py` to get uncovered segments
2. **Identify gaps:**
   - Uncalled functions → write tests that call them
   - Uncovered assertions → write `#[expected_failure]` tests
   - Untaken branches → write tests for both if/else paths
3. **Write tests** for each gap (see patterns below)
4. **Verify** — Re-run analysis to confirm improvement
5. **Repeat** until >90% coverage

### Coverage Test Patterns

**A. Uncalled function:**
```move
#[test]
fun test_<function_name>() {
    let mut ctx = tx_context::dummy();
    <function_name>(&mut ctx);
    // Assert expected behavior
}
```

**B. Assertion failure path:**
```move
#[test]
#[expected_failure(abort_code = <ERROR_CONST>)]
fun test_<function>_fails_when_<condition>() {
    let mut ctx = tx_context::dummy();
    // Setup state that triggers the assertion failure
    <function_call_that_should_fail>();
}
```

**C. Branch coverage (if/else):**
```move
#[test]
fun test_<function>_when_true() { /* condition = true path */ }

#[test]
fun test_<function>_when_false() { /* condition = false path */ }
```

## Common Mistakes

❌ **Not using test_scenario properly**
- **Problem:** Tests fail with "object not found" errors
- **Fix:** Always call `test_scenario::next_tx` between transactions, clean up with `test_scenario::end`

❌ **Testing with unrealistic gas budgets**
- **Problem:** Tests pass but fail in production due to gas limits
- **Fix:** Set realistic gas budgets in tests, use `--gas-limit` flag

❌ **Ignoring test cleanup**
- **Problem:** Objects leak between tests, intermittent failures
- **Fix:** Delete all created objects or use `#[expected_failure]` for abort tests

❌ **Not testing error cases**
- **Problem:** Production failures from unexpected inputs
- **Fix:** Test all `assert!` and `abort` paths with `#[expected_failure(abort_code = X)]`

❌ **Skipping property-based tests for math**
- **Problem:** Edge cases cause overflow/underflow in production
- **Fix:** Test invariants with 100+ random inputs (prices, quantities, percentages)

❌ **Not benchmarking gas costs**
- **Problem:** Expensive operations drain user funds
- **Fix:** Run `sui move test --gas-profile`, track gas per operation

❌ **E2E tests without proper wallet setup**
- **Problem:** Tests fail on wallet connection
- **Fix:** Use Playwright with wallet mock or testnet faucet automation

## Configuration

Test execution targets:
- Unit tests: <30 seconds
- Integration tests: <2 minutes
- E2E tests: <10 minutes
- Full suite: <15 minutes

See [reference.md](references/reference.md) for complete test patterns and [examples.md](references/examples.md) for test examples.
