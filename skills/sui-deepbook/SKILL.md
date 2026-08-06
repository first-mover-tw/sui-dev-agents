---
name: sui-deepbook
description: Use when integrating DeepBook V3 — SUI's native CLOB DEX, margin trading, prediction markets, or DEEP-token fee mechanics. Triggers on "DeepBook", "DBv3", "BalanceManager", "DEEP token", "order book", "CLOB", "limit order", "market order", "Pool", "margin trading", "perpetuals on Sui", "leverage", "TPSL", "take-profit / stop-loss", "flash loan on Sui", "prediction market", "predict", "DeepBook indexer", "Pyth price feed", "permissionless pool", or any on-chain trading / DEX / market-making integration on SUI. Use even when the user only says "I need an orderbook on Sui" or mentions building a DEX without naming DeepBook — DeepBook V3 is the canonical answer.
---

# SUI DeepBook V3 Integration

**Canonical CLOB DEX, margin engine, and prediction-market substrate on SUI.**

## SDK Versions

Targets: `@mysten/deepbook-v3` 1.6.3 (^1.3), `@mysten/sui` 2.23.2 (^2.16). Tested: 2026-08-06.

**Compatibility notes:** Use `@mysten/deepbook-v3` (V3 — current). The legacy `@mysten/deepbook` / `clob_v2` packages are deprecated and **not** what you want.

## V3 vs V2 — what changed

V3 is a clean break from V2. If you've used V2 (`deepbook::clob_v2`, `AccountCap`, custodian), forget the mental model:

| Concern | V2 (legacy) | V3 (current) |
|---|---|---|
| Account model | `AccountCap` per pool, custodian-owned funds | **`BalanceManager`** — one shared object holds all your funds, scoped via `TradeCap` / `DepositCap` / `WithdrawCap` |
| Fees | Paid in base/quote | Paid in **DEEP** (or whitelisted alternative via `payWithDeep: false` on supported pools) |
| Pool creation | Permissioned | **Permissionless** (`createPermissionlessPool`) — burn DEEP as creation fee |
| Margin / leverage | n/a | First-class: `MarginManager`, `MarginPool`, liquidations, Pyth oracles |
| Order primitives | `place_limit_order` only | Limit + Market + IOC + FOK + Post-Only + Self-matching policies + TPSL conditional orders |
| Move modules | `deepbook::clob_v2` | `deepbook::pool`, `deepbook::balance_manager`, `margin::*` |

**Do not** mix V2 and V3 examples in the same codebase. The Move modules, object types, and SDK packages are entirely separate.

## Core architecture

```
┌─────────────────┐         ┌──────────────┐
│ BalanceManager  │◄────────┤  TradeCap    │  (delegate trading without giving up funds)
│  (shared obj)   │         └──────────────┘
│  • Base coins   │
│  • Quote coins  │         ┌──────────────┐
│  • DEEP         │◄────────┤  TradeProof  │  (per-tx capability, generated from cap)
└────────┬────────┘         └──────────────┘
         │
         │  attached to every order via TradeProof
         ▼
┌─────────────────┐
│      Pool       │  baseCoin / quoteCoin, tick_size, lot_size, min_size
│  (shared obj)   │  CLOB matching engine, DEEP fee escrow
└─────────────────┘
```

**Mental model:** `BalanceManager` is your wallet; `Pool` is the order book. Every order references a `BalanceManager` via a `TradeProof`. You can grant `TradeCap` to a market-making bot (up to ~1,000 authorized traders per BM) without exposing withdrawal rights.

**Fee economics:** Paying with DEEP gives a fee discount (canonically ~20% — verify current rate); DEEP stakers earn maker rebates and vote on per-pool fee parameters.

**Pool internals:** A `Pool` is split into `Book` (matching), `State` (governance/fee params), and `Vault` (settlement). `PoolRegistry` enforces a single pool per `(Base, Quote)` pair — no fragmented liquidity.

