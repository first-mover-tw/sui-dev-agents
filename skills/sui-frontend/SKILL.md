---
name: sui-frontend
description: Sui frontend dApp development with @mysten/dapp-kit-react (React) and @mysten/dapp-kit-core (Vue, vanilla JS, other frameworks). Use when building browser apps that connect to Sui wallets, query on-chain data, or execute transactions. Use alongside the sui-ts-sdk skill for PTB construction patterns.
---

# Sui Frontend Skill

This skill covers building browser-based Sui dApps using the dApp Kit SDK. The SDK has two packages:
- `@mysten/dapp-kit-react` — React hooks, DAppKitProvider, and React component wrappers
- `@mysten/dapp-kit-core` — Framework-agnostic core: actions, nanostores state, and Web Components

Both packages expose the same `createDAppKit` factory and identical action APIs. What differs is how you access reactive state and render UI.

For PTB construction details, apply the **sui-ts-sdk** skill alongside this one.

> **Note:** The older `@mysten/dapp-kit` package is deprecated. New projects must use `dapp-kit-react` or `dapp-kit-core`.

## 1. Package Installation

```bash
# React
npm install @mysten/dapp-kit-react @mysten/sui @tanstack/react-query

# Non-React (Vue / Svelte / vanilla JS)
npm install @mysten/dapp-kit-core @mysten/sui
```

## 2. Instance & Provider Setup (React)

`createDAppKit` factory + `DAppKitProvider`. Use `SuiGrpcClient` in `createClient`.

```typescript
// src/dapp-kit.ts
import { createDAppKit, DAppKitProvider } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const dAppKit = createDAppKit({
  networks: {
    devnet: {
      createClient: () => new SuiGrpcClient({ url: 'https://fullnode.devnet.sui.io:443' }),
    },
    testnet: {
      createClient: () => new SuiGrpcClient({ url: 'https://fullnode.testnet.sui.io:443' }),
    },
    mainnet: {
      createClient: () => new SuiGrpcClient({ url: 'https://fullnode.mainnet.sui.io:443' }),
    },
  },
  defaultNetwork: 'devnet',
});

// TypeScript type inference via module augmentation
declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}

export { dAppKit };
```

```typescript
// src/main.tsx
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { dAppKit } from './dapp-kit';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <DAppKitProvider dAppKit={dAppKit}>
      <App />
    </DAppKitProvider>
  </QueryClientProvider>
);
```

## 3. Non-React Integration (Vue / Vanilla JS / Svelte)

`@mysten/dapp-kit-core` with `createDAppKit`. Web Components for connect button/modal. Reactive state via nanostores.

```typescript
import { createDAppKit } from '@mysten/dapp-kit-core';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const dAppKit = createDAppKit({
  networks: {
    mainnet: {
      createClient: () => new SuiGrpcClient({ url: 'https://fullnode.mainnet.sui.io:443' }),
    },
  },
  defaultNetwork: 'mainnet',
});

// Web Components — auto-registered <sui-connect-button>, <sui-connect-modal>
import '@mysten/dapp-kit-core/web-components';

// Reactive state via nanostores
const currentAccount = dAppKit.stores.currentAccount;
currentAccount.subscribe((account) => {
  console.log('Account changed:', account?.address);
});

// Actions — same API as React hooks
const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
```

## 4. Wallet Connection

```typescript
import { ConnectButton, useWallets, useDAppKit } from '@mysten/dapp-kit-react';

// Simple — built-in ConnectButton
function WalletConnect() {
  return <ConnectButton />;
}

// Custom — list wallets and connect manually
function CustomConnect() {
  const wallets = useWallets();
  const dAppKit = useDAppKit();

  return (
    <ul>
      {wallets.map((wallet) => (
        <li key={wallet.name}>
          <button onClick={() => dAppKit.connect(wallet)}>
            {wallet.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

### Connection Status

```typescript
import { useWalletConnection } from '@mysten/dapp-kit-react';

