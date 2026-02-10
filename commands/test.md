---
name: test
description: Run Move tests with gas tracking and detailed reporting
---

# Run Move Tests

When invoked, follow these steps:

1. **Parse arguments**:
   - `--filter <pattern>`: Run specific test(s)
   - `--gas`: Include gas usage analysis
   - `--coverage`: Show code coverage (if available)
   - `--verbose`: Detailed output

2. **Pre-test checks**:
   - Verify `tests/` directory exists
   - Check for `*_tests.move` files
   - Ensure project builds successfully

3. **Run tests**:
   ```bash
   sui move test --skip-fetch-latest-git-deps [--filter <pattern>]
   ```

4. **Parse results**:
   - Total tests: passed/failed/ignored
   - Extract failing test names and reasons
   - Show assertion failures with expected vs actual

5. **Gas usage summary** (if tests pass):
   - Extract gas consumption per test
   - Identify most expensive operations
   - Compare against baseline (if available)
   - Flag tests exceeding thresholds

6. **Failure analysis**:
   - **Abort codes**: Decode to readable errors
   - **Type mismatches**: Show type expectations
   - **Test scenario issues**: Suggest fixes
   - **Missing test utilities**: Recommend patterns

7. **Generate report**:
   ```
   ✓ 15 passed
   ✗ 2 failed

   Failed tests:
   - test_transfer_unauthorized (abort 0x1::error::permission_denied)
   - test_overflow (arithmetic overflow at line 42)

   Gas usage (top 3):
   - test_mint: 1,234,567 gas
   - test_batch_transfer: 987,654 gas
   - test_complex_query: 456,789 gas
   ```

8. **Recommendations**:
   - Fix failing tests first
   - Optimize high-gas operations
   - Add missing test coverage
