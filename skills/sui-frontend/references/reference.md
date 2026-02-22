# SUI Frontend - Reference Guide

Complete SDK API reference and advanced patterns for dApp Kit v2.

## @mysten/sui SDK Reference

> **Note:** Package was renamed from `@mysten/sui.js` to `@mysten/sui` in 2025. In v2, `SuiClient` from `@mysten/sui/client` is removed — use `SuiGrpcClient` from `@mysten/sui/grpc`.

### SuiGrpcClient Methods

All methods are under the `.core` namespace:

- `client.core.getObject(params)` - Fetch single object
- `client.core.multiGetObjects(params)` - Fetch multiple objects (batch)
- `client.core.getOwnedObjects(params)` - Query objects by owner/type
- `client.core.getDynamicFields(params)` - Query dynamic fields
- `client.core.getCoins(params)` - Query coins by owner
- `client.core.getBalance(params)` - Get balance for coin type
- `client.core.executeTransaction(params)` - Execute transaction
- `client.core.waitForTransaction(params)` - Wait for transaction finality

### v1 → v2 Method Rename Table

| v1 (SuiClient) | v2 (SuiGrpcClient) |
|---|---|
| `import { SuiClient } from '@mysten/sui/client'` | `import { SuiGrpcClient } from '@mysten/sui/grpc'` |
| `client.getObject({ id, options: { showContent: true } })` | `client.core.getObject({ id, include: { content: true } })` |
| `client.multiGetObjects({ ids, options: { showContent: true } })` | `client.core.multiGetObjects({ ids, include: { content: true } })` |
| `client.getOwnedObjects({ owner, options })` | `client.core.getOwnedObjects({ owner, include })` |
| `client.getCoins({ owner })` | `client.core.getCoins({ owner })` |
| `client.getBalance({ owner })` | `client.core.getBalance({ owner })` |
| `client.getDynamicFields({ parentId })` | `client.core.getDynamicFields({ parentId })` |
| `client.executeTransactionBlock(...)` | `client.core.executeTransaction(...)` |
| `client.dryRunTransactionBlock(...)` | `client.core.simulateTransaction(...)` |
| `client.subscribeEvent(...)` | `client.core.subscribeEvents(...)` (gRPC streaming) |
| `client.waitForTransactionBlock(...)` | `client.core.waitForTransaction(...)` |
| `options: { showContent, showOwner, showType }` | `include: { content, owner, type }` |

### Transaction Methods

> **Note:** `TransactionBlock` was renamed to `Transaction`. Import from `@mysten/sui/transactions`.

- `moveCall(params)` - Call Move function
- `transferObjects(objects, recipient)` - Transfer objects
- `splitCoins(coin, amounts)` - Split coins
- `mergeCoins(destination, sources)` - Merge coins
- `pure(value, type)` - Pure argument
- `object(id)` - Object argument
- `coinWithBalance({ balance, type? })` - Create coin with exact balance (auto-splits from gas or specified type)
- `$extend(name, fn)` - Add custom methods to Transaction instance

## @mysten/dapp-kit-react Hooks (v2)

> **Note:** `@mysten/dapp-kit` is **deprecated**. Use `@mysten/dapp-kit-react` (React) or `@mysten/dapp-kit-core` (non-React).

### Setup

- `createDAppKit(config)` - Factory to create dApp Kit instance
- `DAppKitProvider` - React context provider (replaces three-provider pattern)

### Wallet Hooks

- `useCurrentAccount()` - Get current connected account
- `useCurrentWallet()` - Get current wallet info
- `useWallets()` - List all available wallets
- `useWalletConnection()` - Connection status (`'disconnected' | 'connecting' | 'connected'`)

### Client & Network Hooks

- `useCurrentClient()` - Get SuiGrpcClient for active network (replaces `useSuiClient()`)
- `useCurrentNetwork()` - Get active network name

### Instance Methods (via `useDAppKit()`)

> **Note:** `useSuiClientQuery()`, `useSuiClientMutation()`, `useSignAndExecuteTransaction()` (mutation hook), `useSignTransaction()`, `useSignPersonalMessage()` are all **removed** in v2.

- `dAppKit.signAndExecuteTransaction({ transaction })` - Sign + execute (async, returns discriminated union)
- `dAppKit.signTransaction({ transaction })` - Sign only (for sponsored flows)
- `dAppKit.signPersonalMessage({ message })` - Sign personal message
- `dAppKit.connect(wallet)` - Connect to wallet
- `dAppKit.disconnect()` - Disconnect wallet
- `dAppKit.switchNetwork(network)` - Switch active network

### Result Types

```typescript
// signAndExecuteTransaction returns a discriminated union:
if ('Transaction' in result) {
  result.Transaction.digest; // success
} else {
  result.FailedTransaction; // failure details
}
```

## gRPC API (GA)

> **JSON-RPC is deprecated** (removed April 2026). See [grpc-reference.md](grpc-reference.md) for full migration guide.

gRPC is now the primary full node API with 7 services:
- `TransactionExecutionService` — Execute/simulate transactions
- `LedgerService` — Checkpoints, transactions, epochs
- `StateService` — Objects, balances, coins, dynamic fields
- `SubscriptionService` — Real-time event/transaction streaming (replaces WebSocket)
- `MovePackageService` — Package and module queries
- `SignatureVerificationService` — Off-chain signature verification
- `NameService` — SuiNS resolution

## GraphQL API (v1.64-v1.65)

### New Fields

- `Query.node(id: ID!)` - Global Identification Specification (Relay support)
- `Query.address(name: ...)` - Resolve SuiNS name (replaces `Query.suinsName`)
- `Query.nameRecord(name: ...)` - Fetch SuiNS NameRecord
- `TransactionEffects.effectsJson` - Effects as JSON blob
- `Transaction.transactionJson` - Transaction as JSON blob
- `TransactionEffects.balanceChangeEffectJson` - Balance changes as JSON blob
- `MoveValue.extract(expr)` - Extract sub-slice using Display v2 expression
- `MoveValue.format(expr)` - Format using single format string
- `MoveValue.asAddress` - Coerce MoveValue to Address
- `DynamicFieldName.literal` - Provide dynamic field name as Display v2 literal

### Breaking Changes

- `Epoch.systemState` now returns `MoveValue` (replaces individual system state fields)
- `ValidatorSet.contents` returns `MoveValue` (replaces most fields)
- `Validator.contents` returns `MoveValue` (replaces most fields)
- `Balance.totalBalance` now sums owned coins + accumulator objects
  - Use `Balance.coinBalance` for previous coin-only behavior
  - Use `Balance.addressBalance` for address-specific balance
- `IAddressable.defaultSuinsName` → `IAddressable.defaultNameRecord.target`
- Single "rich query" limit enforces database request budgets

See examples.md for complete usage patterns.
