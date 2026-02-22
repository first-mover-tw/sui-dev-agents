import { z } from "zod";
import { toBase64 } from "@mysten/sui/utils";
import { execFileSync } from "node:child_process";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transaction } from "@mysten/sui/transactions";
import { getSuiClient, getJsonRpcClient, getNetwork, getActiveAddress, getActiveKeypair, safeStringify } from "../client.js";

async function buildAndDryRun(tx: Transaction, sender: string) {
  // JSON-RPC fallback: gRPC does not support transaction resolution or dryRun
  const rpcClient = getJsonRpcClient();
  tx.setSenderIfNotSet(sender);
  const txBytes = await tx.build({ client: rpcClient });
  const dryRun = await rpcClient.dryRunTransactionBlock({
    transactionBlock: toBase64(txBytes),
  });
  return { txBytes, dryRun };
}

async function signAndExecute(tx: Transaction, sender: string) {
  const keypair = getActiveKeypair();
  if (!keypair) throw new Error("Cannot load keypair for active address");
  // Build via JSON-RPC (transaction resolution), execute via gRPC
  const rpcClient = getJsonRpcClient();
  const grpcClient = getSuiClient();
  tx.setSenderIfNotSet(sender);
  const txBytes = await tx.build({ client: rpcClient });
  const { signature } = await keypair.signTransaction(txBytes);
  return grpcClient.core.executeTransaction({ transaction: txBytes, signatures: [signature] });
}

