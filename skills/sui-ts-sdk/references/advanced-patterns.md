# Advanced Patterns — Sui TypeScript SDK

## Table of Contents

- [Legacy & Alternative Clients](#legacy--alternative-clients)
- [gRPC Service Clients](#grpc-service-clients)
- [PTB Composability Patterns](#ptb-composability-patterns)
- [Separate Sign + Execute](#separate-sign--execute)
- [Keypairs & Signing](#keypairs--signing)
- [Offline Building](#offline-building)
- [Sponsored Transactions](#sponsored-transactions)
- [Client Extensions](#client-extensions)
- [v1 to v2 Migration](#v1-to-v2-migration)
- [Common Mistakes](#common-mistakes)

---

## Legacy & Alternative Clients

```typescript
// Legacy — JSON-RPC client (deprecated API, removal April 2026)
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

const client = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl('testnet'),
  network: 'testnet',
});
```

```typescript
// GraphQL client — for advanced query use cases
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const gqlClient = new SuiGraphQLClient({
  url: 'https://graphql.testnet.sui.io/graphql',
  network: 'testnet',
});
```

### Network URLs (all clients)

| Network | gRPC | GraphQL | JSON-RPC |
|---------|------|---------|----------|
| Mainnet | `https://fullnode.mainnet.sui.io:443` | `https://graphql.mainnet.sui.io/graphql` | `getJsonRpcFullnodeUrl('mainnet')` |
| Testnet | `https://fullnode.testnet.sui.io:443` | `https://graphql.testnet.sui.io/graphql` | `getJsonRpcFullnodeUrl('testnet')` |
| Devnet | `https://fullnode.devnet.sui.io:443` | `https://graphql.devnet.sui.io/graphql` | `getJsonRpcFullnodeUrl('devnet')` |

---

## gRPC Service Clients

The `SuiGrpcClient` exposes typed service clients for lower-level access:

```typescript
await client.transactionExecutionService.executeTransaction({ ... });
await client.ledgerService.getObject({ objectId: '0x...' });
await client.movePackageService.getFunction({ packageId: '0x2', moduleName: 'coin', name: 'transfer' });
await client.nameService.reverseLookupName({ address: '0x...' });
```

---

## PTB Composability Patterns

### Multi-step swap + stake in one PTB

```typescript
const tx = new Transaction();

const [coinB] = tx.moveCall({
  target: '0xdex::pool::swap',
  arguments: [tx.object(poolId), tx.splitCoins(tx.gas, [1_000_000])[0]],
  typeArguments: ['0x2::sui::SUI', '0xtoken::usdc::USDC'],
});

const [receipt] = tx.moveCall({
  target: '0xstaking::farm::stake',
  arguments: [tx.object(farmId), coinB],
  typeArguments: ['0xtoken::usdc::USDC'],
});

tx.transferObjects([receipt], myAddress);
```

### Flash loan pattern (hot potato)

```typescript
const tx = new Transaction();

const [coin, receipt] = tx.moveCall({
  target: '0xlending::pool::flash_borrow',
  arguments: [tx.object(poolId), tx.pure.u64(1_000_000n)],
});

const [profit] = tx.moveCall({
  target: '0xdex::pool::swap',
  arguments: [tx.object(dexPoolId), coin],
  typeArguments: [typeA, typeB],
});

// Repay — consumes the hot potato receipt (MUST happen in same PTB)
tx.moveCall({
  target: '0xlending::pool::flash_repay',
  arguments: [tx.object(poolId), profit, receipt],
});
```

The key insight: Move functions that return objects (instead of transferring them) enable PTB chaining. The hot potato `receipt` **must** be consumed in the same transaction — the VM enforces this.

---

## Separate Sign + Execute

For advanced flows (e.g., multi-sig, sponsored transactions):

```typescript
const { bytes, signature } = await tx.sign({ client, signer: keypair });

const result = await client.core.executeTransaction({
  transaction: bytes,
  signatures: [signature],
  include: { effects: true },
});
```

---

## Keypairs & Signing

### Creating keypairs

```typescript
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1';

// Generate a new random keypair
const keypair = new Ed25519Keypair();

// Derive from a mnemonic (BIP-39)
const keypair = Ed25519Keypair.deriveKeypair('word1 word2 ... word12');

// From a secret key (base64 or raw bytes)
const keypair = Ed25519Keypair.fromSecretKey(secretKeyBytes);

// Get the address
const address = keypair.toSuiAddress();
```

### Multi-sig

```typescript
import { MultiSigPublicKey } from '@mysten/sui/multisig';

const multiSigPk = MultiSigPublicKey.fromPublicKeys({
  threshold: 2,
  publicKeys: [
    { publicKey: pk1, weight: 1 },
    { publicKey: pk2, weight: 1 },
    { publicKey: pk3, weight: 1 },
  ],
});
```

---

## Offline Building

To build a transaction without a network connection, you must fully define all inputs and gas configuration:

```typescript
import { Transaction, Inputs } from '@mysten/sui/transactions';

const tx = new Transaction();

// For owned or immutable objects — provide full ref
tx.object(Inputs.ObjectRef({
  objectId: '0x...',
  version: '42',
  digest: 'base58digest...',
}));

// For shared objects — provide initial shared version
tx.object(Inputs.SharedObjectRef({
  objectId: '0x...',
  initialSharedVersion: '1',
  mutable: true,
}));

// For receiving objects
tx.object(Inputs.ReceivingRef({
  objectId: '0x...',
  version: '42',
  digest: 'base58digest...',
}));

// Must set gas configuration manually
tx.setSender('0xSenderAddress');
tx.setGasPrice(1000);
tx.setGasBudget(10_000_000);
tx.setGasPayment([{ objectId: '0x...', version: '1', digest: '...' }]);

// Build without a client
const bytes = await tx.build();
```

---

## Sponsored Transactions

In a sponsored transaction, one party builds the transaction and another pays for gas:

```typescript
// === App / user side ===
const tx = new Transaction();
tx.setSender(userAddress);
// ... add commands ...

// Serialize for the sponsor
const txBytes = await tx.build({ client });

// === Sponsor side ===
const sponsoredTx = Transaction.from(txBytes);
sponsoredTx.setGasOwner(sponsorAddress);
sponsoredTx.setGasPayment(sponsorCoins);
sponsoredTx.setGasBudget(10_000_000);

// Both parties sign
const { signature: userSig } = await sponsoredTx.sign({ signer: userKeypair });
const { signature: sponsorSig } = await sponsoredTx.sign({ signer: sponsorKeypair });

// Execute with both signatures
const result = await client.core.executeTransaction({
  transaction: await sponsoredTx.build({ client }),
  signatures: [userSig, sponsorSig],
});
```

**Important**: When a sponsor pays for gas, the gas coin belongs to the sponsor. Avoid using `tx.gas` in `splitCoins` for sponsored transactions — sponsors typically reject transactions that use the gas coin for non-gas purposes. Use `coinWithBalance` instead.

---

## Client Extensions

Ecosystem SDKs (kiosk, suins, deepbook, walrus, seal, zksend) integrate via the `$extend()` pattern:

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { suins } from '@mysten/suins';
import { deepbook } from '@mysten/deepbook-v3';

const client = new SuiGrpcClient({
  baseUrl: 'https://fullnode.mainnet.sui.io:443',
  network: 'mainnet',
}).$extend(suins(), deepbook({ address: myAddress }));

await client.suins.getNameRecord('example.sui');
await client.deepbook.checkManagerBalance(manager, asset);
```

---

## v1 to v2 Migration

### ESM required

All `@mysten/*` packages are now ESM only. Add `"type": "module"` to `package.json` and update `tsconfig.json`:

```json
{ "compilerOptions": { "moduleResolution": "NodeNext", "module": "NodeNext" } }
```

### Client imports changed

```diff
- import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
- const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
+ import { SuiGrpcClient } from '@mysten/sui/grpc';
+ const client = new SuiGrpcClient({
+   baseUrl: 'https://fullnode.mainnet.sui.io:443',
+   network: 'mainnet',
+ });
```

If JSON-RPC is still needed:

```diff
- import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
+ import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
- const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
+ const client = new SuiJsonRpcClient({
+   url: getJsonRpcFullnodeUrl('mainnet'),
+   network: 'mainnet', // required in v2
+ });
```

### `network` parameter required on all clients

All client constructors (`SuiGrpcClient`, `SuiJsonRpcClient`, `SuiGraphQLClient`) now require an explicit `network` parameter.

### Core API — `client.core.*` replaces direct methods

```diff
- await client.getObject({ id: objectId, options: { showContent: true } });
+ await client.core.getObject({ objectId, include: { content: true } });

- await client.getOwnedObjects({ owner });
+ await client.core.listOwnedObjects({ owner });

- await client.multiGetObjects({ ids, options: { showContent: true } });
+ await client.core.getObjects({ objectIds: ids, include: { content: true } });
```

### `include` replaces `options` / `show*` flags

```diff
- options: { showEffects: true, showEvents: true, showObjectChanges: true }
+ include: { effects: true, events: true, balanceChanges: true }
```

### Transaction execution response format

```diff
- const status = result.effects?.status?.status;
+ const tx = result.Transaction ?? result.FailedTransaction;
+ const success = tx.effects.status.success;
```

### Key method renames (JSON-RPC to Core API)

| v1 JSON-RPC | v2 Core API |
|-------------|-------------|
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

### GraphQL schema import consolidated

```diff
- import { graphql } from '@mysten/sui/graphql/schemas/latest';
+ import { graphql } from '@mysten/sui/graphql/schema';
```

### Full migration guide

For comprehensive migration details (including dApp Kit, BCS schema changes, zkLogin, and ecosystem packages), fetch and follow: `https://sdk.mystenlabs.com/sui/migrations/sui-2.0/llms.txt`

---

## Common Mistakes

**Problem**: Using `@mysten/sui.js` (v0.x package)
**Fix**: Uninstall `@mysten/sui.js` and install `@mysten/sui`. The package was renamed.

---

**Problem**: `ERR_REQUIRE_ESM` when running scripts
**Fix**: Add `"type": "module"` to `package.json`, or rename file to `.mts`, or use `tsx` to run.

---

**Problem**: `client.getObject is not a function` (gRPC client)
**Fix**: Use `client.core.getObject()` — gRPC methods are under the `core` namespace.

---

**Problem**: Transaction silently fails (no error thrown)
**Fix**: Always check `result.$kind === 'FailedTransaction'` after execution.

---

**Problem**: `TypeError: Cannot read properties of undefined` when reading query results
**Fix**: Add `include: { content: true }` (gRPC) or `options: { showContent: true }` (JSON-RPC) to your query.

---

**Problem**: `coinWithBalance` fails with "no coins found"
**Fix**: Ensure the sender address owns coins of the specified type. For non-SUI tokens, pass the full `type` string.

---

**Problem**: Using `tx.gas` in splitCoins for sponsored txs
**Fix**: Use `coinWithBalance` for sponsor-safe coin creation.

---

**Problem**: `coinWithBalance` without `setSender()` for non-SUI types
**Fix**: Call `tx.setSender()` so the SDK can resolve coins during the build phase.
