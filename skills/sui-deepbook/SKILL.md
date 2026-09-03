---
name: sui-deepbook
description: Use when integrating DeepBook V3 — SUI's native CLOB DEX, margin trading, prediction markets, or DEEP-token fee mechanics. Triggers on "DeepBook", "DBv3", "BalanceManager", "DEEP token", "order book", "CLOB", "limit order", "market order", "Pool", "margin trading", "perpetuals on Sui", "leverage", "TPSL", "take-profit / stop-loss", "flash loan on Sui", "prediction market", "predict", "DeepBook indexer", "Pyth price feed", "permissionless pool", or any on-chain trading / DEX / market-making integration on SUI. Use even when the user only says "I need an orderbook on Sui" or mentions building a DEX without naming DeepBook — DeepBook V3 is the canonical answer.
---

# SUI DeepBook V3 Integration

**Canonical CLOB DEX, margin engine, and prediction-market substrate on SUI.**

## SDK Versions

Targets: `@mysten/deepbook-v3` 2.1.4 (^2.0.1), `@mysten/sui` 2.29.0 (^2.29.0). Tested: 2026-09-03.

**Compatibility notes:** Use `@mysten/deepbook-v3` (V3 — current). The legacy `@mysten/deepbook` / `clob_v2` packages are deprecated and **not** what you want. **`@mysten/deepbook-v3` 2.0 is a breaking major for margin only** — spot CLOB, `BalanceManager`, flash loans and governance are unchanged. Margin now targets Pyth's upgraded Core (new `deepbook_margin` modules `margin_manager_upgraded` / `pool_proxy_upgraded`, `margin_liquidation` `liquidate_*_upgraded`; no legacy switch), whose Hermes endpoint (`PYTH_UPGRADED_HERMES = https://pyth.dourolabs.app/hermes`, Hermes v2 `/v2/updates/price/latest`) answers 401 without a bearer token. Pass `pythAccessToken` to `DeepBookClient` (or `pyth: { ...mainnetPythConfigs, accessToken }` / a self-credentialed `pyth.hermesEndpoint`) — any margin call that pushes a price update otherwise throws `ConfigurationError`. TS method signatures are unchanged; mainnet `MARGIN_PACKAGE_ID` / `LIQUIDATION_PACKAGE_ID` changed (2.0.0 has no mainnet target for `liquidateBase`/`liquidateQuote`, so **2.0.1 is the floor**; this skill pins 2.1.4). See [references/margin.md](references/margin.md).

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
  // Required for margin flows on 2.0+ (Pyth upgraded-Core Hermes needs a bearer
  // token). Spot-only clients can omit it. Supply at runtime — never commit it.
  pythAccessToken: 'YOUR_PYTH_ACCESS_TOKEN', // read from env at runtime
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

## SDK subpaths — `/account`, `/sessions`, `/predict` (deepbook-v3 2.1.x)

The 2.1.x line consolidated the separate DeepBook SDKs into subpaths of `@mysten/deepbook-v3`. (The changesets are labelled 2.1.0–2.1.2, but npm went straight from 2.0.1 to **2.1.3** — `npm i @mysten/deepbook-v3@2.1.0` fails with `ETARGET` / "No matching version found". Pin 2.1.3 or later.) **The package root is unchanged** between 2.0.1 and 2.1.4 — the **root export set** is unchanged and every hardcoded package id on that surface is byte-identical. `dist/utils/constants.mjs` is byte-identical, and so is `dist/index.d.mts` — though that alone proves nothing, since it is only a re-export barrel. Diffing what it pulls in: the sole **non-additive** delta on the public type surface is a semantically-irrelevant union reorder on `DeepBookClient.getAccountOrderDetails` (`dist/client.d.mts`); `contracts/utils/index.d.mts` is on that surface too but purely additive (`MoveTuple`, `ConfigValue`, `RawTransactionArgument`). The rest is inert: alias renumbering, plus a dropped `import "./types/bcs.mjs"` in four emitted modules (`dist/index.mjs` and the three `dist/queries/*Queries.mjs`) whose target is `import …; export {}` — no side effect, and not importable by consumers anyway, since 2.0.1's `exports` map has only `.` — and subpaths are separate module graphs, so importing one loads no spot or margin code (the package is also `sideEffects: false` now).

