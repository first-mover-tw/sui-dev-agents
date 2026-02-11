import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSuiClient } from "../client.js";

export function registerPackageTools(server: McpServer) {
  server.tool(
    "sui_get_package",
    "Get all modules in a Move package",
    { packageId: z.string().describe("Package object ID") },
    async ({ packageId }) => {
      const client = getSuiClient();
      const { response } = await client.movePackageService.getPackage({ packageId });
      const pkg = response.package;
      const summary = (pkg?.modules ?? []).map((mod) => ({
        module: mod.name,
        structs: mod.datatypes.map((d) => d.name),
        functions: mod.functions.map((f) => f.name),
      }));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ packageId, modules: summary }, null, 2),
          },
        ],
      };
    }
  );
}
