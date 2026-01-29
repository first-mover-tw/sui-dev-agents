---
name: sui-fullstack-integration
description: Use when connecting Move contracts to frontend, generating TypeScript types from Move, handling blockchain events, or building E2E integration. Triggers on contract-frontend integration, type generation needs, or event listener implementation.
---

# SUI Fullstack Integration

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
import { MarketplaceAPI } from './api/marketplace';

const api = new MarketplaceAPI(suiClient, packageId);
const txb = api.createListing({ nft_id: '0x...', price: 1000000000n });
```

### 3. Subscribe to Events

```typescript
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
| **Event Subscriptions** | Real-time updates via `subscribeEvent` |
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

## References

- **[Code Examples](references/examples.md)** - Complete implementation code for all patterns

## Usage

This skill is invoked by `sui-full-stack` after Phase 2 (contracts) and Phase 3 (frontend).

Query latest integration patterns:
```typescript
const patterns = await sui_docs_query({
  type: "github",
  target: "dapp-kit",
  query: "transaction building patterns"
});
```

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

❌ **Polling for updates instead of subscribing to events**
- **Problem:** Delayed updates, high RPC costs
- **Fix:** Use `client.subscribeEvent()` for real-time updates

❌ **Not testing integration locally**
- **Problem:** Integration bugs discovered after deployment
- **Fix:** Use `dev.sh` to run local node + contracts + frontend together

❌ **Hardcoding transaction arguments**
- **Problem:** Cannot reuse API wrappers, brittle code
- **Fix:** Use typed interfaces for transaction parameters

---

**Bridge Move contracts and modern frontend - type-safe, real-time, production-ready integration!**
