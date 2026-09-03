# DeepBook V3 — Predict (prediction markets)

> Part of the **sui-deepbook** skill. Predict is a *separate* Move package — NOT the CLOB.
> No Pool / BalanceManager / order book. Read this when the task involves prediction
> markets, expiry/strike binaries, the PLP vault, the Propbook oracles, or the predict-server.

> Verified against `deepbookv3@predict-testnet-8-21` Move source — `sources/` is byte-identical
> between branch HEAD and commit `1f79fe87`, the exact commit `@mysten/deepbook-v3@2.1.4` records in
> `dist/deployments/testnet.mjs` — plus the shipped `@mysten/deepbook-v3/predict` surface and the
> upstream `deployment/INTEGRATION.md` (added after `1f79fe87`, on branch HEAD). Re-verified
> 2026-09-03.
>
> **This replaced an earlier design wholesale.** If you have seen `Predict` (a single shared root),
> `PredictManager`, `OracleSVI`, `vault::supply/withdraw` or `Coin<PLP>` in older notes, those types
> **do not exist** here. Mapping table at the end.

Expiry-based prediction markets. **It is NOT the CLOB** — no `Pool`, no `BalanceManager`, no order
book, no maker/taker. Every trade is priced against a shared LP vault (the protocol is your
counterparty) off a Block Scholes SVI surface. Reaching for `placeLimitOrder` / `TradeProof` means
you are in the wrong mental model.

**Testnet only, and the interfaces may change before mainnet.** `getDeployment('mainnet')` throws.

## Use the SDK, and assert the deployment

`@mysten/deepbook-v3/predict` ships a `PredictClient` class, but the idiom is to install it as a **client extension** rather than construct it yourself (`predict()` returns a `{ name, register }` registrar whose `register` constructs the client):

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { getDeployment, predict } from '@mysten/deepbook-v3/predict';

const deployment = getDeployment('testnet');
if (deployment.deployment !== 'predict-testnet-8-21') {
  throw new Error(`Expected predict-testnet-8-21, got ${deployment.deployment}`);
}

const client = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
}).$extend(predict({ network: 'testnet' }));

const markets = await client.predict.read.markets();
```

Three namespaces: `client.predict.tx` (transaction builders), `.read` (state + pricing + quotes),
`.decode` (execution-result parsers). **Assert the deployment name at startup** — upstream says a
later SDK release can intentionally move testnet to a newer deployment, and that is exactly how a
reference like this one goes stale.

## Object model

| Type | Kind | Role | Source |
|---|---|---|---|
| `Registry` | shared | Config root: embeds `MarketManager`, the `PauseCap` / `MarketLifecycleCap` allowlists, market creation | `registry/registry.move:32` |
| `ProtocolConfig` | shared | Global policy: fees, oracle freshness, `version_watermark`, `trading_paused`, `frozen`, valuation lock | `config/protocol_config.move:31` |
| `PoolVault` | shared | The single LP pool: idle DUSDC, reserves, `LpBook<PLP>` request queues, and one `Ledger` holding a row per expiry | `plp/plp.move:57` |
| **`ExpiryMarket`** | **shared, one per expiry** | **The market root.** Embeds `ExpiryCash`, `StrikeExposure`, `EwmaState`, `mint_paused` | `expiry_market.move:52` |
| `ExpiryCash` | embedded (`store`) | That expiry's DUSDC escrow + inventory-impact escrow. Arithmetic only, no policy | `expiry_cash.move:18` |
| `StrikeExposure` | embedded | `tick_size` / `admission_tick_size` / `reference_tick` / settlement price / payout tree | `strike_exposure/strike_exposure.move:34` |
| `AccountWrapper` / `Account` | shared / embedded | **Your custody lives here**, in the shared `account` package — not in a Predict-owned object | `account/account.move:39` / `:45` |
| `PredictData` / `Position` | app-data slot on `Account` | Predict's `Table<PositionKey, Position>` hangs off the `Account` under the `PredictApp` witness | `predict_account.move:46`, `:35` |
| `Pricer` | `copy, drop`, **no `store`** (so: same-PTB only, but *not* a hot potato — nothing forces you to consume it) | Per-market price snapshot; see below | `pricing/pricing.move:25` |
| `OracleRegistry` / `PythFeed` / `BlockScholesValueStore` / `BlockScholesSVIStore` | shared, **in the `propbook` package** | Oracle bindings and observations. Predict only reads them | `propbook/registry.move:46` |

`Position` stores only `root_id` + `opened_at_ms` — the strike range and size are **encoded in the
order id itself** (`predict_account.move:35`).

## Market lifecycle

```
create_and_share_expiry_market      MarketLifecycleCap   registry.move:232
        │   market opens with cash = 0 → mint asserts backing and fails
        ▼
