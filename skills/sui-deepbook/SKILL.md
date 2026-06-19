---
name: sui-deepbook
description: Use when integrating DeepBook V3 — SUI's native CLOB DEX, margin trading, prediction markets, or DEEP-token fee mechanics. Triggers on "DeepBook", "DBv3", "BalanceManager", "DEEP token", "order book", "CLOB", "limit order", "market order", "Pool", "margin trading", "perpetuals on Sui", "leverage", "TPSL", "take-profit / stop-loss", "flash loan on Sui", "prediction market", "predict", "DeepBook indexer", "Pyth price feed", "permissionless pool", or any on-chain trading / DEX / market-making integration on SUI. Use even when the user only says "I need an orderbook on Sui" or mentions building a DEX without naming DeepBook — DeepBook V3 is the canonical answer.
---

# SUI DeepBook V3 Integration

**Canonical CLOB DEX, margin engine, and prediction-market substrate on SUI.**

## SDK Versions

Targets: `@mysten/deepbook-v3` 1.4.1 (^1.3), `@mysten/sui` 2.17.0 (^2.16). Tested: 2026-06-03.

> Predict section re-verified against `deepbookv3@predict-testnet-4-16` source 2026-05-30 — Predict is a separate `deepbook_predict` Move package, not part of the npm SDK.

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

**Client choice (read this — do not skip):** `@mysten/sui` v2 **removed** `SuiClient` and `getFullnodeUrl`. Use `SuiGrpcClient` from `@mysten/sui/grpc`. JSON-RPC is deprecated (full removal April 2026). Any code you write using `new SuiClient(...)` or `getFullnodeUrl(...)` is wrong on the current SDK and will not type-check.

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

DeepBook Margin adds leverage on top of any CLOB pool via separate objects. The SDK exposes a full surface but the high-level moving parts are:

- **`MarginPool`** — per-asset lending pool. LPs deposit base/quote, borrowers pay interest.
- **`MarginManager`** — a leveraged position; analogous to BalanceManager but with debt.
- **`MarginRegistry`** — global registry of supported margin pools.
- **`PoolProxy`** — wraps a regular DeepBook `Pool` so margin orders route through it without bypassing CLOB matching.
- **Pyth oracles** — health checks use Pyth price feeds; the SDK exposes `SuiPythClient` + `mainnetPythConfigs`.
- **`MarginTPSL`** — conditional take-profit / stop-loss orders that auto-fire when oracle price crosses a trigger.

### Skeleton: open a leveraged long

Two-transaction flow: **(A)** create + initialize + share the margin manager once, **(B)** in later txs reference it by `managerKey` to deposit / borrow / trade.

```typescript
// @check:skip — fragment, continues from Quick Start §1

// === Transaction A: one-time setup ===
const txA = new Transaction();
const { manager, initializer } = dbClient.marginManager.newMarginManagerWithInitializer('SUI_USDC')(txA);
txA.add(dbClient.marginManager.depositDuringInitialization({
  manager,
  poolKey: 'SUI_USDC',
  coinType: 'USDC',
  amount: 1000, // human units
}));
txA.add(dbClient.marginManager.shareMarginManager('SUI_USDC', manager, initializer));
// → register the resulting shared object as 'MY_MM' in your config map

// === Transaction B: borrow + place margin order ===
const tx = new Transaction();

// 1. Borrow against the collateral (use borrowBase / borrowQuote, not generic borrow)
tx.add(dbClient.marginManager.borrowQuote('MY_MM', 3000)); // 3x leverage on quote (USDC)

// 2. Place a margin limit order through the pool proxy
tx.add(
  dbClient.poolProxy.placeMarginLimitOrder({
    poolKey: 'SUI_USDC',
    marginManagerKey: 'MY_MM',
    clientOrderId: 'm-1',
    price: 2.15,
    quantity: 1500,
    isBid: true,
    payWithDeep: true,
  }),
);

// 5. Optional: attach a stop-loss
tx.add(
  dbClient.marginTPSL.addConditionalOrder({
    marginManagerKey: 'MY_MM',
    poolKey: 'SUI_USDC',
    triggerPrice: 1.90,
    isStopLoss: true,
    // ... order params for the unwind leg
  }),
);
```

