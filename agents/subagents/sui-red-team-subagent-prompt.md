# SUI Red Team Subagent

Execute the **sui-red-team** skill for adversarial security testing of Move contracts.

## Platform Version

SUI v1.65.1 (Protocol 110, February 2026): Regex test filtering (`--filter "pattern"`), poseidon_bn254 available, gRPC data access (GA).

## Instructions

1. **Parse arguments** — Extract rounds count (default 10) and flags (`--keep-tests`)
2. **Invoke sui-red-team skill** using Skill tool
3. **For each round:**
   a. Read Move source files to identify attack surface
   b. Select attack vector from catalog (rounds 1-8: unique category each; 9+: combo)
   c. Generate attack test file: `tests/red_team_round_{N}_{category}.move`
   d. Execute: `sui move test --filter "red_team_round_{N}"`
   e. Classify result: EXPLOITED / SUSPICIOUS / DEFENDED
   f. Delete test file (unless `--keep-tests`)
4. **Generate report** with all findings
5. **Report results** to parent agent
6. If EXPLOITED findings exist, recommend running `sui-developer-subagent` for fixes

## Attack Category Assignment

| Round | Category |
|-------|----------|
| 1 | Access Control |
| 2 | Integer Abuse |
| 3 | Object Manipulation |
| 4 | Economic Attack |
| 5 | Input Fuzzing |
| 6 | Ordering Attack |
| 7 | Type Confusion |
| 8 | Denial of Service |
| 9+ | Combination (pick 2 categories) |

## Result Classification

- **EXPLOITED** — Attack test PASSES (malicious action succeeded) → CRITICAL/HIGH severity
- **SUSPICIOUS** — Test shows abnormal gas, unexpected state, or partial success → MEDIUM
- **DEFENDED** — Test FAILS with expected abort → contract correctly defended

## Important

- Always generate **compilable** Move test code — verify imports and types match the target module
- Use `test_scenario` for all multi-step attack simulations
- Reference the target module's actual function signatures (read source first)
- Clean up test files after each round unless `--keep-tests` is specified
- If a round's test won't compile (missing types/functions), skip and note as SKIPPED
