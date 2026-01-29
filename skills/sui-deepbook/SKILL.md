---
name: sui-deepbook
description: Use when integrating DeepBook DEX, implementing orderbook trading, managing liquidity pools, or building market-making features on SUI. Triggers on DEX integration, trading pair setup, or liquidity management tasks.
---

# SUI DeepBook Integration

**Decentralized orderbook exchange protocol on SUI.**

## Overview

DeepBook provides:
- Central limit order book (CLOB)
- High-performance matching engine
- Customizable trading pairs
- Liquidity incentives
- Market making tools

## Use Cases

- DEX with orderbook
- Token trading platforms
- Limit order functionality
- Market making
- Advanced trading features

## Quick Start

### Create Trading Pool

```move
use deepbook::clob_v2;
use deepbook::custodian_v2;

public fun create_pool<BaseAsset, QuoteAsset>(
    tick_size: u64,
    lot_size: u64,
    ctx: &mut TxContext
) {
    clob_v2::create_pool<BaseAsset, QuoteAsset>(
        tick_size,    // Minimum price increment
        lot_size,     // Minimum quantity increment
        ctx
    );
}
```

### Place Limit Order

```move
public fun place_limit_order<BaseAsset, QuoteAsset>(
    pool: &mut Pool<BaseAsset, QuoteAsset>,
    price: u64,
    quantity: u64,
    is_bid: bool,  // true = buy, false = sell
    account_cap: &AccountCap,
    ctx: &mut TxContext
) {
    clob_v2::place_limit_order(
        pool,
        price,
        quantity,
        is_bid,
        account_cap,
        ctx
    );
}
```

## Frontend Integration

### Place Order from UI

```typescript
import { TransactionBlock } from '@mysten/sui.js/transactions';

async function placeBuyOrder(
  poolId: string,
  price: number,
  quantity: number
) {
  const txb = new TransactionBlock();

  txb.moveCall({
    target: `${DEEPBOOK_PACKAGE}::clob_v2::place_limit_order`,
    arguments: [
      txb.object(poolId),
      txb.pure(price),
      txb.pure(quantity),
      txb.pure(true), // is_bid
      txb.object(accountCapId)
    ],
    typeArguments: ['0x2::sui::SUI', '0x...::USDC']
  });

  return await signAndExecute({ transactionBlock: txb });
}
```

### Query Orderbook

```typescript
async function getOrderbook(poolId: string) {
  const pool = await client.getObject({
    id: poolId,
    options: { showContent: true }
  });

  // Parse bids and asks
  const content = pool.data.content;
  const bids = content.fields.bids;
  const asks = content.fields.asks;

  return { bids, asks };
}
```

## Market Making

```move
// Simple market making strategy
public fun provide_liquidity<Base, Quote>(
    pool: &mut Pool<Base, Quote>,
    mid_price: u64,
    spread_bps: u64,
    size: u64,
    account_cap: &AccountCap,
    ctx: &mut TxContext
) {
    let spread = (mid_price * spread_bps) / 10000;

    // Place buy order below mid
    let bid_price = mid_price - spread;
    clob_v2::place_limit_order(
        pool, bid_price, size, true, account_cap, ctx
    );

    // Place sell order above mid
    let ask_price = mid_price + spread;
    clob_v2::place_limit_order(
        pool, ask_price, size, false, account_cap, ctx
    );
}
```

## Best Practices

- Use appropriate tick/lot sizes
- Handle partial fills
- Implement order cancellation
- Monitor pool health
- Provide liquidity incentives

## Common Mistakes

❌ **Incorrect tick/lot size configuration**
- **Problem:** Orders fail, price precision issues, poor UX
- **Fix:** tick_size for price precision (e.g., 0.01 = 100), lot_size for quantity (e.g., 1 token = 1000000)

❌ **Not handling partial fills**
- **Problem:** Order shows as "pending" when partially filled
- **Fix:** Track filled quantity, update UI to show "Partially Filled (50/100)"

❌ **No order cancellation mechanism**
- **Problem:** Users cannot cancel pending orders, funds locked
- **Fix:** Implement `cancel_order` with order ID tracking

❌ **Ignoring orderbook depth**
- **Problem:** Large orders cause excessive slippage
- **Fix:** Query orderbook depth, warn users about potential slippage

❌ **Not validating price against market**
- **Problem:** Orders placed far from market price never fill
- **Fix:** Check mid-price, warn if order is >10% away from market

❌ **Forgetting to create AccountCap**
- **Problem:** Cannot place orders without account capability
- **Fix:** Create AccountCap during user onboarding, store reference

Query DeepBook docs:
```typescript
const deepbookInfo = await sui_docs_query({
  type: "docs",
  target: "deepbook",
  query: "orderbook trading pool creation"
});
```

---

**Professional-grade orderbook DEX on SUI!**
