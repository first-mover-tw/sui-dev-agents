# DeepBook V3 — Margin Trading

> Part of the **sui-deepbook** skill. Leverage layer on top of any CLOB pool.
> Read this when the task involves leverage (leveraged spot / CLOB margin — not
> perpetual futures), MarginManager, Pyth health checks, or take-profit /
> stop-loss.

DeepBook Margin adds leverage on top of any CLOB pool via separate objects. The SDK exposes a full surface but the high-level moving parts are:

- **`MarginPool`** — per-asset lending pool. LPs deposit base/quote, borrowers pay interest.
- **`MarginManager`** — a leveraged position; analogous to BalanceManager but with debt.
- **`MarginRegistry`** — global registry of supported margin pools.
- **`PoolProxy`** — wraps a regular DeepBook `Pool` so margin orders route through it without bypassing CLOB matching.
- **Pyth oracles** — health checks use Pyth price feeds; the SDK exposes `SuiPythClient` + `mainnetPythConfigs`.
- **`MarginTPSL`** — conditional take-profit / stop-loss orders that auto-fire when oracle price crosses a trigger.

## Skeleton: open a leveraged long

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

## Margin v6 additions (@mysten/deepbook-v3 ≥ 1.6.0, verified vs 1.6.3 d.mts)

- **Order + repay in one call** (`poolProxy`): `placeMarketOrderAndRepayLoan(params)`, `placeReduceOnlyLimitOrderAndRepayLoan(...)`, `placeReduceOnlyMarketOrderAndRepayLoan(...)` — close/reduce a position and repay the loan in a single PTB leg instead of composing order + `repayBase`/`repayQuote` manually.
- **TPSL batch execution v3** (`marginTPSL`): `executeConditionalOrdersV3(managerAddress, poolKey, maxOrdersToExecute)`.
- **Admin risk knob** (`marginAdmin`): `setMinOpenRiskRatio(poolKey, minOpenRiskRatio)`; readable via `marginRegistry.minOpenRiskRatio`.
- Repay is split by initiator: `marginManager.repayBase/repayQuote` (manager-initiated) vs `marginLiquidations.liquidateBase/liquidateQuote` (liquidator-initiated) — don't conflate the two families.
- **Testnet package IDs rotate across patch versions** (1.5.9→1.6.3 changed `DEEPBOOK_PACKAGE_ID`, the `MARGIN_*` group, `MARGIN_REGISTRY_ID`): don't hardcode — read `dist/utils/constants.mjs` of the pinned version.

## Margin pitfalls

- Pyth price feeds have a max age (`PRICE_INFO_OBJECT_MAX_AGE_MS`). Stale feeds → reverted orders. Always refresh in the same PTB.
- Interest accrues continuously; `borrow()` returns shares, not a fixed amount.
- TPSL triggers are *permissionless* — any keeper can fire them once the condition is met. Don't rely on yourself being the executor.

## Margin-specific mistakes

❌ **Importing Pyth from `@pythnetwork/pyth-sui-js`**
- **Problem:** Mismatched types vs. what `MarginManagerContract` expects; extra dependency.
- **Fix:** `import { SuiPythClient, SuiPriceServiceConnection } from '@mysten/deepbook-v3'` — the DeepBook SDK re-exports the Pyth pieces wired to its own config (`mainnetPythConfigs`, `testnetPythConfigs`).

❌ **Building margin without refreshing Pyth in the same PTB**
- **Problem:** Health check uses a stale price object; transaction reverts on `EPriceTooOld`.
- **Fix:** Include `pythClient.updatePriceFeeds(...)` (or SDK equivalent) in the same Transaction as the margin op.

❌ **Passing `amount = 0` to `repayBase`/`repayQuote` (≤1.5.8)**
- **Problem:** a truthy guard treats `0` like "amount omitted" (`Option::None`), which the contract interprets as **repay the full debt** — the opposite of a no-op.
- **Fix:** never pass `0` to mean "nothing to repay" — skip the call instead. Omit the amount (or pass `undefined`) when you *want* full repayment. Fixed in `@mysten/deepbook-v3` 1.5.9 (guard is now `amount !== undefined`, so `0` repays zero).

❌ **Assuming TPSL is your private executor**
- **Problem:** Trigger fires when *anyone* sees the condition met; treating it like a private cron leads to surprises.
- **Fix:** Design with permissionless execution in mind — pre-fund the TPSL leg's collateral, expect external keepers to fire.

## Margin best practice

- **Pyth freshness for margin.** Refresh price-info objects in the same PTB that opens/modifies a margin position.
