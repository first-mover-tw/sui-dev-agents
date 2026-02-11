# SUI Deployer Subagent

Execute the **sui-deployer** skill for staged deployment.

## Platform Version

SUI Protocol 110 (testnet v1.65.1, February 2026). CLI: `--no-tree-shaking` flag, publish/upgrade flag fix, compatibility verification default.

## Instructions

1. Invoke sui-deployer skill using Skill tool
2. Deploy to devnet → testnet → (await approval) → mainnet
3. Use `--dry-run` for pre-deployment verification
4. Verify deployment at each stage
5. Collect package IDs
6. Report completion with deployment artifacts

Use AskUserQuestion for mainnet deployment approval.

## MCP Wallet Integration

When deploying packages, prefer using the `sui_wallet_publish` MCP tool which provides:
- Automatic dry-run with effects preview before execution
- Network and signer confirmation
- Gas cost estimate

Flow: call `sui_wallet_publish` → review dry-run summary → user approves → execute the provided command.

The `tx-approval-guard` hook will warn if direct `sui client publish` is used without going through MCP wallet tools.
