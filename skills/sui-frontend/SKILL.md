---
name: sui-frontend
description: Sui frontend dApp development with @mysten/dapp-kit-react (React) and @mysten/dapp-kit-core (Vue, vanilla JS, other frameworks). Use when building browser apps that connect to Sui wallets, query on-chain data, or execute transactions. Use alongside the sui-ts-sdk skill for PTB construction patterns.
---

# Sui Frontend Skill

This skill covers building browser-based Sui dApps using the dApp Kit SDK. The SDK has two packages:

- **`@mysten/dapp-kit-react`** — React hooks, `DAppKitProvider`, and React component wrappers
- **`@mysten/dapp-kit-core`** — Framework-agnostic core: actions, nanostores state, and Web Components for Vue, vanilla JS, Svelte, or any other framework

Both packages expose the same `createDAppKit` factory and identical action APIs (`signAndExecuteTransaction`, `signTransaction`, `signPersonalMessage`, etc.). What differs is how you access reactive state and render UI: React uses hooks and provider components; other frameworks use nanostores stores and Web Components.

For PTB construction details (splitCoins, moveCall, coinWithBalance, etc.), apply the **sui-ts-sdk** skill alongside this one — the `Transaction` API is identical in browser and Node contexts.

> **Note**: The older `@mysten/dapp-kit` package is deprecated (JSON-RPC only, no gRPC/GraphQL support). New projects must use `@mysten/dapp-kit-react` or `@mysten/dapp-kit-core`.

---

## 1. Package Installation

**React:**
```bash
npm install @mysten/dapp-kit-react @mysten/sui
# Add React Query for declarative on-chain data fetching (recommended)
npm install @tanstack/react-query
```

**Vue / vanilla JS / other frameworks:**
```bash
npm install @mysten/dapp-kit-core @mysten/sui
# For Vue reactive bindings:
npm install @nanostores/vue
```

| Package | Purpose |
|---------|---------|
| `@mysten/dapp-kit-react` | React hooks, `DAppKitProvider`, React component wrappers |
| `@mysten/dapp-kit-core` | Framework-agnostic actions, stores, Web Components |
| `@mysten/sui` | Sui TypeScript SDK (Transaction class, gRPC client) |
| `@tanstack/react-query` | Declarative on-chain data fetching (React only) |
| `@nanostores/vue` | Reactive store bindings for Vue |

---

## 2. Instance & Provider Setup (React)

