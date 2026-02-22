import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSuiClient, safeStringify } from "../client.js";

export function registerBalanceTools(server: McpServer) {
  server.tool(
    "sui_get_balance",
    "Get all coin balances for an address",
    { address: z.string().describe("SUI address") },
    async ({ address }) => {
      const client = getSuiClient();
      const result = await client.core.getAllBalances({ address });
      return {
        content: [
          {
            type: "text" as const,
            text: safeStringify(
              {
                address,
                coins: result.balances.map((b) => ({
                  type: b.coinType,
                  balance: b.balance,
                })),
              },
            ),
          },
        ],
      };
    }
  );
}
