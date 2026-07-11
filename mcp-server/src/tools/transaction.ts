import { z } from "zod";
import { fromBase64 } from "@mysten/sui/utils";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSuiClient, safeStringify } from "../client.js";

export function registerTransactionTools(server: McpServer) {
  server.tool(
    "sui_get_transaction",
    "Get transaction details by digest",
    { digest: z.string().describe("Transaction digest") },
    async ({ digest }) => {
      // TransactionInclude has no "input"/"objectChanges" keys in v2 — closest available
      // fields are transaction (parsed tx data) and effects (which carries changed objects).
      const client = getSuiClient();
      const tx = await client.core.getTransaction({
        digest,
        include: { transaction: true, effects: true, events: true, balanceChanges: true },
      });
      return {
        content: [{ type: "text" as const, text: safeStringify(tx) }],
      };
    }
  );

  server.tool(
    "sui_dry_run",
    "Dry-run a transaction (base64 tx bytes) without executing",
    { txBytes: z.string().describe("Base64-encoded transaction bytes") },
    async ({ txBytes }) => {
      const client = getSuiClient();
      try {
        const result = await client.core.simulateTransaction({
          transaction: fromBase64(txBytes),
          include: { effects: true, events: true },
        });
        return {
          content: [{ type: "text" as const, text: safeStringify(result) }],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Dry-run failed: ${e.message}` }],
          isError: true,
        };
      }
    }
  );
}
