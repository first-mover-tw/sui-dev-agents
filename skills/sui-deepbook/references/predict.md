# DeepBook V3 — Predict (prediction markets)

> Part of the **sui-deepbook** skill. Predict is a *separate* Move package — NOT the CLOB.
> No Pool / BalanceManager / order book. Read this when the task involves prediction
> markets, expiry/strike binaries, the PLP vault, the Propbook oracles, or the predict-server.

> Verified against `deepbookv3` Move source at commit `4d752fb8` — the `sourceCommit`
> `@mysten/deepbook-v3@2.6.4` records for `deepbook-predict-testnet` in
> `dist/deployments/testnet.mjs:7`; that is the source of the *original* (v1) package
> `packages.predictV1` — plus the shipped `@mysten/deepbook-v3@2.6.4` `/predict` surface
> (`dist/**/*.d.mts`, `PREDICT.md`) and live testnet/mainnet GraphQL reads. Re-verified 2026-09-30.
> `path:line` references below are `packages/<pkg>/sources/…` at `4d752fb8`. The SDK's Move-call
> target `packages.predict` is a **v2 upgrade** of that package whose source is *not* at
> `4d752fb8` (v2 adds `mint_exact_cost`; see "Package versions"). Anything v2 may have changed
> beyond that one entry point is **unverified** here.
>
> **This replaced an earlier design wholesale.** If you have seen `Predict` (a single shared root),
> `PredictManager`, `OracleSVI`, `vault::supply/withdraw` or `Coin<PLP>` in older notes, those types
> **do not exist** here. Mapping table at the end.

Expiry-based prediction markets. **It is NOT the CLOB** — no `Pool`, no `BalanceManager`, no order
book, no maker/taker. Every trade is priced against a shared LP vault (the protocol is your
counterparty) off a Block Scholes SVI surface. Reaching for `placeLimitOrder` / `TradeProof` means
you are in the wrong mental model.

**Two deployments are recorded** in `@mysten/deepbook-v3@2.6.4`: `deepbook-predict-testnet` and
`deepbook-predict-mainnet` (`dist/deployments/{testnet,mainnet}.mjs:3-8`); `getDeployment` /
`getConfig` / `getUnits` resolve both and throw on any other network
(`dist/deployments/index.mjs:14-18`). The mainnet record exists — that is all this reference
claims for it. Everything below was verified against the testnet deployment's source; mainnet was
initially deployed from a different commit (`7b169bde`, `dist/deployments/mainnet.mjs:7`) that was
not re-read here, and its live `ProtocolConfig` read `trading_paused: true` on 2026-09-30. Treat
mainnet feature parity as **unverified**.

**The previous testnet deployment (`predict-testnet-8-21`, SDK ≤ 2.1.4) is gone from the SDK.**
2.2.0 moved testnet to a *separate* deployment named `deepbook-predict-testnet`, not an upgrade —
old accounts, positions and markets are not visible to it (CHANGELOG 2.2.0). **Then 2.5.0 redeployed
again under the same name**: 2.4.2 records `deepbook-predict-testnet` @ sourceCommit `a928bd2d`,
`packages.predict 0x25d075d2…`; 2.5.0 records the same name @ `4d752fb8`, `0x59d71119…`
(CHANGELOG 2.5.0: "Both networks were redeployed, so every Predict package and object id moved").
If you pinned SDK 2.2–2.4, your `deepbook-predict-testnet` ids are dead. Do not carry any id over.

## Use the SDK, and assert the deployment

`@mysten/deepbook-v3/predict` ships a `PredictClient` class, but the idiom is to install it as a **client extension** rather than construct it yourself (`predict()` returns a `{ name, register }` registrar whose `register` constructs the client):

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { getDeployment, predict } from '@mysten/deepbook-v3/predict';

const deployment = getDeployment('testnet');
// The name alone is not enough: 2.5.0 redeployed under the same name. Pin the commit too.
if (
  deployment.deployment !== 'deepbook-predict-testnet' ||
  deployment.sourceCommit !== '4d752fb82d909a821c85bcc5d3963725efb546f4'
) {
  throw new Error(`Unexpected Predict deployment ${deployment.deployment}@${deployment.sourceCommit}`);
}

const client = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
}).$extend(predict({ network: 'testnet' }));

