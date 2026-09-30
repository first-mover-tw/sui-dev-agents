---
name: sui-indexer
description: Use when building custom indexers, data pipelines, or event processors for the SUI blockchain. Triggers on "indexer", "data pipeline", "backfill", "event processor", "index transactions", "analytics dashboard", "aggregate on-chain data", "historical query", "track all trades", or any custom data extraction from SUI chain history. Also use when the user needs to build dashboards from on-chain data, process historical transactions, or set up real-time event streams.
---

# SUI Indexer

**Build custom indexer pipelines for SUI blockchain data extraction and processing.**

## Overview

The SUI Indexing Framework (`sui-indexer-alt-framework`) lets you build custom data pipelines that process blockchain checkpoints and write structured data to your own storage (typically PostgreSQL). Use this when gRPC/GraphQL queries are insufficient — e.g., you need full historical event aggregation, custom analytics, or real-time derived data.

**When to use an indexer vs gRPC/GraphQL:**

| Use Case | gRPC/GraphQL | Custom Indexer |
|----------|-------------|----------------|
| Read current object state | ✓ | |
| Query recent events | ✓ | |
| Full historical event aggregation | | ✓ |
| Custom analytics / derived data | | ✓ |
| Real-time price feeds | | ✓ |
| Cross-object correlation at scale | | ✓ |

> **GraphQL tx-forensics (P126+):** `Address.asTransactionObject(transactionDigest: String): TransactionObject` returns how an address (read as an object ID) was referenced by a given tx (`ObjectChange | ConsensusObjectRead`); `transactionDigest` is optional when scoped under a `Transaction`/`TransactionEffects`/`Event`. Use this over a custom indexer for one-off "how was this object touched" lookups.

## Architecture

```
Checkpoint Stream → Ingestion Client → Processor(s) → Store (PostgreSQL / custom)
                                            ↓
                                      Service lifecycle
                                    (start, shutdown, metrics)
```

**Components:**
1. **Ingestion Client** — fetches checkpoints from the network
2. **Processor** — transforms checkpoint data into your domain model
3. **Store** — writes processed data to your database
4. **Service** — manages lifecycle, shutdown signals, error handling

## Core API (common case)

Three symbols carry a basic pipeline:
- `IngestionClientTrait::checkpoint(seq) -> CheckpointEnvelope` — fetch a checkpoint. **P119: renamed from `fetch`; return type changed `CheckpointData` → `CheckpointEnvelope` (adds `chain_id`).**
- `Processor` trait — `const NAME` + `async fn process(&self, envelope: &CheckpointEnvelope)`.
- `Service::builder()...build().main()` — lifecycle, parallel processors, SIGINT/SIGTERM shutdown.

Minimal end-to-end indexer (one event processor → PostgreSQL):

```rust
use sui_indexer_alt_framework::{prelude::*, Service, StoreIngestionClient};
use sqlx::{PgPool, postgres::PgPoolOptions};

struct MyEventProcessor { db: PgPool }

#[async_trait]
impl Processor for MyEventProcessor {
    const NAME: &'static str = "my-event-processor";
    async fn process(&self, envelope: &CheckpointEnvelope) -> Result<()> {
        for tx in &envelope.data.transactions {
            for event in &tx.events {
                sqlx::query("INSERT INTO events (tx_digest, type, checkpoint, chain_id) VALUES ($1,$2,$3,$4)")
                    .bind(tx.transaction.digest().to_string())
                    .bind(event.type_.to_string())
                    .bind(envelope.data.checkpoint_summary.sequence_number as i64)
                    .bind(&envelope.chain_id)
                    .execute(&self.db).await?;
            }
        }
        Ok(())
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let pool = PgPoolOptions::new().max_connections(10)
        .connect(&std::env::var("DATABASE_URL")?).await?;
    let ingestion = StoreIngestionClient::new_remote(
        "https://fullnode.testnet.sui.io:443".to_string())?;
    let service = Service::builder()
        .ingestion_client(ingestion)
        .add_processor(MyEventProcessor { db: pool.clone() })
        .build().await?;
    service.main().await
}
```

For the full type catalog, the three `StoreIngestionClient` variants (remote/S3/local), `ObjectTracker` with deleted-objects handling, cargo project setup, backfill / concurrency tuning / metrics, or **archival query-side reads** (`archive.*.sui.io:443`; gRPC does NOT fall back to archival) → see **[references/reference.md](references/reference.md)**.

## Protocol 136-137 / v1.79-v1.80 (mainnet v1.80.1 / P137)

Mainnet is on **v1.80.1 / P137**, which includes the P136 items below.

