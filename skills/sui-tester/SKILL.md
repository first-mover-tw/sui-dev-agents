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

## Quick Start

```bash
# Run all tests
sui move test

# Run with coverage
sui move test --coverage

# Generate coverage report
sui move coverage summary

# Run specific test
sui move test test_create_listing
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

```bash
sui move coverage summary
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