const markets = await client.predict.read.markets();
```

Three namespaces: `client.predict.tx` (transaction builders), `.read` (state + pricing + quotes),
`.decode` (execution-result parsers). **Assert the deployment name *and* `sourceCommit` at
startup** — a later SDK release can intentionally move testnet to a newer deployment with no API
change: 2.2.0 did it with a new name, and 2.5.0 did it again *keeping the name*, so a name-only check
would have passed across a full redeploy. That is exactly how a reference like this one goes stale.
(A package *upgrade* — 2.6.0's v2 — keeps `sourceCommit`, since it records the initial deployment;
see below.)

### Package versions: `predict` vs `predictV1`

| Field (testnet, 2.6.4) | Id | What it is for |
|---|---|---|
| `packages.predict` | `0x30a03c33…25ce` (on-chain version 2) | **Move-call target** — every generated binding resolves `config.predictPackageId` to this |
| `packages.predictV1` | `0x59d71119…e2f4` (version 1) | **Original id** — struct types, event types, dynamic-field keys, `coinTypes.plp` |
| `quoteCoinType` | `0xc028557a…::usdc::USDC` | Settlement collateral |

(`dist/deployments/testnet.mjs:46-61`; on-chain versions read via GraphQL 2026-09-30.) Mainnet has
the same split (`predict 0x1cacb9bf…` v2 / `predictV1 0x89aea622…` v1,
`dist/deployments/mainnet.mjs:46-47`). `toGeneratedConfig(cfg)` maps them to `predictPackageId` /
`predictPackageIdV1` (`dist/predict/config/generated.mjs:4-5`); `predictV1` is optional in
`PredictConfig` and falls back to `packages.predict`, which is only correct for a custom deployment
that has never been upgraded.

The SDK's v2 targets: testnet since 2.6.0; mainnet since **2.6.1** (CHANGELOG 2.6.1, b042290,
bumped mainnet `packages.predict` → `0x1cacb9bf…` and `sessionsPackageId` → `0xec678aee…`, keeping
the originals as `predictV1` / `sessionsPackageIdV1`). v2 adds `expiry_market::mint_exact_cost` (all-in budget mint; SDK `tx.mintCost` /
`read.quoteMintCost`, `dist/predict/client.d.mts:239,262`). It is **not** in the `4d752fb8` source.
Confirmed live on 2026-09-30: `mint_exact_cost` is a `PUBLIC` function in `expiry_market` of testnet
`0x30a03c33…` and mainnet `0x1cacb9bf…`, and absent from both v1 ids. The SDK's own docstrings
(`MintCostOptions`, `dist/predict/client.d.mts:56`; `dist/sessions.d.mts:191`) and `PREDICT.md`
still say "Testnet only / Mainnet remains v1" — that text predates 2.6.1 and is stale; the SDK's
own mainnet record and the chain both say v2. Whether calling it on mainnet works end-to-end
(trading was paused there when checked) is **unverified**.

**Upstream has already moved past the SDK.** At `deepbookv3` `main` (checked 2026-09-30),
`packages/predict/Published.toml` records testnet `published-at 0x6c2c2d3c…` (version 4) and mainnet
`0x08fa3ef1…` (version 3). 2.6.4 still targets version 2 on both. Old versions stay callable only
while `ProtocolConfig.version_watermark` admits them (`assert_version`,
`config/protocol_config.move:573-576`); it read `1` on both networks on 2026-09-30. A watermark bump
turns every 2.6.4 call into `EPackageVersionDisabled` — another reason to pin and assert.

## Object model

| Type | Kind | Role | Source |
|---|---|---|---|
| `Registry` | shared | Config root: embeds `MarketManager`, the `PauseCap` / `MarketLifecycleCap` / `PoolValuationCap` allowlists, market creation | `registry/registry.move:35` |
| `ProtocolConfig` | shared | Global policy: fees, oracle freshness, `no_trade_window_ms`, `version_watermark`, `trading_paused`, `frozen`, valuation / snapshot flags | `config/protocol_config.move:35` |
| `PoolVault` | shared | The single LP pool: idle USDC, reserves, `LpBook<PLP>` request queues, one `Ledger` holding a row per expiry, and the in-flight `PoolValuation` | `plp/plp.move:87` |
| **`ExpiryMarket`** | **shared, one per expiry** | **The market root.** Embeds `ExpiryCash`, `StrikeExposure`, `EwmaState`, `mint_paused`, a fee-incentive balance | `expiry_market.move:54` |
| `ExpiryCash` | embedded (`store`) | That expiry's USDC cash balance + an inventory-impact reserve counter. Arithmetic only, no policy | `expiry_cash.move:18` |
| `StrikeExposure` | embedded | `tick_size` / `admission_tick_size` / `reference_tick` / settlement price / payout tree | `strike_exposure/strike_exposure.move:34` |
| `AccountWrapper` / `Account` | shared / embedded | **Your custody lives here**, in the shared `account` package — not in a Predict-owned object | `account/account.move:39` / `:45` |
| `PredictData` / `Position` | app-data slot on `Account` | Predict's `Table<PositionKey, Position>` hangs off the `Account` under the `PredictApp` witness | `predict_account.move:46`, `:35` |
| `Pricer` | `copy, drop`, **no `store`** (so: same-PTB only, but *not* a hot potato — nothing forces you to consume it) | Per-market price snapshot; see below | `pricing/pricing.move:37` |
| `OracleRegistry` / `PythFeed` / `BlockScholesValueStore` / `BlockScholesSVIStore` | shared, **in the `propbook` package** | Oracle bindings and observations. Predict only reads them | `propbook/registry.move:46` |

`Position` stores only `root_id` + `opened_at_ms` — the strike range and size are **encoded in the
order id itself** (`predict_account.move:35`).

## Market lifecycle

```
create_and_share_expiry_market      MarketLifecycleCap   registry.move:266
        │   market opens with cash = 0 → mint asserts backing and fails
        ▼