## Quick start (TypeScript SDK)

### 1. Initialize the client

**Client choice (read this — do not skip):** `@mysten/sui` v2 **removed** `SuiClient` and `getFullnodeUrl`. Use `SuiGrpcClient` from `@mysten/sui/grpc`. JSON-RPC is shut off on public fullnodes (permanent deactivation landed 2026-07-31). Any code you write using `new SuiClient(...)` or `getFullnodeUrl(...)` is wrong on the current SDK and will not type-check.

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { DeepBookClient } from '@mysten/deepbook-v3';
import { Transaction } from '@mysten/sui/transactions';

const suiClient = new SuiGrpcClient({
  network: 'mainnet',
  baseUrl: 'https://fullnode.mainnet.sui.io:443',
});

const dbClient = new DeepBookClient({
  client: suiClient,
  address: '0xYOUR_ADDRESS',
  network: 'mainnet',
  // Optional: register your own BalanceManager so SDK helpers resolve by key
  balanceManagers: {
    MY_BM: { address: '0xYOUR_BALANCE_MANAGER_ID' },
  },
});
```

The SDK ships mainnet/testnet pool maps (`SUI_USDC`, `DEEP_USDC`, `DEEP_SUI`, …) and package IDs — you don't hard-code them.

### 2. Create a BalanceManager (one-time)

```typescript
// @check:skip — fragment, continues from Quick Start §1
const tx = new Transaction();
tx.add(dbClient.balanceManager.createAndShareBalanceManager());
// Sign + execute, then grab the new shared object ID from object changes
// and feed it back into DeepBookClient as `balanceManagers.MY_BM.address`.
```

If you want to delegate trading: use `createBalanceManagerWithOwner(owner)` and mint a `TradeCap` separately (`balanceManager.mintTradeCap`).

### 3. Deposit funds

```typescript
// @check:skip — fragment, continues from Quick Start §1
const tx = new Transaction();
tx.add(dbClient.balanceManager.depositIntoManager('MY_BM', 'SUI', 1.5));
tx.add(dbClient.balanceManager.depositIntoManager('MY_BM', 'DEEP', 10)); // fee fuel
```

Quantities are **human-readable** (1.5 SUI, not 1_500_000_000 MIST). The SDK applies coin `scalar` from its `CoinMap`.

### 4. Place a limit order

```typescript
// @check:skip — fragment, continues from Quick Start §1
import { OrderType, SelfMatchingOptions } from '@mysten/deepbook-v3';

const tx = new Transaction();
tx.add(
  dbClient.deepBook.placeLimitOrder({
    poolKey: 'SUI_USDC',
    balanceManagerKey: 'MY_BM',
    clientOrderId: '1001',         // your tracking ID
    price: 2.15,                    // quote per base, human units
    quantity: 10,                   // base units, human
    isBid: true,                    // true = buy SUI
    orderType: OrderType.POST_ONLY, // maker-only; cancels if it would cross
    selfMatchingOption: SelfMatchingOptions.CANCEL_TAKER,
    payWithDeep: true,              // DEEP fee path (cheapest on supported pools)
  }),
);
```

`PlaceLimitOrderParams` (from `@mysten/deepbook-v3`):
- `poolKey`, `balanceManagerKey` — string keys into your configured maps
- `clientOrderId` — string; surfaces in events for your reconciliation
- `price`, `quantity` — `number | bigint`, human units (SDK rescales)
- `isBid` — `true` buy base / `false` sell base
- `expiration?` — epoch ms; defaults to `MAX_TIMESTAMP`
- `orderType?` — `NO_RESTRICTION | IMMEDIATE_OR_CANCEL | FILL_OR_KILL | POST_ONLY`
- `selfMatchingOption?` — `SELF_MATCHING_ALLOWED | CANCEL_TAKER | CANCEL_MAKER`
- `payWithDeep?` — `true` (default) uses DEEP fee path

### 5. Place a market order

```typescript
// @check:skip — fragment, continues from §4
tx.add(
  dbClient.deepBook.placeMarketOrder({
    poolKey: 'SUI_USDC',
    balanceManagerKey: 'MY_BM',
    clientOrderId: '2001',
    quantity: 5,
    isBid: true,
    payWithDeep: true,
  }),
);
```

### 6. Cancel / modify

```typescript
// @check:skip — fragment, continues from §4
tx.add(dbClient.deepBook.cancelOrder('SUI_USDC', 'MY_BM', orderId));
tx.add(dbClient.deepBook.cancelAllOrders('SUI_USDC', 'MY_BM'));
tx.add(dbClient.deepBook.modifyOrder('SUI_USDC', 'MY_BM', orderId, newQuantity));
```

### 7. Read state (off-chain queries)

```typescript
// @check:skip — fragment, continues from Quick Start §1
// Top-of-book + depth
const mid = await dbClient.midPrice('SUI_USDC');
const { bids, asks } = await dbClient.getLevel2Range('SUI_USDC', 2.0, 2.30, true);

