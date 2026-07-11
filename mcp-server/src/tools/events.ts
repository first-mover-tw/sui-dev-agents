import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSuiClient, safeStringify } from "../client.js";

export function registerEventTools(server: McpServer) {
  server.tool(
    "sui_get_events",
    "Get events for a transaction digest",
    {
      digest: z.string().describe("Transaction digest to get events for"),
    },
    async ({ digest }) => {
      const client = getSuiClient();
      const result = await client.core.getTransaction({
        digest,
        include: { events: true },
      });
      // TransactionResult is a discriminated union on success/failure; events live on
      // whichever branch matched.
      const tx = result.$kind === "Transaction" ? result.Transaction : result.FailedTransaction;
      const events = tx.events ?? [];
      return {
        content: [{ type: "text" as const, text: safeStringify({ digest, events }) }],
      };
    }
  );
}
