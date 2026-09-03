---
name: sui-enoki
description: Use when adding social login (Google/Twitch/Facebook OAuth) or gasless/sponsored transactions to a SUI app via Mysten's Enoki service. Triggers on Enoki, zkLogin-as-a-service, sponsored transaction, gasless transaction, "sign in with Google" on Sui, social login, OAuth wallet, sponsor gas, pay gas for users, sponsored tx API, EnokiClient, registerEnokiWallets, or onboarding users without seed phrases. For self-hosted zkLogin (proving service you run yourself), use sui-zklogin instead. For passkey/WebAuthn auth, use sui-passkey.
---

# SUI Enoki — zkLogin-as-a-Service + Sponsored Transactions

**Hosted OAuth sign-in (no seed phrase) + gasless transactions, via Mysten's Enoki backend.**

## SDK Versions

Targets: `@mysten/enoki` 1.2.20 (^1.0), `@mysten/sui` 2.29.0 (^2.29.0). Tested: 2026-09-03.

**Compatibility notes:** `@mysten/sui` is a peer dependency of `@mysten/enoki` (`workspace:^` → use your app's v2.x `@mysten/sui`). The React entry (`@mysten/enoki/react`) needs `react >= 17` as a peer; the core `EnokiClient`/`EnokiFlow` work without React. Do not mix `@mysten/sui@1.x` and `@2.x` — run `npm ls @mysten/sui` before adding. Enoki is NOT a `$extend()` client plugin; instantiate `new EnokiClient({ apiKey })` or use `registerEnokiWallets(...)` directly. Requires an Enoki API key + app config from the [Enoki Portal](https://portal.enoki.mystenlabs.com).

## What Enoki Does

1. **zkLogin** — users authenticate with an OAuth provider (Google, Twitch, Facebook, …); Enoki runs the proving service and derives a deterministic Sui address. No seed phrase, no key management for the user.
2. **Sponsored transactions** — your app (or backend) pays gas; users transact without holding SUI.
3. **dApp Kit wallet integration** — Enoki wallets register as standard wallets, so existing dApp-Kit `ConnectButton` / `useSignAndExecuteTransaction` flows just work.
4. **Subname management** — create/delete SuiNS subnames under a domain you own.

## Two credentials, two surfaces

| Credential | Where | Used for |
|---|---|---|
| **Public API key** | Frontend (browser) | zkLogin auth + wallet registration (`registerEnokiWallets`) |
| **Private API key** | Backend only — never ship to the client | Sponsored-transaction creation/execution, server-driven flows |

**Gas sponsorship is a backend operation.** `createSponsoredTransaction` / `executeSponsoredTransaction` should run on your server with the **private** key; the browser only builds the transaction *kind* and forwards it (plus the user's signature) to your backend. Don't put the private key — or the sponsorship call — in the browser. (The JWT travels in the `zklogin-jwt` header, the API key in `Authorization: Bearer` — distinct credentials.)

## Path A — dApp Kit wallet registration (recommended for React apps)

`registerEnokiWallets` is the modern, dApp-Kit-native path. Call it once at app setup, alongside your `SuiClient`.

```ts
// @check:skip
import { registerEnokiWallets } from '@mysten/enoki';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });

const { unregister } = registerEnokiWallets({
  apiKey: 'enoki_public_...',        // public key — safe for the browser
  client,                            // required: builds & executes txns
  network: 'mainnet',                // 'mainnet' | 'testnet' | 'devnet', default 'mainnet'
  providers: {
    // providers is an OBJECT keyed by provider, each with its OAuth clientId.
    google:   { clientId: 'GOOGLE_OAUTH_CLIENT_ID', redirectUrl: 'https://app.example.com/auth' },
    twitch:   { clientId: 'TWITCH_OAUTH_CLIENT_ID' },
    facebook: { clientId: 'FACEBOOK_OAUTH_CLIENT_ID' },
  },
});
```

After registration the Enoki wallets appear in dApp Kit's wallet list — use the normal `ConnectButton` and transaction hooks from `@mysten/dapp-kit-react`. See [sui-frontend](../sui-frontend/SKILL.md) for the provider/hooks setup.

> ⚠️ The package README shows `providers: ['google']` (an array) and `useEnokiFlow().login('google')`. Both are **illustrative and out of date** — the real `providers` type is an object (`Record<AuthProvider, { clientId, ... }>`) and `useEnokiFlow()` returns the `EnokiFlow` instance (which has **no** `login` method). Use the object form above.

## Path B — `EnokiClient` primitives (backend / non-dApp-Kit)

For server-side flows or apps not on dApp Kit, drive the hosted endpoints directly with `EnokiClient`. This is the supported low-level surface (see the EnokiClient API table below): `createZkLoginNonce` → redirect to the provider → on callback `getZkLogin({ jwt })` / `createZkLoginZkp` for the proof, and `createSponsoredTransaction` / `executeSponsoredTransaction` for gas sponsorship. You manage the ephemeral keypair yourself with `@mysten/sui/keypairs/ed25519`.

> ⚠️ **`EnokiFlow` and the `@mysten/enoki/react` hooks (`EnokiFlowProvider`, `useEnokiFlow`, `useZkLogin`, `useZkLoginSession`, `useAuthCallback`) are all marked `@deprecated` in `@mysten/enoki@1.2.1`** — their JSDoc says *"use `registerEnokiWallets` instead"*. Do **not** use them for new React integrations; use **Path A** (`registerEnokiWallets` + dApp Kit wallet hooks). They remain only as a legacy migration target.

## EnokiClient API (TS SDK method names)

> Method/param names below are the **TS SDK** (`@mysten/enoki`) surface. If you call the Enoki HTTP API directly, some field names differ — notably the sponsored-tx body field is `transactionBlockKindBytes`, not the SDK's `transactionKindBytes`.

`new EnokiClient({ apiKey, apiUrl?, additionalEpochs? })` — `apiUrl` defaults to `https://api.enoki.mystenlabs.com` (v1). `additionalEpochs` (nonce validity window) is constrained to `0 <= n <= 30`.

> Since `@mysten/enoki@1.2.0`, `EnokiKeypair` extends `ZkLoginSigner` from `@mysten/sui/zklogin`: `getKeyScheme()` returns `'ZkLogin'` (previously the ephemeral key's scheme) and `sign()` throws instead of returning a bare ephemeral signature. `signTransaction` / `signPersonalMessage` / `getPublicKey` are unchanged.

| Method | Purpose |
|---|---|
| `getApp()` | App config (allowed origins, providers, domains) |
| `getZkLogin({ jwt })` | `{ address, publicKey, salt }` for a JWT |
| `getZkLoginAddresses({ jwt })` | All addresses for a JWT across clientIds |
| `createZkLoginNonce({ network?, ephemeralPublicKey })` | Nonce + randomness + maxEpoch for the OAuth request |
| `createZkLoginZkp({ ... })` | The zkLogin proof |
| `createSponsoredTransaction({ network, transactionKindBytes, sender?, allowedAddresses?, allowedMoveCallTargets? })` | Returns `{ bytes, digest }` to sign |
| `executeSponsoredTransaction({ digest, signature })` | Submit the signed sponsored tx |
| `getSubnames` / `createSubname` / `deleteSubname` | SuiNS subname management |

## Sponsored transaction — the two-step flow

Sponsorship is **create → sign → execute**. The frontend builds a transaction **kind** (not a full transaction) and sends it to your backend; the **backend** (private key) creates the sponsored tx, returns the bytes for the user to sign, then executes the signed result. Below is the backend half.

```ts
// @check:skip
// --- BACKEND (private Enoki API key) ---
import { EnokiClient } from '@mysten/enoki';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64, fromBase64 } from '@mysten/sui/utils';

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const enoki = new EnokiClient({ apiKey: process.env.ENOKI_PRIVATE_KEY! }); // backend-only secret

const tx = new Transaction();
// ... add moveCalls; do NOT set gas — Enoki sponsors it ...

// build ONLY the transaction kind (no gas data, no sender-funded gas)
const kindBytes = await tx.build({ client, onlyTransactionKind: true });

const sponsored = await enoki.createSponsoredTransaction({
  network: 'mainnet',
  transactionKindBytes: toBase64(kindBytes),
  sender: userAddress,
  allowedMoveCallTargets: ['0xPKG::module::function'], // optional allowlist
});

// return `sponsored.bytes` to the client; the user signs with their zkLogin/Enoki keypair:
const { signature } = await keypair.signTransaction(fromBase64(sponsored.bytes));

const { digest } = await enoki.executeSponsoredTransaction({
  digest: sponsored.digest,
  signature,
});
```

## Common Mistakes

| Mistake | Reality |
|---|---|
| `providers: ['google']` (array) | Object form: `providers: { google: { clientId } }`. The array form in the README is stale. |
| Expecting `useEnokiFlow().login(...)` | `useEnokiFlow()` returns the `EnokiFlow` instance — drive auth via `createAuthorizationURL` / `handleAuthCallback`. There is **no `createEnokiHandlers` export** either. |
| Passing a full transaction to `createSponsoredTransaction` | Pass a transaction **kind** (`tx.build({ onlyTransactionKind: true })`), not a sender-funded transaction. |
| Setting gas on a sponsored tx | Leave gas unset — Enoki provides the gas payment. |
| Shipping the private API key to the browser | Public key for frontend (restricted by allowlists); private key backend-only. |
| `additionalEpochs > 30` | Clamped range is `0..30`; larger values are rejected. |
| Omitting `client` from `registerEnokiWallets` | A `SuiClient` (or `clients` + `getCurrentNetwork`) is required to build/execute. |
| Using Enoki for a fully self-hosted prover | Enoki *is* the hosted proving service. If you run your own salt/prover, use [sui-zklogin](../sui-zklogin/SKILL.md). |

## When NOT to use Enoki

- You need a self-custodied, self-hosted zkLogin stack (own salt service + prover) → **sui-zklogin**.
- You want device-bound passkey/WebAuthn auth with no OAuth provider → **sui-passkey**.
- You only need gas sponsorship without social login → a plain sponsored-transaction flow with your own gas station also works; Enoki just bundles both.

## References

- Enoki docs: https://docs.enoki.mystenlabs.com
- Enoki Portal (API keys, app config): https://portal.enoki.mystenlabs.com
- Source: `@mysten/enoki` (MystenLabs/ts-sdks `packages/enoki`)
- Related: `@mysten/enoki-connect` (`registerEnokiConnectWallets`, `EnokiConnectWallet`), *experimental* — lets a dApp connect to Enoki-powered wallets via the wallet standard. Register it through dApp Kit; see [sui-wallet](../sui-wallet/SKILL.md).
