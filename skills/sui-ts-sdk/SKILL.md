---
name: sui-ts-sdk
description: Use when writing TypeScript code interacting with SUI blockchain via @mysten/sui SDK. Covers PTB construction, client setup, transaction execution, and on-chain queries. Triggers on backend scripts, CLI tools, serverless functions, or any non-React TS SDK usage. For frontend-specific setup (dApp Kit, wallet adapters, React hooks), use sui-frontend skill alongside this one.
---

# Sui TypeScript SDK

**Complete guide to `@mysten/sui` v2+ for backend, CLI, and serverless TypeScript.**

## 1. Package & Imports

The SDK is **ESM-only** (v2+). Use subpath exports — never import from the package root.

```bash
npm install @mysten/sui
```

```typescript
// Client
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { SuiGraphQLClient } from '@mysten/sui/graphql';

// Transactions
import { Transaction } from '@mysten/sui/transactions';
import { Inputs } from '@mysten/sui/transactions';

// Keypairs
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1';

// Utilities
import { coinWithBalance } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
```

> **ESM requirement**: Set `"type": "module"` in `package.json` or use `.mts` extension. CommonJS `require()` is NOT supported.

## 2. Client Setup

### SuiGrpcClient (Recommended)

gRPC is GA and the recommended client. JSON-RPC is deprecated (removal: April 2026).

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';

// Public endpoints — use `network` shorthand
const client = new SuiGrpcClient({ network: 'testnet' });
const client = new SuiGrpcClient({ network: 'mainnet' });
const client = new SuiGrpcClient({ network: 'devnet' });

// Custom fullnode
const client = new SuiGrpcClient({
  network: 'mainnet',
  baseUrl: 'https://your-fullnode.example.com:443',
});
```

### SuiJsonRpcClient (Legacy)

```typescript
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

const client = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl('testnet'),
});
```

### SuiGraphQLClient

```typescript
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const gqlClient = new SuiGraphQLClient({
  url: 'https://sui-testnet.mystenlabs.com/graphql',
});
```

## 3. Transaction Construction

All on-chain writes go through the `Transaction` class (renamed from `TransactionBlock` in v1).

```typescript
import { Transaction } from '@mysten/sui/transactions';

const tx = new Transaction();

// Add commands (see sections 6-7)
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1_000_000_000)]);
tx.transferObjects([coin], tx.pure.address('0xRecipient'));

// Execute
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
});
```

## 4. Pure Value Inputs

Non-object inputs must be serialized as BCS. Use `tx.pure.*` typed helpers:

```typescript
tx.pure.address('0xSomeAddress')    // Move `address`
tx.pure.bool(true)                   // Move `bool`
tx.pure.string('hello')             // Move `vector<u8>` (UTF-8)
tx.pure.u8(255)                      // Move `u8`
tx.pure.u16(65535)                   // Move `u16`
tx.pure.u32(4294967295)             // Move `u32`
tx.pure.u64(1_000_000_000n)         // Move `u64`
tx.pure.u128(100n)                   // Move `u128`
tx.pure.u256(100n)                   // Move `u256`

// Vectors and Options
tx.pure.vector('u64', [1n, 2n, 3n])
tx.pure.option('address', '0xAbc')
tx.pure.option('u64', null)          // None

// Raw BCS (advanced)
tx.pure(bcs.U64.serialize(100))
```

## 5. Object Inputs

```typescript
// By object ID (auto-resolved by SDK)
tx.object('0xObjectId')

// System shortcuts
tx.object.clock()          // 0x6 — sui::clock::Clock
tx.object.random()         // 0x8 — sui::random::Random
tx.object.denyList()       // 0x403 — sui::deny_list::DenyList
tx.object.system()         // 0x5 — sui_system::SuiSystemState

// Receiving objects
tx.object.receiving('0xObjectId')
```

## 6. Built-in Commands

### splitCoins
```typescript
// Split from gas coin
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1_000_000_000)]);

// Split multiple amounts
const coins = tx.splitCoins(tx.gas, [
  tx.pure.u64(1_000_000_000),
  tx.pure.u64(2_000_000_000),
]);
```

### mergeCoins
```typescript
tx.mergeCoins(primaryCoin, [coin1, coin2]);
```

### transferObjects
```typescript
tx.transferObjects([coin, nft], tx.pure.address('0xRecipient'));
```

### moveCall
```typescript
tx.moveCall({
  target: '0xPkg::module::function',
  arguments: [tx.object('0xObj'), tx.pure.u64(100)],
  typeArguments: ['0xPkg::module::MyType'],
});
```

### makeMoveVec
```typescript
// Typed vector of objects
const vec = tx.makeMoveVec({
  type: '0xPkg::module::Item',
  elements: [item1, item2],
});
```

### publish
```typescript
const [upgradeCap] = tx.publish({
  modules: compiledModules,
  dependencies: [
    '0x0000000000000000000000000000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000000000000000000000000000002',
  ],
});
```

## 7. Command Result Chaining

Commands return results that can be used as inputs to subsequent commands — this is what makes PTBs atomic and composable.

```typescript
const tx = new Transaction();