**Health & liquidation:** read margin state with `dbClient.getMarginManagerState('MY_MM')` → returns assets, debts, and a health factor. Below 1.0 → liquidatable via `marginLiquidations`.

### Margin pitfalls

- Pyth price feeds have a max age (`PRICE_INFO_OBJECT_MAX_AGE_MS`). Stale feeds → reverted orders. Always refresh in the same PTB.
- Interest accrues continuously; `borrow()` returns shares, not a fixed amount.
- TPSL triggers are *permissionless* — any keeper can fire them once the condition is met. Don't rely on yourself being the executor.

## DeepBook Indexer

Off-chain REST service for historical and aggregate data (trades, volume, OHLCV, orderbook snapshots) that you can't cheaply derive from RPC. There is no SDK wrapper — fetch directly:

```typescript
// Mainnet base: https://deepbook-indexer.mainnet.mystenlabs.com
// Predict (testnet): https://predict-server.testnet.mystenlabs.com

// Common endpoints (canonical names — verify exact query-param spelling against current docs):
//   GET /pools                              — all pools + metadata (tick_size, lot_size)
//   GET /summary                            — per-pool 24h price/volume/quote summary
//   GET /book_depth?pool_id=...             — live L2 depth snapshot
//   GET /ohlcv?pool_id=...&interval=...     — candles
//   GET /historical_volume?...              — volume by pool or balance manager

const summary = await fetch(
  'https://deepbook-indexer.mainnet.mystenlabs.com/summary',
).then(r => r.json());
```

**When to use the indexer vs. SDK queries:**
- ✅ Historical OHLCV / candles / volume → indexer
- ✅ All trades for a balance manager over time → indexer
- ✅ TVL, 24h volume per pool → indexer
- ❌ Current orderbook depth → SDK (`getLevel2Range`) — it's live RPC
- ❌ Your open orders → SDK (`accountOpenOrders`)

> Endpoint surface evolves; canonical reference is https://docs.sui.io/onchain-finance/deepbookv3/deepbookv3-indexer. Use the `sui-docs-query` skill for the current list before hard-coding.

## DeepBook Predict

Expiry-based prediction-market protocol. **It is NOT the CLOB.** Predict is a *separate* Move package (`deepbook_predict`, currently on the `predict-testnet-4-16` branch) that only borrows `deepbook::math` — it has **no `Pool`, no `BalanceManager`, no order book, no maker/taker**. Every trade is priced against a shared LP vault (the protocol is your counterparty), using Block Scholes' **OracleSVI** volatility model. If you find yourself reaching for `placeLimitOrder` / `TradeProof` here, you're in the wrong mental model.

**As of 2026-05, Predict is testnet-only and experimental.** Verify mainnet availability before wiring it into production.

### Object model (memorize this — it's the #1 thing LLMs get wrong)

| Object | Role |
|---|---|
| **`Predict`** | Shared root. Holds the vault balances, pricing/risk/treasury config, quote-asset allowlist, oracle strike grids, and the `PLP` treasury cap. Treat as the "market root". |
| **`PredictManager`** | Per-user account. Holds the user's quote balances **plus their position & range quantities**. One per user, reused. Analogous *in spirit* to a BalanceManager but a completely different type/module. |
| **`OracleSVI`** | Market state for one `(underlying, expiry)`. Carries spot, forward, SVI params, activation status, settlement price. Created/updated by a Block Scholes operator via `OracleSVICap`. |
| **`PLP`** | LP share token (a `Coin<PLP>`), minted when you `supply` quote into the vault. |
| **`Registry` / `AdminCap`** | Admin wiring (create Predict, create oracles, set spreads/limits). Not user-facing. |

**Positions and ranges are NOT objects.** They are internal balances inside `PredictManager`, keyed by:
- directional binary: `(oracle_id, expiry, strike, is_up)` → a `MarketKey`
- vertical range: `(oracle_id, expiry, lower_strike, higher_strike)` → a `RangeKey`

