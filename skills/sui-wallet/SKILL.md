# sui-wallet

Use when performing on-chain transactions (transfer, Move call, publish) through the agent wallet. Triggers on wallet operations, transaction signing, or deployment requests.

## MCP Wallet Tools

The following MCP tools are available via the `sui-dev-mcp` server:

| Tool | Purpose |
|------|---------|
| `sui_wallet_status` | Show active address, network, balance |
| `sui_wallet_transfer` | Transfer SUI (dry-run → approve → execute) |
| `sui_wallet_call` | Call Move function (dry-run → approve → execute) |
| `sui_wallet_publish` | Publish Move package (dry-run → approve → execute) |

## Transaction Flow

All wallet tools follow a **dry-run → approve → execute** flow:

1. **Agent calls MCP tool** → tool runs `sui client ... --dry-run` internally
2. **MCP returns summary** with `status: "PENDING_APPROVAL"` including:
   - Network, signer, gas estimate
   - Effects preview (object changes, balance changes)
   - The CLI command to execute
3. **Agent presents summary to user** for review
4. **User approves** in Claude Code
5. **Agent executes** the command from `execute_args`

## Safety Rules

- **NEVER** execute a transaction without showing the dry-run summary first
- **ALWAYS** confirm the network (testnet vs mainnet) before executing
- **ALWAYS** use MCP wallet tools instead of direct `sui client` CLI when possible
- The `tx-approval-guard` hook will warn if direct CLI signing is attempted

## When to Use This vs dApp Kit

| Scenario | Use This Skill | Use `sui-frontend` Skill |
|----------|---------------|-------------------------|
| Automated deployments | ✅ MCP wallet tools | |
| Testing flows / CI/CD | ✅ Agent-driven transactions | |
| Backend scripts / headless ops | ✅ CLI wallet | |
| Browser wallet signing (React/Vue) | | ✅ dApp Kit |
| User-facing UI with wallet connect | | ✅ dApp Kit |

- **MCP wallet tools** = agent automation (backend, scripts, CI/CD, headless operations)
- **dApp Kit** = user-facing wallet signing in browser (frontend, React/Vue apps)

## Examples

### Check wallet status
```
Use the sui_wallet_status MCP tool.
```

### Transfer SUI
```
Use sui_wallet_transfer with recipient and amount.
Review the dry-run output, then execute the command if user approves.
```

### Publish package
```
Use sui_wallet_publish with the package path.
Review gas cost and effects, then execute if user approves.
```

### Call Move function
```
Use sui_wallet_call with package_id, module, function_name, and args.
Review the effects preview, then execute if user approves.
```
