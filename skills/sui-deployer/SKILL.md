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