rebalance_expiry_cash               permissionless       plp.move:616
        │   ← this is what actually makes the market tradeable
        ▼
LIVE            now < expiry, not settled
        │   mint_exact_quantity / mint_exact_amount / redeem_live   (all need a Pricer)
        │   (+ mint_exact_cost on the v2 package — not in the 4d752fb8 source)
        │   set_reference_tick    permissionless; re-calling with the same tick is a no-op, a
        │                         different one aborts. Gated only on version (NOT on the
        │                         valuation lock), so it is callable after expiry too
        ▼
NO-TRADE WINDOW  expiry - now <= no_trade_window_ms → live mint / quote / redeem abort
        │        ETradeWindowClosed (protocol_config.move:591-599). Settlement paths stay open
        ▼
EXPIRED-UNSETTLED   now >= expiry — no Pricer obtainable
        │   rebalance_expiry_cash silently no-ops here (plp.move:924), but a flush's
        │   snapshot_expiry_pricer ABORTS on it (EExpiredMarketNotSettled, plp.move:360) —
        │   settle first or the whole snapshot PTB reverts
        ▼   try_settle    permissionless, idempotent, returns bool (false = data missing, NOT abort)
SETTLED         redeem_settled(Auth) / redeem_settled_permissionless(app-auth); no Pricer needed
        │       price = exact Pyth spot at expiry; Block Scholes fallback only after a 30s grace
        │       (constants.move:149)
        ▼
SWEPT           dropped from the active set, balances returned to the pool
```

Pool valuation (the "flush") is a **cap-gated, multi-stage** keeper flow that spans transactions
(`plp.move:103-123` docstring):

```
registry::generate_pool_valuation_proof(&PoolValuationCap)        registry.move:165
  └─ PTB 1 (atomic "snapshot stage"):
       start_pool_valuation(proof) → SnapshotStage (hot potato)    plp.move:280
       snapshot_expiry_pricer × every active market                plp.move:319
       seal_valuation_snapshot(stage)                              plp.move:391
  └─ PTB 2..n: value_expiry × every snapshotted market             plp.move:431
  └─ finish_flush — must land within max_valuation_window_ms       plp.move:495
