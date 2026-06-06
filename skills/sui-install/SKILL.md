---
name: sui-install
description: Use when installing or updating the Sui CLI, managing CLI versions with suiup, or resolving environment/setup problems — "install sui", "update sui", "command not found", "sui not found", "client/server api version mismatch", build errors about "old dependencies", switching CLI versions per network, or installing toolchain components (Walrus, MVR, Move Analyzer, site-builder). Also use for first-time client setup, getting faucet tokens, recovering keys from a phrase, or "Cannot find gas coin for signer address". For deploying/upgrading packages use sui-deployer; for on-chain data queries use sui-ts-sdk.
---

# SUI Install & Environment Setup

> Source: docs.sui.io (via MystenLabs/skills). Commands use the `@network` suffix rather than pinned version numbers — the CLI version must match the network's protocol version.

Covers machine setup and environment problems: installing/updating the CLI, fixing version mismatches, first-time client config, and getting test tokens. For deployment/upgrade see `sui-deployer`; for gas-model/epoch/network concepts see `sui-developer`; for on-chain data queries see `sui-ts-sdk`.

## Installing & updating with suiup

`suiup` is the official installer and version manager for the Sui toolchain (Sui CLI, Walrus, MVR, Move Analyzer).

```bash
curl -sSfL https://raw.githubusercontent.com/MystenLabs/suiup/main/install.sh | sh
```

Then install the CLI for a specific network — the version MUST match the network or you get build/publish failures:

```bash
suiup install sui@testnet     # Testnet-compatible CLI
suiup install sui@mainnet     # Mainnet-compatible CLI
```

| Command | Syntax | What it does |
|---|---|---|
| `install` | `suiup install sui@testnet` | Download + install a binary for a network |
| `update` | `suiup update sui@testnet` | Download the latest version (does NOT switch to it) |
| `switch` | `suiup switch sui@testnet` | Make the latest installed version for a network the active default |
| `show` | `suiup show` | List installed binaries with versions + which is default |
| `status` | `suiup status` | Show which binaries have updates available + the command to update |
| `self update` | `suiup self update` | Update suiup itself |

- **`update` does NOT switch.** After `suiup update sui@testnet` you must `suiup switch sui@testnet` to actually use the new version.
- `switch` takes a single `binary@network` argument (`sui@testnet`, `walrus@testnet`, `move-analyzer@testnet`) — NOT positional args like `suiup switch sui testnet v1.70.2`.
- **Windows:** `curl | sh` needs a Unix shell — use WSL, or `choco install sui` (Chocolatey).
- **Alternatives:** `brew install sui` (macOS/Linux), `choco install sui` (Windows). These can NOT install extra Stack components (Walrus, MVR) and may be slow on first run.

### Optional toolchain components

Install only when explicitly needed, then switch each one:

```bash
suiup install move-analyzer   # Move Language Server
suiup install mvr             # Move Registry CLI (onchain package manager)
suiup install walrus          # Walrus decentralized-storage CLI
suiup install site-builder    # Walrus site builder
suiup switch move-analyzer@testnet
suiup switch walrus@testnet
```

## Version mismatch troubleshooting

The CLI version must match the network you target — each network runs a specific protocol version.

- **`client/server api version mismatch` warning** = your local CLI is older than the network. Do NOT ignore it — it causes build failures and unexpected behavior. Fix:

  ```bash
  suiup update sui@testnet      # download latest
  suiup switch sui@testnet      # make it active
  suiup show                    # verify which version is now active
  ```

- **"sui not found" / command not found** → `suiup switch sui@testnet` to set the active default. Do NOT suggest manual `export PATH=...` or reinstalling — `suiup switch` is the correct fix.
- **Build errors mentioning "old dependencies"**, transaction/publish failures, or odd behavior after a network upgrade are common mismatch symptoms.
- Diagnose with:

  ```bash
  sui --version                 # your installed version
  sui client active-env         # which network you target
  ```

## First-time client setup

Running `sui client` for the first time prompts to create a config — accept the default (Enter / `Y`), or skip the prompt with `sui client -y`. It generates a key pair + address, a 12-word recovery phrase (shown ONCE — save it immediately), and `client.yaml`.

Config + key locations:

- macOS/Linux: `~/.sui/sui_config/client.yaml` and `~/.sui/sui_config/sui.keystore`
- Windows: `%USERPROFILE%\.sui\sui_config\client.yaml` (and `sui.keystore`)

`sui.keystore` holds Base64-encoded private keys — it is NOT your machine's system keychain.

Recover an address from a recovery phrase (entire phrase in single quotes, correct order):

```bash
sui keytool import '<12-WORD-PHRASE>' ed25519
```

### Address & environment management

| Command | Purpose |
|---|---|
| `sui client active-env` | Show current network |
| `sui client active-address` | Show current address |
| `sui client envs` | List configured environments |
| `sui client switch --env devnet` | Switch network (do NOT hand-edit client.yaml) |
| `sui client switch --address <ADDRESS>` | Switch active address |
| `sui client new-address ed25519` | Create a new address |
| `sui client addresses` | List local addresses + aliases |
| `sui client balance` | Check SUI balance |
| `sui client gas` | List gas coin objects |

## Getting test tokens (faucet)

Testnet/Devnet tokens are free and have no value.

| Method | How |
|---|---|
| Web faucet | `faucet.sui.io` — enter address, pick network, request |
| CLI (Devnet/Localnet ONLY) | `sui client faucet` |
| TypeScript SDK | `requestSuiFromFaucetV2()` from the `@mysten/sui/faucet` sub-export |
| Discord | `!faucet <ADDRESS>` in `#devnet-faucet` / `#testnet-faucet` |

> **`sui client faucet` works on Devnet and Localnet ONLY — NOT Testnet.** For Testnet tokens use the web faucet at `faucet.sui.io` or another method. NEVER suggest `sui client faucet` for Testnet. Faucets are rate-limited.

## Coin management

"Cannot find gas coin for signer address" or many tiny coins but none big enough for gas → merge with `sui client ptb`:

```bash
# Merge one coin into another
sui client ptb --merge-coins @0xPRIMARY_COIN_ID "[@0xCOIN_TO_MERGE_ID]"
# Merge several at once
sui client ptb --merge-coins @0xPRIMARY_COIN_ID "[@0xCOIN_A, @0xCOIN_B, @0xCOIN_C]"
```

Use `sui client ptb` for all CLI transaction operations — avoid legacy single-purpose helpers (`merge-coin`, `split-coin`, `transfer`) which are less composable and may be deprecated.

## Explorers

Inspect transactions/objects/addresses with SuiVision (`suivision.xyz`) or Suiscan (`suiscan.xyz`). Use `sui replay` to locally re-execute a past transaction for debugging.
