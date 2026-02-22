import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSuiClient, getNetwork, safeStringify } from "../client.js";

export function registerNetworkTools(server: McpServer) {
  server.tool(
    "sui_get_latest_checkpoint",
    "Get the latest checkpoint sequence number and details",
    {},
    async () => {
      const client = getSuiClient();
      const { response } = await client.ledgerService.getServiceInfo({});
      return {
        content: [
          {
            type: "text" as const,
            text: safeStringify(
              {
                network: getNetwork(),
                chain: response.chain,
                chainId: response.chainId,
                epoch: response.epoch?.toString(),
                latestCheckpoint: response.checkpointHeight?.toString(),
              },
            ),
          },
        ],
      };
    }
  );
}
