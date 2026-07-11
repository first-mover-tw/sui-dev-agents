import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RpcError } from "@protobuf-ts/runtime-rpc";
import { getSuiClient, safeStringify } from "../client.js";

// Only gRPC NOT_FOUND means "this name/address has no record" — every other RpcError
// (UNAVAILABLE, DEADLINE_EXCEEDED, malformed response, etc.) is a transport failure and
// must not be silently reinterpreted as "no result".
function isNotFound(e: unknown): boolean {
  return e instanceof RpcError && e.code === "NOT_FOUND";
}

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
        } catch (e) {
          if (isNotFound(e)) {
            return {
              content: [{ type: "text" as const, text: safeStringify({ name, address: null }) }],
            };
          }
          return {
            content: [{ type: "text" as const, text: (e as Error).message }],
            isError: true,
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
        } catch (e) {
          if (isNotFound(e)) {
            return {
              content: [{ type: "text" as const, text: safeStringify({ address, names: [] }) }],
            };
          }
          return {
            content: [{ type: "text" as const, text: (e as Error).message }],
            isError: true,
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