rebalance_expiry_cash               permissionless       plp.move:360
        │   ← this is what actually makes the market tradeable
        ▼
LIVE            now < expiry, not settled
        │   mint_exact_quantity / mint_exact_amount / redeem_live   (all need a Pricer)
        │   set_reference_tick    permissionless; re-calling with the same tick is a no-op, a
        │                         different one aborts. Gated only on version + valuation lock,
        │                         so it is callable after expiry too
        ▼
EXPIRED-UNSETTLED   now >= expiry — no Pricer obtainable
        │   rebalance_expiry_cash silently no-ops here, but value_expiry ABORTS
        │   (ELivePricingExpired) — settle first or the whole valuation PTB reverts
        ▼   try_settle    permissionless, idempotent, returns bool (false = data missing, NOT abort)
SETTLED         redeem_settled(Auth) / redeem_settled_permissionless(app-auth); no Pricer needed
        │       price = exact Pyth spot at expiry; Block Scholes fallback only after a 30s grace
        ▼
SWEPT           dropped from the active set, balances returned to the pool
```

Pool valuation is a separate **ordered** PTB, and it locks everything else out:
`start_pool_valuation` (consumes a `MarketLifecycleProof`) → `value_expiry` once per active market
→ `finish_flush` (`plp.move:194 / :212 / :272`). While the lock is held, mint / redeem / rebalance /
market creation all abort with `EValuationInProgress` (`protocol_config.move:489`).

## Everything priced needs a `Pricer`, obtained in the same PTB

There is no "pass the oracle objects into mint" shape. `Pricer` has `copy, drop` but **no `store`**,
so it cannot be cached across transactions — and it can be reused across commands within one PTB.

```
PTB
 ├─ load_live_pricer(market, config, oracleRegistry, pyth, bsValues, bsSvi, clock, ctx) → Pricer
 │     asserts the three feed objects are the registry's canonical binding, and now < expiry
 ├─ quote_mint(&market, config, &pricer, …)              (optional, devInspect)
 ├─ mint_exact_quantity(&mut market, …, &pricer, …)
 └─ redeem_live(&mut market, …, &pricer, …)              same Pricer reused