There is no "position NFT" to find. Read them from the manager object or the indexed server.

### Current testnet deployment (verify before use — testnet redeploys often)

```
Predict package: 0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
Predict object:  0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
Quote asset:     ...::dusdc::DUSDC   (testnet faucet stablecoin, 6 decimals)
Public server:   https://predict-server.testnet.mystenlabs.com
```

### On-chain entry points (`deepbook_predict::predict`)

All trade fns are generic over `<Quote>` and take human-irrelevant **scaled** u64s (Move layer):

- `create_manager(ctx): ID` — make a `PredictManager` (shared). One per user.
- `mint<Quote>(predict, manager, oracle, key: MarketKey, quantity, clock, ctx)` — buy a directional position; debits quote from the manager, emits `PositionMinted`.
- `redeem<Quote>(predict, manager, oracle, key, quantity, clock, ctx)` — sell; payout into the manager. `redeem_permissionless<Quote>(...)` for *settled* oracles (anyone can call).
- `mint_range<Quote>(predict, manager, oracle, key: RangeKey, quantity, clock, ctx)` / `redeem_range<Quote>(...)` — vertical ranges.
- `supply<Quote>(predict, coin, clock, ctx): Coin<PLP>` — LP in, get shares.
- `withdraw<Quote>(predict, lp_coin, clock, ctx): Coin<Quote>` — burn shares, quote out (subject to a withdrawal rate-limiter + vault-availability check).
- Preview helpers (read-only, devInspect): `get_trade_amounts(...) -> (cost, payout)`, `get_range_trade_amounts(...)`, `ask_bounds(oracle_id) -> (min, max)`.

There is **no dedicated `@mysten/deepbook-predict` SDK.** Build PTBs with `@mysten/codegen`-generated bindings, or raw `moveCall`:

```typescript
// @check:skip — references deployment IDs/types you supply at runtime
import { Transaction } from '@mysten/sui/transactions';

const PKG = '0xf5ea2b...';           // predict package id
const PREDICT = '0xc87362...';        // Predict shared object
const DUSDC = '0x<pkg>::dusdc::DUSDC';
const CLOCK = '0x6';

// LP: supply quote → PLP shares (real flow from scripts/transactions/predict/deposit.ts)
const tx = new Transaction();
const lp = tx.moveCall({
  target: `${PKG}::predict::supply`,
  typeArguments: [DUSDC],
  arguments: [tx.object(PREDICT), coin /* Coin<DUSDC> */, tx.object(CLOCK)],
});
tx.transferObjects([lp], tx.pure.address(myAddress));

// Trade: buy a directional position (manager + oracle + MarketKey built upstream)
tx.moveCall({
  target: `${PKG}::predict::mint`,
  typeArguments: [DUSDC],
  arguments: [tx.object(PREDICT), tx.object(MANAGER), tx.object(ORACLE), marketKey, tx.pure.u64(qty), tx.object(CLOCK)],
});
```

### Oracle lifecycle — gates tradeability

`active` → live spot/SVI updates (prices update more often than SVI) → **`settled`** (frozen on the first post-expiry price push; emits `OracleSettled`) → optionally `compacted` (storage optimization). Mints require an active oracle; after settlement only redeems work (and `redeem_permissionless` opens up). **Don't assume an oracle is tradeable just because it exists — check status.**

### Reading data (3 paths, in priority order)

1. **Public `predict-server`** — your default render backend (indexed, paginated). Key endpoints:
   - `GET /predicts/:id/state`, `/predicts/:id/oracles`, `/oracles/:id/state`, `/oracles/:id/ask-bounds`
   - vault: `/predicts/:id/vault/summary`, `/vault/performance?range=ALL`
   - portfolio: `/managers`, `/managers/:id/summary`, `/managers/:id/positions/summary`, `/managers/:id/pnl?range=ALL`
   - history: `/oracles/:id/prices[/latest]`, `/oracles/:id/svi[/latest]`, `/positions/{minted,redeemed}`, `/ranges/{minted,redeemed}`, `/lp/{supplies,withdrawals}`, `/trades/:oracle_id`
