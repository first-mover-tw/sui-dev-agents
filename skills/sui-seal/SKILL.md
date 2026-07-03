---
name: sui-seal
description: Use when implementing data encryption, access control, or secrets management on SUI using the Seal protocol. Triggers on threshold encryption, data privacy, token-gated content, encrypted storage, decryption policies, paywall, gated access, encrypted NFT metadata, private data sharing, or any scenario requiring on-chain access control for off-chain data. Also use when the user mentions Seal, pay-to-decrypt, "only NFT holders can see", or subscriber-only content on SUI. Also covers on-chain encrypted messaging (the @mysten/messaging SDK — encrypted group channels, DMs, chat apps on SUI built on SEAL + Walrus): trigger on "encrypted messaging", "chat app on SUI", "on-chain DM", "group channel encryption", or "@mysten/messaging".
---

# SUI Seal — Decentralized Secrets Management

**On-chain access policies + threshold encryption + decentralized key servers.**

## SDK Versions

Targets: `@mysten/seal` 1.2.3 (^1.1), `@mysten/sui` 2.20.1 (^2.16). Tested: 2026-07-03.

**Compatibility notes:** `@mysten/sui` is a peer dependency of `@mysten/seal`. The `suiClient` must be a v2.x `SuiGrpcClient` (from `@mysten/sui/grpc`) or `SuiJsonRpcClient` (from `@mysten/sui/jsonRpc`) — these satisfy `SealCompatibleClient`. Do not mix `@mysten/sui@1.x` and `@2.x` in the same install — run `npm ls @mysten/sui` before adding seal/walrus/dapp-kit. Seal is NOT a `$extend()` client extension; always instantiate `new SealClient({ ... })` directly.

## What Seal Does

1. **Encrypt** data client-side using Seal SDK
2. **Define access policies** in Move smart contracts via `seal_approve*` entry functions
3. **Threshold decrypt** — key servers release key shares only when the on-chain policy approves the supplied PTB
4. **Storage agnostic** — encrypted blobs can live on Walrus, IPFS, S3, or anywhere

Security:
- Privacy holds as long as fewer than `t` of `n` key servers are compromised
- Liveness holds as long as at least `t` key servers are available

## Core Concepts

| Concept | Description |
|---|---|
| **Identity-Based Encryption (IBE)** | Data encrypted under an `id` derived from on-chain policy |
| **Threshold Key Servers** | Distributed key management — no single point of failure |
| **Session Keys** | Time-limited decryption credentials signed by the user (personal message) |
| **seal_approve PTB** | A built (not executed) PTB calling `seal_approve*` that key servers dry-run to authorize |
| **Access Policy (Move)** | Move module exposing `seal_approve*(id, ...)` entry functions |

## Usage Flow

```
1. App encrypts data with SealClient.encrypt({ packageId, id, threshold, data })
   ↓
2. Encrypted blob (Uint8Array) stored on Walrus / IPFS / DB
   ↓
3. User starts a session: SessionKey.create({ address, packageId, ttlMin, signer, suiClient })
   ↓
4. App builds a Transaction that calls `${packageId}::policy::seal_approve_*` with the id
   ↓
5. tx.build({ client: suiClient, onlyTransactionKind: true }) → txBytes
   ↓
6. sealClient.decrypt({ data, sessionKey, txBytes }) → plaintext
```

## TypeScript SDK

### Setup

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SealClient } from '@mysten/seal';

const suiClient = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
});

// Each entry is a key server *object ID* on-chain — not a URL.
// weight controls how that server counts toward the threshold.
const sealClient = new SealClient({
  suiClient,
  serverConfigs: [
    { objectId: '0xKEYSERVER_OBJ_1', weight: 1 },
    { objectId: '0xKEYSERVER_OBJ_2', weight: 1 },
    { objectId: '0xKEYSERVER_OBJ_3', weight: 1 },
    // optional fields per entry:
    // apiKeyName, apiKey, aggregatorUrl (required for committee-mode servers)
  ],
  verifyKeyServers: true,
  timeout: 10_000,
});
```

### Encrypt

```typescript
// @check:skip
const PACKAGE_ID = '0xYOUR_POLICY_PKG';
// `id` is the IBE identity, passed as a hex string. Convention: bytes that the
// on-chain seal_approve* function will validate (e.g. allowlist object id || nonce).

