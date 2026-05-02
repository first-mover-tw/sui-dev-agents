---
name: sui-seal
description: Use when implementing data encryption, access control, or secrets management on SUI using the Seal protocol. Triggers on threshold encryption, data privacy, token-gated content, encrypted storage, decryption policies, paywall, gated access, encrypted NFT metadata, private data sharing, or any scenario requiring on-chain access control for off-chain data. Also use when the user mentions Seal, pay-to-decrypt, "only NFT holders can see", or subscriber-only content on SUI.
---

# SUI Seal — Decentralized Secrets Management

**On-chain access policies + threshold encryption + decentralized key servers.**

## SDK Versions

Targets: `@mysten/sui` ^2.0, `@mysten/seal` ^1.0. Last verified: 2026-05-02.

If you see `Cannot find module '@mysten/sui/client'` or `SuiClient is not exported`, you have mixed sui 1.x examples with sui 2.x install — `SuiClient` was removed in sui 2.x. Use `SuiGrpcClient` from `@mysten/sui/grpc` (recommended) or `SuiJsonRpcClient` from `@mysten/sui/jsonRpc`. See `sui-ts-sdk` skill for full migration.

Do not mix `@mysten/sui@1.x` and `@2.x` in the same install. Run `npm ls @mysten/sui` before adding seal/walrus/dapp-kit packages — peer-deps will silently pull a second sui copy.

## What Seal Does

Seal is a Decentralized Secrets Management (DSM) platform on SUI:

1. **Encrypt** data client-side using Seal SDK
2. **Define access policies** in Move smart contracts (who can decrypt, when, under what conditions)
3. **Threshold decrypt** — key servers release key shares only when the on-chain policy approves
4. **Storage agnostic** — encrypted blobs can live on Walrus, IPFS, S3, or anywhere

Security guarantees:
- Privacy holds as long as fewer than `t` of `n` key servers are compromised
- Liveness holds as long as at least `t` key servers are available

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Identity-Based Encryption (IBE)** | Data encrypted to an identity derived from on-chain policy |
| **Threshold Key Servers** | Distributed key management — no single point of failure |
| **Session Keys** | Time-limited decryption credentials created per user session |
| **Access Policy (Move)** | On-chain smart contract that gates decryption approval |
| **Envelope Encryption** | Supports key rotation without re-encrypting data |

## Usage Flow

```
1. App encrypts data with Seal SDK (client-side)
   ↓
2. Encrypted blob stored (Walrus, IPFS, etc.)
   ↓
3. User requests decryption
   ↓
4. Seal SDK creates SessionKey → sends to key servers
   ↓
5. Key servers check on-chain Move policy
   ↓
6. If approved → key shares returned → client decrypts
```

## TypeScript SDK

### Setup

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { seal } from '@aspect/seal-sdk';

const client = new SuiGrpcClient({ network: 'testnet' });

// Configure Seal with key server endpoints
const sealClient = client.extend(
  seal({
    serverConfigs: [
      { url: 'https://seal-ks-1.example.com', weight: 1 },
      { url: 'https://seal-ks-2.example.com', weight: 1 },
      { url: 'https://seal-ks-3.example.com', weight: 1 },
    ],
    verifyKeyServers: true,
    timeout: 10000,
  })
);
```

### Encrypt

```typescript
// Encrypt data — the policyObjectId determines who can decrypt
const encrypted = await sealClient.seal.encrypt({
  data: new TextEncoder().encode('secret content'),
  policyObjectId: '<POLICY_OBJECT_ID>',
  threshold: 2, // 2-of-3 key servers needed
});

// Store encrypted blob (e.g., on Walrus)
const blobId = await uploadToWalrus(encrypted);
```

### Create Session Key & Decrypt

```typescript
import { SessionKey } from '@aspect/seal-sdk';

// Create a time-limited session key for decryption
const sessionKey = await SessionKey.create({
  address: userAddress,
  packageId: '<ACCESS_POLICY_PACKAGE>',
  ttlMs: 600_000, // 10 minutes
  signer: keypair,
  client: sealClient,
});

// Decrypt — key servers verify the on-chain policy before releasing shares
const decrypted = await sealClient.seal.decrypt({
  encrypted: encryptedBlob,
  sessionKey,
});

const content = new TextDecoder().decode(decrypted);
```

## Move Access Policy Examples

Access policies are Move modules that Seal key servers call to verify authorization.

### Token-Gated Access

```move
/// Only holders of a specific NFT collection can decrypt
module example::token_gate {
    use sui::object;

    struct GatePolicy has key {
        id: UID,
        required_collection: ID,
    }

    /// Seal key servers call this — returns true if caller holds the NFT
    public fun authorize(
        policy: &GatePolicy,
        ctx: &TxContext,
    ): bool {
        // Verify caller owns an object from required_collection
        // Implementation depends on your NFT structure
        true
    }
}
```

### Time-Locked Access

```move
/// Content unlocks after a specific epoch
module example::time_lock {
    use sui::clock::Clock;

    struct TimeLockPolicy has key {
        id: UID,
        unlock_epoch: u64,
    }

    public fun authorize(
        policy: &TimeLockPolicy,
        clock: &Clock,
    ): bool {
        clock::timestamp_ms(clock) >= policy.unlock_epoch
    }
}
```

### Pay-to-Decrypt

```move
/// User must pay to decrypt content
module example::pay_to_decrypt {
    use sui::coin::Coin;
    use sui::sui::SUI;

    struct PayPolicy has key {
        id: UID,
        price: u64,
        recipient: address,
    }

    public fun authorize_and_pay(
        policy: &PayPolicy,
        payment: Coin<SUI>,
        ctx: &mut TxContext,
    ): bool {
        assert!(coin::value(&payment) >= policy.price, 0);
        transfer::public_transfer(payment, policy.recipient);
        true
    }
}
```

## Common Use Cases

| Use Case | Policy Type |
|----------|-------------|
| Premium content / paywall | Pay-to-decrypt |
| NFT-gated community content | Token-gate |
| Time-release announcements | Time-lock |
| Private DAO votes | Membership check |
| Encrypted NFT metadata | Owner-only |
| Subscription content | Token balance check |

## Best Practices

- **Store encrypted blobs on Walrus** for decentralized, censorship-resistant storage
- **Use envelope encryption** for content that needs key rotation
- **Set reasonable SessionKey TTL** — shorter is safer (minutes, not hours)
- **Test policies on testnet** with Seal's testnet key servers before mainnet
- **Handle decryption failures gracefully** — key servers may be temporarily unavailable

## Common Mistakes

❌ **Storing unencrypted data and relying only on access control**
- Seal encrypts data client-side — the encrypted blob is safe even if storage is public

❌ **Hardcoding key server URLs**
- Use configuration so you can switch between testnet/mainnet servers

❌ **Overly permissive policies**
- A policy that always returns `true` defeats the purpose — test authorization logic

❌ **Not handling threshold unavailability**
- If fewer than `t` key servers respond, decryption fails — implement retry with timeout

## Resources

- [Seal Documentation](https://seal.mystenlabs.com/)
- [Seal SDK (TypeScript)](https://sdk.mystenlabs.com/seal)
- [GitHub — MystenLabs/seal](https://github.com/MystenLabs/seal)
- [Seal Mainnet Launch Blog](https://www.mystenlabs.com/blog/seal-mainnet-launch-privacy-access-control)