// Split a coin from gas
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1_000_000_000)]);

// Use the result in a move call
tx.moveCall({
  target: '0xPkg::module::deposit',
  arguments: [tx.object('0xPool'), coin],
});

// Access nested results
const result = tx.moveCall({
  target: '0xPkg::module::swap',
  arguments: [tx.object('0xPool'), coin],
});
// result[0], result[1] — access individual return values
tx.transferObjects([result[0]], tx.pure.address('0xRecipient'));
```

## 8. Gas Coin

`tx.gas` is a special reference to the transaction's gas coin.

```typescript
// Split from gas (most common pattern)
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(100)]);

// Set explicit gas budget
tx.setGasBudget(50_000_000);

// Set gas price
tx.setGasPrice(1000);

// Set explicit gas payment coin(s)
tx.setGasPayment([{
  objectId: '0xGasCoinId',
  version: '1',
  digest: 'abc123',
}]);
```

> **Warning**: Do NOT use `tx.gas` as a moveCall argument directly. Split first.

## 9. Transaction Intents — `coinWithBalance`

For non-SUI coin types, use `coinWithBalance` to automatically resolve coins:

```typescript
import { coinWithBalance } from '@mysten/sui/transactions';

const tx = new Transaction();

// SUI (default)
tx.transferObjects(
  [coinWithBalance({ balance: 1_000_000_000n })],
  tx.pure.address('0xRecipient'),
);

// Non-SUI token
tx.transferObjects(
  [coinWithBalance({
    balance: 1_000_000_000n,
    type: '0xPkg::token::TOKEN',
  })],
  tx.pure.address('0xRecipient'),
);
```

The SDK automatically finds, splits, and merges coins owned by the sender to satisfy the requested balance.

## 10. Execution & Status Checking

```typescript
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
});

// CRITICAL: Always check for failure
if (result.$kind === 'FailedTransaction') {
  throw new Error(
    `Transaction failed: ${result.FailedTransaction.status.error?.message}`
  );
}

console.log('Digest:', result.digest);
```

### With options/include (gRPC)

```typescript
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
  include: {
    effects: true,
    events: true,
    balanceChanges: true,
  },
});
```

### Manual sign + execute

```typescript
const { bytes, signature } = await tx.sign({ client, signer: keypair });

const result = await client.core.executeTransaction({
  transaction: bytes,
  signatures: [signature],
  include: { effects: true },
});
```

## 11. Waiting for Indexing

After execution, the transaction may not be immediately visible to queries. Use `waitForTransaction`:

```typescript
await client.waitForTransaction({ digest: result.digest });

// Now safe to query objects created by the transaction
const obj = await client.core.getObject({
  objectId: createdObjectId,
  include: { content: true },
});
```

## 12. Keypairs & Signing

```typescript
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Generate new
const keypair = new Ed25519Keypair();

// From secret key (base64 or hex)
const keypair = Ed25519Keypair.fromSecretKey('suiprivkey1...');

// From mnemonic
const keypair = Ed25519Keypair.deriveKeypair(
  'your twelve word mnemonic phrase here ...'
);

// Get address
const address = keypair.getPublicKey().toSuiAddress();
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

## 13. Offline Building

When building transactions without a connected client, manually specify all resolution data:

```typescript
import { Transaction, Inputs } from '@mysten/sui/transactions';

const tx = new Transaction();

tx.setSender('0xSenderAddress');
tx.setGasPrice(1000);
tx.setGasBudget(50_000_000);
tx.setGasPayment([{
  objectId: '0xGasCoinId',
  version: '1',
  digest: 'abc123',
}]);

// Owned or immutable objects — use ObjectRef
tx.object(Inputs.ObjectRef({
  objectId: '0xObjId',
  version: '1',
  digest: 'abc123',
}));

// Shared objects — use SharedObjectRef
tx.object(Inputs.SharedObjectRef({
  objectId: '0xSharedObjId',
  initialSharedVersion: '1',
  mutable: true,
}));

// Receiving objects
tx.object(Inputs.ReceivingRef({
  objectId: '0xObjId',
  version: '1',
  digest: 'abc123',
}));

// Build without client
const bytes = await tx.build();
```