- **gRPC `SimulateTransaction` can return a `VALIDITY` expiration (PR 27598) — now possible on mainnet (P137).** The response switches from `VALID_DURING` to `VALIDITY` (carrying the allowed consensus proposers) **only when the `allowed_proposers` protocol flag is on**. P136 enabled it for devnet only (`sui-protocol-config/src/lib.rs:4736-4738` @ `mainnet-v1.80.1`: `if chain != Chain::Mainnet && chain != Chain::Testnet`); **P137 enables it on mainnet and testnet** (`lib.rs:4760`, comment `lib.rs:398`). It also requires the fullnode's `enable_simulate_allowed_proposers` node config (default **false** — off unless the fullnode operator enables it) (`crates/sui-config/src/node.rs:244-248` @ `mainnet-v1.80.1`) and a proposer selector returning a set for the current epoch (`crates/sui-rpc-api/.../simulate/mod.rs:573-585`), so public fullnodes will typically still return `VALID_DURING` — handle both. If your client **rebuilds** the expiration instead of passing the returned one through verbatim, omitting `allowed_proposers` changes the signed bytes and the digest will not match — copy it unmodified.
- **GraphQL `Query.multiGetBalances` (PR 27685).** New batched balance query:
  ```graphql
  input BalanceKey { address: SuiAddress!, coinType: String! }
  type Query { multiGetBalances(keys: [BalanceKey!]!): [Balance!]! }
  ```
  Same PR documents that `totalBalance = coinBalance + addressBalance` — if you were treating `totalBalance` as coin-object-only, your numbers were already wrong for accounts using address balances.
- **Operator breaking — `sui-indexer-alt-jsonrpc` / `sui-indexer-alt-graphql` (PR 27557 / 27653).** The four `--bigtable-*` flags are **removed**, and `--ledger-grpc-url` is now **required**; these services no longer fall back to Postgres for ledger reads. Deployments that relied on the Postgres fallback will fail to start until the flag is supplied.

## Breaking Changes Log

| Version | Change |
|---------|--------|
| v1.80 (Protocol 137) | Mainnet v1.80.1 / P137. `allowed_proposers` is now on for mainnet and testnet (`lib.rs:4760` @ `mainnet-v1.80.1`), so gRPC `SimulateTransaction` may return `VALIDITY` on the public networks (see above). |
| v1.79 (Protocol 136) | Mainnet v1.79.1+ / P136 (included in P137). gRPC `SimulateTransaction` may return a `VALIDITY` expiration with allowed proposers (PR 27598) — at P136 gated on the `allowed_proposers` flag, which P136 turned on for devnet only; P137 extends it to mainnet and testnet. GraphQL adds `Query.multiGetBalances(keys: [BalanceKey!]!): [Balance!]!` + `BalanceKey` input (PR 27685). Operator breaking: `sui-indexer-alt-jsonrpc` / `-graphql` drop the four `--bigtable-*` flags and require `--ledger-grpc-url` (no Postgres fallback) (PR 27557 / 27653). |
| v1.78 (Protocol 134-135) | Mainnet v1.78.1 / P135 (live 2026-08-29). No gRPC `.proto` or GraphQL schema shape change vs v1.77.2 — only error-message text (gRPC simulate/resolve version-digest mismatch errors now include the object id). New GraphQL `transactions` subscription can replay from a historical cursor, but it is staging-gated (not exposed on public endpoints). |
| v1.77 (Protocol 133) | Mainnet v1.77.2 (mainnet jumped P130 → P133 directly). New `EndOfEpochTransactionKind` variant `ForwardingAddressRegistryCreate` — gRPC proto enum and GraphQL union both gained this member (**devnet-gated**, not yet emitted on mainnet). Indexers that switch on `EndOfEpochTransactionKind` should tolerate an unrecognized/new variant rather than erroring. |
| v1.74 (Protocol 127) | Testnet v1.74.0 (later v1.74.1 on both networks; the v1.75–v1.76 releases carried no indexer-relevant change). GraphQL transaction pagination now uses a custom `TransactionConnection` (`pageInfo`/`edges`/`nodes`, partial results from bitmap streaming); invalid-unicode `SuiAddress` parse fix; opt-in `disable_json_rpc` node config (gRPC/REST stay up); checkpoint pruning pairing bug fixed |
| v1.73 (Protocol 126) | Testnet v1.73.1+ / mainnet P126 (v1.73.2). JSON-RPC permanent deactivation **2026-07-31** — migrate indexer reads to gRPC / GraphQL before the cutoff |
| v1.72 (Protocol 124) | `rpc-index` DB v4 — first start re-indexes full object history; added `pipeline-depth` for sequential pipelines |
| v1.71 (Protocol 123) | `checkpoint_lag` / `checkpoint_buffer_size` **removed**; sequential pipelines use adaptive concurrency + `subscriber_channel_size` |
| v1.69.1 (Protocol 119) | `IngestionClientTrait::fetch` → `checkpoint`; returns `CheckpointEnvelope` with `chain_id` |
| v1.68 (Protocol 118) | `Processor::FANOUT` removed; Adaptive Concurrency Control replaces fixed workers |
| v1.65.2 (Protocol 111) | `RemoteIngestionClient` renamed to `StoreIngestionClient`; supports any `ObjectStore` |
| v1.63.3 (Protocol 107) | Indexer/ingestion services return `Service` instead of `JoinHandle<()>`; use `Service::main()` |
