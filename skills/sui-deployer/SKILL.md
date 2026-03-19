---
name: sui-deployer
description: Use when deploying Move packages across networks (devnet/testnet/mainnet), orchestrating staged rollouts, or verifying deployed contracts. Triggers on deployment tasks, network migration, or release management.
---

# SUI Deployer

**Staged deployment orchestration for SUI Move packages.**

## Overview

This skill provides comprehensive deployment management:
- Multi-stage deployment (devnet → testnet → mainnet)
- Contract verification
- Upgrade management
- Post-deployment monitoring

## Quick Start

```bash
# Deploy to devnet
sui-deployer deploy --network devnet

# Deploy to testnet with verification
sui-deployer deploy --network testnet --verify

# Deploy to mainnet (requires confirmation)
sui-deployer deploy --network mainnet
```

## SUI v1.68 Deployment Updates (Protocol 117)

**RPC Migration (CRITICAL):**
- **JSON-RPC is deprecated** — will be removed **April 2026**. Quorum Driver for transaction submission is **fully disabled**.
- **gRPC is the primary API** — use gRPC endpoints for deployment verification and monitoring. Transaction submission now exclusively via **Transaction Driver**.
- If using custom RPC endpoints, ensure they expose gRPC (port 8443 TLS / 8080 plaintext)
- `sui client` CLI already uses gRPC internally — no changes needed for CLI workflows

**gRPC Endpoints:**
| Network | Endpoint |
|---------|----------|
| Mainnet | `grpc.mainnet.sui.io:443` |
| Testnet | `grpc.testnet.sui.io:443` |
| Devnet  | `grpc.devnet.sui.io:443` |

**CLI changes (v1.64-v1.68):**
- **publish/upgrade flag fix:** Fixed `sui client publish | upgrade` handling of flags like `--dry-run`. Use flags correctly now.
- **`--no-tree-shaking` flag:** New flag for `--dump-bytecode-as-base64`. Keeps all dependencies in the JSON output regardless of usage. By default, unused dependencies are removed on publication/upgrade.
- **Compatibility verification:** Now enabled by default (was opt-in). Your deployments will automatically verify compatibility.
- **`sui move build --dump`:** Now correctly outputs with 0 address (`v1.67.3+`).
- **Protocol Version 117** is current on testnet, **115** on mainnet.

```bash
# Publish with dry-run (now works correctly)
sui client publish --dry-run --gas-budget 100000000

# Preserve all dependencies in bytecode dump
sui client publish --dump-bytecode-as-base64 --no-tree-shaking
```

## Deployment Stages

### Stage 1: Devnet Deployment
- Quick deployment for testing
- No verification required
- Automated deployment

### Stage 2: Testnet Deployment
- Public testing
- Optional verification
- Bug bounty preparation

### Stage 3: Mainnet Deployment
- Security audit required
- Multi-sig control
- Gradual rollout

## Core Features

### 1. Package Publishing

```bash
# Build and publish
sui client publish --gas-budget 100000000
```

### 2. Upgrade Management

```bash
# Create upgrade capability
# Publish new version
# Execute upgrade
```

### 3. Verification

Verifies:
- Source code matches on-chain bytecode
- All tests passing
- Security audit completed (mainnet)

## Configuration

`.sui-deployer.json`:
```json
{
  "networks": {
    "devnet": { "auto_deploy": true },
    "testnet": { "require_tests": true },
    "mainnet": { "require_audit": true, "require_multisig": true }
  }
}
```

## Common Mistakes

❌ **Deploying to mainnet without testnet verification**
- **Problem:** Critical bugs discovered in production, funds at risk
- **Fix:** Always deploy and test on testnet for 48+ hours before mainnet

❌ **Not saving deployment artifacts**
- **Problem:** Cannot verify on-chain code, lost package IDs
- **Fix:** Save published package ID, upgrade cap ID, and deployment receipt

❌ **Forgetting to transfer UpgradeCap**
- **Problem:** Upgrade capability stuck in deployer address, cannot upgrade
- **Fix:** Transfer UpgradeCap to multisig or admin address immediately

❌ **No rollback plan**
- **Problem:** Bad deployment breaks production, no recovery path
- **Fix:** Keep previous package ID, implement emergency pause mechanism

❌ **Deploying with insufficient gas**
- **Problem:** Transaction fails halfway, wasted gas, incomplete deployment
- **Fix:** Estimate gas with `--dry-run`, add 20% buffer

❌ **Not updating frontend package IDs**
- **Problem:** Frontend calls old package, transactions fail
- **Fix:** Automate package ID updates in .env files post-deployment

❌ **Skipping post-deployment smoke tests**
- **Problem:** Deployment succeeds but contract is broken
- **Fix:** Run automated smoke tests (create listing, purchase, etc.) after deploy

See [reference.md](references/reference.md) for complete deployment process and [examples.md](references/examples.md) for deployment scripts.
