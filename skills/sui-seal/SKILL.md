---
name: sui-seal
description: Use when implementing sealed-bid auctions, building private bidding systems, or creating reveal mechanisms on SUI. Triggers on auction implementation, private bidding requirements, or sealed bid patterns.
---

# SUI Seal Integration

**Sealed-bid auctions with privacy and fairness guarantees.**

## Overview

Seal provides:
- Private bidding (bids hidden until reveal)
- Commit-reveal mechanism
- Fair auction settlement
- Front-running protection

## Use Cases

- High-value NFT auctions
- Fair token sales
- Resource allocation
- Any scenario requiring bid privacy

## Quick Start

### Create Sealed Auction

```move
use seal::auction;

public fun create_auction<T: key + store>(
    item: T,
    reserve_price: u64,
    duration: u64,
    ctx: &mut TxContext
): ID {
    auction::create<T>(
        item,
        reserve_price,
        duration,
        ctx
    )
}
```

### Submit Sealed Bid

```move
public fun submit_bid(
    auction_id: ID,
    bid_commitment: vector<u8>,  // Hash of (bid_amount + secret)
    ctx: &mut TxContext
) {
    auction::commit_bid(
        auction_id,
        bid_commitment,
        ctx
    );
}
```

### Reveal Bid

```move
public fun reveal_bid(
    auction_id: ID,
    bid_amount: u64,
    secret: vector<u8>,
    ctx: &mut TxContext
) {
    auction::reveal_bid(
        auction_id,
        bid_amount,
        secret,
        ctx
    );
}
```

## Frontend Integration

```typescript
import { sha256 } from '@noble/hashes/sha256';

// Generate bid commitment
function createBidCommitment(amount: number, secret: string): string {
  const data = new TextEncoder().encode(`${amount}:${secret}`);
  const hash = sha256(data);
  return Buffer.from(hash).toString('hex');
}

// Submit sealed bid
async function submitSealedBid(auctionId: string, amount: number) {
  const secret = crypto.randomUUID();
  const commitment = createBidCommitment(amount, secret);

  // Store secret locally for reveal
  localStorage.setItem(`bid_secret_${auctionId}`, secret);

  const txb = new TransactionBlock();
  txb.moveCall({
    target: `${PACKAGE_ID}::auction::commit_bid`,
    arguments: [
      txb.pure(auctionId),
      txb.pure(Array.from(Buffer.from(commitment, 'hex')))
    ]
  });

  return await signAndExecute({ transactionBlock: txb });
}

// Reveal bid after commit phase
async function revealBid(auctionId: string, amount: number) {
  const secret = localStorage.getItem(`bid_secret_${auctionId}`);

  if (!secret) {
    throw new Error('Secret not found');
  }

  const txb = new TransactionBlock();
  txb.moveCall({
    target: `${PACKAGE_ID}::auction::reveal_bid`,
    arguments: [
      txb.pure(auctionId),
      txb.pure(amount),
      txb.pure(Array.from(new TextEncoder().encode(secret)))
    ]
  });

  return await signAndExecute({ transactionBlock: txb });
}
```

## Auction Phases

```
Phase 1: Commit (bidders submit commitments)
  ↓
Phase 2: Reveal (bidders reveal bids)
  ↓
Phase 3: Settlement (highest bidder wins)
```

## Best Practices

- Use strong random secrets
- Store secrets securely
- Handle reveal deadline
- Validate commitment hash
- Implement bid cancellation

## Common Mistakes

❌ **Weak or predictable secrets**
- **Problem:** Bids can be guessed via brute force
- **Fix:** Use `crypto.randomUUID()` or 32+ random bytes

❌ **Losing secret before reveal phase**
- **Problem:** Cannot reveal bid, lose deposit and item
- **Fix:** Backup secret to encrypted cloud storage or email user a copy

❌ **Not enforcing reveal deadline**
- **Problem:** Auction never completes, item locked
- **Fix:** Implement timeout mechanism, auto-settle if reveal period expires

❌ **Reusing secrets across auctions**
- **Problem:** If one secret leaks, all bids compromised
- **Fix:** Generate unique secret per auction

❌ **Commitment hash mismatch**
- **Problem:** Reveal fails, bid invalidated
- **Fix:** Test commitment generation locally before submitting

❌ **Not handling commit phase expiration**
- **Problem:** Users submit bids after commit deadline
- **Fix:** Check auction phase client-side, show "Commit phase ended" message

❌ **Storing secret in plaintext localStorage**
- **Problem:** XSS can steal all secrets
- **Fix:** Encrypt secrets before localStorage or use sessionStorage

Query Seal docs:
```typescript
const sealInfo = await sui_docs_query({
  type: "github",
  target: "sui-core",
  query: "sealed auction implementation patterns"
});
```

---

**Fair, private auctions with cryptographic guarantees!**