| Subpath | What it is | Status |
|---|---|---|
| `@mysten/deepbook-v3/account` | The shared on-chain **account primitive** (`AccountContract`, generated `account` bindings, `Account` / `AccountWrapper` BCS structs). DeepBook's core account wrapper and DeepBook Predict both build on it. | testnet-only ids |
| `@mysten/deepbook-v3/sessions` | Time-limited trading **sessions** over a canonical Account (`SessionsContract`). | testnet-only ids |
| `@mysten/deepbook-v3/predict` | **DeepBook Predict** (`PredictClient`, quotes, mint/redeem/claim, PLP, typed receipts, client-side board pricer). ⚠️ targets a **newer Move design** than [references/predict.md](references/predict.md) documents — see below. | testnet-only ids |

Two standalone packages are **superseded** and formally `npm deprecate`d, so installing either now emits a warning: `@mysten/deepbook-account` (final release 0.1.0, *"Deprecated: use @mysten/deepbook-v3/account instead."*) and `@mysten/deepbook-predict` (0.3.0, *"…use @mysten/deepbook-v3/predict instead."*). Both keep working but will not be updated.

**Name collision worth knowing:** `Account` exported from the package root is `@deepbook/core::account::Account`. The account primitive's `Account` is a *different type*, reachable only from `/account`.

Deployed ids come from a generated deploy manifest shared by all three subpaths, so they cannot drift apart across a redeploy: `getAccountConfig(network)` / `getSessionsConfig(network)` / `getConfig(network)`, with `getDeployment(network)` reporting which deployment and source commit the ids came from. **They throw on an unrecorded network rather than returning placeholder ids** — testnet is the only one recorded today (`dist/account.mjs:22`). For your own deployment, pass ids to the contract class directly.

### Sessions — the authorization surface

An Account owner authorizes an **ephemeral address** to act for the Account until a fixed expiry. The session key **never holds a reusable `Auth`** (each wrapper mints app authorization internally and consumes it in the same call), it cannot withdraw to an address, cannot grant or revoke sessions, and cannot outlive its expiry.

**But treat a session key as authority over everything the Account holds.** The SDK's own class doc is blunt about it: the spot wrappers take a **caller-chosen `Pool`** and pull the account's **entire** Base, Quote and DEEP balance — stored *plus* unsettled — into the embedded manager for the duration of the call, with `price_limit` also supplied by the caller. Nothing caps notional, restricts which pools are reachable, or bounds loss to adverse pricing. Fund an ephemeral-session Account accordingly; do not hand a session key to something you would not hand the whole Account to.

Operationally: an admin must have authorized `SessionsApp` on the account registry, or the **trading** wrappers abort with `EAppNotAuthorized` (`authorizeSession` / `revokeSession` / `sessionExpirationMs` use owner or no auth and keep working). And `deauthorize_app` **does not clear `SessionsData`** — re-authorizing revives every still-unexpired grant at once. It is a pause, not a kill switch; revoke the grants themselves.

Hard limits, straight from the declarations (`dist/sessions.d.mts:54-56`; the `720 * 60 * 60 * 1000` literal is in `dist/sessions.mjs:25`):

