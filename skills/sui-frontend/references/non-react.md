# Non-React Integration (Vue / Vanilla JS / Svelte)

Reference for `@mysten/dapp-kit-core`. The `createDAppKit` call and all actions are identical to the React skill — only reactive state access (nanostores) and UI rendering (Web Components) differ. Read this when building outside React.

For PTB construction details (splitCoins, moveCall, coinWithBalance, etc.), apply the **sui-ts-sdk** skill alongside this one — the `Transaction` API is identical in browser and Node contexts.

## createDAppKit (core)

Use `@mysten/dapp-kit-core` when not building with React. The `createDAppKit` call is identical — only the import path differs:

```ts
// @check:skip
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

All actions on the instance work identically to the React sections: `signAndExecuteTransaction`, `signTransaction`, `signPersonalMessage`, `connectWallet`, `disconnectWallet`, `switchNetwork`, `switchAccount`.

## Web Components

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

## Reactive State (nanostores)

State is exposed as [nanostores](https://github.com/nanostores/nanostores) stores on `dAppKit.stores`:

| Store | Type | Description |
|-------|------|-------------|
| `$connection` | `{ wallet, account, status, isConnected, isConnecting, isReconnecting, isDisconnected }` | Full connection state |
| `$currentNetwork` | `string` | Active network name |
| `$currentClient` | `SuiClient` | Client for the active network |
| `$wallets` | `UiWallet[]` | Detected wallets |

**Vanilla JS** — subscribe for reactive updates:

```ts
// @check:skip
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

## On-chain queries (non-React)

Outside React there's no `useCurrentClient` hook. Use the store or `getClient()` directly:

```ts
// @check:skip
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