export function registerWalletTools(server: McpServer) {
  server.tool(
    "sui_wallet_status",
    "Show active wallet address, network, and SUI balance",
    {},
    async () => {
      const address = getActiveAddress();
      if (!address) {
        return {
          content: [{ type: "text" as const, text: "Error: No active SUI wallet. Run `sui client active-address` to check." }],
          isError: true,
        };
      }
      const client = getSuiClient();
      const result = await client.core.getBalance({ address, coinType: "0x2::sui::SUI" });
      const bal = result.balance.balance;
      return {
        content: [
          {
            type: "text" as const,
            text: safeStringify({
                address,
                network: getNetwork(),
                sui_balance: `${(Number(bal) / 1e9).toFixed(4)} SUI`,
                raw_balance: bal,
              }),
          },
        ],
      };
    }
  );

  server.tool(
    "sui_wallet_transfer",
    "Transfer SUI to a recipient. Returns a dry-run summary for user confirmation — does NOT auto-execute.",
    {
      recipient: z.string().describe("Recipient SUI address"),
      amount: z.number().describe("Amount in SUI (e.g. 1.5)"),
      execute: z.boolean().optional().default(false).describe("Set true to execute after approval (default: dry-run only)"),
    },
    async ({ recipient, amount, execute }) => {
      const address = getActiveAddress();
      if (!address) {
        return { content: [{ type: "text" as const, text: "Error: No active wallet" }], isError: true };
      }

      const amountMist = Math.floor(amount * 1e9);
      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [amountMist]);
      tx.transferObjects([coin], recipient);

      if (!execute) {
        try {
          const { dryRun } = await buildAndDryRun(tx, address);
          return {
            content: [{
              type: "text" as const,
              text: safeStringify({
                action: "TRANSFER_SUI", status: "PENDING_APPROVAL",
                network: getNetwork(), from: address, to: recipient,
                amount: `${amount} SUI (${amountMist} MIST)`,
                dry_run: dryRun,
                instruction: "Call this tool again with execute=true to send the transaction.",
              }),
            }],
          };
        } catch (e: any) {
          return { content: [{ type: "text" as const, text: `Dry-run failed: ${e.message}` }], isError: true };
        }
      }

      try {
        const result = await signAndExecute(tx, address);
        return {
          content: [{
            type: "text" as const,
            text: safeStringify({ action: "TRANSFER_SUI", status: "EXECUTED", network: getNetwork(), result }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Execution failed: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "sui_wallet_call",
    "Call a Move function. Returns a dry-run summary for user confirmation — does NOT auto-execute.",
    {
      package_id: z.string().describe("Package ID"),
      module: z.string().describe("Module name"),
      function_name: z.string().describe("Function name"),
      type_args: z.array(z.string()).optional().default([]).describe("Type arguments"),
      args: z.array(z.string()).optional().default([]).describe("Function arguments"),
      gas_budget: z.number().optional().default(50_000_000).describe("Gas budget in MIST"),
      execute: z.boolean().optional().default(false).describe("Set true to execute after approval"),
    },
    async ({ package_id, module, function_name, type_args, args, gas_budget, execute }) => {
      const address = getActiveAddress();
      if (!address) {
        return { content: [{ type: "text" as const, text: "Error: No active wallet" }], isError: true };
      }

      const target = `${package_id}::${module}::${function_name}` as `${string}::${string}::${string}`;
      const tx = new Transaction();
      tx.setGasBudget(gas_budget);
      tx.moveCall({
        target,
        typeArguments: type_args,
        arguments: args.map((a) => a.startsWith("0x") ? tx.object(a) : tx.pure.string(a)),
      });

      if (!execute) {
        try {
          const { dryRun } = await buildAndDryRun(tx, address);
          return {
            content: [{
              type: "text" as const,
              text: safeStringify({
                action: "MOVE_CALL", status: "PENDING_APPROVAL",
                network: getNetwork(), signer: address,
                target: `${package_id}::${module}::${function_name}`,
                type_args, args, gas_budget,
                dry_run: dryRun,
                instruction: "Call this tool again with execute=true to send the transaction.",
              }),
            }],
          };
        } catch (e: any) {
          return { content: [{ type: "text" as const, text: `Dry-run failed: ${e.message}` }], isError: true };
        }
      }

      try {
        const result = await signAndExecute(tx, address);
        return {
          content: [{
            type: "text" as const,
            text: safeStringify({ action: "MOVE_CALL", status: "EXECUTED", network: getNetwork(), result }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Execution failed: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "sui_wallet_publish",
    "Publish a Move package. Build uses CLI, publish uses SDK. Returns dry-run for confirmation.",
    {
      package_path: z.string().describe("Path to Move package directory"),
      gas_budget: z.number().optional().default(200_000_000).describe("Gas budget in MIST"),
      skip_dependency_verification: z.boolean().optional().default(false),
      execute: z.boolean().optional().default(false).describe("Set true to execute after approval"),
    },
    async ({ package_path, gas_budget, skip_dependency_verification, execute }) => {
      const address = getActiveAddress();
      if (!address) {
        return { content: [{ type: "text" as const, text: "Error: No active wallet" }], isError: true };
      }

      const buildArgs = ["move", "build", "--dump-bytecode-as-base64", "--path", package_path];
      if (skip_dependency_verification) buildArgs.push("--skip-dependency-verification");

      let buildOutput: { modules: string[]; dependencies: string[] };
      try {
        const raw = execFileSync("sui", buildArgs, { encoding: "utf-8", timeout: 60_000 }).trim();
        buildOutput = JSON.parse(raw);
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Build failed: ${e.stderr || e.message}` }], isError: true };
      }

      const tx = new Transaction();
      tx.setGasBudget(gas_budget);
      const [upgradeCap] = tx.publish({
        modules: buildOutput.modules,
        dependencies: buildOutput.dependencies,
      });
      tx.transferObjects([upgradeCap], address);

      if (!execute) {
        try {
          const { dryRun } = await buildAndDryRun(tx, address);
          return {
            content: [{
              type: "text" as const,
              text: safeStringify({
                action: "PUBLISH_PACKAGE", status: "PENDING_APPROVAL",
                network: getNetwork(), signer: address, package_path, gas_budget,
                modules_count: buildOutput.modules.length,
                dry_run: dryRun,
                instruction: "Call this tool again with execute=true to publish.",
              }),
            }],
          };
        } catch (e: any) {
          return { content: [{ type: "text" as const, text: `Dry-run failed: ${e.message}` }], isError: true };
        }
      }

      try {
        const result = await signAndExecute(tx, address);
        return {
          content: [{
            type: "text" as const,
            text: safeStringify({ action: "PUBLISH_PACKAGE", status: "EXECUTED", network: getNetwork(), result }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Publish failed: ${e.message}` }], isError: true };
      }
    }
  );
}
