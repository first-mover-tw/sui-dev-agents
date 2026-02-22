import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSuiClient, safeStringify } from "../client.js";

export function registerCoinTools(server: McpServer) {
  server.tool(
    "sui_get_coins",
    "Get coins of a specific type for an address",
    {
      address: z.string().describe("Owner address"),
      coinType: z.string().optional().default("0x2::sui::SUI").describe("Coin type (default: 0x2::sui::SUI)"),
      limit: z.number().optional().default(50).describe("Max results"),
      cursor: z.string().optional().describe("Pagination cursor"),
    },
    async ({ address, coinType, limit, cursor }) => {
      const client = getSuiClient();
      const result = await client.core.getCoins({
        address,
        coinType,
        limit,
        cursor: cursor ?? null,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: safeStringify(
              {
                data: result.objects.map((c) => ({
                  id: c.id,
                  balance: c.balance,
                  version: c.version,
                })),
                cursor: result.cursor,
                hasNextPage: result.hasNextPage,
              },
            ),
          },
        ],
      };
    }
  );
}
