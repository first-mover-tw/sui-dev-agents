# DeepBook V3 — Indexer (off-chain data)

> Part of the **sui-deepbook** skill. Off-chain REST service for historical /
> aggregate data. Read this for OHLCV, volume, trade history, orderbook
> snapshots — anything you can't cheaply derive from live RPC.

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