```

**Trading is NOT locked out by the flush** in this source — this is the biggest behavioural change
from `predict-testnet-8-21`. Live mint / redeem / settled redeem are blocked only while the one-PTB
snapshot stage is open (`assert_snapshot_not_in_progress`, `expiry_market.move:895-914`), which in
practice means a keeper cannot compose a trade into its own snapshot PTB. `rebalance_expiry_cash`,
`try_settle`, `set_reference_tick` and market creation all run mid-flush. What *does* abort with
`EValuationInProgress` (`protocol_config.move:609`) while the valuation flag is set: every
`ProtocolConfig` setter, `sponsor_fee_incentives`, and `cancel_supply_request` /
`cancel_withdraw_request` (`plp.move:639 / :783 / :821`).

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

A `Pricer` is bound to one market (`EWrongPricer`, `expiry_market.move:917`) — a multi-market PTB
loads one per market.

## Entry points

The whole package has **zero `entry fun`** — everything is `public fun`, called from a PTB.
Amounts are quote-coin (`usdc::usdc::USDC`) base units (6 decimals); probabilities and rates use FLOAT_SCALING `1e9`.

| Function | Shape | Preconditions | Source |
|---|---|---|---|
| `load_live_pricer` | → `Pricer` | canonical feeds; `now < expiry` (`ELivePricingExpired`, `pricing/pricing.move:293`) | `expiry_market.move:231` |
| `mint_exact_quantity` | `(…, &Pricer, lower_tick, higher_tick, quantity, max_cost, max_probability, …) → u256` | `quantity % 10_000 == 0` (`order.move:91`); ticks on the admission grid; outside the no-trade window | `:432` |
| `mint_exact_amount` | `(…, &Pricer, …, max_premium, min_quantity, max_cost, …) → u256` | **`max_cost > 0` is mandatory** (`EMintCostCapRequired`, `:495`) | `:479` |
| `mint_exact_cost` | `(…, &Pricer, lower_tick, higher_tick, max_cost, min_quantity, …) → u256` (arg order per the 2.6.4 binding, `dist/contracts/deepbook_predict/expiry_market.mjs:879`) | **v2 package only** — not in the `4d752fb8` source, so no line ref | — |
| `redeem_live` | `(…, &Pricer, order_id, close_quantity, min_probability, min_proceeds, …) → Option<u256>` | not settled; outside the no-trade window; **not in the same ms as the mint** (`EMintRedeemSameTimestamp`, `:1114`) | `:529` |
| `redeem_settled` | `(…, order_id, …)` | settled; **no `Pricer`** | `:564` |
| `redeem_settled_permissionless` | `(…, &AccountRegistry, …)` | settled; via `PredictApp` app-auth. **There is no per-owner opt-out** — `deauthorize_app<PredictApp>` is a global switch held by the `AccountAdminCap` (`account_registry.move:120`), so a position holder cannot decline keeper-driven settlement of their own positions | `:590`, `:585-589` |
| `set_reference_tick` | `(…) → u64` | permissionless; **aborts** if the exact Pyth observation is missing (`EReferenceTickObservationMissing`), or if a *different* tick was already set (`EReferenceTickAlreadySet`, `strike_exposure.move:473`) | `:618` |
| `try_settle` | `(…) → bool` | permissionless, idempotent; **returns `false`** when data is missing | `:669` |

Read-only (devInspect): `quote_mint` / `quote_mint_for_account` (`:307` / `:338`), `current_nav`,
`live_order_value`, `settled_order_payout` (`:269` / `:280` / `:289`). `quote_mint` mutates no
market state (upstream's own docstring, `:300-306`); it does take `&mut TxContext` in its
signature, so pass one, but its quote uses the **pre-update** EWMA state and preflights neither
account balance, slippage caps nor exposure capacity. It *does* apply the live-mint gates, so it
aborts inside the no-trade window like a real mint.

## Oracles (Propbook, not Predict)

- **Block Scholes is primary**: spot, per-expiry forward, per-expiry SVI parameters. Writes are
  **permissionless** — safety comes from a signed batch plus a series-id check, not a capability.
  The old `OracleSVICap` is gone.
- **Pyth is auxiliary**: re-anchors the forward basis when `use_pyth_spot_for_forward` is on,
  supplies the exact spot for `set_reference_tick`, and is the first-choice settlement price.
- **Binding** a feed to an underlying, and creating the Block Scholes store pair, need `RegistryAdminCap` (`propbook/registry.move:257/299/319`). Creating the Propbook **Pyth feed wrapper** is permissionless (`:232`) — a duplicate source aborts before object creation, a junk source id just makes an inert feed at the caller's storage cost.
- Freshness windows **default** to Pyth spot 2s, BS price 2s, BS SVI 60s (`config/config_constants.move:362/382/398`) — these are mutable `ProtocolConfig` fields with admin setters, so read the shared object rather than trusting the compiled default. (Live on 2026-09-30: testnet's BS SVI window was 10s, mainnet's 60s — the two recorded deployments already differ.)
- **EWMA is not a trading precondition** — the congestion surcharge returns 0 when unwarmed
  (`ewma.move:42-51`), it does not abort; it is also off entirely unless `ewma_config.enabled`
  (read `false` on both networks' live `ProtocolConfig`, 2026-09-30).

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
snapshot stage → value_expiry×N → finish_flush   → mints/burns PLP at the frozen NAV mark
```

