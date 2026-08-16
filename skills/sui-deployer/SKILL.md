---
name: sui-deployer
description: Use when deploying or upgrading Move packages to devnet/testnet/mainnet, managing UpgradeCaps, or planning deployment strategy. Triggers on "deploy", "publish", "upgrade package", "sui client publish", "mainnet release", "staged rollout", or any deployment/release task. Also use when the user asks about package versioning or upgrade compatibility.
---

# SUI Deployer

**Staged deployment orchestration for SUI Move packages.**

## Quick Start

```bash
# Build and publish to current network
sui client publish --gas-budget 100000000

# Dry-run first (recommended)
sui client publish --dry-run --gas-budget 100000000

# Publish and preserve all dependencies in bytecode dump
sui client publish --dump-bytecode-as-base64 --no-tree-shaking
```

## SUI Protocol Deployment Updates (now mainnet v1.77.2 / Protocol 133; testnet v1.77.2)

**RPC Migration (CRITICAL):**
- **JSON-RPC is shut off on public fullnodes** — permanent deactivation landed 2026-07-31. Quorum Driver fully disabled.
- **gRPC is the primary API** — transaction submission exclusively via Transaction Driver.
- `sui client` CLI already uses gRPC internally — no changes needed for CLI workflows.

**gRPC Endpoints:**
| Network | Endpoint |
|---------|----------|
| Mainnet | `grpc.mainnet.sui.io:443` |
| Testnet | `grpc.testnet.sui.io:443` |
| Devnet  | `grpc.devnet.sui.io:443` |

**Protocol 127 Notes (shipped testnet v1.74.0):**
- **Timestamp-based epoch close (P127 mainnet behavior):** Mainnet switches to timestamp-based epoch close at P127 — no operator action required. (Live on both networks since P127/P128; mainnet now v1.77.2 / P133. First shipped testnet v1.74.0.)
- **New Move VM (Testnet):** Active on testnet. Account for gas metering differences in cross-network testing.
- **Offline Bytecode Dump:** `sui move build --dump --no-tree-shaking` works offline — enables air-gapped deployment pipelines.
- **Compatibility verification** enabled by default (was opt-in).

**CLI Breaking Changes (v1.77.2 / P133, verified against installed `sui` 1.77.2 `--help`):**
- **`sui client send-funds`:** the `--stateless` flag is **removed**. Use `--from-address-balance` instead — funds a transfer from the sender's address balance; without it, coin objects are used first and the address balance is only tapped if coin objects don't cover the amount. Recipients always receive into their address balance.
- **`sui client verify-source`:** reworked. It now takes an optional `[package_path]` positional (defaults to `.`) instead of a package-id argument, and reads on-chain metadata to rebuild with the toolchain used at publish time. `--verify-deps`, `--skip-source`, and `--address-override` are **removed**. New: downloaded toolchains are cached (default 5, tune with `SUI_BINARY_CACHE_LIMIT`), `--toolchain <path>` to verify against a local binary, `--json` for metadata output.

## Deployment Stages

### Stage 1: Devnet
```bash
sui client switch --env devnet
sui client publish --gas-budget 100000000
```
Quick iteration, no verification needed.

### Stage 2: Testnet
```bash
sui client switch --env testnet
sui move test              # run all tests first
sui client publish --gas-budget 200000000
```
Public testing, 48+ hours soak time before mainnet.

### Stage 3: Mainnet
```bash
sui client switch --env mainnet
sui client publish --gas-budget 500000000
```
Requires: security audit, multisig UpgradeCap transfer, rollback plan.

## Upgrade Management

```bash
# Step 1: Build upgrade bytecode
sui move build --dump-bytecode-as-base64

# Step 2: Execute upgrade with existing UpgradeCap
sui client upgrade --gas-budget 200000000 --upgrade-capability <UPGRADE_CAP_ID>
```

**UpgradeCap best practices:**
- Transfer to multisig address immediately after first publish
- Store the cap object ID in your deployment records
- Use `sui client object <CAP_ID>` to verify cap ownership

## Post-Deployment Checklist

1. Save published **package ID** and **UpgradeCap ID**
2. Transfer UpgradeCap to multisig/admin address
3. Update frontend `.env` with new package ID
4. Run smoke tests against deployed package
5. Verify on-chain bytecode via explorer (Suivision / Suiscan)

## Common Mistakes

❌ **Forgetting to transfer UpgradeCap** — stuck in deployer address, cannot upgrade with multisig later. Transfer immediately after publish.

❌ **Not saving deployment artifacts** — lost package IDs mean you can't verify on-chain code or reference it. Save package ID + upgrade cap ID + tx digest.

❌ **Not updating frontend package IDs** — frontend calls old package, all transactions fail. Automate package ID updates in `.env` post-deployment.

See [reference.md](references/reference.md) for upgrade compatibility rules and [examples.md](references/examples.md) for deployment scripts. If the CLI is missing or you hit `client/server api version mismatch`, see the **sui-install** skill.