const { encryptedObject, key } = await sealClient.encrypt({
  threshold: 2,                    // 2-of-3 key servers
  packageId: PACKAGE_ID,
  id: '0xdeadbeef',                // hex-encoded identity string
  data: new TextEncoder().encode('secret content'),
  // optional: aad, kemType, demType (DemType.AesGcm256 by default)
});

// `encryptedObject` is Uint8Array (BCS-serialized) — store wherever you want.
// `key` is the raw symmetric key — DO NOT share; only useful for backup/escrow.
const blobId = await uploadToWalrus(encryptedObject);
```

### Decrypt — full round-trip

```typescript
// @check:skip
import { SessionKey } from '@mysten/seal';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromHex } from '@mysten/sui/utils';

// 1. Create a session key. The user signs a personal message under the hood
//    (signer can be any Signer — Ed25519, EnokiSigner, PasskeyKeypair, etc.).
const keypair = Ed25519Keypair.generate();
const sessionKey = await SessionKey.create({
  address: keypair.toSuiAddress(),
  packageId: PACKAGE_ID,
  ttlMin: 10,           // minutes, NOT ms
  signer: keypair,
  suiClient,
});

// 2. Build (don't execute) the seal_approve PTB. The key servers will
//    dry-run this transaction; if it succeeds, they release the share.
const tx = new Transaction();
tx.moveCall({
  target: `${PACKAGE_ID}::policy::seal_approve_allowlist`,
  arguments: [
    tx.pure.vector('u8', Array.from(fromHex('deadbeef'))), // the id
    tx.object('0xALLOWLIST_OBJ'),
    // ...any other args your seal_approve_* function needs
  ],
});
const txBytes = await tx.build({
  client: suiClient,
  onlyTransactionKind: true,   // REQUIRED — TransactionKind, not full tx
});

// 3. Fetch the encrypted blob and decrypt.
const encryptedBlob: Uint8Array = await fetchFromWalrus(blobId);
const plaintext = await sealClient.decrypt({
  data: encryptedBlob,
  sessionKey,
  txBytes,
});

console.log(new TextDecoder().decode(plaintext));
```

### Batch decrypts (same session, many ids)

```typescript
// @check:skip
// Pre-fetch keys once, then decrypt many objects cheaply.
await sealClient.fetchKeys({
  ids: ['0xdeadbeef', '0xcafebabe'],
  txBytes,           // a single PTB that calls seal_approve* for all ids
  sessionKey,
  threshold: 2,
});

for (const blob of blobs) {
  const pt = await sealClient.decrypt({ data: blob, sessionKey, txBytes });
  // ...
}
```

### Persisting a SessionKey (e.g. across page reloads)

```typescript
// @check:skip
const exported = sessionKey.export();          // ExportedSessionKey (JSON-safe)
localStorage.setItem('seal-sk', JSON.stringify(exported));

// Later:
const restored = SessionKey.import(
  JSON.parse(localStorage.getItem('seal-sk')!),
  suiClient,
  keypair, // optional, only needed if you must re-sign
);
```

### Parsing an encrypted blob's metadata

```typescript
// @check:skip
import { EncryptedObject } from '@mysten/seal';

const meta = EncryptedObject.parse(encryptedBlob);
// → { version, packageId, id, services, threshold, ciphertext, ... }
```

## Move Access Policy

The on-chain side exposes `seal_approve*` entry functions. The function name **must** start with `seal_approve`. The first argument is always the IBE `id` as `vector<u8>`. The body should `abort` if access is denied — success means "release the key".

### Token-gated (NFT holder) example

```move
module example::token_gate {
    use sui::object::{Self, UID, ID};

    public struct GatePolicy has key {
        id: UID,
        required_collection: ID,
    }

