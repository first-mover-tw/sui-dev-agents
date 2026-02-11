# mcp-status

Check the status of the SUI MCP server and available tools.

## Instructions

1. List all available MCP tools from the `sui-dev-mcp` server
2. Call `sui_get_latest_checkpoint` to verify connectivity
3. Call `sui_wallet_status` to show wallet info
4. Report:
   - MCP server status (connected/disconnected)
   - Network and latest checkpoint
   - Active wallet address and balance
   - Number of available query tools and wallet tools