// Account view
const balances = await dbClient.checkManagerBalance('MY_BM', 'SUI');
const openOrders = await dbClient.accountOpenOrders('SUI_USDC', 'MY_BM');

// Quote a hypothetical fill
const out = await dbClient.getQuoteQuantityOut('SUI_USDC', 10);
```

All read methods are on the `DeepBookClient` instance and are async (`Promise<...>`). They route through devInspect / RPC — no signing needed.

## Move side (writing your own integration module)

Since SUI v1.47, DeepBook is **not** an implicit dependency. Pin it explicitly:

```toml
[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/mainnet" }
DeepBook = { git = "https://github.com/MystenLabs/deepbookv3.git", subdir = "packages/deepbook", rev = "main" }
Token = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-system", rev = "framework/mainnet" }
```

Minimal Move call (most teams should use the SDK instead — direct Move integration is for protocol composability):

```move
use deepbook::pool::Pool;
use deepbook::balance_manager::{BalanceManager, TradeProof};
use token::deep::DEEP;
use sui::clock::Clock;

public fun place_bid<Base, Quote>(
    pool: &mut Pool<Base, Quote>,
    manager: &mut BalanceManager,
    proof: &TradeProof,
    client_order_id: u64,
    price: u64,            // scaled, see FLOAT_SCALAR
    quantity: u64,         // scaled to base coin decimals
    expire_timestamp: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    deepbook::pool::place_limit_order<Base, Quote>(
        pool,
        manager,
        proof,
        client_order_id,
        0,                  // NO_RESTRICTION
        0,                  // SELF_MATCHING_ALLOWED
        price,
        quantity,
        true,               // is_bid
        true,               // pay_with_deep
        expire_timestamp,
        clock,
        ctx,
    );
}
```

## Margin trading

DeepBook Margin adds leverage on top of any CLOB pool via separate objects
(`MarginManager`, `MarginPool`, `PoolProxy`, Pyth oracles, `MarginTPSL`). For the
full setup → borrow → place-margin-order → TPSL flow, health/liquidation reads,
and margin pitfalls, see **[references/margin.md](references/margin.md)**.

## DeepBook Indexer

Off-chain REST service for historical / aggregate data (OHLCV, volume, trade
history, orderbook snapshots) that you can't cheaply derive from live RPC. Live
state (current depth, your open orders) → SDK; historical / aggregates → indexer.
For endpoints and the full indexer-vs-SDK guidance, see
**[references/indexer.md](references/indexer.md)**.

## DeepBook Predict

Expiry-based prediction markets — a **separate** `deepbook_predict` Move package,
NOT the CLOB (no Pool / BalanceManager / order book; trades price against an LP
vault via OracleSVI). Testnet-only/experimental as of 2026-05. For the object
model, on-chain entry points, oracle lifecycle, data-read paths, and pitfalls,
see **[references/predict.md](references/predict.md)**.

## Best practices

- **Always fund DEEP.** Pools default to DEEP fees. A BalanceManager with zero DEEP can't place orders on most pools — surface this in your UX before order submission.
- **Use `clientOrderId` as your reconciliation key.** It echoes back in events and order objects; the on-chain `orderId` is generated and not predictable.
- **Quote first, place second.** For market orders, call `getQuoteQuantityOut` / `getBaseQuantityOut` to compute expected slippage; show the user the worst-case fill.
- **POST_ONLY for makers.** Use `OrderType.POST_ONLY` for market-making strategies to avoid accidentally crossing the spread and paying taker fees.
- **Batch in a PTB.** Cancel-and-replace, multi-leg market making, deposit + place — group into one Transaction; the SDK's `tx.add(...)` composition pattern is built for this.
- **Self-matching policy matters.** If a single BalanceManager runs both sides of a strategy, set `CANCEL_TAKER` (default-allowed self-matches waste fees).

## Common mistakes

❌ **Using `SuiClient` / `getFullnodeUrl` (v1 SDK)**
- **Problem:** Both were removed in `@mysten/sui` v2 (current); imports fail at type-check, RPC client is wrong shape.
- **Fix:** `import { SuiGrpcClient } from '@mysten/sui/grpc'`; construct with `{ network, baseUrl }`. The DeepBook SDK is built against the gRPC client, not the legacy JSON-RPC one.

❌ **Mixing V2 (`clob_v2`) examples with V3 imports**
- **Problem:** `clob_v2::place_limit_order` doesn't exist on the V3 deployment; LLMs hallucinate this constantly.
- **Fix:** V3 = `deepbook::pool::place_limit_order` + `BalanceManager` + `TradeProof`. No `AccountCap`, no `custodian_v2`.

❌ **Forgetting DEEP for fees**
- **Problem:** Order submission reverts with insufficient-DEEP error; UX shows opaque failure.
- **Fix:** Check `checkManagerBalance(bm, 'DEEP')` before placing; or set `payWithDeep: false` on pools that support whitelisted fee tokens.

❌ **Hard-coding pool / package IDs**
- **Problem:** Mainnet/testnet IDs change with upgrades; you end up calling a stale package.
- **Fix:** Use `mainnetPools` / `testnetPools` / `mainnetPackageIds` from the SDK; if you must override, do it via `DeepBookClient` constructor options.

❌ **Confusing human vs. scaled units**
- **Problem:** Passing `1_500_000_000` to the SDK when it expects `1.5`.
- **Fix:** SDK methods take **human units** and apply `coin.scalar` internally. Move modules take **scaled units**. Know which layer you're at.

❌ **Treating BalanceManager like a per-pool AccountCap**
- **Problem:** Creating a new BalanceManager per pool replicates V2 thinking; wastes objects and fragments DEEP.
- **Fix:** One BalanceManager per user (or per strategy) holds funds across all pools. That's the whole point of V3.

## Discovery

Need current contract addresses, indexer endpoints, or Predict launch status? Use the **sui-docs-query** skill (Context7 MCP) — e.g. "v3 mainnet contract-information balance manager package id".

Reference URLs (canonical, check for updates):
- Protocol: https://docs.sui.io/onchain-finance/deepbookv3/deepbook
- Design: https://docs.sui.io/onchain-finance/deepbookv3/design
- Contracts: https://docs.sui.io/onchain-finance/deepbookv3/contract-information
- SDK: https://docs.sui.io/onchain-finance/deepbookv3-sdk/
- Indexer: https://docs.sui.io/onchain-finance/deepbookv3/deepbookv3-indexer
- Margin: https://docs.sui.io/onchain-finance/deepbook-margin/
- Predict: https://docs.sui.io/onchain-finance/deepbook-predict/
- Repo: https://github.com/MystenLabs/deepbookv3

---

**One BalanceManager, many pools, DEEP fuels the engine.**