    /// Seal key servers dry-run this. Aborts → no key. Returns → key released.
    /// `id` is the IBE identity supplied by the decryptor (must match what was encrypted).
    public fun seal_approve_holder(
        id: vector<u8>,
        policy: &GatePolicy,
        nft: &SomeNFT,             // caller passes their NFT
        _ctx: &TxContext,
    ) {
        assert!(some_nft::collection(nft) == policy.required_collection, 0);
        // (optionally bind `id` to `object::id(nft)` so each NFT has its own key)
    }
}
```

### Time-locked example

```move
module example::time_lock {
    use sui::clock::Clock;

    public struct TimeLockPolicy has key { id: UID, unlock_ms: u64 }

    public fun seal_approve_after(
        _id: vector<u8>,
        policy: &TimeLockPolicy,
        clock: &Clock,
    ) {
        assert!(clock::timestamp_ms(clock) >= policy.unlock_ms, 0);
    }
}
```

### Pay-to-decrypt (split: payment runs as a real tx, approval as dry-run)

```move
module example::paywall {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;

    public struct Receipt has key, store { id: UID, owner: address, paid_for: vector<u8> }

    /// Real transaction: user pays, gets a Receipt object.
    public entry fun pay(price: u64, mut payment: Coin<SUI>, paid_for: vector<u8>, ctx: &mut TxContext) {
        assert!(coin::value(&payment) >= price, 0);
        // ...transfer payment, mint receipt...
    }

    /// seal_approve runs against the user's owned Receipt.
    public fun seal_approve_with_receipt(
        id: vector<u8>,
        receipt: &Receipt,
        ctx: &TxContext,
    ) {
        assert!(receipt.owner == tx_context::sender(ctx), 0);
        assert!(receipt.paid_for == id, 0);
    }
}
```

## Common Use Cases

| Use Case | Policy Type |
|---|---|
| Premium content / paywall | Receipt-based `seal_approve` |
| NFT-gated community content | Holder check |
| Time-release announcements | Clock-based |
| Private DAO votes | Membership check |
| Encrypted NFT metadata | Owner-only |

## Best Practices

- Store encrypted blobs on Walrus for decentralized storage
- Keep `ttlMin` short (5–15 min); rotate session keys
- Test policies against testnet key servers before mainnet
- Always retry with at least `threshold` servers reachable
- Bind the IBE `id` to something on-chain (object ID, content hash) so re-using a key isn't possible

## Common Mistakes

**`sealClient.seal.encrypt(...)` / `client.extend(seal())` — neither exists.**
- Seal exports a `SealClient` class. There is no `.seal` namespace and no `$extend()` factory.
- Use `new SealClient({ suiClient, serverConfigs })`, call `sealClient.encrypt(...)` / `.decrypt(...)` directly.

**Calling `decrypt` without `txBytes`.**
- `txBytes` is mandatory. It must be a `TransactionKind` (`tx.build({ client, onlyTransactionKind: true })`) that calls a `seal_approve*` Move function for the given `id`. Key servers dry-run this PTB; if it aborts, the key is denied.

**`KeyServerConfig.url` — wrong field.**
- Servers are referenced by their on-chain object ID: `{ objectId: '0x…', weight: 1 }`. There is no `url` field. (For committee-mode servers, supply `aggregatorUrl`.)

## See Also

- [advanced-apis.md](references/advanced-apis.md) — Read when you need derived keys without full decrypt, session-key export/reuse across reloads, decoding `EncryptedObject` metadata, or enumerating key servers / public keys (seal ≥1.1.3)
- [messaging.md](references/messaging.md) — Read when the user wants on-chain encrypted messaging / chat / DMs / group channels on SUI (the `@mysten/messaging` `0.x` SDK): channels + SEAL-encrypted message keys + Walrus attachment storage + on-chain membership, composed on top of Seal

## Resources

- [Seal Documentation](https://seal.mystenlabs.com/)
- [Seal SDK reference](https://sdk.mystenlabs.com/seal)
- [GitHub — MystenLabs/seal](https://github.com/MystenLabs/seal)
