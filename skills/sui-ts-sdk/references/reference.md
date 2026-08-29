# Sui TS SDK v1 → v2 API Reference

## Client Method Mapping

| v1 (JSON-RPC) | v2 (Core API) |
|---|---|
| `client.getObject()` | `client.core.getObject()` |
| `client.getOwnedObjects()` | `client.core.listOwnedObjects()` |
| `client.multiGetObjects()` | `client.core.getObjects()` |
| `client.getCoins()` | `client.core.listCoins()` |
| `client.getAllBalances()` | `client.core.listBalances()` |
| `client.getDynamicFields()` | `client.core.listDynamicFields()` |
| `client.getDynamicFieldObject()` | `client.core.getDynamicField()` |
| `client.getTransactionBlock()` | `client.core.getTransaction()` |
| `client.devInspectTransactionBlock()` | `client.core.simulateTransaction()` |
| `client.executeTransactionBlock()` | `client.core.executeTransaction()` |
| `client.signAndExecuteTransactionBlock()` | `client.signAndExecuteTransaction()` |
| `client.waitForTransactionBlock()` | `client.waitForTransaction()` |
| `client.resolveNameServiceAddress()` | `client.core.resolveNameServiceAddress()` (sui ≥2.24.0; also on gRPC/GraphQL Core clients) |
| `client.getLatestSuiSystemState()` | `client.core.getCurrentSystemState()`; top-level `client.getCurrentSystemState(options?)` on `SuiGrpcClient` / `SuiGraphQLClient` since 2.25.0 |
| `client.getProtocolConfig()` | `client.core.getProtocolConfig()`; top-level `client.getProtocolConfig(options?)` since 2.25.0 |
| `client.getChainIdentifier()` | `client.core.getChainIdentifier()`; top-level `client.getChainIdentifier(options?)` since 2.25.0 |
| `client.getDynamicFieldObject()` (object-valued) | `client.core.getDynamicObjectField()`; top-level `client.getDynamicObjectField({ parentId, name })` since 2.25.0 |
| `client.getReferenceGasPrice()` | `client.getReferenceGasPrice(options?)` — optional `{ signal }` accepted since 2.25.0; the zero-arg call still works |
| `SuiHTTPStatusError` / `code === 'notExists'` checks | `ObjectError` / `TransactionError` (extend `SuiClientError`, exported from `@mysten/sui/client`, since 2.26.0): branch on transport-neutral `error.reason` (`ObjectErrorReason = 'notFound' \| 'deleted' \| 'unknown'`, `TransactionErrorReason = 'notFound'`); `error.code` stays transport-specific (gRPC missing object → `'notExists'` again from 2.26.1 — 2.26.0 returned the raw status number) |
| `tx.timestampMs` / `tx.checkpoint` on `getTransactionBlock` | `Transaction.timestampMs: number \| null` and `Transaction.checkpoint: string \| null` on Core API transaction results since 2.27.0 — `null` for un-checkpointed results (`executeTransaction` / `simulateTransaction`); non-optional, so custom `CoreClient` implementations must populate them |

## Import Path Changes

| v1 | v2 |
|---|---|
| `SuiClient` from `@mysten/sui/client` | Removed. Use `SuiGrpcClient` from `@mysten/sui/grpc` or `SuiJsonRpcClient` from `@mysten/sui/jsonRpc` |
| `getFullnodeUrl` from `@mysten/sui/client` | Removed. Use `getJsonRpcFullnodeUrl` from `@mysten/sui/jsonRpc` or `network` param for gRPC |
| `Commands` | `TransactionCommands` |
| `graphql` from `@mysten/sui/graphql/schemas/latest` | `graphql` from `@mysten/sui/graphql/schema` |
| `TransactionBlock` from `@mysten/sui/transactions` | `Transaction` from `@mysten/sui/transactions` |

## Options → Include Mapping

v2 replaces `options` with `include` for specifying which data to return.

| v1 `options` | v2 `include` |
|---|---|
| `showContent: true` | `content: true` |
| `showOwner: true` | `owner: true` |
| `showEffects: true` | `effects: true` |
| `showEvents: true` | `events: true` |
| `showObjectChanges: true` | `balanceChanges: true` |

### Example

```typescript
// @check:skip
// v1
const obj = await client.getObject({
  id: '0x123',
  options: {
    showContent: true,
    showOwner: true,
  },
});

// v2
const obj = await client.core.getObject({
  objectId: '0x123',
  include: {
    content: true,
    owner: true,
  },
});
```

## ESM Requirements

v2 of `@mysten/sui` is ESM-only. To migrate:

1. **`package.json`**: Add `"type": "module"`
2. **Imports**: Use `import` syntax (no `require()`)
3. **File extensions**: Use `.mts` or `.ts` with ESM-compatible tsconfig
4. **tsconfig.json**: Set `"module": "nodenext"` or `"module": "esnext"`, and `"moduleResolution": "nodenext"` or `"moduleResolution": "bundler"`

```jsonc
// tsconfig.json (recommended)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "esModuleInterop": true,
    "strict": true
  }
}
```

## `$extend()` Ecosystem Integration

v2 introduces `$extend()` for composing ecosystem SDKs onto the client:

```typescript
// @check:skip — illustrative placeholder method calls
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { walrus } from '@mysten/walrus';
import { suins } from '@mysten/suins';

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' })
  .$extend(walrus())
  .$extend(suins());

// Now client has walrus and suins methods (placeholder methods — see each SDK's docs)
await client.walrus.doSomething();
await client.suins.getName('0xAddress');
```

### Available Extensions

| Package | Import | Extension |
|---|---|---|
| `@mysten/walrus` | `import { walrus } from '@mysten/walrus'` | `.$extend(walrus())` |
| `@mysten/suins` | `import { suins } from '@mysten/suins'` | `.$extend(suins())` |
| `@mysten/deepbook-v3` | `import { deepbook } from '@mysten/deepbook-v3'` | `.$extend(deepbook({ address }))` |
| `@mysten/zksend` | `import { zksend } from '@mysten/zksend'` | `.$extend(zksend())` |

Note: `@mysten/seal` does **not** ship a client extension. Construct `new SealClient({ suiClient, serverConfigs })` directly — see the `sui-seal` skill.

Each extension adds its own namespace of methods to the client instance, keeping concerns separated while sharing the same underlying transport.
