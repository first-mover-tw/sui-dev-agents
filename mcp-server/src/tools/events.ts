import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSuiClient } from "../client.js";

export function registerEventTools(server: McpServer) {
  server.tool(
    "sui_get_events",
    "Get events for a transaction digest",
    {
      digest: z.string().describe("Transaction digest to get events for"),
    },
    async ({ digest }) => {
      const client = getSuiClient();
      // gRPC: get transaction with events included
      const tx = await client.core.getTransaction({ digest });
      const events = (tx as any)?.events ?? [];
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ digest, events }, null, 2) }],
      };
    }
  );
}
