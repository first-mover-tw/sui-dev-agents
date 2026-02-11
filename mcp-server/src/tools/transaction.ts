import { z } from "zod";
import { fromBase64 } from "@mysten/sui/utils";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSuiClient } from "../client.js";

export function registerTransactionTools(server: McpServer) {
  server.tool(
    "sui_get_transaction",
    "Get transaction details by digest",
    { digest: z.string().describe("Transaction digest") },
    async ({ digest }) => {
      const client = getSuiClient();
      const tx = await client.core.getTransaction({ digest });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(tx, null, 2) }],
      };
    }
  );

  server.tool(
    "sui_dry_run",
    "Dry-run a transaction (base64 tx bytes) without executing",
    { txBytes: z.string().describe("Base64-encoded transaction bytes") },
    async ({ txBytes }) => {
      const client = getSuiClient();
      const result = await client.core.dryRunTransaction({
        transaction: fromBase64(txBytes),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