- `lp_book` is **not** an order book: two FIFO request queues, the PLP `TreasuryCap`, and
  `locked_lp` — permanent genesis shares with no withdraw path, so total supply never returns to 0.
- Minimums: supply 10 USDC, withdraw 1 PLP (`constants.move:43/46`). Withdraw fee **defaults to**
  0.2% and supply fee to 0 (`config/config_constants.move:81/76`; both admin-mutable — read
  `ProtocolConfig`); `min_plp_out` / `min_usdc_out` are measured **after** fees.
- `lp_request_limit_flush_attempts` defaults to **1** (`config/config_constants.move:116`) — a
  request that misses its limit at the mark is refunded on the spot, not carried to the next flush.
- The pool must be bootstrapped once (`lock_capital`) before any request: `request_supply` /
  `request_withdraw` abort `ENotBootstrapped` on an empty pool (`plp/plp.move:700 / :744`).
- `read.pool()`'s `supplyRequestsPending` / `withdrawRequestsPending` are **request counts**, not
  amounts.
- The protocol reserve and fee-incentive reserve are **not** part of PLP NAV — do not treat the
  vault's total balance as redeemable.

## Reading data

1. **SDK** (`client.predict.read.*`) for live on-chain state and quotes — `markets`, `market`,
   `price`, `pricer`, `positions`, `balance`, `hasPosition`, `plpBalance`, `quoteMint`,
   `quoteMintCost`, `quoteRedeem`, `pool` (`dist/predict/client.d.mts:250-267`). Note
   `read.quoteMint` does **not** call the on-chain `quote_mint` — it builds the real mint and
   simulates it, decoding the `OrderMinted` event (`dist/predict/client.mjs:217-220, 415-418`). For a
   no-chain preview there is the `cost` namespace (`cost.mintCost`, `cost.mintCostForBudget`,
   `cost.redeemLiveProceeds`, …; `dist/predict/cost.d.mts`), an integer port of the fee path.
2. **Public read APIs** (indexed views) for history and discovery. The previous reference named
   `predict-server-v4.testnet.mystenlabs.com` (plus `propbook-server-v4…` / `account-server-v4…`).
   **Unverified for the current deployment:** on 2026-09-30 that host did not resolve (DNS NXDOMAIN),
   neither the 2.6.4 tarball nor `deepbookv3@4d752fb8` names a replacement, and the
   `deployment/INTEGRATION.md` this used to cite is not in the `4d752fb8` tree. Find the current host
   from upstream before relying on one, and check its `/status` before trusting recency.
