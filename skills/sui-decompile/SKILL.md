---
name: sui-decompile
description: Use when fetching on-chain SUI Move contract source code for analysis, learning from existing protocols, or reverse-engineering deployed contracts. Triggers on decompile, contract source, on-chain code, or protocol analysis tasks.
---

# SUI Decompile

**Fetch and analyze on-chain SUI Move contract source code from block explorers.**

## Overview

This skill fills the "study existing contracts" gap in the development workflow. Before writing your own contracts, study how production protocols work:

```
sui-decompile → sui-architect → sui-developer → sui-tester → sui-deployer
    Study          Plan           Write          Test         Deploy
```

## Methods (Priority Order)

### Method 1: `sui client` CLI (Fastest, No Browser)

For packages with **verified source** or when you only need the normalized bytecode representation:

```bash
# Get package object with module bytecodes
sui client object <package_id> --json

# Get specific module's normalized struct/function definitions
sui client call --package 0x2 --module display --function new --type-args '0x2::coin::Coin<0x2::sui::SUI>' --dry-run
```

For verified source packages, use the **Revela decompiler** (if available locally):

```bash
# If revela is installed
revela decompile -p <package_id> --network mainnet
```

### Method 2: Suivision Explorer (Preferred Browser Method)

Suivision often has **official verified source code** (via MovebitAudit).

**URL pattern:**
```
https://suivision.xyz/package/{package_id}?tab=Code
```

**Playwright MCP workflow:**

```
1. Navigate to https://suivision.xyz/package/{package_id}?tab=Code
2. Wait for code table to load
3. If multiple modules: click each module tab in the sidebar
4. Extract code with browser_evaluate:
```

```javascript
// Extract source code from Suivision code table
() => {
  const rows = document.querySelectorAll('table tr');
  const lines = [];
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    if (cells.length >= 2) lines.push(cells[1].textContent);
  });
  return lines.join('\n');
}
```

```javascript
// List all module tabs
() => {
  const tabs = document.querySelectorAll('[role="tab"], .module-tab, nav a');
  return Array.from(tabs).map(t => t.textContent.trim()).filter(Boolean);
}
```

### Method 3: Suiscan Explorer (Alternative)

**URL pattern:**
```
https://suiscan.xyz/{network}/object/{package_id}/contracts
```

Where `{network}` is `mainnet`, `testnet`, or `devnet`.

**Playwright MCP workflow:**

```
1. Navigate to https://suiscan.xyz/mainnet/object/{package_id}/contracts
2. Click "Source" tab (default may show Bytecode)
3. Click module tabs if multiple modules exist
4. Extract code with browser_evaluate:
```

```javascript
// Extract source code from Suiscan
() => {
  const rows = document.querySelectorAll('table tr');
  const lines = [];
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    if (cells.length >= 2) lines.push(cells[1].textContent);
  });
  return lines.join('\n') || 'Source not found - try clicking Source tab';
}
```

## Multi-Module Packages

Many real packages (e.g., DeepBook `0xdee9`) contain multiple modules:

1. **List modules** — Check sidebar/tabs after page loads
2. **Click each module** — Extract code per module
3. **Save separately** — Write each to `decompiled/{module_name}.move`

```bash
# Suggested output structure
decompiled/
├── clob_v2.move
├── custodian_v2.move
├── math.move
└── order_query.move
```

## Common Packages for Study

| Protocol | Package ID | Network | Modules |
|----------|-----------|---------|---------|
| Sui Framework | `0x2` | all | coin, transfer, object, etc. |
| Sui System | `0x3` | all | staking, validator, etc. |
| DeepBook v2 | `0xdee9` | mainnet | clob_v2, custodian_v2 |
| Cetus CLMM | `0x1eabed72c53feb73c00...` | mainnet | pool, position, tick |
| Turbos Finance | `0x91bfbc386a41afcfd9b...` | mainnet | pool, swap |

## Usage Examples

### Study a DeFi AMM

```
1. Decompile Cetus CLMM pool module
2. Analyze: concentrated liquidity math, fee calculation, tick management
3. Use learned patterns in sui-architect to design your own AMM
```

### Audit a Dependency

```
1. Decompile the package your contract depends on
2. Check for access control, reentrancy, integer overflow
3. Document findings before integrating
```

### Learn Move Patterns

```
1. Decompile Sui Framework (0x2) — coin, transfer, display modules
2. Study official coding patterns: witness, capability, hot potato
3. Apply patterns via sui-developer
```

## Important Notes

- Decompiled code may not compile directly (variable names may differ)
- Suivision shows verified source when available (higher quality)
- Suiscan shows Revela decompiled output (always available but less readable)
- Close browser tabs after extraction to avoid resource leaks
- Respect rate limits — don't scrape explorers aggressively
- For testnet/devnet packages, adjust the network in URLs

## Integration with Other Skills

- **sui-architect** — Study existing protocols before designing your own architecture
- **sui-developer** — Apply learned patterns in your Move code
- **sui-tester** — Write tests based on decompiled contract behavior
- **sui-security-guard** — Audit decompiled dependencies for vulnerabilities
- **sui-red-team** — Analyze attack surface of decompiled contracts