```

A `Pricer` is bound to one market (`EWrongPricer`, `expiry_market.move:793`) — a multi-market PTB
loads one per market.

## Entry points

The whole package has **zero `entry fun`** — everything is `public fun`, called from a PTB.
Amounts are DUSDC base units (6 decimals); probabilities and rates use FLOAT_SCALING `1e9`.

| Function | Shape | Preconditions | Source |
|---|---|---|---|
| `load_live_pricer` | → `Pricer` | canonical feeds; `now < expiry` | `expiry_market.move:208` |
| `mint_exact_quantity` | `(…, &Pricer, lower_tick, higher_tick, quantity, max_cost, max_probability, …) → u256` | `quantity % 10_000 == 0`; ticks on the admission grid | `:399` |
| `mint_exact_amount` | `(…, &Pricer, …, max_premium, min_quantity, max_cost, …) → u256` | **`max_cost > 0` is mandatory** (`EMintCostCapRequired`, `:462`) | `:446` |
| `redeem_live` | `(…, &Pricer, order_id, close_quantity, min_probability, min_proceeds, …) → Option<u256>` | not settled; **not in the same ms as the mint** (`EMintRedeemSameTimestamp`, `:987`) | `:496` |
| `redeem_settled` | `(…, order_id, …)` | settled; **no `Pricer`** | `:531` |
| `redeem_settled_permissionless` | `(…, &AccountRegistry, …)` | settled; via `PredictApp` app-auth. **There is no per-owner opt-out** — `deauthorize_app<PredictApp>` is a global switch held by the `AccountAdminCap` (`account_registry.move:120`), so a position holder cannot decline keeper-driven settlement of their own positions | `:557`, `:552-556` |
| `set_reference_tick` | `(…) → u64` | permissionless; **aborts** if the exact Pyth observation is missing, or if a *different* tick was already set (`EReferenceTickAlreadySet`) | `:583` |
| `try_settle` | `(…) → bool` | permissionless, idempotent; **returns `false`** when data is missing | `:635` |

Read-only (devInspect): `quote_mint` / `quote_mint_for_account` (`:274` / `:305`), `current_nav`,
`live_order_value`, `settled_order_payout`. `quote_mint` mutates no market state (upstream's own
docstring, `:268`); it does take `&mut TxContext` in its signature, so pass one, but its quote uses
the **pre-update** EWMA state and preflights neither account balance, slippage caps nor exposure
capacity.

## Oracles (Propbook, not Predict)

- **Block Scholes is primary**: spot, per-expiry forward, per-expiry SVI parameters. Writes are
  **permissionless** — safety comes from a signed batch plus a series-id check, not a capability.
  The old `OracleSVICap` is gone.
- **Pyth is auxiliary**: re-anchors the forward basis when `use_pyth_spot_for_forward` is on,
  supplies the exact spot for `set_reference_tick`, and is the first-choice settlement price.
- **Binding** a feed to an underlying, and creating the Block Scholes store pair, need `RegistryAdminCap` (`propbook/registry.move:257/299/319`). Creating the Propbook **Pyth feed wrapper** is permissionless (`:232`) — a duplicate source aborts before object creation, a junk source id just makes an inert feed at the caller's storage cost.
- Freshness windows **default** to Pyth spot 10s, BS price 10s, BS SVI 60s (`config_constants.move:331/346/362`) — these are mutable `ProtocolConfig` fields with admin setters, so read the shared object rather than trusting the compiled default.
- **EWMA is not a trading precondition** — the congestion surcharge returns 0 when unwarmed
  (`ewma.move:42-50`), it does not abort.

## Strikes, ticks and order ids

- Ranges are half-open **`(lower_tick, higher_tick]`**; `strike = tick * tick_size`; `tick == 0` is
  `-inf` and `pos_inf_tick = 2^30 - 1` is `+inf`. The full `(0, pos_inf)` range is rejected.
- **Two tick sizes.** `tick_size` is the fine grid (quotes, settlement); `admission_tick_size` is the
  coarser grid new mints must land on. The market's `reference_tick`, when set, is the one extra
  admissible boundary.
- **Order id is a packed `u256`**, not an object id: `quantity_lots << 100 | lower_tick << 70 |
  higher_tick << 40 | sequence` (`order.move:23-25`). A partial `redeem_live` returns a **new**
  order id; `root_id` and `opened_at_ms` carry over.
- Positions are unique per market: identify one by `(expiry_market_id, order_id)`.

## PLP is asynchronous now

The synchronous `supply` / `withdraw` entry points that handed back a `Coin<PLP>` are gone (`PLP`
is still very much a coin type — the shares just live in Account custody now). LPs **queue a
request**; it settles in the keeper's flush:

```
request_supply / request_withdraw   → escrowed into the LpBook queue, returns a queue index
   (assets are pulled from Account custody — you do not pass a Coin in)
        ↓
