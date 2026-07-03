# SUI gRPC API Reference

> **Status:** GA (Generally Available) as of SUI v1.67+, current v1.74+
> **JSON-RPC:** Deprecated, Quorum Driver disabled, permanent deactivation 2026-07-31
> **Service/method names verified against `@mysten/sui@2.20.1` shipped protos (`sui.rpc.v2`)**
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
  rpc GetServiceInfo(GetServiceInfoRequest) returns (GetServiceInfoResponse);
  rpc GetObject(GetObjectRequest) returns (GetObjectResponse);
  rpc BatchGetObjects(BatchGetObjectsRequest) returns (BatchGetObjectsResponse);
  rpc GetTransaction(GetTransactionRequest) returns (GetTransactionResponse);
  rpc BatchGetTransactions(BatchGetTransactionsRequest) returns (BatchGetTransactionsResponse);
  rpc GetCheckpoint(GetCheckpointRequest) returns (GetCheckpointResponse);
  rpc GetEpoch(GetEpochRequest) returns (GetEpochResponse);
}
```

**Replaces:** `sui_getObject`, `sui_multiGetObjects`, `sui_getTransactionBlock`, `sui_getCheckpoint`. Note: object reads live here, **not** on StateService.

### 3. StateService
Query on-chain state (objects, balances, coins, dynamic fields).

```protobuf
service StateService {
  rpc ListOwnedObjects(ListOwnedObjectsRequest) returns (ListOwnedObjectsResponse);
  rpc GetCoinInfo(GetCoinInfoRequest) returns (GetCoinInfoResponse);
  rpc GetBalance(GetBalanceRequest) returns (GetBalanceResponse);
  rpc ListBalances(ListBalancesRequest) returns (ListBalancesResponse);
  rpc ListDynamicFields(ListDynamicFieldsRequest) returns (ListDynamicFieldsResponse);
}
```

**Replaces:** `suix_getOwnedObjects`, `suix_getCoins` (via `ListOwnedObjects` with a coin `type` filter), `suix_getBalance`, `suix_getAllBalances`, `suix_getDynamicFields`

### 4. SubscriptionService
Real-time streaming of checkpoints — the **only** subscription the gRPC API ships.

```protobuf
service SubscriptionService {
  rpc SubscribeCheckpoints(SubscribeCheckpointsRequest) returns (stream SubscribeCheckpointsResponse);
}
```

**Replaces:** WebSocket `suix_subscribeEvent` / `suix_subscribeTransaction` have **no direct equivalent** — derive events/transactions from the checkpoint stream (filter client-side), or use an indexer / GraphQL.

### 5. MovePackageService
Query Move packages, modules, and ABIs.

```protobuf
service MovePackageService {
  rpc GetPackage(GetPackageRequest) returns (GetPackageResponse);
  rpc GetDatatype(GetDatatypeRequest) returns (GetDatatypeResponse);
  rpc GetFunction(GetFunctionRequest) returns (GetFunctionResponse);
  rpc ListPackageVersions(ListPackageVersionsRequest) returns (ListPackageVersionsResponse);
}
```

**Replaces:** `sui_getNormalizedMoveModule` (module contents come back inside `GetPackage`), `sui_getNormalizedMoveFunction` (`GetFunction`)

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
  rpc LookupName(LookupNameRequest) returns (LookupNameResponse);
  rpc ReverseLookupName(ReverseLookupNameRequest) returns (ReverseLookupNameResponse);
}
```

**Replaces:** `suix_resolveNameServiceAddress` (`LookupName`), `suix_resolveNameServiceNames` (`ReverseLookupName`)

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

# Node/service info
grpcurl grpc.testnet.sui.io:443 sui.rpc.v2.LedgerService/GetServiceInfo

# Get object (object reads are on LedgerService)
grpcurl -d '{"object_id": "0x..."}' grpc.testnet.sui.io:443 sui.rpc.v2.LedgerService/GetObject

# Subscribe to checkpoints (the only streaming RPC; filter events client-side)
grpcurl -d '{}' grpc.testnet.sui.io:443 sui.rpc.v2.SubscriptionService/SubscribeCheckpoints
```

### TypeScript (via @mysten/sui)

In SDK v2, `SuiClient` from `@mysten/sui/client` is **removed**. Use `SuiGrpcClient` from `@mysten/sui/grpc`:

```typescript
// ❌ v1 (removed)
// import { SuiClient } from '@mysten/sui/client';
// const client = new SuiClient({ url: getFullnodeUrl('testnet') });

