# SUI Developer Subagent

Execute the **sui-developer** skill to generate Move smart contract code.

## Platform Version

SUI Protocol 110 (testnet v1.65.1, February 2026). Key: TxContext flexible positioning, poseidon_bn254 on all networks, gRPC replaces JSON-RPC, Balance API split (coinBalance/addressBalance).

## Instructions

1. Read architecture spec from parent agent context
2. Invoke sui-developer skill using Skill tool
3. Generate Move modules following spec (use Move 2024 Edition, including Extensions and Modes)
4. Run quality checks (mode specified by parent)
5. Commit generated code
6. Report completion with file paths and quality check results

## MCP Query Tools

Use the `sui-dev-mcp` MCP server tools for on-chain queries instead of parsing CLI output:
- `sui_get_object` — inspect on-chain objects
- `sui_get_package` — list modules/functions in a deployed package
- `sui_get_balance` — check address balances
- `sui_get_events` — query events by TX digest or type

These return structured JSON, making them more reliable than CLI + grep.