start_pool_valuation → value_expiry×N → finish_flush   → mints/burns PLP at the frozen NAV mark
```

- `lp_book` is **not** an order book: two FIFO request queues, the PLP `TreasuryCap`, and
  `locked_lp` — permanent genesis shares with no withdraw path, so total supply never returns to 0.
- Minimums: supply 10 DUSDC, withdraw 1 PLP. Withdraw fee **defaults to** 0.2% and supply fee to 0
  (both admin-mutable — read `ProtocolConfig`); `min_*_out` is measured **after** fees.
- `lp_request_limit_flush_attempts` defaults to **1** — a request that misses its limit at the mark
  is refunded on the spot, not carried to the next flush.
- `read.pool()`'s `supplyRequestsPending` / `withdrawRequestsPending` are **request counts**, not
  amounts.
- The protocol reserve and fee-incentive reserve are **not** part of PLP NAV — do not treat the
  vault's total balance as redeemable.

## Reading data

1. **SDK** (`client.predict.read.*`) for live on-chain state and quotes — `markets`, `market`,
   `price`, `pricer`, `positions`, `balance`, `hasPosition`, `plpBalance`, `quoteMint`, `quoteRedeem`,
   `pool`. Note `read.quoteMint` does **not** call the on-chain `quote_mint` — it simulates a real
   mint and decodes the event (`client.mjs:215-233`), which is why `quote_mint` still appears in the
   hand-built list below.
2. **Public read APIs** (indexed views, read-only JSON GET, permissive CORS) for history and
   discovery: `predict-server-v4.testnet.mystenlabs.com` (markets, positions, vault, events),
   `propbook-server-v4…` (oracle bindings and observations), `account-server-v4…` (custody,
   balances, portfolio). Check each service's `/status` before trusting recency.
3. **Hand-built `moveCall` for everything else — there is no third path.** The package's `exports`
   map is only `.`, `/account`, `/sessions`, `/predict`, so `dist/contracts/deepbook_predict/*` is
   **not importable by consumers** — ignore the SDK's own `client.d.mts` docstring inviting you to
   "use the generated bindings under `contracts/`", because the `exports` map makes that impossible.
   The **only exported standalone transaction builders** are `loadLivePricer` and `generateAuth`.
   The mint/redeem/PLP builders are reachable only *through* `PredictClient` (`client.predict.tx.*`),
   which is fine when its options suffice — see pitfall 1 for where they do not. Everything below is
   reachable no other way and must be hand-built as a `moveCall`:
   - **the min-out variants** — `redeem_live`, `request_supply`, `request_withdraw` with their
     floors (pitfall 1);
   - **admin / cap-gated** — `start_pool_valuation`, `value_expiry`, `finish_flush`, every
     `ProtocolConfig` setter, `set_mint_paused`, `create_and_share_expiry_market`;
   - **permissionless keeper calls** — `rebalance_expiry_cash`, `try_settle`,
     `sponsor_fee_incentives`, `set_reference_tick`, `redeem_settled_permissionless`;
   - **read-only** — `quote_mint`, `live_order_value`, `settled_order_payout` (no cap, devInspect;
     they are simply not bound).

   The rest of what `/predict` does export is worth knowing before you re-implement it:
   `PredictClient` / `predict`, `getConfig` / `getDeployment` / `getUnits`, `TESTNET_CONFIG` /
   `TESTNET_DEPLOYMENT` / `TESTNET_UNITS`, `decodeMoveAbort` / `PredictMoveError` /
   `PredictInputError` (importable, so `instanceof` works), `deriveAccountWrapperId`, the `pricing`
   namespace, the tick helpers `POS_INF_TICK` / `binaryRangeTicks`, the constants
   `POSITION_LOT_SIZE` / `U64_MAX`, the unit converters (`usdcToRaw`, `probabilityToRaw`, …) — and
   **`toGeneratedConfig(cfg)`**, which turns a `PredictConfig` into the exact
   `{predictPackageId, accountPackageId, protocolConfig, poolVault, registry, oracleRegistry,
   accountRegistry}` shape a hand-built call wants. Do not hand-roll that mapping.

   One id a hand-built call needs is **not** in `PredictConfig.objects`: the shared
   `0x2::accumulator::AccumulatorRoot`.

Account API paths take the shared **Account wrapper id**, not the owner address —
`client.predict.wrapperIdFor(owner)` derives it deterministically, no chain read.

Data conventions from the upstream guide: Postgres `NUMERIC` serializes as **strings** (parse with
decimal/bigint tooling, not `parseFloat`); raw event windows use `from_ms` / `to_ms` in
milliseconds with an exclusive upper bound, while named history windows use `start_time` /
`end_time` in **seconds** — do not mix the two families.

## Errors

`decodeMoveAbort(err)` → `PredictMoveError | null` (null when the failure was not a `MoveAbort`,
e.g. insufficient gas). Match on **`.abortName`** — but note it is `string | null`, null whenever
the transport surfaced no name (a non-clever abort, or a JSON-RPC failure carrying only a line
number), so always handle that branch instead of assuming a name is present. Do **not** match on
`.code`: it is the clever-error encoding, which packs module, line and constant index into the high
bits of a u64 (hence `bigint`, not `number`) and therefore shifts whenever the package is
recompiled. Separately, the underlying Move constants restart at 0 in every module —
`EExpiryMarketNotActive` (plp) and `ERequestNotFound` (lp_book) are both `0` — so a raw source
constant is ambiguous too. `PredictInputError` is thrown client-side before submission (lot size,
tick alignment).

`EValuationInProgress` means *retry later*, not permanent failure.

## Pitfalls

1. **Only the mint paths let you set a slippage guard through the facade.** Four cases; mint's two
   are fixable (`mintAmount` only partly), the other two are not:
   - **`tx.mint` — fixable, both guards.** `MintOptions` takes optional `maxCost` and
     `maxProbability` (`client.d.mts:43-47`) and `#buildMint` forwards them (`client.mjs:396-411`);
     omit either and the SDK substitutes `U64_MAX` (`tx/trade.mjs:39-40`), i.e. uncapped.
   - **`tx.mintAmount` — cost guard only.** `MintAmountOptions` is `{ spend, minQuantity, maxCost? }`
     (`client.d.mts:49-55`) — there is **no `maxProbability`**, because `mint_exact_amount` has no
     `max_probability` parameter on-chain (`expiry_market.move:446-458`). Omitted `maxCost` becomes
     `U64_MAX` (`tx/trade.mjs:55`); the SDK does reject `maxCost <= 0` client-side with
     `PredictInputError` (`client.mjs:105`).
   - **`tx.redeem` — not fixable.** `CloseOptions` is `{ orderId, quantity }` only
     (`client.d.mts:58-61`), `#buildRedeem` forwards nothing else (`client.mjs:413-424`), and the
     internal `redeemLive` fills in `minProbability: 0n, minProceeds: 0n` (`tx/trade.mjs:68-69`).
   - **`tx.supplyPlp` / `tx.withdrawPlp` — not fixable either.** Their signatures are
     `(owner, amountUsdc)` and `(owner, shares)` (`client.d.mts:213-214`); there is no min-out
     parameter to pass, and the builders hardcode `minPlpOut: 0n` / `minDusdcOut: 0n`
     (`client.mjs:134,142`).

   For the two unfixable cases there is no SDK escape hatch — those builders are not exported from
   `/predict`, and `dist/contracts/**` is outside the package's `exports` map. Hand-build the
   `moveCall` (`expiry_market::redeem_live` with `min_probability` / `min_proceeds`,
   `plp::request_supply` / `request_withdraw` with `min_plp_out` / `min_dusdc_out`).
2. **A submitted PLP request is not a fill.** You get a queue index; the flush decides.
3. **Refresh oracles and trade in separate transactions.** Writing an observation and then pricing
   off it in the same tx aborts with `EOracleWrittenInThisTransaction` — it compares the
   observation's writer digest against `tx_context::digest()`.
4. **A newly created market cannot be minted against** until someone calls the permissionless
   `rebalance_expiry_cash`.
5. **`max_premium` ≠ `max_cost`.** `max_premium` only sizes the position; fees, builder fee and the
   EWMA penalty are added on top, and `max_cost` is the only true ceiling.
6. **mint and redeem are asymmetric**: mint caps are disabled by passing `u64::MAX` and redeem
   floors by passing `0`. The one hard requirement is `mint_exact_amount`'s `max_cost`, which is
   asserted `> 0` (`expiry_market.move:462`) — `u64::MAX` satisfies that assert and is exactly what
   the SDK substitutes when you omit `maxCost`, so the guard stops a *zero*, not an uncapped mint.
   Also: `redeem_live` needs a `Pricer`, `redeem_settled` does not.
7. **Align to `admission_tick_size`, not `tick_size`** — and pass ticks, not strikes.
8. `try_settle` returning `false` is a normal "not yet" (keep polling); `set_reference_tick` aborts
   instead.
9. `live_order_value` / `settled_order_payout` **do not check ownership** — never use them as an
   authorization check.
10. **Three different registries** exist and are easy to confuse: `deepbook_predict::registry::Registry`,
    `propbook::registry::OracleRegistry`, `account::account_registry::AccountRegistry`. At most two
    meet in one signature (`create_and_share_expiry_market` takes the first two); within the predict
    package `AccountRegistry` appears in exactly one public fun, `redeem_settled_permissionless`
    (the `account` package itself of course takes it all over).
11. **Do not derive `coinTypes.plp` from `packages.predict`.** At this deployment they are the
    *same id*, which makes the bug invisible today: a type tag pins the *original* package id,
    while `packages.predict` moves on every upgrade. Read `coinTypes.plp` from the config.
12. `getUnits()` returns four fields but the SDK only actually consumes `positionLotSize`; the other
    three are still hardcoded internally.

## Superseded design → current

| `predict-testnet-4-16` | `predict-testnet-8-21` |
|---|---|
| `Predict` (single shared root) | `Registry` + `ProtocolConfig` + `PoolVault` (three shared objects) |
| `PredictManager` (per-user object) | **nothing** — custody is the shared `account` package's `Account`, with a `PredictData` app slot |
| `OracleSVI` + `OracleSVICap` | `propbook`'s `BlockScholesSVIStore` / `BlockScholesValueStore` / `PythFeed`, bound via `OracleRegistry` |
| `vault` | `PoolVault` + embedded `Ledger`, plus per-market `ExpiryCash` (funds sit in two layers) |
| `supply` / `withdraw` → `Coin<PLP>` | `request_supply` / `request_withdraw` → queue index → keeper flush |
| `RangeKey` / `strike_matrix` | tick pairs + `range_codec`; order id packs the range |
| — | `ExpiryMarket` per expiry, cadence-scheduled deployment, `BuilderCode`, fee-incentive sponsorship, EWMA congestion surcharge |