// ✅ v2
import { SuiGrpcClient } from '@mysten/sui/grpc';

const client = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
});

// Methods are under .core namespace
const object = await client.core.getObject({ objectId: '0x...', include: { content: true } });
const coins = await client.core.listCoins({ owner: '0x...' });
```

> **Note:** All client methods now live under `client.core.*`. The `options` parameter is renamed to `include` (e.g., `include: { content: true }` instead of `options: { showContent: true }`).

### Chain ID Header (Protocol 119+)

The gRPC `chain-id` response header now returns the full 32-byte, Base58-encoded chain identifier. Previously, some endpoints returned a truncated format.

**New format example:**
```
chain-id: 4btiuiMPvEENsttpZC7CZ53DruC3MAgfGZsMSMz6GRbi
```

**Impact:** If your code compares chain IDs from gRPC headers, update the comparison to handle the full 32-byte Base58 string. The `SuiGrpcClient` handles this transparently — this mainly affects custom gRPC clients.

## Migration: JSON-RPC → gRPC

### Quick Reference

| JSON-RPC Method | gRPC Service.Method |
|----------------|-------------------|
| `sui_getObject` | `LedgerService.GetObject` |
| `sui_multiGetObjects` | `LedgerService.BatchGetObjects` |
| `suix_getOwnedObjects` | `StateService.ListOwnedObjects` |
| `suix_getCoins` | `StateService.ListOwnedObjects` (coin `type` filter) |
| `suix_getBalance` | `StateService.GetBalance` |
| `suix_getDynamicFields` | `StateService.ListDynamicFields` |
| `sui_executeTransactionBlock` | `TransactionExecutionService.ExecuteTransaction` |
| `sui_dryRunTransactionBlock` | `TransactionExecutionService.SimulateTransaction` |
| `sui_getTransactionBlock` | `LedgerService.GetTransaction` |
| `sui_getCheckpoint` | `LedgerService.GetCheckpoint` |
| `sui_getNormalizedMoveModule` | `MovePackageService.GetPackage` (modules inside) |
| `suix_subscribeEvent` (WS) | Removed — derive from `SubscriptionService.SubscribeCheckpoints` or use an indexer |
| `suix_subscribeTransaction` (WS) | Removed — derive from `SubscriptionService.SubscribeCheckpoints` or use an indexer |
| `suix_resolveNameServiceAddress` | `NameService.LookupName` |

### Key Differences

1. **Checkpoint streaming replaces WebSocket:** per-event/per-tx WS subscriptions are gone. The gRPC API streams whole checkpoints (`SubscribeCheckpoints`); filter for your events client-side or use an indexer.
2. **Binary encoding:** gRPC uses protobuf (smaller, faster) vs JSON-RPC's JSON encoding.
3. **Multiplexing:** Multiple gRPC calls share one HTTP/2 connection.
4. **Type safety:** Protobuf definitions provide strong typing.

### SDK Users

If you use `@mysten/sui` SDK v2:

- **Import changed:** `SuiGrpcClient` from `@mysten/sui/grpc` (not `SuiClient` from `@mysten/sui/client`)
- **Methods under `.core`:** `client.core.getObject(...)` instead of `client.getObject(...)`
- **`options` → `include`:** `include: { content: true }` instead of `options: { showContent: true }`
- **`subscribeEvent` via WebSocket** is removed and **no SDK v2 method replaces it** — for live events use an indexer / GraphQL (the underlying gRPC API only streams checkpoints).
- **Custom RPC middleware** that intercepts JSON-RPC payloads will need updating.
- **Direct `fetch()` calls** to JSON-RPC must be migrated.

## Data Access Architecture (v1.69+)

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

## Indexing Changes (v1.69)

- Checkpoint data encoding changed from BCS to **zstd-compressed protobuf**
- Custom indexers using raw checkpoint data must update their deserialization
- Official indexer framework handles this automatically
- **Adaptive Concurrency Control (v1.68.0):** `Processor::FANOUT` removed — use `fanout` field with `ConcurrencyConfig` enum. `ingest_concurrency` changed from integer to `ConcurrencyConfig` type.
- **Ingestion client** now enforces single source configuration (`v1.71.1+`)
