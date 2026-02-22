# Sui TS SDK — Advanced Examples

## 1. `$extend()` Ecosystem Integrations

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { walrus } from '@mysten/walrus';
import { suins } from '@mysten/suins';
import { deepbook } from '@mysten/deepbook';
import { seal } from '@mysten/seal';
import { zksend } from '@mysten/zksend';

// Chain multiple extensions
const client = new SuiGrpcClient({ network: 'mainnet' })
  .$extend(walrus())
  .$extend(suins())
  .$extend(deepbook());

// Walrus with custom config
const walrusClient = new SuiGrpcClient({ network: 'testnet' })
  .$extend(walrus({
    packageConfig: {
      systemObjectId: '0x98ebc47370603fe81d9e15491b2f1443d619d1dab720d586e429ed233e1255c1',
      stakingPoolId: '0x20266a17b4f1a216727f3eef5772f8d486a9e3b5e319af80a5b75809c035561d',
    },
  }));
```

## 2. `coinWithBalance` Examples

### SUI Transfer

```typescript
import { Transaction, coinWithBalance } from '@mysten/sui/transactions';

const tx = new Transaction();

// Transfer 1 SUI (auto-split from owned coins)
tx.transferObjects(
  [coinWithBalance({ balance: 1_000_000_000n })],
  tx.pure.address('0xRecipient'),
);

await client.signAndExecuteTransaction({ transaction: tx, signer: keypair });
```

### Non-SUI Token Transfer

```typescript
const tx = new Transaction();

// Transfer 100 USDC (specify coin type)
tx.transferObjects(
  [coinWithBalance({
    balance: 100_000_000n,
    type: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
  })],
  tx.pure.address('0xRecipient'),
);
```

### Use in moveCall

```typescript
const tx = new Transaction();

const coin = coinWithBalance({
  balance: 500_000_000n,
  type: '0xPkg::token::TOKEN',
});

tx.moveCall({
  target: '0xPkg::pool::deposit',
  arguments: [tx.object('0xPoolId'), coin],
  typeArguments: ['0xPkg::token::TOKEN'],
});
```

## 3. Sponsored Transaction Complete Flow

```typescript
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const client = new SuiGrpcClient({ network: 'testnet' });
const senderKeypair = Ed25519Keypair.deriveKeypair('sender mnemonic ...');
const sponsorKeypair = Ed25519Keypair.deriveKeypair('sponsor mnemonic ...');

const senderAddress = senderKeypair.getPublicKey().toSuiAddress();
const sponsorAddress = sponsorKeypair.getPublicKey().toSuiAddress();

// Step 1: Builder creates transaction kind
const tx = new Transaction();
tx.moveCall({
  target: '0xPkg::game::play',
  arguments: [tx.object('0xGameObj')],
});
const kindBytes = await tx.build({ client, onlyTransactionKind: true });

// Step 2: Sponsor wraps with gas info
const sponsoredTx = Transaction.fromKind(kindBytes);
sponsoredTx.setSender(senderAddress);
sponsoredTx.setGasOwner(sponsorAddress);

// Sponsor picks gas coins
const { data: sponsorCoins } = await client.core.listCoins({
  owner: sponsorAddress,
});
sponsoredTx.setGasPayment(sponsorCoins.slice(0, 1).map(c => ({
  objectId: c.coinObjectId,
  version: c.version,
  digest: c.digest,
})));

// Step 3: Both sign
const { signature: sponsorSig } = await sponsoredTx.sign({
  client,
  signer: sponsorKeypair,
});
const { signature: senderSig } = await sponsoredTx.sign({
  client,
  signer: senderKeypair,
});

// Step 4: Execute
const sponsoredBytes = await sponsoredTx.build({ client });
const result = await client.core.executeTransaction({
  transaction: sponsoredBytes,
  signatures: [senderSig, sponsorSig],
  include: { effects: true },
});

