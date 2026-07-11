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
      // listBalances is a paginated API — a single page silently truncates addresses
      // holding many coin types. Page through until hasNextPage is false, capped at
      // MAX_PAGES as a runaway-loop guard (surfaced via `truncated: true` if hit).
      const MAX_PAGES = 20;
      const balances: { coinType: string; balance: string }[] = [];
      let cursor: string | null = null;
      let truncated = false;
      for (let page = 0; page < MAX_PAGES; page++) {
        const result = await client.core.listBalances({ owner: address, cursor });
        balances.push(...result.balances);
        if (!result.hasNextPage) {
          cursor = null;
          break;
        }
        cursor = result.cursor;
        if (page === MAX_PAGES - 1) {
          truncated = true;
        }
      }
      return {
        content: [
          {
            type: "text" as const,
            text: safeStringify(
              {
                address,
                coins: balances.map((b) => ({
                  type: b.coinType,
                  balance: b.balance,
                })),
                ...(truncated ? { truncated: true } : {}),
              },
            ),
          },
        ],
      };
    }
  );
}
