---
name: sui-decompile
description: Use when fetching or analyzing deployed SUI Move contract source code from on-chain bytecode. Triggers on "decompile", "show me the contract code", "reverse engineer", "read on-chain module", "analyze deployed package", or when the user provides a package ID and wants to understand what it does. Also use when studying existing protocols or verifying deployed code.
---

# SUI Decompile

**Fetch and analyze on-chain SUI Move contract source code.**

```
sui-decompile → sui-architect → sui-developer → sui-tester → sui-deployer
    Study          Plan           Write          Test         Deploy
```

## Methods (Priority Order)

### Method 1: `sui client` CLI (Fastest, No Browser)

```bash
# Get package object with module bytecodes
sui client object <package_id> --json

# Revela decompiler (if installed)
revela decompile -p <package_id> --network mainnet
```

### Method 2: Suivision Explorer (Preferred Browser)

Often has **verified source code** (via MovebitAudit).

```
https://suivision.xyz/package/{package_id}?tab=Code
```

For Playwright MCP scraping workflow, see [references/scraping-patterns.md](references/scraping-patterns.md).

### Method 3: Suiscan Explorer (Alternative)

```
https://suiscan.xyz/{network}/object/{package_id}/contracts
```

Always available via Revela decompilation. See [references/scraping-patterns.md](references/scraping-patterns.md) for extraction snippets.

## Common Packages for Study

| Protocol | Package ID | Network |
|----------|-----------|---------|
| Sui Framework | `0x2` | all |
| Sui System | `0x3` | all |
| DeepBook v2 | `0xdee9` | mainnet |
| Cetus CLMM | `0x1eabed72c53feb73c00...` | mainnet |
| Turbos Finance | `0x91bfbc386a41afcfd9b...` | mainnet |

## After Decompiling

- **Design your own** → `sui-architect`
- **Write code based on patterns** → `sui-developer`
- **Audit dependencies** → `sui-red-team`
