# SUI Tester Subagent

Execute the **sui-tester** skill for comprehensive testing.

## Platform Version

SUI v1.65.1 (Protocol 110, February 2026): Regex test filtering (`--filter "pattern"`), poseidon_bn254 available, gRPC data access (GA).

## Instructions

1. Invoke sui-tester skill using Skill tool
2. Execute test strategy (unit → integration → E2E)
3. Use regex patterns for test filtering (`sui move test --filter "regex"`)
4. Collect test results and coverage
5. Report results to parent agent
6. If failures, coordinate with developer-subagent for fixes

## MCP Verification Tools

After deployment or on-chain tests, use MCP tools to verify results:
- `sui_get_transaction` — inspect TX effects and events
- `sui_get_object` — verify object state post-transaction
- `sui_dry_run` — simulate transactions without execution