function ConnectionStatus() {
  const { status } = useWalletConnection(); // 'disconnected' | 'connecting' | 'connected'
  return <span>Status: {status}</span>;
}
```

## 5. Current Account & Wallet

```typescript
import { useCurrentAccount, useCurrentWallet } from '@mysten/dapp-kit-react';

function AccountInfo() {
  const account = useCurrentAccount();
  const wallet = useCurrentWallet();

  if (!account) return <p>Connect a wallet</p>;

  return (
    <div>
      <p>Address: {account.address}</p>
      <p>Wallet: {wallet?.name}</p>
    </div>
  );
}
```

## 6. Accessing the Raw Client

`useCurrentClient` returns the `SuiClient` for the active network.

```typescript
import { useCurrentClient } from '@mysten/dapp-kit-react';

function MyComponent() {
  const client = useCurrentClient();
  // client.core.getObject(...), client.core.getCoins(...), etc.
}
```

## 7. Querying On-Chain Data

No `useSuiClientQuery`. Use `useCurrentClient` + `useQuery` from `@tanstack/react-query`.

```typescript
import { useCurrentClient, useCurrentAccount } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';

function useOwnedObjects() {
  const client = useCurrentClient();
  const account = useCurrentAccount();

  return useQuery({
    queryKey: ['ownedObjects', account?.address],
    queryFn: () =>
      client.core.getOwnedObjects({
        owner: account!.address,
        include: { content: true },
      }),
    enabled: !!account,
  });
}
```

## 8. Paginated Queries

`useInfiniteQuery` from react-query + `useCurrentClient`.

```typescript
import { useCurrentClient, useCurrentAccount } from '@mysten/dapp-kit-react';
import { useInfiniteQuery } from '@tanstack/react-query';

