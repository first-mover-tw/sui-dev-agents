# SUI gRPC API Reference

> **Status:** GA (Generally Available) as of SUI v1.65
> **JSON-RPC:** Deprecated, will be removed April 2026
> **Default port:** 8443 (TLS) or 8080 (plaintext)

## Overview

SUI full nodes now expose gRPC as the primary API interface, replacing the deprecated JSON-RPC. The gRPC API provides 7 services covering all blockchain interaction needs.

> **SDK v2 Breaking Change:** `SuiClient` from `@mysten/sui/client` is **removed**. Use `SuiGrpcClient` from `@mysten/sui/grpc` instead. See [TypeScript section](#typescript-via-mystensui) below.

## gRPC Services

### 1. TransactionExecutionService
Execute and submit transactions to the network.

```protobuf
service TransactionExecutionService {
  rpc ExecuteTransaction(ExecuteTransactionRequest) returns (ExecuteTransactionResponse);
  rpc SimulateTransaction(SimulateTransactionRequest) returns (SimulateTransactionResponse);
}
```

**Replaces:** `sui_executeTransactionBlock`, `sui_dryRunTransactionBlock`

### 2. LedgerService
Query blockchain ledger data (checkpoints, transactions, epochs).

```protobuf
service LedgerService {
  rpc GetCheckpoint(GetCheckpointRequest) returns (Checkpoint);
  rpc GetTransaction(GetTransactionRequest) returns (TransactionResponse);
  rpc GetEpoch(GetEpochRequest) returns (EpochInfo);
  rpc GetLatestCheckpoint(Empty) returns (Checkpoint);
}
```

**Replaces:** `sui_getCheckpoint`, `sui_getTransactionBlock`, `sui_getLatestCheckpointSequenceNumber`

### 3. StateService
Query on-chain state (objects, balances, coins, dynamic fields).

```protobuf
service StateService {
  rpc GetObject(GetObjectRequest) returns (ObjectResponse);
  rpc MultiGetObjects(MultiGetObjectsRequest) returns (MultiGetObjectsResponse);
  rpc GetOwnedObjects(GetOwnedObjectsRequest) returns (OwnedObjectsResponse);
  rpc GetCoins(GetCoinsRequest) returns (CoinsResponse);
  rpc GetBalance(GetBalanceRequest) returns (BalanceResponse);
  rpc GetDynamicFields(GetDynamicFieldsRequest) returns (DynamicFieldsResponse);
}
```

**Replaces:** `sui_getObject`, `sui_multiGetObjects`, `suix_getOwnedObjects`, `suix_getCoins`, `suix_getBalance`, `suix_getDynamicFields`

### 4. SubscriptionService
Real-time streaming for events and transactions.

```protobuf
service SubscriptionService {
  rpc SubscribeEvents(SubscribeEventsRequest) returns (stream EventResponse);
  rpc SubscribeTransactions(SubscribeTransactionsRequest) returns (stream TransactionResponse);
}
```

**Replaces:** WebSocket `suix_subscribeEvent`, `suix_subscribeTransaction`

### 5. MovePackageService
Query Move packages, modules, and ABIs.

```protobuf
service MovePackageService {
  rpc GetPackage(GetPackageRequest) returns (MovePackage);
  rpc GetNormalizedModule(GetNormalizedModuleRequest) returns (NormalizedMoveModule);
  rpc GetNormalizedFunction(GetNormalizedFunctionRequest) returns (NormalizedMoveFunction);
}
```

**Replaces:** `sui_getNormalizedMoveModule`, `sui_getNormalizedMoveFunction`

### 6. SignatureVerificationService
Verify transaction signatures off-chain.

```protobuf
service SignatureVerificationService {
  rpc VerifySignature(VerifySignatureRequest) returns (VerifySignatureResponse);
}
```

### 7. NameService
Resolve SuiNS names.

```protobuf
service NameService {
  rpc ResolveName(ResolveNameRequest) returns (ResolveNameResponse);
  rpc ReverseResolve(ReverseResolveRequest) returns (ReverseResolveResponse);
}
```

**Replaces:** `suix_resolveNameServiceAddress`, `suix_resolveNameServiceNames`

## Connection

### Endpoint URLs

| Network | gRPC Endpoint |
|---------|--------------|
| Mainnet | `grpc.mainnet.sui.io:443` |
| Testnet | `grpc.testnet.sui.io:443` |
| Devnet  | `grpc.devnet.sui.io:443` |
| Local   | `localhost:8080` (plaintext) |

### grpcurl Examples

```bash
# List services
grpcurl grpc.testnet.sui.io:443 list

# Get latest checkpoint
grpcurl grpc.testnet.sui.io:443 sui.ledger.v1.LedgerService/GetLatestCheckpoint

# Get object
grpcurl -d '{"object_id": "0x..."}' grpc.testnet.sui.io:443 sui.state.v1.StateService/GetObject

# Subscribe to events (streaming)
grpcurl -d '{"filter": {"move_event_type": "0x2::coin::CoinEvent"}}' \
  grpc.testnet.sui.io:443 sui.subscription.v1.SubscriptionService/SubscribeEvents
```

### TypeScript (via @mysten/sui)

In SDK v2, `SuiClient` from `@mysten/sui/client` is **removed**. Use `SuiGrpcClient` from `@mysten/sui/grpc`:

```typescript
// ❌ v1 (removed)
// import { SuiClient } from '@mysten/sui/client';
// const client = new SuiClient({ url: getFullnodeUrl('testnet') });

// ✅ v2
import { SuiGrpcClient } from '@mysten/sui/grpc';

const client = new SuiGrpcClient({ url: 'https://fullnode.testnet.sui.io:443' });

// Methods are under .core namespace
const object = await client.core.getObject({ id: '0x...', include: { content: true } });
const coins = await client.core.getCoins({ owner: '0x...' });
```

> **Note:** All client methods now live under `client.core.*`. The `options` parameter is renamed to `include` (e.g., `include: { content: true }` instead of `options: { showContent: true }`).

## Migration: JSON-RPC → gRPC

### Quick Reference

| JSON-RPC Method | gRPC Service.Method |
|----------------|-------------------|
| `sui_getObject` | `StateService.GetObject` |
| `sui_multiGetObjects` | `StateService.MultiGetObjects` |
| `suix_getOwnedObjects` | `StateService.GetOwnedObjects` |
| `suix_getCoins` | `StateService.GetCoins` |
| `suix_getBalance` | `StateService.GetBalance` |
| `suix_getDynamicFields` | `StateService.GetDynamicFields` |
| `sui_executeTransactionBlock` | `TransactionExecutionService.ExecuteTransaction` |
| `sui_dryRunTransactionBlock` | `TransactionExecutionService.SimulateTransaction` |
| `sui_getTransactionBlock` | `LedgerService.GetTransaction` |
| `sui_getCheckpoint` | `LedgerService.GetCheckpoint` |
| `sui_getNormalizedMoveModule` | `MovePackageService.GetNormalizedModule` |
| `suix_subscribeEvent` (WS) | `SubscriptionService.SubscribeEvents` (streaming) |
| `suix_subscribeTransaction` (WS) | `SubscriptionService.SubscribeTransactions` (streaming) |
| `suix_resolveNameServiceAddress` | `NameService.ResolveName` |

### Key Differences

1. **Streaming replaces WebSocket:** `subscribeEvent` WebSocket is replaced by gRPC server-streaming. No separate WS connection needed.
2. **Binary encoding:** gRPC uses protobuf (smaller, faster) vs JSON-RPC's JSON encoding.
3. **Multiplexing:** Multiple gRPC calls share one HTTP/2 connection.
4. **Type safety:** Protobuf definitions provide strong typing.

### SDK Users

If you use `@mysten/sui` SDK v2:

- **Import changed:** `SuiGrpcClient` from `@mysten/sui/grpc` (not `SuiClient` from `@mysten/sui/client`)
- **Methods under `.core`:** `client.core.getObject(...)` instead of `client.getObject(...)`
- **`options` → `include`:** `include: { content: true }` instead of `options: { showContent: true }`
- **`subscribeEvent` via WebSocket** is removed. Use `client.core.subscribeEvents(...)` (gRPC streaming).
- **Custom RPC middleware** that intercepts JSON-RPC payloads will need updating.
- **Direct `fetch()` calls** to JSON-RPC must be migrated.

## Data Access Architecture (v1.65+)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   gRPC      │     │  GraphQL     │     │  Indexer      │
│  (Primary)  │     │  (Beta)      │     │  (Custom)     │
├─────────────┤     ├──────────────┤     ├──────────────┤
│ Full node   │     │ Frontend     │     │ Analytics     │
│ Direct      │     │ Relay-style  │     │ Historical    │
│ Streaming   │     │ Flexible     │     │ Aggregation   │
│ Low-latency │     │ queries      │     │ Custom views  │
└─────────────┘     └──────────────┘     └──────────────┘
```

**Choose:**
- **gRPC** — Backend services, real-time subscriptions, transaction execution
- **GraphQL** — Frontend queries, complex object graphs, Relay integration
- **Indexer** — Historical analytics, custom aggregations, complex filters

## Indexing Changes (v1.65)

- Checkpoint data encoding changed from BCS to **zstd-compressed protobuf**
- Custom indexers using raw checkpoint data must update their deserialization
- Official indexer framework handles this automatically