if (result.$kind === 'FailedTransaction') {
  throw new Error(`Sponsored tx failed: ${result.FailedTransaction.status.error?.message}`);
}
```

## 4. BCS Encoding for Custom Types

```typescript
import { bcs } from '@mysten/sui/bcs';

// Define a custom struct matching your Move type
const MyStruct = bcs.struct('MyStruct', {
  id: bcs.U64,
  name: bcs.String,
  active: bcs.Bool,
});

// Serialize for use in moveCall
const serialized = MyStruct.serialize({
  id: 42n,
  name: 'example',
  active: true,
});

tx.moveCall({
  target: '0xPkg::module::process',
  arguments: [tx.pure(serialized)],
});

// Define an enum
const MyEnum = bcs.enum('MyEnum', {
  Variant1: null,
  Variant2: bcs.U64,
  Variant3: bcs.struct('Variant3', {
    x: bcs.U32,
    y: bcs.U32,
  }),
});

// Vectors with BCS
const encoded = bcs.vector(bcs.U64).serialize([1n, 2n, 3n]);
tx.moveCall({
  target: '0xPkg::module::process_vec',
  arguments: [tx.pure(encoded)],
});
```

## 5. Multi-Command PTB Composition

```typescript
const tx = new Transaction();

// 1. Split coins for multiple operations
const [depositCoin, feeCoin] = tx.splitCoins(tx.gas, [
  tx.pure.u64(10_000_000_000n),
  tx.pure.u64(100_000_000n),
]);

// 2. Deposit into pool
const [lpToken] = tx.moveCall({
  target: '0xPkg::pool::deposit',
  arguments: [tx.object('0xPoolId'), depositCoin],
  typeArguments: ['0x2::sui::SUI'],
});

// 3. Stake LP token
tx.moveCall({
  target: '0xPkg::farm::stake',
  arguments: [tx.object('0xFarmId'), lpToken],
});

// 4. Pay fee
tx.transferObjects([feeCoin], tx.pure.address('0xFeeCollector'));

// All 4 operations execute atomically
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
  include: { effects: true, events: true },
});
```

## 6. Dev Inspect (Dry Run)

Simulate a transaction without executing it on-chain. Useful for estimating gas and checking effects.

```typescript
const tx = new Transaction();
tx.moveCall({
  target: '0xPkg::module::view_function',
  arguments: [tx.object('0xObjId')],
});

// gRPC — simulateTransaction
const txBytes = await tx.build({ client });
const simResult = await client.core.simulateTransaction({
  transaction: txBytes,
  include: { effects: true, events: true },
});

console.log('Effects:', simResult.effects);
console.log('Events:', simResult.events);
```

### Reading return values from dev inspect

```typescript
const tx = new Transaction();
tx.moveCall({
  target: '0xPkg::module::get_value',
  arguments: [tx.object('0xObjId')],
});

tx.setSender('0xSenderAddress');
const txBytes = await tx.build({ client });
const result = await client.core.simulateTransaction({
  transaction: txBytes,
  include: { effects: true },
});

// Parse return values from the results
```

## 7. Paginated Query Pattern

For queries that return large result sets, use cursor-based pagination:

```typescript
async function getAllOwnedObjects(
  client: SuiGrpcClient,
  owner: string,
) {
  const allObjects = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const page = await client.core.listOwnedObjects({
      owner,
      include: { content: true },
      cursor,
      limit: 50,
    });

    allObjects.push(...page.data);
    cursor = page.nextCursor ?? null;
    hasMore = page.hasNextPage;
  }

  return allObjects;
}

// Usage
const objects = await getAllOwnedObjects(client, '0xMyAddress');
console.log(`Found ${objects.length} objects`);
```

### Paginated coin fetching

```typescript
async function getAllCoins(
  client: SuiGrpcClient,
  owner: string,
  coinType?: string,
) {
  const allCoins = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const page = await client.core.listCoins({
      owner,
      coinType,
      cursor,
      limit: 50,
    });

    allCoins.push(...page.data);
    cursor = page.nextCursor ?? null;
    hasMore = page.hasNextPage;
  }

  return allCoins;
}
```