function usePaginatedCoins() {
  const client = useCurrentClient();
  const account = useCurrentAccount();

  return useInfiniteQuery({
    queryKey: ['coins', account?.address],
    queryFn: ({ pageParam }) =>
      client.core.getCoins({
        owner: account!.address,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!account,
  });
}
```

## 9. Signing and Executing Transactions

`useDAppKit().signAndExecuteTransaction()` — async function, NOT a mutation hook.
Result is a discriminated union: `result.Transaction.digest` or `result.FailedTransaction`.

```typescript
import { useDAppKit } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';
import { useState } from 'react';

function MintButton({ packageId }: { packageId: string }) {
  const dAppKit = useDAppKit();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMint() {
    setIsPending(true);
    setError(null);
    try {
      const tx = new Transaction();
      tx.moveCall({ target: `${packageId}::nft::mint` });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

      if ('Transaction' in result) {
        console.log('Success:', result.Transaction.digest);
      } else {
        console.error('Failed:', result.FailedTransaction);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button onClick={handleMint} disabled={isPending}>
      {isPending ? 'Minting...' : 'Mint NFT'}
    </button>
  );
}
```

## 10. Signing Without Executing

For sponsored transaction flows:

```typescript
const dAppKit = useDAppKit();

const { bytes, signature } = await dAppKit.signTransaction({ transaction: tx });
// Send bytes + signature to sponsor backend
```

## 11. Personal Message Signing

```typescript
const dAppKit = useDAppKit();

const { signature } = await dAppKit.signPersonalMessage({
  message: new TextEncoder().encode('Hello Sui'),
});
```

## 12. Network Switching

```typescript
import { useCurrentNetwork, useDAppKit } from '@mysten/dapp-kit-react';

function NetworkSwitcher() {
  const network = useCurrentNetwork();
  const dAppKit = useDAppKit();

  return (
    <select value={network} onChange={(e) => dAppKit.switchNetwork(e.target.value)}>
      <option value="devnet">Devnet</option>
      <option value="testnet">Testnet</option>
      <option value="mainnet">Mainnet</option>
    </select>
  );
}
```

## 13. Cache Invalidation After Transactions

`waitForTransaction` before `invalidateQueries`.

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';

function useExecuteAndRefresh() {
  const dAppKit = useDAppKit();
  const client = useCurrentClient();
  const queryClient = useQueryClient();

  return async (tx: Transaction) => {
    const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

    if ('Transaction' in result) {
      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      await queryClient.invalidateQueries();
    }

    return result;
  };
}
```

## 14. Wallet-Gated UI

```typescript
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react';

function ProtectedPage() {
  const account = useCurrentAccount();

  if (!account) {
    return (
      <div>
        <p>Please connect your wallet to continue</p>
        <ConnectButton />
      </div>
    );
  }

  return <Dashboard address={account.address} />;
}
```

## 15. What dApp Kit is NOT

| Mistake | Correct Approach |
|---------|-----------------|
| `useSuiClientQuery('getObject', ...)` | `useCurrentClient()` + `useQuery()` from react-query |
| `useSuiClient()` | `useCurrentClient()` |
| `useSignAndExecuteTransaction()` as mutation hook | `useDAppKit().signAndExecuteTransaction()` — async fn |
| `result.digest` | `result.Transaction.digest` / `result.FailedTransaction` |
| `import { ... } from '@mysten/dapp-kit'` | `from '@mysten/dapp-kit-react'` or `'@mysten/dapp-kit-core'` |
| Three-provider wrap (`SuiClientProvider`, `WalletProvider`, `QueryClientProvider`) | `createDAppKit()` + `DAppKitProvider` (+ `QueryClientProvider`) |
| `new SuiClient({ url })` | `new SuiGrpcClient({ url })` |
| `options: { showContent: true }` | `include: { content: true }` |
| `client.getObject(...)` | `client.core.getObject(...)` |

## Common Mistakes

❌ **Using deprecated `@mysten/dapp-kit`**
- **Problem:** Old package, will stop receiving updates
- **Fix:** Migrate to `@mysten/dapp-kit-react` (React) or `@mysten/dapp-kit-core` (other frameworks)

❌ **Using `useSuiClientQuery` / `useSuiClientMutation`**
- **Problem:** These hooks are removed in dApp Kit v2
- **Fix:** Use `useCurrentClient()` + `useQuery()` / `useInfiniteQuery()` from `@tanstack/react-query`

❌ **Using `useSignAndExecuteTransaction` as a mutation hook**
- **Problem:** v2 removed mutation-style hooks; this pattern no longer works
- **Fix:** Use `useDAppKit().signAndExecuteTransaction()` (async function), manage `isPending`/`error` with `useState`

❌ **Accessing `result.digest` directly**
- **Problem:** v2 returns a discriminated union, not a flat object
- **Fix:** Check `'Transaction' in result` then access `result.Transaction.digest`, or handle `result.FailedTransaction`

❌ **Using `SuiClient` from `@mysten/sui/client`**
- **Problem:** `SuiClient` is removed in SDK v2; `@mysten/sui/client` no longer exists
- **Fix:** Use `SuiGrpcClient` from `@mysten/sui/grpc`

❌ **Using `options: { showContent: true }`**
- **Problem:** `options` parameter renamed in v2
- **Fix:** Use `include: { content: true }` instead

❌ **Calling `client.getObject(...)` directly**
- **Problem:** Methods moved under `.core` namespace in v2
- **Fix:** Use `client.core.getObject(...)`, `client.core.getCoins(...)`, etc.

❌ **Not handling wallet disconnection**
- **Problem:** App crashes when user disconnects wallet mid-session
- **Fix:** Use `useWalletConnection()` for connection status, null-check `useCurrentAccount()`

❌ **Hardcoding package IDs**
- **Problem:** Package ID changes between networks
- **Fix:** Use environment variables or network-specific config in `createDAppKit`

## Integration

### Called By
- `sui-full-stack` (Phase 3: Frontend development)
- `sui-fullstack-integration` (contract-frontend integration)

### Calls
- `sui-ts-sdk` - PTB construction patterns
- `sui-docs-query` - Query latest SDK documentation

### Next Step
After frontend complete:
```
✅ Frontend development complete!
Next: Ready for full-stack integration with sui-fullstack-integration?
```

## See Also

- [reference.md](references/reference.md) - Complete SDK API reference, hooks documentation
- [grpc-reference.md](references/grpc-reference.md) - gRPC API reference, migration guide
- [examples.md](references/examples.md) - Complete component examples, integration patterns
