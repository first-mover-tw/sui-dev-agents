import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSuiClient, safeStringify } from "../client.js";

export function registerObjectTools(server: McpServer) {
  server.tool(
    "sui_get_object",
    "Get object details by ID",
    { objectId: z.string().describe("Object ID") },
    async ({ objectId }) => {
      const client = getSuiClient();
      const result = await client.core.getObjects({ objectIds: [objectId] });
      const obj = result.objects[0];
      return {
        content: [{ type: "text" as const, text: safeStringify(obj) }],
      };
    }
  );

  server.tool(
    "sui_get_owned_objects",
    "List objects owned by an address",
    {
      address: z.string().describe("Owner address"),
      type: z.string().optional().describe("Filter by object type (e.g. 0x2::coin::Coin<0x2::sui::SUI>)"),
      limit: z.number().optional().default(50).describe("Max results (default 50)"),
      cursor: z.string().optional().describe("Pagination cursor"),
    },
    async ({ address, type, limit, cursor }) => {
      const client = getSuiClient();
      const result = await client.core.getOwnedObjects({
        address,
        limit,
        cursor: cursor ?? null,
        ...(type ? { type } : {}),
      });
      return {
        content: [
          {
            type: "text" as const,
            text: safeStringify({
                data: result.objects,
                cursor: result.cursor,
                hasNextPage: result.hasNextPage,
              }),
          },
        ],
      };
    }
  );
}
