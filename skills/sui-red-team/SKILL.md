---
name: sui-red-team
description: Use when performing adversarial security testing on SUI Move contracts — generating attack tests for access control bypass, integer overflow, object manipulation, economic exploits, reentrancy, and DoS vectors. Triggers on "red team", "attack test", "find vulnerabilities", "exploit", "pentest", "security test", or when the user wants to stress-test their contract's security. For defensive security setup (scanning, hooks, checklists), use sui-security-guard instead.
---

# SUI Red Team

**Adversarial security testing for SUI Move contracts — think like a hacker, break before they do.**

## Overview

This skill runs automated attack rounds against Move contracts, generating malicious test code that actively tries to exploit vulnerabilities. Unlike static analysis, red-team testing executes real attacks.

- **Access Control Bypass** — Call admin functions without capabilities
- **Integer Abuse** — Overflow, underflow, zero-value exploits
- **Object Manipulation** — Wrong objects, shared object races, reuse attacks
- **Economic Attacks** — Flash loan simulation, price manipulation, fee bypass
- **Input Fuzzing** — Empty vectors, oversized strings, malformed data
- **Ordering Attacks** — Transaction ordering, epoch manipulation, timelock bypass
- **Type Confusion** — Wrong generics, phantom type abuse, ability bypass
- **Denial of Service** — Gas exhaustion, infinite loops, storage bloat

## Usage

```
/sui-red-team                    → 10 rounds (default), delete test files after
/sui-red-team 20                 → 20 rounds
/sui-red-team --rounds 5         → 5 rounds
/sui-red-team --keep-tests       → Keep attack tests in tests/red-team/
```

## Execution Flow

For each round N of {total_rounds}:

1. **Scan** — Read all Move source files, build module dependency graph
2. **Analyze Attack Surface** — Identify public entry functions, shared objects, token flows, admin capabilities
3. **Select Attack Vector** — Pick from attack catalog (rounds 1-8: one category each; 9+: combo attacks)
4. **Generate Attack Test** — Write Move test code with malicious inputs, boundary values, permission bypass attempts
5. **Execute** — Run `sui move test --filter "red_team_round_{N}"`
6. **Classify Result**:
   - Test **PASSES** (attack succeeds) → `EXPLOITED` — vulnerability found
   - Test **FAILS** with `expected_failure` or abort → `DEFENDED` — contract correctly blocked
   - Test shows abnormal gas / unexpected behavior → `SUSPICIOUS`
7. **Cleanup** — Delete generated test file (unless `--keep-tests`)

## Attack Vector Catalog

| # | Category | Attack Vectors |
|---|----------|---------------|
| 1 | Access Control | Call admin func without Cap, forge Cap, wrong sender, stolen shared object |
| 2 | Integer Abuse | 0 value, MAX_U64, overflow trigger, underflow trigger, precision loss |
| 3 | Object Manipulation | Wrong object ID, shared object contention, object double-use, orphan objects |
| 4 | Economic Attack | Flash loan sim, price manipulation, fee bypass, dust attack, rounding exploit |
| 5 | Input Fuzzing | Empty vector, max-length string, special bytes (0x00, 0xFF), deeply nested |
| 6 | Ordering Attack | Tx ordering dependency, epoch manipulation, timelock bypass, front-running sim |
| 7 | Type Confusion | Wrong generic param, phantom type abuse, ability constraint bypass |
| 8 | Denial of Service | Gas exhaustion, large loop trigger, storage bloat, recursive call depth |

### Round Assignment Strategy

- Rounds 1–8: Each round targets one unique category (systematic coverage)
- Rounds 9+: Combination attacks (e.g., integer abuse + economic attack)
- Each round focuses on the **highest-risk** entry point for that category

## Output Report Format

```
Red Team Report ({N} rounds)
============================

🔴 EXPLOITED ({count}):
  Round X: [sources/module.move:line] function_name() vulnerability description
    → Attack: description of successful exploit
    → Fix: suggested remediation

🟡 SUSPICIOUS ({count}):
  Round X: [sources/module.move:line] description of anomaly
    → Concern: why this is suspicious

🟢 DEFENDED ({count}):
  Round X: Category — defense description ✓

Summary: {exploited} exploits / {suspicious} suspicious / {defended} defended
Confidence: {confidence}% (based on round coverage)
```

### Confidence Calculation

- 5 rounds → 40%
- 8 rounds → 60% (all categories covered once)
- 10 rounds → 70% (+ combo attacks)
- 15 rounds → 80%
- 20+ rounds → 90%

## Test File Convention

Generated test files use the naming pattern:
```
tests/red_team_round_{N}_{category}.move
```

With `--keep-tests`, files persist in `tests/red-team/` directory for later review or extension.

## Integration with Other Skills

- After red-team: Run `sui-security-guard` for static analysis complement
- Before deployment: `sui-deployer` should check red-team report
- Fix cycle: Exploit found → fix → re-run that specific round to verify

## Common Mistakes

❌ **Running too few rounds**
- 5 rounds only covers ~40% attack surface
- Minimum recommended: 10 rounds for meaningful coverage

❌ **Ignoring SUSPICIOUS results**
- These often indicate subtle bugs that only manifest under load
- Investigate gas anomalies and unexpected state changes

❌ **Not re-testing after fixes**
- Always re-run the specific attack round after applying a fix
- Regression: `sui move test --filter "red_team_round_{N}"`

See [reference.md](references/reference.md) for attack pattern details and [examples.md](references/examples.md) for attack test code examples.
