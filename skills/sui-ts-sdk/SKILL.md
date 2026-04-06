---
name: sui-ts-sdk
description: Use when writing TypeScript code interacting with SUI blockchain via @mysten/sui SDK. Covers PTB construction, client setup, transaction execution, and on-chain queries. Triggers on backend scripts, CLI tools, serverless functions, or any non-React TS SDK usage. For frontend-specific setup (dApp Kit, wallet adapters, React hooks), use sui-frontend skill alongside this one.
---

# Sui TypeScript SDK Skill

You are writing TypeScript code that interacts with the Sui blockchain using the `@mysten/sui` SDK (v2+). Follow these rules precisely. This skill covers PTB (Programmable Transaction Block) construction, client setup, transaction execution, and on-chain queries. These patterns apply equally in backend scripts and frontend apps. If you are building a frontend, use the **sui-frontend** skill first (or alongside this one) for dApp Kit setup, wallet connection, and React integration — then apply the PTB and client patterns from this skill.

---

## 1. Package & Imports

The SDK package is `@mysten/sui`. The old package name `@mysten/sui.js` was renamed at v1.0 and must not be used.

```bash
# correct
npm install @mysten/sui

# deprecated package name — will not receive updates
npm install @mysten/sui.js
```

All imports use subpath exports from `@mysten/sui`:

```typescript
// correct subpath imports
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiGrpcClient } from '@mysten/sui/grpc';

// wrong: old package name
import { TransactionBlock } from '@mysten/sui.js';

// wrong: importing from package root
import { Transaction } from '@mysten/sui';
```

**ESM-only (v2+)**: Set `"type": "module"` in `package.json` and update `tsconfig.json`:

```json
{ "compilerOptions": { "moduleResolution": "NodeNext", "module": "NodeNext" } }
```

---

## 2. Client Setup

The SDK provides three client types. **Use `SuiGrpcClient` for new code** — it is the recommended client with the best performance. The JSON-RPC API is deprecated (removal: April 2026).

```typescript
// Recommended — gRPC client (best performance, type-safe protobuf)
import { SuiGrpcClient } from '@mysten/sui/grpc';

const client = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
});
```

For legacy JSON-RPC, GraphQL clients, and gRPC service clients, see [references/advanced-patterns.md](references/advanced-patterns.md).

### Network URLs

| Network | gRPC base URL |
|---------|--------------|
| Mainnet | `https://fullnode.mainnet.sui.io:443` |
| Testnet | `https://fullnode.testnet.sui.io:443` |
| Devnet | `https://fullnode.devnet.sui.io:443` |

---

## 3. Transaction Construction

A Programmable Transaction Block (PTB) is built using the `Transaction` class. The class was renamed from `TransactionBlock` at v1.0:

```typescript
// correct
import { Transaction } from '@mysten/sui/transactions';
const tx = new Transaction();

// wrong: old class name (pre-1.0)
import { TransactionBlock } from '@mysten/sui.js/transactions';
const txb = new TransactionBlock();
```

### Cloning a transaction

```typescript
// v1.0+
const newTx = Transaction.from(existingTx);

// wrong: old constructor-based cloning
const newTx = new TransactionBlock(existingTx);
```

### Serialization

```typescript
// v1.0+ — async, runs serialization plugins
const json = await tx.toJSON();

// Deserialize
const restored = Transaction.from(json);

// deprecated
const bytes = tx.serialize();
```

---

## 4. Pure Value Inputs

Use `tx.pure.<type>()` helpers for non-object inputs. These handle BCS serialization automatically. **Never manually BCS-encode values when a `tx.pure` helper exists.**