> **Not using React?** Skip to the [Non-React Integration](#non-react-integration-vue--vanilla-js--svelte) section below.

The new dApp Kit uses a single `createDAppKit` factory instead of three nested providers. Create the instance once in a dedicated file, then wrap your app with `DAppKitProvider`:

```tsx
// dapp-kit.ts
import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const GRPC_URLS: Record<string, string> = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
};

export const dAppKit = createDAppKit({
  networks: ['testnet', 'mainnet'],
  defaultNetwork: 'testnet',
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
});

// Register the instance type for TypeScript inference in hooks
declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
```

```tsx
// App.tsx
import { DAppKitProvider, ConnectButton } from '@mysten/dapp-kit-react';
import { dAppKit } from './dapp-kit';

export default function App() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <ConnectButton />
      <YourApp />
    </DAppKitProvider>
  );
}
```

The `declare module` augmentation is what makes `useDAppKit()` and other hooks return properly typed values without passing the instance explicitly.

---

## 3. Network & Client Configuration

`createDAppKit` accepts these key options:

```tsx
createDAppKit({
  networks: ['testnet', 'mainnet'],       // which networks your app supports
  defaultNetwork: 'testnet',              // starting network
  createClient: (network) =>              // called once per network
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
  autoConnect: true,                      // default: true — restores last wallet on reload
});
```

**Use `SuiGrpcClient` here** — unlike the deprecated `@mysten/dapp-kit`, the new package is built for gRPC. Do not pass `SuiJsonRpcClient` to `createClient`.

```tsx
// wrong client type — belongs to the deprecated @mysten/dapp-kit era
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
createClient: (network) => new SuiJsonRpcClient({ ... })

// correct
import { SuiGrpcClient } from '@mysten/sui/grpc';
createClient: (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] })
```

---

## Non-React Integration (Vue / Vanilla JS / Svelte)

Use `@mysten/dapp-kit-core` when not building with React. The `createDAppKit` call is identical — only the import path differs:

```ts
// dapp-kit.ts
import { createDAppKit } from '@mysten/dapp-kit-core';  // core, not -react
import { SuiGrpcClient } from '@mysten/sui/grpc';

const GRPC_URLS: Record<string, string> = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
};

export const dAppKit = createDAppKit({
  networks: ['testnet', 'mainnet'],
  defaultNetwork: 'testnet',
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
});
```

No `declare module` augmentation needed — that's React-only.

All actions on the instance work identically to the React sections below: `signAndExecuteTransaction`, `signTransaction`, `signPersonalMessage`, `connectWallet`, `disconnectWallet`, `switchNetwork`, `switchAccount`.

### Web Components

Register the web components once at your app entry point, then use them in any HTML or template:

```ts
// main.ts (app entry point)
import '@mysten/dapp-kit-core/web';
```

**Connect Button** — set `instance` as a DOM property (not an HTML attribute):

```html
<mysten-dapp-kit-connect-button></mysten-dapp-kit-connect-button>

<script type="module">
  import { dAppKit } from './dapp-kit.js';
  document.querySelector('mysten-dapp-kit-connect-button').instance = dAppKit;
</script>
```

In Vue templates use property binding:

```vue
<mysten-dapp-kit-connect-button :instance="dAppKit" />
```

**Connect Modal** — for custom triggers (menu items, keyboard shortcuts, programmatic open):

```html
<mysten-dapp-kit-connect-modal></mysten-dapp-kit-connect-modal>

<script type="module">
  const modal = document.querySelector('mysten-dapp-kit-connect-modal');
  modal.instance = dAppKit;
  document.getElementById('open-btn').addEventListener('click', () => modal.show());
</script>
```

Modal events: `open`, `opened`, `close`, `closed`, `cancel`.

### Reactive State (nanostores)

State is exposed as [nanostores](https://github.com/nanostores/nanostores) stores on `dAppKit.stores`:

| Store | Type | Description |
|-------|------|-------------|
| `$connection` | `{ wallet, account, status, isConnected, isConnecting, isReconnecting, isDisconnected }` | Full connection state |
| `$currentNetwork` | `string` | Active network name |
| `$currentClient` | `SuiClient` | Client for the active network |
| `$wallets` | `UiWallet[]` | Detected wallets |

**Vanilla JS** — subscribe for reactive updates:

```ts
// Read current value synchronously
const connection = dAppKit.stores.$connection.get();

// Subscribe (returns an unsubscribe function — always clean up)
const unsubscribe = dAppKit.stores.$connection.subscribe((conn) => {
  const el = document.getElementById('status');
  if (!el) return;
  if (conn.isConnected && conn.account) {
    el.textContent = `${conn.wallet?.name}: ${conn.account.address}`;
  } else {
    el.textContent = 'Not connected';
  }
});

// Unsubscribe when the view is destroyed
unsubscribe();
```

**Vue** — use `@nanostores/vue` for reactive template bindings:

```vue
<script setup lang="ts">
import { useStore } from '@nanostores/vue';
import { Transaction } from '@mysten/sui/transactions';
import { dAppKit } from './dapp-kit';

const connection = useStore(dAppKit.stores.$connection);
const network = useStore(dAppKit.stores.$currentNetwork);

async function handleTransfer() {
  if (!connection.value.account) return;

  const tx = new Transaction();
  // ... build PTB ...
  const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

  if (result.FailedTransaction) {
    throw new Error(result.FailedTransaction.status.error?.message ?? 'Transaction failed');
  }
  console.log('Digest:', result.Transaction.digest);
}
</script>

<template>
  <mysten-dapp-kit-connect-button :instance="dAppKit" />
  <div v-if="connection.account">
    <p>Wallet: {{ connection.wallet?.name }}</p>
    <p>Address: {{ connection.account.address }}</p>
    <p>Network: {{ network }}</p>
    <button @click="handleTransfer">Send Transaction</button>
  </div>
  <p v-else>Connect your wallet to get started</p>
</template>
```

### On-chain queries (non-React)

Outside React there's no `useCurrentClient` hook. Use the store or `getClient()` directly:

```ts
const client = dAppKit.stores.$currentClient.get();
// or equivalently:
const client = dAppKit.getClient();           // current network's client
const mainnetClient = dAppKit.getClient('mainnet'); // specific network

const connection = dAppKit.stores.$connection.get();
if (!connection.account) throw new Error('Wallet not connected');

const balance = await client.getBalance({
  owner: connection.account.address,
  coinType: '0x2::sui::SUI',
});
```

---

## 4. Wallet Connection

### ConnectButton

The simplest approach — renders a "Connect Wallet" button that opens a wallet selection modal:

```tsx
import { ConnectButton } from '@mysten/dapp-kit-react';

function Header() {
  return (
    <header>
      <ConnectButton />
    </header>
  );
}
```

`ConnectButton` auto-connects on page load by default (controlled by `autoConnect` in `createDAppKit`). Wallet detection happens in the browser — the component must be client-side rendered.

You can filter or sort the wallet list:

```tsx
<ConnectButton
  modalOptions={{
    filterFn: (wallet) => wallet.name !== 'ExcludedWallet',
    sortFn: (a, b) => a.name.localeCompare(b.name),
  }}
/>
```

### Custom connection UI

Use `useWallets` to list wallets and `useDAppKit` for the connect/disconnect actions:

```tsx
import { useWallets, useDAppKit } from '@mysten/dapp-kit-react';

function WalletMenu() {
  const wallets = useWallets();
  const dAppKit = useDAppKit();

  return (
    <div>
      {wallets.map((wallet) => (
        <button
          key={wallet.name}
          onClick={() => dAppKit.connectWallet({ wallet })}
        >
          {wallet.name}
        </button>
      ))}
      <button onClick={() => dAppKit.disconnectWallet()}>Disconnect</button>
    </div>
  );
}
```

### Connection status

`useWalletConnection` provides the full connection state:

```tsx
import { useWalletConnection } from '@mysten/dapp-kit-react';

function ConnectionStatus() {
  const { status, wallet, account } = useWalletConnection();
  // status: 'disconnected' | 'connecting' | 'reconnecting' | 'connected'

  if (status === 'connecting' || status === 'reconnecting') return <p>Connecting...</p>;
  if (status === 'connected') return <p>Connected: {wallet?.name}</p>;
  return <p>Disconnected</p>;
}
```

---

## 5. Current Account & Wallet

`useCurrentAccount` gives you the connected address; `useCurrentWallet` gives you the wallet object (name, icon, accounts list):

```tsx
import { useCurrentAccount, useCurrentWallet } from '@mysten/dapp-kit-react';

function Profile() {
  const account = useCurrentAccount();
  const wallet = useCurrentWallet();

  if (!account) {
    return <p>No wallet connected</p>;
  }

  return (
    <div>
      <p>Wallet: {wallet?.name}</p>
      <p>Address: {account.address}</p>
      <p>Label: {account.label}</p>
    </div>
  );
}
```

Both return `null` when no wallet is connected. Always null-check before accessing their properties.

- `useCurrentAccount()` -> `UiWalletAccount | null` — provides `address`, `label`
- `useCurrentWallet()` -> `UiWallet | null` — provides `name`, `icon`, `accounts`

---

## 6. Accessing the Raw Client

`useCurrentClient` returns the `SuiClient` for the active network:

```tsx
import { useCurrentClient } from '@mysten/dapp-kit-react';

function SomeComponent() {
  const client = useCurrentClient();

  const handleSuccess = async (digest: string) => {
    // Wait for indexing before follow-up reads (see sui-ts-sdk section 11)
    await client.waitForTransaction({ digest });
    // All SuiGrpcClient methods are available
  };
}
```

Do not instantiate `new SuiGrpcClient(...)` inside components — use `useCurrentClient` so it stays in sync with the active network.

---

## 7. Signing and Executing Transactions

Use `useDAppKit` and call `signAndExecuteTransaction`. Build the `Transaction` using **sui-ts-sdk** PTB patterns:

```tsx
import { useDAppKit, useCurrentClient, useCurrentAccount } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';
import { useState } from 'react';

function ActionButton() {
  const dAppKit = useDAppKit();
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const [isPending, setIsPending] = useState(false);

  const handleAction = async () => {
    if (!account) return;
    setIsPending(true);
    try {
      const tx = new Transaction();
      // ... build PTB ...

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.FailedTransaction) {
        throw new Error(result.FailedTransaction.status.error?.message ?? 'Transaction failed');
      }
      await client.waitForTransaction({ digest: result.Transaction.digest });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button onClick={handleAction} disabled={!account || isPending}>
      {isPending ? 'Waiting for wallet...' : 'Submit'}
    </button>
  );
}
```

**Key points:**
- No mutation hook — `signAndExecuteTransaction` is a plain async function on `useDAppKit()`
- Result is a discriminated union: `result.FailedTransaction` (failure) or `result.Transaction.digest` (success)
- Always `waitForTransaction` before re-querying state

For querying on-chain data (React Query patterns), paginated queries, sign-without-execute, personal message signing, network switching, cache invalidation, wallet-gated UI, and the full "What dApp Kit is NOT" migration table, see:
- [references/react-patterns.md](references/react-patterns.md)

---

## 8. What dApp Kit is NOT (key items)

| Mistake | Correct approach |
|---------|-----------------|
| Using `@mysten/dapp-kit` | Deprecated — use `@mysten/dapp-kit-react` or `@mysten/dapp-kit-core` |
| Three-provider setup | Use `createDAppKit` + `DAppKitProvider` |
| `useSignAndExecuteTransaction` hook | Use `useDAppKit().signAndExecuteTransaction()` |
| `useSuiClient` | Renamed to `useCurrentClient` |
| `useSuiClientQuery` | Removed — use `useCurrentClient` + `@tanstack/react-query` |

Full migration table in [references/react-patterns.md](references/react-patterns.md).

---

## Integration

### Called By
- `sui-full-stack` (Phase 3: Frontend development)
- `sui-fullstack-integration` (contract-frontend integration)

### Calls
- `sui-ts-sdk` - PTB construction patterns
- `sui-docs-query` - Query latest SDK documentation

## References

- [references/react-patterns.md](references/react-patterns.md) - Queries, pagination, signing, cache invalidation, wallet-gated UI, full migration table
- [references/reference.md](references/reference.md) - Complete SDK API reference, hooks documentation
- [references/grpc-reference.md](references/grpc-reference.md) - gRPC API reference, migration guide
- [references/examples.md](references/examples.md) - Complete component examples, integration patterns