3. **Generated move-call bindings for everything the facade does not wrap.** Since 2.4.0 `/predict`
   exports every Predict module with a callable function as a namespace of transaction thunks
   (`dist/predict/index.d.mts:38`): `adminMoveCalls`, `builderCodeMoveCalls`,
   `expiryMarketMoveCalls`, `marketLifecycleCapMoveCalls`, `marketManagerMoveCalls`,
   `pauseCapMoveCalls`, `plpMoveCalls`, `poolValuationCapMoveCalls`, `predictAccountMoveCalls`,
   `pricingMoveCalls`, `protocolConfigMoveCalls`, `rangeCodecMoveCalls`, `registryMoveCalls` — plus
   event layouts `builderCodeEvents`, `configEvents`, `orderEvents`, `vaultEvents`. Pass
   `config: toGeneratedConfig(cfg)` and the shared objects fill themselves in; owner-authorized
   calls take an `Auth` from `generateAuth(cfg)` and priced calls a `Pricer` from `loadLivePricer`.
   The bindings also inject `0x6` (Clock) and `0xacc` (`AccumulatorRoot`) themselves
   (`dist/contracts/utils/index.mjs:42,54-55`). This is how you reach:
   - **the min-out variants** — `expiryMarketMoveCalls.redeemLive` with `minProbability` /
     `minProceeds` (pitfall 1);
   - **admin / cap-gated** — the pool-valuation flow, every `ProtocolConfig` setter,
     `set_mint_paused`, `create_and_share_expiry_market`;
   - **permissionless keeper calls** — `rebalance_expiry_cash`, `try_settle`,
     `sponsor_fee_incentives`, `set_reference_tick`, `redeem_settled_permissionless`;
   - **read-only** — `quote_mint`, `live_order_value`, `settled_order_payout` (devInspect).

   Also exported and worth knowing before you re-implement them: `PredictClient` / `predict`,
   `getConfig` / `getDeployment` / `getUnits`, `TESTNET_CONFIG` / `TESTNET_DEPLOYMENT` /
   `TESTNET_UNITS` and the `MAINNET_*` trio, `decodeMoveAbort` / `PredictMoveError` /
   `PredictInputError` (importable, so `instanceof` works), `deriveAccountWrapperId`, the `pricing`
   namespace (client-side board pricer — distinct from `pricingMoveCalls`), the `cost` namespace,
   the tick helpers `POS_INF_TICK` / `binaryRangeTicks`, the constants `POSITION_LOT_SIZE` /
   `U64_MAX`, the unit converters (`usdcToRaw`, `probabilityToRaw`, …) — and
   **`toGeneratedConfig(cfg)`**, which returns `{predictPackageId, predictPackageIdV1,
   accountPackageId, protocolConfig, poolVault, registry, oracleRegistry, accountRegistry}`
   (`dist/predict/config/generated.mjs:2-13`). Do not hand-roll that mapping — getting
   `predictPackageIdV1` wrong is exactly pitfall 11.

   A raw `tx.moveCall` you write yourself gets none of that: pass the shared
   `0x2::accumulator::AccumulatorRoot` (`0xacc`) explicitly.

Account API paths take the shared **Account wrapper id**, not the owner address —
`client.predict.wrapperIdFor(owner)` derives it deterministically, no chain read.