```typescript
// Typed pure helpers
tx.pure.u8(255);
tx.pure.u16(65535);
tx.pure.u32(4294967295);
tx.pure.u64(1000000n);              // accepts bigint or number
tx.pure.u128(1000000n);
tx.pure.u256(1000000n);
tx.pure.bool(true);
tx.pure.string('hello');
tx.pure.address('0xSomeAddress');
tx.pure.id('0xSomeObjectId');       // equivalent to address, for object IDs as values

// Vectors
tx.pure.vector('u64', [100n, 200n, 300n]);
tx.pure.vector('address', [addr1, addr2]);
tx.pure.vector('bool', [true, false]);

// Option
tx.pure.option('u64', 42n);         // Some(42)
tx.pure.option('u64', null);        // None
```

```typescript
// don't manually construct BCS for types that have helpers
import { bcs } from '@mysten/sui/bcs';
tx.pure(bcs.U64.serialize(100));    // unnecessary — use tx.pure.u64(100)
```

For advanced types without a built-in helper, fall back to `tx.pure(bcsBytes)` where `bcsBytes` is a `Uint8Array`:

```typescript
import { bcs } from '@mysten/sui/bcs';

const MyStruct = bcs.struct('MyStruct', {
  id: bcs.Address,
  value: bcs.U64,
});
tx.pure(MyStruct.serialize({ id: '0x...', value: 100n }));
```

---

## 5. Object Inputs

Use `tx.object(id)` for object inputs. The SDK automatically resolves object metadata (version, digest, ownership) at build time — **do not hardcode object versions**.

```typescript
// Let the SDK resolve object details
tx.object('0xSomeObjectId');

// Well-known system object shortcuts
tx.object.system();    // 0x5 — Sui system state
tx.object.clock();     // 0x6 — Clock
tx.object.random();    // 0x8 — Random
tx.object.denyList();  // 0x403 — DenyList

// Construct an Option<Object> input
tx.object.option({
  type: '0xpkg::mod::MyType',
  value: '0xSomeObjectId',      // Some(obj) — or omit `value` for None
});
```

```typescript
// don't hardcode object versions
tx.object(Inputs.ObjectRef({
  objectId: '0x...',
  version: '42',     // will break when object is modified
  digest: 'abc...',
}));
// Exception: offline building (see section 13)
```

### Receiving objects

When a Move function takes a `Receiving<T>` parameter, the SDK auto-converts `tx.object()` to a receiving reference. No special handling is needed — just pass the object ID normally.

---

## 6. Built-in Commands

### splitCoins

Creates new coins by splitting from a source coin. Returns an array of coin references:

```typescript
// Split from gas coin — most common pattern for SUI
const [coin] = tx.splitCoins(tx.gas, [1000]);

// Split multiple amounts
const [coin1, coin2] = tx.splitCoins(tx.gas, [1000, 2000]);

// Split from a non-gas coin
const [portion] = tx.splitCoins(tx.object('0xMyCoin'), [500]);
```

### mergeCoins

Merges coins into a destination coin:

```typescript
tx.mergeCoins(tx.object('0xDestCoin'), [
  tx.object('0xCoinA'),
  tx.object('0xCoinB'),
]);
```

### transferObjects

Transfers one or more objects to a recipient address:

```typescript
// Transfer a split coin
const [coin] = tx.splitCoins(tx.gas, [1000]);
tx.transferObjects([coin], '0xRecipientAddress');

// Transfer existing objects
tx.transferObjects(
  [tx.object('0xObj1'), tx.object('0xObj2')],
  '0xRecipientAddress',
);

// Transfer the entire gas coin (send all SUI to someone)
tx.transferObjects([tx.gas], '0xRecipientAddress');
```

### moveCall

Calls a Move function:

```typescript
tx.moveCall({
  target: '0xPackageId::module_name::function_name',
  arguments: [
    tx.object('0xSomeObject'),     // object argument
    tx.pure.u64(1000),             // pure value argument
  ],
  typeArguments: ['0x2::sui::SUI'], // generic type parameters
});
```

**Return values** from `moveCall` are usable in subsequent commands:

```typescript
const [result] = tx.moveCall({
  target: '0xpkg::amm::swap',
  arguments: [tx.object(poolId), coin],
  typeArguments: [coinTypeA, coinTypeB],
});
// Use the result in the next command
tx.transferObjects([result], myAddress);
```

