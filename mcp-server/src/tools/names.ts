import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSuiClient, safeStringify } from "../client.js";

export function registerNameTools(server: McpServer) {
  server.tool(
    "sui_resolve_name",
    "Resolve a SuiNS name to an address, or an address to its default SuiNS name",
    {
      name: z.string().optional().describe("SuiNS name to resolve (e.g. example.sui)"),
      address: z.string().optional().describe("Address to reverse-resolve"),
    },
    async ({ name, address }) => {
      const client = getSuiClient();

      if (name) {
        try {
          const resolved = await client.nameService.lookupName({ name });
          return {
            content: [
              { type: "text" as const, text: safeStringify({ name, result: resolved.response }) },
            ],
          };
        } catch (e: any) {
          const msg = e.code === "NOT_FOUND" ? `No address found for name "${name}"` : e.message;
          return { content: [{ type: "text" as const, text: msg }], isError: true };
        }
      }

      if (address) {
        try {
          const resolved = await client.nameService.reverseLookupName({ address });
          return {
            content: [
              { type: "text" as const, text: safeStringify({ address, result: resolved.response }) },
            ],
          };
        } catch (e: any) {
          const msg = e.code === "NOT_FOUND" ? `No SuiNS name found for address ${address}` : e.message;
          return { content: [{ type: "text" as const, text: msg }], isError: true };
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
