---
name: sui-kiosk
description: Use when building NFT marketplaces, enforcing royalties, or managing transfer policies using SUI's Kiosk standard. Triggers on "Kiosk", "NFT marketplace", "transfer policy", "royalty enforcement", "list NFT for sale", "purchase rules", or any NFT commerce on SUI. Also use when the user asks about listing, delisting, or trading NFTs with enforced rules.
---

# SUI Kiosk Integration

**Official NFT trading standard with transfer policies and royalties.**

## SDK Versions

Targets: `@mysten/kiosk` 1.4.6 (^1.2), `@mysten/sui` 2.27.1 (^2.27.1). Tested: 2026-08-29.

**Compatibility notes:** As of `@mysten/kiosk@1.4.0`, `KioskCompatibleClient` is typed as `ClientWithCoreApi` — `SuiGrpcClient` (and any other Core-API client) is now accepted directly; objects and transfer-policy events route through the shared Core API. **Public fullnode JSON-RPC is shut off** (permanent deactivation landed 2026-07-31) — prefer `SuiGrpcClient` or `SuiGraphQLClient` (or your own full node's JSON-RPC).

## Overview

Kiosk provides:
- Standard NFT marketplace protocol
- Programmable transfer policies
- Automatic royalty enforcement
- Trading rule flexibility
- Marketplace interoperability

## Use Cases

- NFT marketplaces
- Game item trading
- Collectible platforms
- Any NFT trading scenario

## Quick Start

### Create Kiosk

```move
use sui::kiosk::{Self, Kiosk, KioskOwnerCap};

public fun create_kiosk(ctx: &mut TxContext): (Kiosk, KioskOwnerCap) {
    kiosk::new(ctx)
}
```

### List NFT in Kiosk

```move
public fun list_nft<T: key + store>(
    kiosk: &mut Kiosk,
    cap: &KioskOwnerCap,
    nft: T,
    price: u64
) {
    kiosk::place_and_list<T>(kiosk, cap, nft, price);
}
```

### Purchase from Kiosk

```move
use sui::transfer_policy::{Self, TransferPolicy};
use sui::coin::Coin;
use sui::sui::SUI;

public fun purchase_nft<T: key + store>(
    kiosk: &mut Kiosk,
    item_id: ID,
    payment: Coin<SUI>,
    policy: &TransferPolicy<T>,
    ctx: &mut TxContext
): T {
    let (nft, request) = kiosk::purchase<T>(kiosk, item_id, payment);

    // Confirm transfer policy
    transfer_policy::confirm_request(policy, request);

    nft
}
```

## Transfer Policy with Royalties

```move
use sui::transfer_policy::{Self, TransferPolicy, TransferPolicyCap};

// Create policy with royalty rule
public fun create_royalty_policy<T>(
    publisher: &Publisher,
    royalty_bps: u64,  // Basis points (e.g., 500 = 5%)
    ctx: &mut TxContext
): (TransferPolicy<T>, TransferPolicyCap<T>) {
    let (policy, cap) = transfer_policy::new<T>(publisher, ctx);

    // Add royalty rule
    royalty_rule::add<T>(
        &mut policy,
        &cap,
        royalty_bps,
        ctx
    );

    (policy, cap)
}
```

## Frontend Integration

```typescript
// @check:skip
import { Transaction } from '@mysten/sui/transactions';
import { KioskTransaction } from '@mysten/kiosk';

// List NFT for sale
async function listNFT(kioskId: string, nftId: string, price: number) {
  const tx = new Transaction();

  tx.moveCall({
    target: '0x2::kiosk::place_and_list',
    arguments: [
      tx.object(kioskId),
      tx.object(kioskOwnerCapId),
      tx.object(nftId),
      tx.pure.u64(BigInt(price))
    ],
    typeArguments: [`${PACKAGE_ID}::nft::NFT`]
  });

  return await signAndExecute({ transaction: tx });
}

// Purchase an NFT from a kiosk.
//
// `kiosk::purchase` returns a `TransferRequest` hot-potato that MUST be resolved
// against the item's TransferPolicy (royalty, lock, etc.) or the transaction
// aborts — you cannot just drop it. `KioskTransaction.purchaseAndResolve` runs
// the purchase AND resolves every policy rule for you, so never hand-roll the
// `transfer_policy::confirm_request` call. The buyer needs their own kiosk to
// receive the item.
async function purchaseNFT(
  itemId: string,
  price: string,
  sellerKioskId: string
) {
  const { kioskOwnerCaps } = await kioskClient.getOwnedKiosks({ address: buyer });

  const tx = new Transaction();
  // The buyer needs a kiosk to receive the item: reuse an existing one, or
  // create a fresh kiosk in the same tx (`finalize()` shares it and returns the
  // cap to the signer). `kioskOwnerCaps[0]` alone would be `undefined` for a
  // first-time buyer.
  const kioskTx = kioskOwnerCaps.length
    ? new KioskTransaction({ transaction: tx, kioskClient, cap: kioskOwnerCaps[0] })
    : new KioskTransaction({ transaction: tx, kioskClient }).create();

  await kioskTx.purchaseAndResolve({
    itemType: `${PACKAGE_ID}::nft::NFT`,
    itemId,
    price,
    sellerKiosk: sellerKioskId,
  });

  kioskTx.finalize();
  return await signAndExecute({ transaction: tx });
}
```

## Best Practices

- Always use Kiosk for NFT marketplaces
- Implement transfer policies for royalties
- Support multiple payment tokens
- Handle partial fills gracefully
- Test with various NFT types

## Common Mistakes

❌ **Bypassing Kiosk transfer policies**
- **Problem:** Royalties not enforced, seller loses revenue
- **Fix:** Always use `kiosk::purchase` and `transfer_policy::confirm_request`

❌ **Not checking NFT ownership before listing**
- **Problem:** Transaction fails, poor UX
- **Fix:** Verify ownership via `kiosk::has_item` before listing

❌ **Forgetting to delist before transfer**
- **Problem:** NFT locked in Kiosk, cannot be transferred
- **Fix:** Call `kiosk::delist` before any transfer operation

❌ **Hardcoding royalty percentages**
- **Problem:** Cannot update royalties after deployment
- **Fix:** Store royalty in TransferPolicy, use admin functions to update

❌ **Not handling zero-price listings**
- **Problem:** Free listings bypass royalty enforcement
- **Fix:** Enforce minimum price in transfer policy rules

For current Kiosk transfer-policy/royalty docs, use the **sui-docs-query** skill (Context7 MCP).

---

**Standard, secure, royalty-enabled NFT trading!**