Data conventions from the old upstream integration guide (written for the `predict-testnet-8-21`
servers; **unverified** against whatever serves the current deployment): Postgres `NUMERIC` serializes as **strings** (parse with
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
`EMissingExpiryValuation` (plp, `plp/plp.move:46`) and `ERequestNotFound` (lp_book,
`plp/lp_book.move:16`) are both `0` — so a raw source
constant is ambiguous too. `PredictInputError` is thrown client-side before submission (lot size,
tick alignment).

`EValuationInProgress` means *retry later*, not permanent failure.

## Pitfalls

1. **Every facade builder except `tx.redeem` can carry a slippage guard — but the defaults are all
   "no guard".** Five cases (`dist/predict/client.d.mts:43-89`, builders `dist/predict/client.mjs`):
   - **`tx.mint` — both guards.** `MintOptions` takes optional `maxCost` and `maxProbability`
     (`client.d.mts:43-47`), forwarded by `#buildMint` (`client.mjs:383-398`); omit either and the
     SDK substitutes `U64_MAX` (`tx/trade.mjs:40-41`), i.e. uncapped.
   - **`tx.mintAmount` — cost guard only.** `MintAmountOptions` is `{ spend, minQuantity, maxCost? }`
     (`client.d.mts:49-55`) — there is **no `maxProbability`**, because `mint_exact_amount` has no
     `max_probability` parameter on-chain (`expiry_market.move:479-492`). Omitted `maxCost` becomes
     `U64_MAX` (`tx/trade.mjs:56`); the SDK does reject `maxCost <= 0` client-side with
     `PredictInputError` (`client.mjs:107`).
   - **`tx.mintCost` (v2) — `spend` *is* the all-in cap** and `minQuantity` the payout floor
     (`client.d.mts:57-62`, `client.mjs:400-414`); `minQuantity: 0` disables the floor.
   - **`tx.supplyPlp` / `tx.withdrawPlp` — fixable since 2.3.0.** Optional third argument
     `{ minPlpOut?: bigint }` (raw PLP shares) / `{ minUsdcOut?: number | string }` (USD decimals)
     (`client.d.mts:69-89, 243-244`). Omit it and the builders send `0` — no floor
     (`client.mjs:136, 144`). Both are floors on the **mark**, not fill sizes: a flush quoting less
     cancels and refunds (at the default one attempt) rather than filling smaller.
   - **`tx.redeem` — still not fixable through the facade.** `CloseOptions` is `{ orderId, quantity }`
     only (`client.d.mts:65-68`), `#buildRedeem` forwards nothing else (`client.mjs:435-446`), and the
     internal `redeemLive` fills in `minProbability: 0n, minProceeds: 0n` (`tx/trade.mjs:84-85`).
     Escape hatch: compose `expiryMarketMoveCalls.redeemLive({ config: toGeneratedConfig(cfg),
     arguments: { market, wrapper, auth, pricer, orderId, closeQuantity, minProbability,
     minProceeds } })` yourself, with `auth` from `generateAuth(cfg)` and `pricer` from
     `loadLivePricer` in the same PTB (`dist/contracts/deepbook_predict/expiry_market.d.mts:790-823`).
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
   asserted `> 0` (`expiry_market.move:495`) — `u64::MAX` satisfies that assert and is exactly what
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
11. **Do not derive `coinTypes.plp` — or any Predict struct/event type — from `packages.predict`.**
    On both recorded deployments they already differ: testnet `coinTypes.plp` is
    `0x59d71119…::plp::PLP` (`predictV1`) while `packages.predict` is `0x30a03c33…` (v2)
    (`dist/deployments/testnet.mjs:46-47,60`). A type tag pins the *original* package id; the
    Move-call target moves on every upgrade. Read `coinTypes.plp` from the config, build other type
    tags from `packages.predictV1`, and when hand-building a config for an upgraded deployment
    supply `predictV1` — it is optional and silently falls back to `packages.predict`
    (`dist/predict/config/generated.mjs:5`).
12. `getUnits()` returns four fields but the SDK only actually consumes `positionLotSize`; the other
    three are still hardcoded internally.
13. **The no-trade window is longer than the compiled default.** Live mint / quote / redeem abort
    `ETradeWindowClosed` once `expiry - now <= no_trade_window_ms`
    (`config/protocol_config.move:591-599`). Compiled default is 2s
    (`config/config_constants.move:420`) and the 2.6.4 `PREDICT.md` says 2s, but both live
    `ProtocolConfig`s read `10000` (10s) on 2026-09-30. Read the object; do not hardcode.

## Superseded design → current

| `predict-testnet-4-16` | `predict-testnet-8-21` / `deepbook-predict-testnet` |
|---|---|
| `Predict` (single shared root) | `Registry` + `ProtocolConfig` + `PoolVault` (three shared objects) |
| `PredictManager` (per-user object) | **nothing** — custody is the shared `account` package's `Account`, with a `PredictData` app slot |
| `OracleSVI` + `OracleSVICap` | `propbook`'s `BlockScholesSVIStore` / `BlockScholesValueStore` / `PythFeed`, bound via `OracleRegistry` |
| `vault` | `PoolVault` + embedded `Ledger`, plus per-market `ExpiryCash` (funds sit in two layers) |
| `supply` / `withdraw` → `Coin<PLP>` | `request_supply` / `request_withdraw` → queue index → keeper flush |
| `RangeKey` / `strike_matrix` | tick pairs + `range_codec`; order id packs the range |
| — | `ExpiryMarket` per expiry, cadence-scheduled deployment, `BuilderCode`, fee-incentive sponsorship, EWMA congestion surcharge |

`predict-testnet-8-21` → `deepbook-predict-testnet` kept that object model but is a separate
deployment (fresh ids, no carried-over state) — and `deepbook-predict-testnet` itself was redeployed
in 2.5.0 (`a928bd2d` → `4d752fb8`, every id moved, same name). Differences that matter to a caller: the collateral
module is `usdc::usdc::USDC` (was `dusdc::dusdc::DUSDC`; the testnet coin still *displays* as
DUSDC) and the PLP floor argument is `min_usdc_out` (was `min_dusdc_out`) — CHANGELOG 2.2.0; the
flush no longer locks trading and is gated by a `PoolValuationCap`; a pre-expiry no-trade window
exists; and the package has been upgraded once (v2, `mint_exact_cost`).
