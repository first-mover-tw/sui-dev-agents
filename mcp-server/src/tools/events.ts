import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getJsonRpcClient, safeStringify } from "../client.js";

export function registerEventTools(server: McpServer) {
  server.tool(
    "sui_get_events",
    "Get events for a transaction digest",
    {
      digest: z.string().describe("Transaction digest to get events for"),
    },
    async ({ digest }) => {
      // JSON-RPC fallback: gRPC getTransaction returns incompatible schema
      const client = getJsonRpcClient();
      const tx = await client.getTransactionBlock({
        digest,
        options: { showEvents: true },
      });
      const events = tx.events ?? [];
      return {
        content: [{ type: "text" as const, text: safeStringify({ digest, events }) }],
      };
    }
  );
}
