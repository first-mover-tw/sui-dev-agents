# DeepBook V3 — Predict (prediction markets)

> Part of the **sui-deepbook** skill. Predict is a *separate* `deepbook_predict`
> Move package — NOT the CLOB. No Pool / BalanceManager / order book. Read this
> when the task involves prediction markets, expiry/strike binaries, OracleSVI,
> PredictManager, PLP vault, or the predict-server.

> ⚠️ **STALE — describes the superseded `predict-testnet-4-16` design.** Verified against `deepbookv3@predict-testnet-4-16` source 2026-05-30. The TypeScript client now shipping at `@mysten/deepbook-v3/predict` (since `@mysten/deepbook-v3` **2.1.3**, superseding the standalone `@mysten/deepbook-predict`) targets a **later deployment, `predict-testnet-8-21`**, whose Move package is a restructure: modules are `expiry_market`, `expiry_cash`, `predict_account`, `order`, `pricing`, `plp`/`lp_book`/`pool_accounting`, `registry`/`market_manager`, `strike_exposure*`. There is **no `predict.move`, no `predict_manager` and no `oracle` module** — `PredictManager` and `OracleSVI` below **do not exist** as `deepbook_predict` types in that deployment (the SVI oracle moved to the separate `propbook` package and is still wired in through `PredictConfig.objects.oracleRegistry` / `underlyings[<symbol>].blockScholesSviStore`) (positions live in the shared `Account` primitive as `predict_account::{Position, PredictData}`; markets are `ExpiryMarket`; pricing goes through `expiry_market::load_live_pricer`).
>
> Read this file for the 4-16 design only. **Do not hand-build PTBs from it against `PredictClient`** — use the SDK's own entry points. Re-verification against `predict-testnet-8-21` is outstanding.

Expiry-based prediction-market protocol. **It is NOT the CLOB.** Predict is a *separate* Move package (`deepbook_predict`, currently on the `predict-testnet-4-16` branch) that only borrows `deepbook::math` — it has **no `Pool`, no `BalanceManager`, no order book, no maker/taker**. Every trade is priced against a shared LP vault (the protocol is your counterparty), using Block Scholes' **OracleSVI** volatility model. If you find yourself reaching for `placeLimitOrder` / `TradeProof` here, you're in the wrong mental model.

**As of 2026-05, Predict is testnet-only and experimental.** Verify mainnet availability before wiring it into production.

## Object model (memorize this — it's the #1 thing LLMs get wrong)

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

## Current testnet deployment (verify before use — testnet redeploys often)

```
Predict package: 0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
Predict object:  0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
Quote asset:     ...::dusdc::DUSDC   (testnet faucet stablecoin, 6 decimals)
Public server:   https://predict-server.testnet.mystenlabs.com
```

## On-chain entry points (`deepbook_predict::predict`)

All trade fns are generic over `<Quote>` and take human-irrelevant **scaled** u64s (Move layer):

- `create_manager(ctx): ID` — make a `PredictManager` (shared). One per user.
- `mint<Quote>(predict, manager, oracle, key: MarketKey, quantity, clock, ctx)` — buy a directional position; debits quote from the manager, emits `PositionMinted`.
- `redeem<Quote>(predict, manager, oracle, key, quantity, clock, ctx)` — sell; payout into the manager. `redeem_permissionless<Quote>(...)` for *settled* oracles (anyone can call).
- `mint_range<Quote>(predict, manager, oracle, key: RangeKey, quantity, clock, ctx)` / `redeem_range<Quote>(...)` — vertical ranges.
- `supply<Quote>(predict, coin, clock, ctx): Coin<PLP>` — LP in, get shares.
- `withdraw<Quote>(predict, lp_coin, clock, ctx): Coin<Quote>` — burn shares, quote out (subject to a withdrawal rate-limiter + vault-availability check).
- Preview helpers (read-only, devInspect): `get_trade_amounts(...) -> (cost, payout)`, `get_range_trade_amounts(...)`, `ask_bounds(oracle_id) -> (min, max)`.

**Prefer the SDK subpath** — since `@mysten/deepbook-v3` 2.1.3, `@mysten/deepbook-v3/predict` ships `PredictClient` plus quotes, mint/redeem/claim, PLP, typed receipts and a client-side board pricer, with testnet ids from the shared generated deploy manifest (`getConfig('testnet')`). The standalone `@mysten/deepbook-predict` package is superseded. **Note that the client targets `predict-testnet-8-21`, not the 4-16 entry points listed above** — the raw `moveCall` shape below is 4-16-era and will not resolve against the deployment the client uses:

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

## Oracle lifecycle — gates tradeability

`active` → live spot/SVI updates (prices update more often than SVI) → **`settled`** (frozen on the first post-expiry price push; emits `OracleSettled`) → optionally `compacted` (storage optimization). Mints require an active oracle; after settlement only redeems work (and `redeem_permissionless` opens up). **Don't assume an oracle is tradeable just because it exists — check status.**

## Reading data (3 paths, in priority order)

1. **Public `predict-server`** — your default render backend (indexed, paginated). Key endpoints:
   - `GET /predicts/:id/state`, `/predicts/:id/oracles`, `/oracles/:id/state`, `/oracles/:id/ask-bounds`
   - vault: `/predicts/:id/vault/summary`, `/vault/performance?range=ALL`
   - portfolio: `/managers`, `/managers/:id/summary`, `/managers/:id/positions/summary`, `/managers/:id/pnl?range=ALL`
   - history: `/oracles/:id/prices[/latest]`, `/oracles/:id/svi[/latest]`, `/positions/{minted,redeemed}`, `/ranges/{minted,redeemed}`, `/lp/{supplies,withdrawals}`, `/trades/:oracle_id`
2. **Sui event stream** (freshness, not pagination) — filter the package id for `oracle::Oracle{PricesUpdated,SVIUpdated,Settled,Activated}`.
3. **Direct object reads** — only for confirmation-critical state right around a wallet tx (the manager, the target oracle, a coin about to be spent).

## Predict pitfalls

❌ **Treating Predict like the CLOB.** No Pool/BalanceManager/TradeProof/limit orders. Counterparty is the PLP vault; price comes from OracleSVI + a utilization spread.
❌ **Looking for a position object.** Positions/ranges are balances inside `PredictManager`. Read the manager, not a dangling NFT.
❌ **Scanning chain as your primary backend.** Use `predict-server` for lists/history/PnL; chain reads are slow and hard to paginate.
❌ **Assuming zero server lag post-tx.** Confirm the tx, then refresh server endpoints — it's low-lag, not instant.
❌ **Using stale testnet package IDs.** Predict redeploys; pull the current package/object IDs (server `/status`, or the repo's `scripts/config/constants.ts`) instead of hard-coding.
