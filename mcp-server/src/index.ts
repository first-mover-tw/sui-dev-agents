import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerBalanceTools } from "./tools/balance.js";
import { registerObjectTools } from "./tools/object.js";
import { registerTransactionTools } from "./tools/transaction.js";
import { registerEventTools } from "./tools/events.js";
import { registerCoinTools } from "./tools/coins.js";
import { registerNetworkTools } from "./tools/network.js";
import { registerNameTools } from "./tools/names.js";
import { registerPackageTools } from "./tools/package.js";
import { registerWalletTools } from "./tools/wallet.js";

const server = new McpServer({
  name: "sui-dev-mcp",
  version: "1.0.0",
});

// Query tools
registerBalanceTools(server);
registerObjectTools(server);
registerTransactionTools(server);
registerEventTools(server);
registerCoinTools(server);
registerNetworkTools(server);
registerNameTools(server);
registerPackageTools(server);

// Wallet tools
registerWalletTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