## 14. Common Query Patterns

### gRPC (v2 — recommended)

```typescript
const client = new SuiGrpcClient({ network: 'mainnet' });

// Get object
const obj = await client.core.getObject({
  objectId: '0xObjId',
  include: { content: true, owner: true },
});

// List owned objects
const objects = await client.core.listOwnedObjects({
  owner: '0xAddress',
  include: { content: true },
});

// List coins
const coins = await client.core.listCoins({
  owner: '0xAddress',
});

// Get balances
const balances = await client.core.listBalances({
  owner: '0xAddress',
});

// Get transaction
const txn = await client.core.getTransaction({
  digest: 'TransactionDigest',
  include: { effects: true, events: true },
});

// Simulate (dry run)
const simResult = await client.core.simulateTransaction({
  transaction: txBytes,
  include: { effects: true },
});

// Dynamic fields
const fields = await client.core.listDynamicFields({
  parentId: '0xParentObjId',
});
```

### JSON-RPC (legacy)

```typescript
const client = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl('mainnet'),
});

// Uses legacy method names
const obj = await client.getObject({
  id: '0xObjId',
  options: { showContent: true },
});

const objects = await client.getOwnedObjects({
  owner: '0xAddress',
  options: { showContent: true },
});
```

## 15. Sponsored Transactions

A sponsor pays gas on behalf of the sender. Both must sign.

```typescript
// === Builder side ===
const tx = new Transaction();
// ... add commands ...
const kindBytes = await tx.build({ client, onlyTransactionKind: true });

// === Sponsor side ===
const sponsoredTx = Transaction.fromKind(kindBytes);
sponsoredTx.setSender(senderAddress);
sponsoredTx.setGasOwner(sponsorAddress);
sponsoredTx.setGasPayment(sponsorCoins);

const sponsoredBytes = await sponsoredTx.build({ client });

// Sponsor signs
const { signature: sponsorSig } = await sponsoredTx.sign({
  client,
  signer: sponsorKeypair,
});

// === Sender signs the same bytes ===
const { signature: senderSig } = await sponsoredTx.sign({
  client,
  signer: senderKeypair,
});

// === Execute with both signatures ===
const result = await client.core.executeTransaction({
  transaction: sponsoredBytes,
  signatures: [senderSig, sponsorSig],
  include: { effects: true },
});
```

## 16. What the Sui TS SDK is NOT

| Mistake | Reality |
|---------|---------|
| Using SDK to write Move code | SDK is TypeScript-only. Write Move in `.move` files, compile with `sui move build` |
| Expecting `require()` to work | v2 is ESM-only. Use `import` syntax |
| Using `SuiClient` from v1 | Removed. Use `SuiGrpcClient` or `SuiJsonRpcClient` |
| Calling `client.getObject()` on gRPC client | Use `client.core.getObject()` with `include` instead of `options` |
| Passing raw numbers to Move functions | Use `tx.pure.u64()` etc. for BCS serialization |
| Using `tx.gas` directly as moveCall arg | Split first: `const [coin] = tx.splitCoins(tx.gas, [...])` |
| Assuming transaction succeeded | Always check `result.$kind === 'FailedTransaction'` |
| Querying objects immediately after execution | Use `client.waitForTransaction()` first |

## 17. v1 → v2 Migration

### Key Changes

1. **ESM-only** — No more CommonJS. Set `"type": "module"` in `package.json`.
2. **`network` param** — Clients accept `network: 'mainnet'` instead of URL strings.
3. **`client.core.*`** — gRPC methods live under `client.core` namespace.
4. **`include` replaces `options`** — `{ showContent: true }` → `{ content: true }`.
5. **`$extend()`** — Ecosystem integrations via client extension pattern.
6. **`TransactionBlock` → `Transaction`** — Class renamed.
7. **`getFullnodeUrl` → removed** — Use `getJsonRpcFullnodeUrl` for JSON-RPC or `network` param for gRPC.

### Migration Example

```typescript
// v1 (OLD)
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
const client = new SuiClient({ url: getFullnodeUrl('testnet') });
const obj = await client.getObject({
  id: '0x123',
  options: { showContent: true },
});

// v2 (NEW)
import { SuiGrpcClient } from '@mysten/sui/grpc';
const client = new SuiGrpcClient({ network: 'testnet' });
const obj = await client.core.getObject({
  objectId: '0x123',
  include: { content: true },
});
```

See [references/reference.md](references/reference.md) for the complete v1→v2 API mapping table.

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

## References

- [references/reference.md](references/reference.md) — Complete v1→v2 API mapping
- [references/examples.md](references/examples.md) — Advanced PTB examples and patterns
