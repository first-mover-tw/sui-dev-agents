# SUI Frontend - Reference Guide

Complete SDK API reference and advanced patterns.

## @mysten/sui SDK Reference

> **Note:** Package was renamed from `@mysten/sui.js` to `@mysten/sui` in 2025. Update all imports accordingly.

### SuiClient Methods

> **Note:** SuiClient in SDK v1.65+ uses gRPC internally. These methods work as-is — no manual migration needed.

- `getObject(params)` - Fetch single object
- `multiGetObjects(params)` - Fetch multiple objects (batch)
- `getOwnedObjects(params)` - Query objects by owner/type
- `getDynamicFields(params)` - Query dynamic fields
- `executeTransaction(params)` - Execute transaction
- `subscribeEvent(params)` - Subscribe to events

### Transaction Methods

> **Note:** `TransactionBlock` was renamed to `Transaction`. Import from `@mysten/sui/transactions`.

- `moveCall(params)` - Call Move function
- `transferObjects(objects, recipient)` - Transfer objects
- `splitCoins(coin, amounts)` - Split coins
- `mergeCoins(destination, sources)` - Merge coins
- `pure(value, type)` - Pure argument
- `object(id)` - Object argument

## @mysten/dapp-kit Hooks

### Wallet Hooks

- `useCurrentAccount()` - Get current connected account
- `useAccounts()` - Get all connected accounts
- `useConnectWallet()` - Connect wallet mutation
- `useDisconnectWallet()` - Disconnect wallet mutation
- `useSwitchAccount()` - Switch account mutation

### Client Hooks

- `useSuiClient()` - Get SUI client instance
- `useSuiClientQuery()` - Query with SUI client
- `useSuiClientMutation()` - Mutation with SUI client

### Transaction Hooks

> **Note:** Hooks were renamed: `useSignAndExecuteTransactionBlock` → `useSignAndExecuteTransaction`

- `useSignAndExecuteTransaction()` - Sign and execute transaction
- `useSignTransaction()` - Sign transaction only
- `useSignPersonalMessage()` - Sign message

## gRPC API (v1.65+, GA)

> **JSON-RPC is deprecated** (removed April 2026). See [grpc-reference.md](grpc-reference.md) for full migration guide.

gRPC is now the primary full node API with 7 services:
- `TransactionExecutionService` — Execute/simulate transactions
- `LedgerService` — Checkpoints, transactions, epochs
- `StateService` — Objects, balances, coins, dynamic fields
- `SubscriptionService` — Real-time event/transaction streaming (replaces WebSocket)
- `MovePackageService` — Package and module queries
- `SignatureVerificationService` — Off-chain signature verification
- `NameService` — SuiNS resolution

**SDK users:** `@mysten/sui` `SuiClient` handles gRPC transport automatically. No code changes needed for most operations.

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