- `MAX_SESSION_DURATION_MS` = 30 days (`720 * 60 * 60 * 1000`); `durationMs` must be `> 0` and `<=` this.
- `MAX_SESSIONS_PER_ACCOUNT` = **20** distinct addresses. **Expired grants keep occupying slots** — revoke or overwrite, or you hit the cap with dead sessions.
- A grant is dead **at** its `expiresAtMs` (strict `<`).
- There is **no bulk on-chain read** of an Account's grants: derive the field id (`deriveSessionsFieldId`), fetch the object, then decode client-side with the *static* methods `SessionsContract.decodeSessions(contents)`, `.activeSessions(grants, nowMs)` and `.expiredSessions(grants, nowMs)` (`dist/sessions.d.mts:231-240`) — statics on the class, not free functions.
- To reclaim slots, use **`expiredSessions`**, not a hand-rolled filter. `nowMs > expiresAtMs` looks equivalent but leaves the grant expiring exactly *at* `nowMs` occupying a slot forever (the SDK's own warning); `expiredSessions` uses `>=` to match the strict-`<` liveness rule.

`SessionsContract` covers `authorizeSession` / `revokeSession` / `sessionExpirationMs` plus the Predict wrappers (`mintExactQuantity`, `mintExactAmount`, `redeemLive`, `redeemSettled`). The **spot** session wrappers are generated and reachable through `sessionsMoveCalls`, but are **not** wrapped on `SessionsContract` — the spot-over-Account workflow is not modelled yet.

### ⚠️ Predict: the shipped client is ahead of this skill's Move reference

`@mysten/deepbook-v3/predict` addresses deployment **`predict-testnet-8-21`** (`dist/deployments/testnet.mjs`), while [references/predict.md](references/predict.md) documents the earlier **`predict-testnet-4-16`** branch. That is not a version bump, it is a restructure: the generated bindings that ship with the SDK are `expiry_market`, `expiry_cash`, `predict_account`, `order`, `pricing`, `plp` / `lp_book` / `pool_accounting`, `registry` / `market_manager`, `strike_exposure*` — there is **no `predict.move`, no `predict_manager` and no `oracle` module**. `PredictManager` and `OracleSVI`-as-a-`deepbook_predict`-type do not exist in the deployment `PredictClient` talks to; positions live in the shared `Account` primitive as `predict_account::{Position, PredictData}`, markets are `ExpiryMarket`, and pricing goes through `expiry_market::load_live_pricer`. **The SVI oracle did not disappear — it moved into the separate `propbook` package**, and you still have to wire it: `PredictPackages.propbook`, `PredictConfig.objects.oracleRegistry`, and, per underlying (`PredictConfig.underlyings` is a `Record` keyed by symbol, not an array), `blockScholesSviStore` / `blockScholesValueStore` / `pythFeed` (`dist/predict/config/types.d.mts`); `load_live_pricer` takes `propbookRegistry` / `pyth` / `bsValues` / `bsSvi` and defaults `propbookRegistry` from `config.oracleRegistry`.

**So:** use `PredictClient` and the config/deployment helpers from the SDK, and treat predict.md's object model, entry points and pitfalls as documentation of the **superseded 4-16 design** — do not hand-build PTBs from it against the shipped client. Re-verifying predict.md against `predict-testnet-8-21` is tracked as follow-up work.

### Predict config change (2.1.x)

`PredictConfig` gains two **required** fields — `coinTypes` (`plp`, `deep`) and `units` (`positionLotSize`, `fixedPointScale`, `quoteCoinDecimals`, `positionQuantityDecimals`). Consumers using the shipped `getConfig(network)` / `TESTNET_CONFIG` are unaffected; anyone hand-building a config for their own deployment must add both.

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

Expiry-based prediction markets — a **separate** Move package, NOT the CLOB (no Pool /
BalanceManager / order book; trades price against an LP vault). Testnet-only/experimental.
Since deepbook-v3 **2.1.3** the TypeScript client ships in-tree at
`@mysten/deepbook-v3/predict` (superseding the standalone `@mysten/deepbook-predict`) —
see the subpath section above, **including the warning that the shipped client targets
`predict-testnet-8-21` while the reference below documents the earlier `predict-testnet-4-16`
design**. For that (superseded) object model, entry points, oracle lifecycle and pitfalls,
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
