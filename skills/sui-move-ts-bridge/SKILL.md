---
name: sui-move-ts-bridge
description: Use when bridging Move contracts to TypeScript — generating TS types from Move ABI, creating contract API wrappers, subscribing to on-chain events, or building E2E integration tests. Triggers on "generate types from Move", "event listener", "contract ABI", "Move to TypeScript", "subscribe to events", "ABI wrapper", or any Move↔frontend bridging task. This is the CONTRACT-TO-CODE BRIDGE, not project setup (sui-full-stack) or UI/wallet (sui-frontend).
---

# SUI Move ↔ TypeScript Bridge

> **Scope:** This skill covers Move ↔ TypeScript bridging: type generation, event handling, ABI wrappers. For dApp UI setup and wallet integration, use the `sui-frontend` skill. For PTB construction and SDK client patterns, use the `sui-ts-sdk` skill.

Targets: `@mysten/sui` 2.24.0 (^2.16), `@mysten/kiosk` 1.4.0 (^1.2). Tested: 2026-08-16.

**Compatibility notes:** As of `@mysten/kiosk@1.4.0`, `KioskCompatibleClient` is typed as `ClientWithCoreApi`, so the kiosk example below now uses `SuiGrpcClient` like the other examples in this skill. **Public fullnode JSON-RPC is shut off** (permanent deactivation landed 2026-07-31) — use `SuiGrpcClient` or `SuiGraphQLClient` (or your own full node's JSON-RPC).

**Seamlessly integrate Move smart contracts with frontend applications.**

## Overview

This skill bridges Move contracts and frontend code through:
- Automatic TypeScript type generation from Move ABI
- Contract API wrappers for frontend
- Event handling patterns
- Development environment setup (local node + frontend)
- End-to-end integration testing
- Error handling and user feedback

## Quick Start

### 1. Generate Types from Move ABI

```bash
# Build Move package and generate TypeScript types
npx ts-node scripts/generate-types.ts
```

Output: `frontend/src/types/contracts.ts`

### 2. Create API Wrapper

```typescript
// @check:skip
import { MarketplaceAPI } from './api/marketplace';

const api = new MarketplaceAPI(suiClient, packageId);
const txb = api.createListing({ nft_id: '0x...', price: 1000000000n });
```

### 3. Subscribe to Events

```typescript
// @check:skip
useNFTPurchasedEvents((event) => {
  console.log(`NFT ${event.nft_id} sold for ${event.price}`);
});
```

### 4. Start Dev Environment

```bash
./scripts/dev.sh  # Starts local node + deploys + frontend
```

## Integration Patterns

| Pattern | Description |
|---------|-------------|
| **Type Generation** | Auto-generate TS types from Move ABI |
| **API Wrapper** | Type-safe transaction builders |
| **React Hooks** | `useMarketplaceAPI()` for component integration |
| **Event Subscriptions** | WebSocket `subscribeEvent` removed — gRPC stream `client.subscriptionService.subscribeEvents` (≥2.23), indexer / GraphQL, or filter the checkpoint stream |
| **Error Handling** | Map Move abort codes to user messages |

## Move Type to TypeScript Mapping

| Move Type | TypeScript Type |
|-----------|-----------------|
| `u8` | `number` |
| `u64` | `number \| bigint` |
| `u128` | `bigint` |
| `bool` | `boolean` |
| `address` | `string` |
| `vector<u8>` | `Uint8Array` |
| `String` | `string` |
| `ID`, `UID` | `string` |

## Project Structure

```
project/
├── contracts/
│   └── sources/*.move
├── frontend/
│   ├── src/
│   │   ├── api/           # API wrappers
│   │   ├── hooks/         # React hooks
│   │   ├── types/         # Generated types
│   │   └── lib/           # Error handling
│   └── .env.local
└── scripts/
    ├── generate-types.ts
    └── dev.sh
```

## SDK v2 Notes

- SDK v2 uses `client.core.*` namespace for core RPC methods
- ESM-only: SDK v2 requires ESM (`"type": "module"` in `package.json` or `.mts` files)
- Use `coinWithBalance` for non-SUI coin transfers (not just SUI)
- Extend client capabilities with `$extend()` for ecosystem integration:

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { kiosk } from '@mysten/kiosk';

const client = new SuiGrpcClient({
  network: 'mainnet',
  baseUrl: 'https://fullnode.mainnet.sui.io:443',
}).$extend(kiosk());
```

## References

- **[Code Examples](references/examples.md)** - Complete implementation code for all patterns

## Usage

This skill is invoked by `sui-full-stack` after Phase 2 (contracts) and Phase 3 (frontend).

For the latest dApp Kit transaction-building patterns, use the **sui-docs-query** skill (Context7 MCP).

## Common Mistakes

❌ **Manual type definitions instead of generating from Move ABI**
- **Problem:** Types drift from contract, runtime errors in production
- **Fix:** Always run `generate-types.ts` after Move contract changes

❌ **Not handling u64/u128 correctly in TypeScript**
- **Problem:** Number overflow, precision loss for large values
- **Fix:** Use `bigint` for u64/u128, `number | bigint` for safety

❌ **Forgetting to update package ID after redeployment**
- **Problem:** Frontend calls old contract, all transactions fail
- **Fix:** Store package ID in .env, auto-update in deployment script

❌ **Not mapping Move abort codes to user messages**
- **Problem:** Generic "Transaction failed" error, users confused
- **Fix:** Create error code mapping in `lib/errors.ts`

❌ **Expecting per-event subscriptions from the SDK**
- **Problem:** WebSocket `subscribeEvent` is removed in SDK v2 — code waiting for a WS push never fires
- **Fix:** Use the gRPC stream `client.subscriptionService.subscribeEvents(...)` (≥2.23, stable since P130), consume an indexer / GraphQL, or filter the checkpoint stream (`SubscribeCheckpoints`)

❌ **Not testing integration locally**
- **Problem:** Integration bugs discovered after deployment
- **Fix:** Use `dev.sh` to run local node + contracts + frontend together

❌ **Hardcoding transaction arguments**
- **Problem:** Cannot reuse API wrappers, brittle code
- **Fix:** Use typed interfaces for transaction parameters

---

**Bridge Move contracts and modern frontend - type-safe, real-time, production-ready integration!**
