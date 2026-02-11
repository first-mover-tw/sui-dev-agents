---
name: sui-frontend
description: Use when building SUI frontend applications, integrating wallet connections, constructing transactions in TypeScript/React, or managing blockchain state. Triggers on dApp frontend development, wallet integration, or transaction UI tasks.
---

# SUI Frontend

**Complete frontend development guide for SUI dApps with TypeScript SDK.**

## Overview

This skill provides comprehensive frontend development support for SUI applications:
- Project setup (React/Next.js/Vue/Svelte)
- @mysten/sui SDK integration
- @mysten/dapp-kit React hooks
- Multi-wallet support
- Transaction building and signing
- Event listening and real-time updates
- State management patterns

## SUI SDK & API Updates (v1.65, February 2026)

**Breaking SDK changes:**
- **Package renamed:** `@mysten/sui.js` → `@mysten/sui` (update all imports)
- **Transaction class renamed:** `TransactionBlock` → `Transaction`
- **Hook renamed:** `useSignAndExecuteTransactionBlock` → `useSignAndExecuteTransaction`
- **Import paths:** `@mysten/sui/client`, `@mysten/sui/transactions` (no `.js`)

**Data Access Migration (CRITICAL):**
- **JSON-RPC is deprecated** and will be removed in **April 2026**
- **gRPC is now GA** — primary API for full node interaction (7 services)
- **GraphQL** remains beta, best for frontend/Relay-style queries
- SDK (`@mysten/sui`) handles transport automatically — no code changes for most users
- **`subscribeEvent` via WebSocket** is replaced by gRPC streaming internally
- Direct `fetch()` calls to JSON-RPC endpoints must be migrated
- See [grpc-reference.md](references/grpc-reference.md) for migration guide

**GraphQL API changes (v1.64-v1.65):**
- `Query.node(id: ID!)` for Global Identification Specification (Relay support)
- `effectsJson` / `transactionJson` fields for JSON blob returns
- `MoveValue.extract`, `MoveValue.format`, `MoveValue.asAddress` for value manipulation
- `Balance.totalBalance` now sums owned coins + accumulator objects
  - Use `Balance.coinBalance` for coin-only balance (previous behavior)
  - Use `Balance.addressBalance` for address-specific balance
- SuiNS: `Query.suinsName` → `Query.address(name: ...)`, `defaultSuinsName` → `defaultNameRecord.target`
- Single "rich query" limit enforces database request budgets per GraphQL request
- `DynamicFieldName.literal` for providing dynamic field names as Display v2 literals

**TxContext flexibility:** `TxContext` arguments can now appear in any position in PTBs.

## Quick Start

### Framework Support

**Supported frameworks:**
- ✅ React (Vite) - Recommended for most projects
- ✅ Next.js - For SSR/SSG requirements
- ✅ Vue 3 - Alternative to React
- ✅ Svelte - Lightweight alternative
- ✅ Vanilla TypeScript - For simple projects

### Initialize React Project

```bash
# Create project
npm create vite@latest my-sui-dapp -- --template react-ts

cd my-sui-dapp

# Install SUI dependencies (note: package is @mysten/sui, not @mysten/sui.js)
npm install @mysten/sui @mysten/dapp-kit

# Install state management
npm install @tanstack/react-query zustand

# Install dev dependencies
npm install -D @types/node
```

### Project Structure

```
frontend/
├── src/
│   ├── config/
│   │   ├── sui.ts           # SUI client config
│   │   └── contracts.ts     # Contract addresses
│   ├── api/
│   │   └── marketplace.ts   # Contract API wrappers
│   ├── hooks/
│   │   ├── useMarketplace.ts
│   │   └── useEvents.ts
│   ├── components/
│   │   ├── ConnectWallet.tsx
│   │   └── NFTCard.tsx
│   ├── types/
│   │   └── contracts.ts     # Auto-generated from Move
│   └── main.tsx
└── package.json
```

## Core Features

### 1. Environment Configuration

```typescript
// src/config/sui.ts
// ✅ SuiClient in SDK v1.65+ uses gRPC internally — no manual migration needed
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { createNetworkConfig } from '@mysten/dapp-kit';

const { networkConfig, useNetworkVariable } = createNetworkConfig({
  devnet: {
    url: getFullnodeUrl('devnet'),
    variables: {
      packageId: import.meta.env.VITE_PACKAGE_ID_DEVNET,
    },
  },
  testnet: {
    url: getFullnodeUrl('testnet'),
    variables: {
      packageId: import.meta.env.VITE_PACKAGE_ID_TESTNET,
    },
  },
});

export { networkConfig, useNetworkVariable };

export const suiClient = new SuiClient({
  url: getFullnodeUrl(import.meta.env.VITE_SUI_NETWORK || 'devnet'),
});
```

### 2. Wallet Integration

```typescript
// src/main.tsx
import { WalletProvider } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { networkConfig } from './config/sui';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <WalletProvider networks={networkConfig} defaultNetwork="devnet">
      <App />
    </WalletProvider>
  </QueryClientProvider>
);
```

**Connect Wallet Component:**

```typescript
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';

export function ConnectWallet() {
  const account = useCurrentAccount();

  return (
    <div>
      {account ? (
        <div>
          <span>{account.address.slice(0, 6)}...{account.address.slice(-4)}</span>
          <ConnectButton />
        </div>
      ) : (
        <ConnectButton />
      )}
    </div>
  );
}
```

### 3. Transaction Building

```typescript
// src/api/marketplace.ts
import { Transaction } from '@mysten/sui/transactions';

export class MarketplaceAPI {
  static createListing(params: { nftId: string; price: number | bigint }) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${packageId}::listing::create_listing`,
      arguments: [
        tx.object(params.nftId),
        tx.pure(params.price, 'u64'),
      ],
    });

    return tx;
  }
}
```

### 4. React Hooks for Contract Calls

```typescript
// src/hooks/useMarketplace.ts
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useMutation } from '@tanstack/react-query';

