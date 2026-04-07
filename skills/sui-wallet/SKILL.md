---
name: sui-wallet
description: Use when performing on-chain transactions (transfer, Move call, publish) through the agent's CLI wallet via MCP tools. Triggers on "transfer SUI", "call Move function", "publish package", "wallet status", "sign transaction", or any agent-driven on-chain operation. This is for headless/backend wallet operations — for browser wallet UI (React/Vue), use sui-frontend instead.
---

# sui-wallet

## MCP Wallet Tools

Available via the `sui-dev-mcp` server:

| Tool | Purpose |
|------|---------|
| `sui_wallet_status` | Show active address, network, balance |
| `sui_wallet_transfer` | Transfer SUI (dry-run → approve → execute) |
| `sui_wallet_call` | Call Move function (dry-run → approve → execute) |
| `sui_wallet_publish` | Publish Move package (dry-run → approve → execute) |

## Transaction Flow

All tools follow **dry-run → approve → execute**:

1. Agent calls MCP tool → runs `sui client ... --dry-run` internally
2. MCP returns summary (`status: "PENDING_APPROVAL"`) with network, signer, gas estimate, effects preview, and the CLI command
3. Agent presents summary to user for review
4. User approves → agent executes the command from `execute_args`

## Safety Rules

- **NEVER** execute without showing dry-run summary first
- **ALWAYS** confirm network (testnet vs mainnet) before executing
- **ALWAYS** prefer MCP wallet tools over direct `sui client` CLI
- The `tx-approval-guard` hook warns on direct CLI signing attempts

## When to Use This vs dApp Kit

- **This skill (MCP wallet)** → agent automation, backend scripts, CI/CD, headless ops
- **sui-frontend (dApp Kit)** → browser wallet signing, user-facing UI with wallet connect
