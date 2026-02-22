import { z } from "zod";
import { toBase64, fromBase64 } from "@mysten/sui/utils";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getJsonRpcClient, safeStringify } from "../client.js";

export function registerTransactionTools(server: McpServer) {
  server.tool(
    "sui_get_transaction",
    "Get transaction details by digest",
    { digest: z.string().describe("Transaction digest") },
    async ({ digest }) => {
      // JSON-RPC fallback: gRPC getTransaction returns incompatible schema
      const client = getJsonRpcClient();
      const tx = await client.getTransactionBlock({
        digest,
        options: {
          showInput: true,
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
          showBalanceChanges: true,
        },
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
      // JSON-RPC fallback: gRPC dryRunTransaction not yet supported
      const client = getJsonRpcClient();
      const result = await client.dryRunTransactionBlock({
        transactionBlock: txBytes,
      });
      return {
        content: [{ type: "text" as const, text: safeStringify(result) }],
      };
    }
  );
}
