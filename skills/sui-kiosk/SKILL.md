---
name: sui-kiosk
description: Use when building NFT marketplaces, enforcing royalties, or managing transfer policies using SUI's Kiosk standard. Triggers on "Kiosk", "NFT marketplace", "transfer policy", "royalty enforcement", "list NFT for sale", "purchase rules", or any NFT commerce on SUI. Also use when the user asks about listing, delisting, or trading NFTs with enforced rules.
---

# SUI Kiosk Integration

**Official NFT trading standard with transfer policies and royalties.**

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
import { Transaction } from '@mysten/sui/transactions';

// List NFT for sale
async function listNFT(kioskId: string, nftId: string, price: number) {
  const tx = new Transaction();

  tx.moveCall({
    target: '0x2::kiosk::place_and_list',
    arguments: [
      tx.object(kioskId),
      tx.object(kioskOwnerCapId),
      tx.object(nftId),
      tx.pure(price)
    ],
    typeArguments: [`${PACKAGE_ID}::nft::NFT`]
  });

  return await signAndExecute({ transaction: tx });
}

// Purchase NFT
async function purchaseNFT(
  kioskId: string,
  nftId: string,
  paymentCoinId: string,
  policyId: string
) {
  const tx = new Transaction();

  tx.moveCall({
    target: '0x2::kiosk::purchase',
    arguments: [
      tx.object(kioskId),
      tx.pure(nftId),
      tx.object(paymentCoinId)
    ],
    typeArguments: [`${PACKAGE_ID}::nft::NFT`]
  });

  // Confirm transfer policy
  tx.moveCall({
    target: '0x2::transfer_policy::confirm_request',
    arguments: [
      tx.object(policyId),
      // ... transfer request
    ]
  });

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

Query Kiosk docs:
```typescript
const kioskInfo = await sui_docs_query({
  type: "docs",
  target: "kiosk",
  query: "transfer policy and royalty implementation"
});
```

---

**Standard, secure, royalty-enabled NFT trading!**