export function useCreateListing() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  return useMutation({
    mutationFn: async (params: { nftId: string; price: number }) => {
      const tx = MarketplaceAPI.createListing(params);
      return await signAndExecute({ transaction: tx });
    },
    onSuccess: () => {
      toast.success('Listing created successfully!');
    },
  });
}
```

### 5. Querying On-Chain Data

```typescript
// src/hooks/useNFT.ts
import { useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';

export function useNFT(nftId: string) {
  const client = useSuiClient();

  return useQuery({
    queryKey: ['nft', nftId],
    queryFn: async () => {
      return await client.getObject({
        id: nftId,
        options: {
          showContent: true,
          showOwner: true,
        },
      });
    },
    enabled: !!nftId,
  });
}
```

### 6. Event Listening

```typescript
// src/hooks/useEvents.ts
import { useEffect, useState } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';

export function useMarketplaceEvents(eventType: string) {
  const client = useSuiClient();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const subscribe = async () => {
      const unsubscribe = await client.subscribeEvent({
        filter: { MoveEventType: `${packageId}::listing::${eventType}` },
        onMessage: (event) => {
          setEvents((prev) => [event, ...prev]);
        },
      });
      return unsubscribe;
    };

    subscribe();
  }, [client, eventType]);

  return events;
}
```

### 7. State Management

```typescript
// src/store/useAppStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  network: 'devnet' | 'testnet' | 'mainnet';
  setNetwork: (network: AppState['network']) => void;
  favorites: string[];
  toggleFavorite: (nftId: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      network: 'devnet',
      setNetwork: (network) => set({ network }),
      favorites: [],
      toggleFavorite: (nftId) =>
        set((state) => ({
          favorites: state.favorites.includes(nftId)
            ? state.favorites.filter((id) => id !== nftId)
            : [...state.favorites, nftId],
        })),
    }),
    { name: 'app-storage' }
  )
);
```

## Best Practices

### Type Safety

```typescript
// Use generated types from Move ABI
import { Listing } from './types/contracts';

function handleListing(listing: Listing) {
  console.log(listing.price);
  console.log(listing.seller);
}
```

### Error Handling

```typescript
// Parse contract errors
export function parseContractError(error: any): string {
  if (error.message?.includes('MoveAbort')) {
    const abortMatch = error.message.match(/code:\s*(\d+)/);
    if (abortMatch) {
      return getErrorMessage(abortMatch[1]);
    }
  }
  return error.message || 'Transaction failed';
}
```

### Performance Optimization

```typescript
// Batch queries
export function useMultipleNFTs(nftIds: string[]) {
  const client = useSuiClient();

  return useQuery({
    queryKey: ['nfts', nftIds],
    queryFn: async () => {
      return await client.multiGetObjects({
        ids: nftIds,
        options: { showContent: true },
      });
    },
  });
}
```

### Security Considerations

```typescript
// ⚠️ NEVER put private keys in frontend
// ❌ BAD
const ADMIN_PRIVATE_KEY = 'suiprivkey1...';

// ✅ GOOD - Use wallet for signing
const { mutate: signTransaction } = useSignAndExecuteTransaction();

// ⚠️ NEVER trust user input
// ✅ GOOD - Validate first
const validatedAmount = validateAmount(userInput);
tx.pure(validatedAmount, 'u64');
```

## Common Mistakes

❌ **Not handling wallet disconnection**
- **Problem:** App crashes when user disconnects wallet mid-session
- **Fix:** Listen to wallet events, clear user state on disconnect

❌ **Passing numbers as transaction arguments**
- **Problem:** Transaction fails with "invalid argument type"
- **Fix:** Use `tx.pure(value, 'u64')` for integers, `tx.pure(value, 'u128')` for large numbers

❌ **Not enabling query options**
- **Problem:** Object returned without content/owner data
- **Fix:** Always specify `options: { showContent: true, showOwner: true }`

❌ **Polling instead of subscribing to events**
- **Problem:** High RPC costs, delayed updates, rate limiting
- **Fix:** Use `client.subscribeEvent()` for real-time updates

❌ **Not handling transaction failures gracefully**
- **Problem:** Generic "Transaction failed" message, users confused
- **Fix:** Parse abort codes, display user-friendly error messages

❌ **Storing sensitive data in localStorage**
- **Problem:** XSS attacks can steal wallet proofs/keys
- **Fix:** Use sessionStorage for sensitive data, encrypt if necessary

❌ **Not batching queries**
- **Problem:** 100 NFTs = 100 RPC calls, slow loading
- **Fix:** Use `multiGetObjects()` to fetch multiple objects in one call

❌ **Hardcoding package IDs**
- **Problem:** Package ID changes between networks
- **Fix:** Use environment variables (VITE_PACKAGE_ID_DEVNET, etc.)

## Integration

### Called By
- `sui-full-stack` (Phase 3: Frontend development)
- `sui-fullstack-integration` (contract-frontend integration)

### Calls
- `sui-docs-query` - Query latest SDK documentation

### Next Step
After frontend complete:
```
✅ Frontend development complete!
Next: Ready for full-stack integration with sui-fullstack-integration?
```

## See Also

- [reference.md](references/reference.md) - Complete SDK API reference, hooks documentation
- [grpc-reference.md](references/grpc-reference.md) - gRPC API reference, JSON-RPC migration guide
- [examples.md](references/examples.md) - Complete component examples, integration patterns

---

**Build modern, type-safe, performant SUI frontends with confidence!**