### makeMoveVec

Constructs a `vector<T>` of objects for passing into a Move function:

```typescript
const vec = tx.makeMoveVec({
  type: '0xpkg::mod::MyType',
  elements: [tx.object('0xA'), tx.object('0xB')],
});
tx.moveCall({
  target: '0xpkg::mod::process_all',
  arguments: [vec],
});
```

### publish

Publishes a new Move package. Build the package with the Sui CLI first, then pass the compiled modules:

```typescript
const tx = new Transaction();
const [upgradeCap] = tx.publish({ modules, dependencies });
tx.transferObjects([upgradeCap], myAddress);
```

To get the `modules` and `dependencies`, run:

```bash
sui move build --dump-bytecode-as-base64 --path ./your_package
```

Parse the JSON output to extract `modules` and `dependencies` arrays.

---

## 7. Command Result Chaining

Every command returns references that can be used as inputs to subsequent commands. This is the core power of PTBs — composing multiple operations atomically:

```typescript
const tx = new Transaction();

// Step 1: Split a coin
const [coin] = tx.splitCoins(tx.gas, [1_000_000]);

// Step 2: Pass the split coin into a Move call
const [receipt] = tx.moveCall({
  target: '0xpkg::shop::buy_item',
  arguments: [tx.object(shopId), coin, tx.pure.string('sword')],
});

// Step 3: Transfer the receipt to the sender
tx.transferObjects([receipt], myAddress);
```

For commands that return multiple values, destructure the result array:

```typescript
const [coinOut, receipt] = tx.moveCall({
  target: '0xpkg::amm::swap',
  arguments: [tx.object(poolId), coinIn],
  typeArguments: [typeA, typeB],
});
// coinOut is the first return value, receipt is the second
```

For advanced PTB composability (multi-step swap+stake, flash loan hot potato patterns), see [references/advanced-patterns.md](references/advanced-patterns.md).

---

## 8. Gas Coin

`tx.gas` is a special reference to the gas payment coin:

```typescript
// Split from gas coin (by-reference)
const [coin] = tx.splitCoins(tx.gas, [100]);

// Merge into gas coin
tx.mergeCoins(tx.gas, [tx.object('0xOtherCoin')]);

// Transfer the entire gas coin (moves all SUI)
tx.transferObjects([tx.gas], recipient);

// Pass gas coin as a Move call argument (by-reference)
tx.moveCall({
  target: '0xpkg::mod::deposit',
  arguments: [tx.object(vaultId), tx.gas],
});
```

### Gas configuration

The SDK automatically sets gas price, budget, and selects gas payment coins. Override only when needed:

```typescript
// Manual overrides (rarely needed)
tx.setGasPrice(1000);
tx.setGasBudget(10_000_000);
tx.setGasPayment([{
  objectId: '0x...',
  version: '1',
  digest: '...',
}]);
// Gas payment coins must not overlap with transaction input objects

// Set sender explicitly (required for some offline or sponsored flows)
tx.setSender('0xSenderAddress');
```

---

## 9. Transaction Intents — `coinWithBalance`

For non-SUI coin types, manually splitting coins is complex because you must find, select, and merge coins of the correct type. The `coinWithBalance` intent automates this:

```typescript
import { coinWithBalance, Transaction } from '@mysten/sui/transactions';

const tx = new Transaction();

// REQUIRED: setSender when using coinWithBalance with non-SUI types
tx.setSender(keypair.toSuiAddress());

tx.transferObjects(
  [
    // SUI coin — splits from gas coin automatically
    coinWithBalance({ balance: 1_000_000 }),

    // Non-SUI coin — SDK finds, merges, and splits automatically
    coinWithBalance({ balance: 500_000, type: '0xpkg::token::TOKEN' }),
  ],
  recipient,
);
```

**Why use `coinWithBalance` over manual `splitCoins`?**

For SUI, `tx.splitCoins(tx.gas, [...])` works fine. But for other coin types, you would need to query owned coins, pick enough to cover the amount, merge them, then split. `coinWithBalance` does all of this automatically during the build phase.

