import { SuiGrpcClient } from "@mysten/sui/grpc";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Secp256r1Keypair } from "@mysten/sui/keypairs/secp256r1";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { parse as parseYaml } from "./yaml.js";

export type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

const NETWORK = (process.env.SUI_NETWORK as SuiNetwork) || "testnet";

const GRPC_URLS: Record<SuiNetwork, string> = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
  localnet: "http://127.0.0.1:9000",
};

const client = new SuiGrpcClient({
  network: NETWORK,
  baseUrl: process.env.SUI_GRPC_URL || GRPC_URLS[NETWORK],
} as any);

export function getSuiClient(): SuiGrpcClient {
  return client;
}

export function getNetwork(): SuiNetwork {
  return NETWORK;
}

const SUI_CONFIG_DIR = join(homedir(), ".sui", "sui_config");

/**
 * Read active address from client.yaml config
 */
export function getActiveAddress(): string | null {
  try {
    const configPath = join(SUI_CONFIG_DIR, "client.yaml");
    const raw = readFileSync(configPath, "utf-8");
    const config = parseYaml(raw);
    return config.active_address ?? null;
  } catch {
    return null;
  }
}

/**
 * Load the keypair for the active address from sui.keystore
 */
export function getActiveKeypair(): Ed25519Keypair | Secp256k1Keypair | Secp256r1Keypair | null {
  try {
    const address = getActiveAddress();
    if (!address) return null;

    const keystorePath = join(SUI_CONFIG_DIR, "sui.keystore");
    const keys: string[] = JSON.parse(readFileSync(keystorePath, "utf-8"));

    for (const encodedKey of keys) {
      let keypair: Ed25519Keypair | Secp256k1Keypair | Secp256r1Keypair;
      try {
        // Try bech32 format first (suiprivkey1...)
        const { scheme, secretKey } = decodeSuiPrivateKey(encodedKey);
        switch (scheme) {
          case "ED25519":
            keypair = Ed25519Keypair.fromSecretKey(secretKey);
            break;
          case "Secp256k1":
            keypair = Secp256k1Keypair.fromSecretKey(secretKey);
            break;
          case "Secp256r1":
            keypair = Secp256r1Keypair.fromSecretKey(secretKey);
            break;
          default:
            continue;
        }
      } catch {
        // Legacy base64 format: flag byte + 32-byte secret key
        try {
          const raw = Buffer.from(encodedKey, "base64");
          const flag = raw[0];
          const secret = raw.subarray(1);
          switch (flag) {
            case 0: keypair = Ed25519Keypair.fromSecretKey(secret); break;
            case 1: keypair = Secp256k1Keypair.fromSecretKey(secret); break;
            case 2: keypair = Secp256r1Keypair.fromSecretKey(secret); break;
            default: continue;
          }
        } catch {
          continue;
        }
      }
      if (keypair.toSuiAddress() === address) {
        return keypair;
      }
    }
    return null;
  } catch {
    return null;
  }
}
