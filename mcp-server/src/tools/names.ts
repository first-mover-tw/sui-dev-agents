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
      // client.nameService is a raw ts-proto client — payload is under .response, and it
      // throws RpcError (e.g. NOT_FOUND, "name has expired") instead of returning empty/null
      // for unresolved lookups. JSON-RPC never threw for this case, so we normalize back to
      // a non-error "no result" response to preserve the pre-migration contract.
      const client = getSuiClient();

      if (name) {
        try {
          const { response } = await client.nameService.lookupName({ name });
          const resolved = response.record?.targetAddress ?? null;
          return {
            content: [
              { type: "text" as const, text: safeStringify({ name, address: resolved }) },
            ],
          };
        } catch {
          return {
            content: [{ type: "text" as const, text: safeStringify({ name, address: null }) }],
          };
        }
      }

      if (address) {
        try {
          const { response } = await client.nameService.reverseLookupName({ address });
          const names = response.record?.name ? [response.record.name] : [];
          return {
            content: [
              { type: "text" as const, text: safeStringify({ address, names }) },
            ],
          };
        } catch {
          return {
            content: [{ type: "text" as const, text: safeStringify({ address, names: [] }) }],
          };
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