2. **Sui event stream** (freshness, not pagination) — filter the package id for `oracle::Oracle{PricesUpdated,SVIUpdated,Settled,Activated}`.
3. **Direct object reads** — only for confirmation-critical state right around a wallet tx (the manager, the target oracle, a coin about to be spent).

### Predict pitfalls

❌ **Treating Predict like the CLOB.** No Pool/BalanceManager/TradeProof/limit orders. Counterparty is the PLP vault; price comes from OracleSVI + a utilization spread.
❌ **Looking for a position object.** Positions/ranges are balances inside `PredictManager`. Read the manager, not a dangling NFT.
❌ **Scanning chain as your primary backend.** Use `predict-server` for lists/history/PnL; chain reads are slow and hard to paginate.
❌ **Assuming zero server lag post-tx.** Confirm the tx, then refresh server endpoints — it's low-lag, not instant.
❌ **Using stale testnet package IDs.** Predict redeploys; pull the current package/object IDs (server `/status`, or the repo's `scripts/config/constants.ts`) instead of hard-coding.

## Best practices

- **Always fund DEEP.** Pools default to DEEP fees. A BalanceManager with zero DEEP can't place orders on most pools — surface this in your UX before order submission.
- **Use `clientOrderId` as your reconciliation key.** It echoes back in events and order objects; the on-chain `orderId` is generated and not predictable.
- **Quote first, place second.** For market orders, call `getQuoteQuantityOut` / `getBaseQuantityOut` to compute expected slippage; show the user the worst-case fill.
- **POST_ONLY for makers.** Use `OrderType.POST_ONLY` for market-making strategies to avoid accidentally crossing the spread and paying taker fees.
- **Batch in a PTB.** Cancel-and-replace, multi-leg market making, deposit + place — group into one Transaction; the SDK's `tx.add(...)` composition pattern is built for this.
- **Self-matching policy matters.** If a single BalanceManager runs both sides of a strategy, set `CANCEL_TAKER` (default-allowed self-matches waste fees).
- **Pyth freshness for margin.** Refresh price-info objects in the same PTB that opens/modifies a margin position.

## Common mistakes

❌ **Using `SuiClient` / `getFullnodeUrl` (v1 SDK)**
- **Problem:** Both were removed in `@mysten/sui` v2 (current); imports fail at type-check, RPC client is wrong shape.
- **Fix:** `import { SuiGrpcClient } from '@mysten/sui/grpc'`; construct with `{ network, baseUrl }`. The DeepBook SDK is built against the gRPC client, not the legacy JSON-RPC one.

❌ **Importing Pyth from `@pythnetwork/pyth-sui-js`**
- **Problem:** Mismatched types vs. what `MarginManagerContract` expects; extra dependency.
- **Fix:** `import { SuiPythClient, SuiPriceServiceConnection } from '@mysten/deepbook-v3'` — the DeepBook SDK re-exports the Pyth pieces wired to its own config (`mainnetPythConfigs`, `testnetPythConfigs`).

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

❌ **Querying orderbook depth from the indexer**
- **Problem:** Indexer is eventually consistent and lags live state; you'll quote stale prices.
- **Fix:** Live state → `getLevel2Range` / `midPrice`. Indexer → historical + aggregates only.

❌ **Building margin without refreshing Pyth in the same PTB**
- **Problem:** Health check uses a stale price object; transaction reverts on `EPriceTooOld`.
- **Fix:** Include `pythClient.updatePriceFeeds(...)` (or SDK equivalent) in the same Transaction as the margin op.

❌ **Assuming TPSL is your private executor**
- **Problem:** Trigger fires when *anyone* sees the condition met; treating it like a private cron leads to surprises.
- **Fix:** Design with permissionless execution in mind — pre-fund the TPSL leg's collateral, expect external keepers to fire.

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
