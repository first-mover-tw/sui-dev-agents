import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getJsonRpcClient, safeStringify } from "../client.js";

export function registerNameTools(server: McpServer) {
  server.tool(
    "sui_resolve_name",
    "Resolve a SuiNS name to an address, or an address to its default SuiNS name",
    {
      name: z.string().optional().describe("SuiNS name to resolve (e.g. example.sui)"),
      address: z.string().optional().describe("Address to reverse-resolve"),
    },
    async ({ name, address }) => {
      // Use JSON-RPC client — gRPC nameService returns BigInt that breaks MCP SDK serialization
      const client = getJsonRpcClient();

      if (name) {
        try {
          const resolved = await client.resolveNameServiceAddress({ name });
          return {
            content: [
              { type: "text" as const, text: safeStringify({ name, address: resolved ?? null }) },
            ],
          };
        } catch (e: any) {
          return { content: [{ type: "text" as const, text: e.message }], isError: true };
        }
      }

      if (address) {
        try {
          const resolved = await client.resolveNameServiceNames({ address });
          const names = resolved.data ?? [];
          return {
            content: [
              { type: "text" as const, text: safeStringify({ address, names }) },
            ],
          };
        } catch (e: any) {
          return { content: [{ type: "text" as const, text: e.message }], isError: true };
        }
      }

      return {
        content: [
          { type: "text" as const, text: "Error: provide either name or address" },
        ],
        isError: true,
      };
    }
  );
}
