---
name: gas
description: Gas analysis and optimization recommendations
---

# Gas Analysis

When invoked, follow these steps:

1. **Run tests with gas metering**:
   ```bash
   sui move test --skip-fetch-latest-git-deps
   ```
   - Extract gas usage from test output
   - Group by test function

2. **Analyze gas consumption**:
   - Parse computational costs per operation
   - Identify top gas consumers:
     - Storage operations (writes > reads)
     - Dynamic fields access
     - Vector operations (large vectors)
     - Event emissions
     - Object creation/destruction

3. **Generate gas report**:
   ```
   Gas Analysis Report
   ===================

   Top 10 Most Expensive Operations:
   1. test_batch_mint: 2,456,789 gas
      - 10 object creations: ~2M gas
      - 10 transfer operations: ~400K gas
      - Event emissions: ~56K gas

   2. test_marketplace_listing: 1,234,567 gas
      - Dynamic field writes: ~800K gas
      - Shared object access: ~300K gas
      - Type checks: ~134K gas

   Storage Cost Breakdown:
   - Object creation: 45%
   - Dynamic fields: 30%
   - Transfer ops: 15%
   - Events: 10%
   ```

4. **Identify optimization opportunities**:

   **High Impact**:
   - Batch operations instead of loops
   - Reduce object creations (use tables/bags)
   - Minimize dynamic field access
   - Consolidate events

   **Medium Impact**:
   - Use `vector` for fixed-size collections
   - Avoid unnecessary copies
   - Optimize struct packing
   - Cache repeated computations

   **Low Impact**:
   - Reduce local variables
   - Simplify conditionals
   - Inline small functions

5. **Compare against baselines**:
   - Check if gas increased since last run
   - Flag regressions > 10%
   - Show trend if historical data exists

6. **Generate optimization suggestions**:
   ```
   Recommendations:

   🔴 CRITICAL (2.4M gas savings):
   - [marketplace.move:78] Replace loop with batch_transfer()
     Current: 10 x transfer() = 2.4M gas
     Optimized: 1 x batch_transfer() = 400K gas

   🟡 MEDIUM (300K gas savings):
   - [vault.move:45] Cache dynamic field reads
     Reading same field 5 times = 300K gas
     Cache in local var = 60K gas

   🟢 LOW (50K gas savings):
   - [utils.move:23] Use &mut instead of copy
   ```

7. **Benchmark against common operations**:
   - Compare with SUI standard library functions
   - Show if implementation is efficient

8. **Output**:
   - Gas report summary
   - Prioritized optimization list
   - Estimated savings
   - Code examples for top fixes