**Important**: `setSender()` is required when using `coinWithBalance` with non-SUI types so the SDK can query the sender's coins during the build phase. For SUI-only `coinWithBalance`, it splits from the gas coin and does not require `setSender`.

---

## 10. Execution & Status Checking

### Sign and execute

```typescript
const result = await client.signAndExecuteTransaction({
  signer: keypair,
  transaction: tx,
});

// ALWAYS check for failure — a finalized tx can still fail (Move abort, gas)
if (result.$kind === 'FailedTransaction') {
  throw new Error(
    `Transaction failed: ${result.FailedTransaction.status.error?.message}`,
  );
}
```

### Execution with include options

```typescript
const result = await client.core.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
  include: { effects: true, events: true, balanceChanges: true, objectTypes: true },
});
```

### Waiting for indexing

After execution, wait before follow-up queries:

```typescript
await client.waitForTransaction({ digest: result.digest });
// Now safe to query updated state
```

For separate sign + execute, multi-sig, keypairs, offline building, sponsored transactions, client extensions, v1→v2 migration, and common mistakes, see:
- [references/advanced-patterns.md](references/advanced-patterns.md)
- [references/reference.md](references/reference.md) - Complete v1-to-v2 API mapping
- [references/examples.md](references/examples.md) - Advanced PTB examples and patterns

---

## 11. Common Query Patterns

### Core API (recommended)

```typescript
// Get object
const obj = await client.core.getObject({
  objectId: '0xObjId',
  include: { content: true, owner: true },
});

// List owned objects
const objects = await client.core.listOwnedObjects({ owner: '0xAddress', include: { content: true } });

// List coins / balances
const coins = await client.core.listCoins({ owner: '0xAddress' });
const balances = await client.core.listBalances({ owner: '0xAddress' });

// Get transaction
const txn = await client.core.getTransaction({ digest: 'Digest', include: { effects: true, events: true } });

// Simulate (dry run)
const simResult = await client.core.simulateTransaction({ transaction: txBytes, include: { effects: true } });

// Dynamic fields
const fields = await client.core.listDynamicFields({ parentId: '0xParentObjId' });
```

### gRPC service clients (lower-level)

```typescript
await client.ledgerService.getObject({ objectId: '0x...' });
await client.transactionExecutionService.executeTransaction({ ... });
await client.movePackageService.getFunction({ packageId: '0x2', moduleName: 'coin', name: 'transfer' });
```

---

## 12. What the Sui TS SDK is NOT

| Mistake | Correct approach |
|---------|-----------------|
| `import ... from '@mysten/sui.js'` | Use `@mysten/sui` — `.js` suffix removed at v1.0 |
| `new TransactionBlock()` | Use `new Transaction()` — renamed at v1.0 |
| `client.signAndExecuteTransactionBlock()` | Use `client.signAndExecuteTransaction()` |
| Hardcoding object versions in `tx.object()` | Let SDK resolve automatically (except offline builds) |
| Manual BCS for basic types | Use `tx.pure.u64()`, `tx.pure.address()`, etc. |
| Not checking `result.$kind` after execution | Always check for `FailedTransaction` |
| Querying state immediately after execution | Use `client.waitForTransaction()` first |
| Using `SuiClient` / `getFullnodeUrl` | Removed in v2 — use `SuiGrpcClient` |
| `tx.serialize()` | Use `await tx.toJSON()` |

---

## Integration

### Called By
- `sui-full-stack` (Phase 2: Development)
- `sui-frontend` (PTB construction patterns)

### Calls
- `sui-docs-query` - Query latest SDK documentation

## References

- [references/advanced-patterns.md](references/advanced-patterns.md) - Execution, keypairs, offline building, sponsored tx, extensions, v1→v2 migration, common mistakes
- [references/reference.md](references/reference.md) - Complete v1-to-v2 API mapping
- [references/examples.md](references/examples.md) - Advanced PTB examples and patterns
