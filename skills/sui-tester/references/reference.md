# SUI Tester - Reference

Complete testing patterns and best practices.

## Test Pyramid

```
          E2E Tests (5%)
         /            \
    Integration (15%)
       /                \
   Unit Tests (80%)
```

## Move Test Patterns

### Pattern 1: Test Scenario
Use `test_scenario` for multi-transaction tests.

### Pattern 2: Expected Failure
Use `#[expected_failure(abort_code = ...)]` for error tests.

### Pattern 3: Test Helpers
Create reusable test utilities.

See examples.md for complete test examples.
