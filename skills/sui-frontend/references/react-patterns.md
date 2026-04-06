# React Patterns — Sui dApp Kit

## Table of Contents

- [Querying On-Chain Data](#querying-on-chain-data)
- [Paginated Queries](#paginated-queries)
- [Signing Without Executing](#signing-without-executing)
- [Personal Message Signing](#personal-message-signing)
- [Network Switching](#network-switching)
- [Cache Invalidation After Transactions](#cache-invalidation-after-transactions)
- [Wallet-Gated UI](#wallet-gated-ui)
- [What dApp Kit is NOT (Full Table)](#what-dapp-kit-is-not-full-table)

---

## Querying On-Chain Data

`useSuiClientQuery` no longer exists in the new package. Use `useCurrentClient` with `@tanstack/react-query` directly:

```tsx
import { useCurrentClient, useCurrentAccount } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';

function Balance() {
  const client = useCurrentClient();
  const account = useCurrentAccount();

  const { data, isPending, error } = useQuery({
    queryKey: ['getBalance', account?.address],
    queryFn: () =>
      client.getBalance({
        owner: account!.address,
        coinType: '0x2::sui::SUI',
      }),
    enabled: !!account, // skip until wallet is connected
  });

  if (isPending) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  const sui = Number(data.totalBalance) / 1_000_000_000;
  return <p>Balance: {sui.toFixed(4)} SUI</p>;
}
```

Always wrap `@tanstack/react-query` usage in a `QueryClientProvider`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient();

<QueryClientProvider client={queryClient}>
  <DAppKitProvider dAppKit={dAppKit}>
    <App />
  </DAppKitProvider>
</QueryClientProvider>
```

**Always pass `enabled: !!account`** for queries that require a connected wallet. Without it, the query fires immediately with an undefined owner and errors.

---

## Paginated Queries

Use `useInfiniteQuery` from `@tanstack/react-query` paired with `useCurrentClient`:

```tsx
import { useCurrentClient, useCurrentAccount } from '@mysten/dapp-kit-react';
import { useInfiniteQuery } from '@tanstack/react-query';

function OwnedNFTs() {
  const client = useCurrentClient();
  const account = useCurrentAccount();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['getOwnedObjects', account?.address],
    queryFn: ({ pageParam }) =>
      client.getOwnedObjects({
        owner: account!.address,
        cursor: pageParam ?? null,
        filter: { StructType: '0xPKG::nft::NFT' },
        options: { showContent: true },
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextCursor : undefined,
    enabled: !!account,
  });

  const allObjects = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div>
      {allObjects.map((obj) => (
        <NFTCard key={obj.data?.objectId} object={obj} />
      ))}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
```

---

## Signing Without Executing

When you need the user's signature but execution happens elsewhere (e.g., a sponsored flow where your backend attaches gas):

```tsx
import { useDAppKit } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';

function SponsoredMint() {
  const dAppKit = useDAppKit();

  const handleSign = async () => {
    const tx = new Transaction();
    // ... build PTB ...

    const { bytes, signature } = await dAppKit.signTransaction({ transaction: tx });
    // Send bytes + signature to backend; sponsor attaches gas and executes
    await fetch('/api/sponsor', {
      method: 'POST',
      body: JSON.stringify({ bytes, signature }),
    });
  };

  return <button onClick={handleSign}>Mint (Gasless)</button>;
}
```

For the server-side sponsored execution flow, see **sui-ts-sdk references/advanced-patterns.md § Sponsored Transactions**.

---

## Personal Message Signing

```tsx
import { useDAppKit, useCurrentAccount } from '@mysten/dapp-kit-react';

function AuthButton() {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();

  const handleAuth = async () => {
    if (!account) return;
    const nonce = crypto.randomUUID();
    const message = new TextEncoder().encode(`Sign in to MyApp: nonce=${nonce}`);

    const { bytes, signature } = await dAppKit.signPersonalMessage({ message });
    await verifyOnServer({ address: account.address, bytes, signature });
  };

  return (
    <button onClick={handleAuth} disabled={!account}>
      Sign In
    </button>
  );
}
```

The message must be a `Uint8Array` — use `TextEncoder` to convert strings.

---

## Network Switching

```tsx
import { useCurrentNetwork, useDAppKit } from '@mysten/dapp-kit-react';

function NetworkSwitcher() {
  const network = useCurrentNetwork();
  const dAppKit = useDAppKit();

  return (
    <select value={network} onChange={(e) => dAppKit.switchNetwork(e.target.value)}>
      <option value="mainnet">Mainnet</option>
      <option value="testnet">Testnet</option>
    </select>
  );
}
```

Only networks in `createDAppKit`'s `networks` array are valid targets. `switchNetwork` executes synchronously and does not notify the wallet.

---

## Cache Invalidation After Transactions

After a successful transaction, invalidate React Query caches. **Always wait for indexing first:**

```tsx
import { useQueryClient } from '@tanstack/react-query';
import { useDAppKit, useCurrentClient, useCurrentAccount } from '@mysten/dapp-kit-react';

function MintButton() {
  const dAppKit = useDAppKit();
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const queryClient = useQueryClient();

  const handleMint = async () => {
    const tx = new Transaction();
    // ... build PTB ...

    const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
    if (result.FailedTransaction) throw new Error('Mint failed');

    await client.waitForTransaction({ digest: result.Transaction.digest }); // wait first!
    await queryClient.invalidateQueries({ queryKey: ['getBalance', account?.address] });
    await queryClient.invalidateQueries({ queryKey: ['getOwnedObjects', account?.address] });
  };

  return <button onClick={handleMint}>Mint NFT</button>;
}
```

```tsx
// WRONG: invalidating before waitForTransaction — indexer hasn't caught up yet
const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
await queryClient.invalidateQueries(...); // stale!
await client.waitForTransaction({ digest: result.Transaction.digest });
```

---

## Wallet-Gated UI

```tsx
import { useCurrentAccount, ConnectButton } from '@mysten/dapp-kit-react';

function ProtectedPage() {
  const account = useCurrentAccount();

  if (!account) {
    return (
      <div>
        <p>Connect your wallet to continue.</p>
        <ConnectButton />
      </div>
    );
  }

  return <Dashboard address={account.address} />;
}
```

Reusable guard:

```tsx
function WalletGuard({ children }: { children: React.ReactNode }) {
  const account = useCurrentAccount();
  if (!account) return <ConnectButton />;
  return <>{children}</>;
}
```

---

## What dApp Kit is NOT (Full Table)

| Mistake | Correct approach |
|---------|-----------------|
| Using `@mysten/dapp-kit` in new projects | That package is deprecated; use `@mysten/dapp-kit-react` (React) or `@mysten/dapp-kit-core` (Vue, vanilla JS, other frameworks) |
| Using `SuiJsonRpcClient` in `createClient` | The new dApp Kit uses `SuiGrpcClient` — pass it to `createDAppKit`'s `createClient` |
| Three-provider setup (`QueryClientProvider` + `SuiClientProvider` + `WalletProvider`) | Use `createDAppKit` + `DAppKitProvider` — the old provider pattern is gone |
| Omitting the `declare module` augmentation | Without it, `useDAppKit()` and hooks lose TypeScript type inference |
| `useSignAndExecuteTransaction`, `useConnectWallet`, `useDisconnectWallet` | These mutation hooks no longer exist; use `useDAppKit()` instance methods instead |
| `useSuiClient` | Renamed to `useCurrentClient` |
| `useSuiClientContext` | Replaced by `useCurrentNetwork` (read) + `useDAppKit().switchNetwork()` (write) |
| `useSuiClientQuery` / `useSuiClientInfiniteQuery` | Removed; use `useCurrentClient` + `useQuery`/`useInfiniteQuery` from `@tanstack/react-query` |
| Checking `result.digest` after `signAndExecuteTransaction` | Result is a discriminated union: use `result.Transaction.digest` (success) or `result.FailedTransaction` (failure) |
| Reading `account.address` without null check | `useCurrentAccount()` returns `null` before connection; always guard |
| `enabled: !!account` omitted from queries | Without it, the query fires with an undefined owner and errors immediately |
| Invalidating queries before `waitForTransaction` | Indexer may not have processed the tx yet; always wait first |
| `ConnectButton` in SSR without client-side guard | Wallet detection is browser-only; ensure client-side rendering for wallet components |
