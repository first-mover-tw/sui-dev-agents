---
name: sui-indexer
description: Use when building custom indexers, data pipelines, or event processors for the SUI blockchain. Triggers on "indexer", "checkpoint processing", "data pipeline", "backfill", "event processor", "index transactions", or any custom data extraction from SUI chain history. Also use when the user needs to process historical on-chain data or build real-time event streams.
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

## Core API (Protocol 119)

### CheckpointEnvelope

As of Protocol 119, `IngestionClientTrait::checkpoint()` returns a `CheckpointEnvelope` containing both checkpoint data and chain identification:

```rust
/// Returned by IngestionClientTrait::checkpoint()
pub struct CheckpointEnvelope {
    /// The full checkpoint data (transactions, effects, events, objects)
    pub data: CheckpointData,
    /// Chain identifier — full 32-byte Base58-encoded digest
    pub chain_id: String,
}
```

**Breaking change from Protocol 118:** The method was renamed from `fetch()` to `checkpoint()` and the return type changed from `CheckpointData` to `CheckpointEnvelope`. Update existing indexers accordingly.

### IngestionClientTrait

```rust
#[async_trait]
pub trait IngestionClientTrait: Send + Sync {
    /// Fetch a checkpoint by sequence number (renamed from `fetch` in Protocol 119)
    async fn checkpoint(&self, checkpoint: u64) -> Result<Arc<CheckpointEnvelope>>;
}
```

**Built-in implementations:**
- `StoreIngestionClient` — reads from any `object_store::ObjectStore` (S3, GCS, local filesystem)
- Remote checkpoint fetching via full node gRPC

### Processor Trait

```rust
#[async_trait]
pub trait Processor: Send + Sync + 'static {
    /// Human-readable name for logging and metrics
    const NAME: &'static str;

    /// Process a single checkpoint envelope
    async fn process(&self, envelope: &CheckpointEnvelope) -> Result<()>;
}
```

**Example — Event indexer:**

```rust
use sui_indexer_alt_framework::prelude::*;

struct MyEventProcessor {
    db: PgPool,
}

#[async_trait]
impl Processor for MyEventProcessor {
    const NAME: &'static str = "my-event-processor";

    async fn process(&self, envelope: &CheckpointEnvelope) -> Result<()> {
        let checkpoint = &envelope.data;
        for tx in &checkpoint.transactions {
            for event in &tx.events {
                if event.type_.module == "my_module" {
                    sqlx::query("INSERT INTO events (tx_digest, type, data, checkpoint, chain_id) VALUES ($1, $2, $3, $4, $5)")
                        .bind(&tx.transaction.digest().to_string())
                        .bind(&event.type_.to_string())
                        .bind(&serde_json::to_value(&event.parsed_json)?)
                        .bind(checkpoint.checkpoint_summary.sequence_number as i64)
                        .bind(&envelope.chain_id)
                        .execute(&self.db)
                        .await?;
                }
            }
        }
        Ok(())
    }
}
```

### Service Lifecycle

```rust
use sui_indexer_alt_framework::Service;

// Build and run the indexer service
let service = Service::builder()
    .ingestion_client(store_client)
    .add_processor(MyEventProcessor { db: pool.clone() })
    .add_processor(MyObjectTracker { db: pool.clone() })
    .build()
    .await?;

// Run with clean shutdown handling
// Blocks until SIGINT/SIGTERM or fatal error
service.main().await?;
```

**Key points:**
- `Service` replaces the old `JoinHandle<()>` pattern (breaking change from v1.63)
- Call `service.main()` for clean shutdown handling (responds to SIGINT/SIGTERM)
- Multiple processors run in parallel within a single service

## Quick Start

### 1. Set up project

```bash
cargo new my-indexer
cd my-indexer
```

**Cargo.toml:**
```toml
[package]
name = "my-indexer"
version = "0.1.0"
edition = "2021"

[dependencies]
sui-indexer-alt-framework = { git = "https://github.com/MystenLabs/sui.git", branch = "mainline" }
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres"] }
tokio = { version = "1", features = ["full"] }
serde_json = "1"
anyhow = "1"
async-trait = "0.1"
```

### 2. Implement processor

See the Event indexer example in Core API section above.

### 3. Wire up main

```rust
use sui_indexer_alt_framework::{Service, StoreIngestionClient};
use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&std::env::var("DATABASE_URL")?)
        .await?;

    let ingestion = StoreIngestionClient::new_remote(
        "https://fullnode.testnet.sui.io:443".to_string(),
    )?;

    let service = Service::builder()
        .ingestion_client(ingestion)
        .add_processor(MyEventProcessor { db: pool.clone() })
        .build()
        .await?;

    service.main().await
}
```

### 4. Run

```bash
export DATABASE_URL="postgres://user:pass@localhost/my_indexer"
cargo run
```

## Advanced Patterns

### Multi-Processor Parallel Pipelines

Run multiple processors concurrently — each processes the same checkpoint stream independently:

```rust
let service = Service::builder()
    .ingestion_client(ingestion)
    .add_processor(EventProcessor { db: pool.clone() })
    .add_processor(ObjectTracker { db: pool.clone() })
    .add_processor(BalanceAggregator { db: pool.clone() })
    .build()
    .await?;
```

Each processor runs in its own task. Failures in one processor do not affect others. The service logs errors and continues.

### Backfill Strategy

For historical data, configure the starting checkpoint:

```rust
let service = Service::builder()
    .ingestion_client(ingestion)
    .add_processor(processor)
    .start_checkpoint(0)  // Start from genesis for full backfill
    .build()
    .await?;
```

**Tips:**
- For large backfills, use `StoreIngestionClient` pointed at a checkpoint archive (S3/GCS) — much faster than fetching from a full node
- Track your last-processed checkpoint in the database so you can resume after restarts
- Use separate processor instances for backfill vs live indexing

### Concurrency Control

Since Protocol 118, the framework uses Adaptive Concurrency Control instead of fixed `FANOUT`:

```rust
// Old (removed):
// const FANOUT: usize = 10;

// New: framework automatically scales concurrency based on throughput
// No configuration needed — the framework adapts to your processor speed
```

### Metrics & Monitoring

The framework exposes Prometheus metrics automatically:

```rust
let service = Service::builder()
    .ingestion_client(ingestion)
    .add_processor(processor)
    .metrics_address("0.0.0.0:9184".parse()?)
    .build()
    .await?;
```

**Key metrics:**
- `indexer_checkpoint_processed_total` — checkpoints processed per processor
- `indexer_checkpoint_latency_seconds` — processing time histogram
- `indexer_ingestion_lag` — how far behind the tip

## Breaking Changes Log

| Version | Change |
|---------|--------|
| v1.69.1 (Protocol 119) | `IngestionClientTrait::fetch` → `checkpoint`; returns `CheckpointEnvelope` with `chain_id` |
| v1.68 (Protocol 118) | `Processor::FANOUT` removed; Adaptive Concurrency Control replaces fixed workers |
| v1.65.2 (Protocol 111) | `RemoteIngestionClient` renamed to `StoreIngestionClient`; supports any `ObjectStore` |
| v1.63.3 (Protocol 107) | Indexer/ingestion services return `Service` instead of `JoinHandle<()>`; use `Service::main()` |
