---
name: sui-frontend
description: Sui frontend dApp development with @mysten/dapp-kit-react (React) and @mysten/dapp-kit-core (Vue, vanilla JS, other frameworks). Use when building browser apps that connect to Sui wallets, add a ConnectButton or wallet-connection UI, query on-chain data, execute or sign transactions in the browser, or migrate off the deprecated @mysten/dapp-kit package. Use alongside the sui-ts-sdk skill for PTB construction patterns.
---

# Sui Frontend Skill

## SDK Versions

Targets: `@mysten/sui` 2.24.0 (^2.0), `@mysten/dapp-kit-react` 2.1.16 (^2.0), `@mysten/dapp-kit-core` 1.6.14 (^1.3). Tested: 2026-08-16.

**Compatibility notes:** Before installing, run `npm ls @mysten/sui` — if you already have `@mysten/sui@1.x` from `seal`, `walrus`, or legacy `@mysten/dapp-kit`, do not add a 2.x package on top. Remediation: either upgrade those peers to versions compatible with sui 2.x, or stay fully on the 1.x line — don't mix. UI components moved to `@mysten/dapp-kit-react/ui` in 2.x — importing `ConnectButton` from the package root will fail with "is not exported".

---

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

> **Not using React?** See [Non-React Integration](references/non-react.md) (Vue / vanilla JS / Svelte).

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
// @check:skip
// App.tsx
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
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

`createDAppKit` (see §2 for the full instance file) accepts these key options:

| Option | Description |
|--------|-------------|
| `networks` | Which networks your app supports (e.g. `['testnet', 'mainnet']`) |
| `defaultNetwork` | Starting network |
| `createClient` | Called once per network — return a `SuiGrpcClient` for that network |
| `autoConnect` | Default `true` — restores the last connected wallet on reload |

**Use `SuiGrpcClient` here** — unlike the deprecated `@mysten/dapp-kit`, the new package is built for gRPC. Do not pass `SuiJsonRpcClient` to `createClient`.

```tsx
// @check:skip — illustrative wrong/correct contrast, not a runnable snippet
// wrong client type — belongs to the deprecated @mysten/dapp-kit era
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
createClient: (network) => new SuiJsonRpcClient({ ... })

// correct
import { SuiGrpcClient } from '@mysten/sui/grpc';
createClient: (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] })
```

---

## Non-React Integration (Vue / Vanilla JS / Svelte)

Building with Vue, vanilla JS, Svelte, or any non-React framework? Use `@mysten/dapp-kit-core` instead of `-react`. `createDAppKit` is identical — the difference is reactive state via [nanostores](https://github.com/nanostores/nanostores) stores (`dAppKit.stores.$connection`, `$currentNetwork`, `$currentClient`, `$wallets`) and UI via Web Components (`<mysten-dapp-kit-connect-button>` / `-connect-modal`) instead of hooks and `DAppKitProvider`.

→ Full setup, Web Components, nanostores subscriptions, Vue bindings, and non-React on-chain queries: [references/non-react.md](references/non-react.md).

---

## 4. Wallet Connection

### ConnectButton

The simplest approach — renders a "Connect Wallet" button that opens a wallet selection modal. **In dapp-kit-react 2.x, UI components live in the `/ui` subpath** — importing `ConnectButton` from the package root will fail:

```tsx
import { ConnectButton } from '@mysten/dapp-kit-react/ui';

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
// @check:skip
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

> **Parser-breaking (v1.70+):** `0x1::type_name::TypeName` values in structured outputs (JSON-RPC, gRPC, GraphQL) are now serialized as a plain string (e.g. `"0x2::sui::SUI"`) instead of `{ "name": "0x2::sui::SUI" }`. If your frontend parses these fields, expect a string at that position.

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
- `sui-move-ts-bridge` (contract-frontend integration)

### Calls
- `sui-ts-sdk` - PTB construction patterns
- `sui-docs-query` - Query latest SDK documentation

## References

- [references/react-patterns.md](references/react-patterns.md) - Queries, pagination, signing, cache invalidation, wallet-gated UI, full migration table
- [references/reference.md](references/reference.md) - Complete SDK API reference, hooks documentation
- [references/grpc-reference.md](references/grpc-reference.md) - gRPC API reference, migration guide
- [references/examples.md](references/examples.md) - Complete component examples, integration patterns
- [references/non-react.md](references/non-react.md) - Vue / vanilla JS / Svelte: dapp-kit-core setup, Web Components, nanostores state, non-React queries
