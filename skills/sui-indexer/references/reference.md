# SUI Indexer Framework Reference

## Table of Contents

- [Contents](#contents)
- [Type Definitions](#type-definitions)
  - [CheckpointEnvelope](#checkpointenvelope)
  - [CheckpointData](#checkpointdata)
  - [CheckpointTransaction](#checkpointtransaction)
- [Traits](#traits)
  - [IngestionClientTrait](#ingestionclienttrait)
  - [Processor](#processor)
- [Service Builder API](#service-builder-api)
  - [Service Methods](#service-methods)
- [Ingestion Client Implementations](#ingestion-client-implementations)
  - [StoreIngestionClient (recommended)](#storeingestionclient-recommended)
- [Processor Examples](#processor-examples)
  - [Event Processor](#event-processor)
  - [Object State Tracker](#object-state-tracker)
  - [Pipeline Composition](#pipeline-composition)
- [Quick Start](#quick-start)
  - [1. Set up project](#1-set-up-project)
  - [2. Implement processor](#2-implement-processor)
  - [3. Wire up main](#3-wire-up-main)
  - [4. Run](#4-run)
- [Advanced Patterns](#advanced-patterns)
  - [Multi-Processor Parallel Pipelines](#multi-processor-parallel-pipelines)
  - [Backfill Strategy](#backfill-strategy)
  - [Concurrency Control](#concurrency-control)
  - [Sequential pipeline tuning (1.71+)](#sequential-pipeline-tuning-171)
  - [Metrics & Monitoring](#metrics--monitoring)
- [Archival reads](#archival-reads)

---


> Framework: `sui-indexer-alt-framework` from MystenLabs/sui repository
> Aligned with: Protocol 127 (shipped testnet v1.74.0; now mainnet v1.76.1 / P130)

## Contents
- [Type Definitions](#type-definitions)
- [Traits](#traits)
- [Service Builder API](#service-builder-api)
- [Ingestion Client Implementations](#ingestion-client-implementations)
- [Processor Examples](#processor-examples)
- [Quick Start](#quick-start)
- [Advanced Patterns](#advanced-patterns)
- [Archival reads](#archival-reads)

## Type Definitions

### CheckpointEnvelope

```rust
pub struct CheckpointEnvelope {
    pub data: CheckpointData,
    pub chain_id: String,
}
```

### CheckpointData

```rust
pub struct CheckpointData {
    pub checkpoint_summary: CheckpointSummary,
    pub transactions: Vec<CheckpointTransaction>,
}
```

### CheckpointTransaction

```rust
pub struct CheckpointTransaction {
    pub transaction: Transaction,
    pub effects: TransactionEffects,
    pub events: Vec<Event>,
    pub input_objects: Vec<Object>,
    pub output_objects: Vec<Object>,
}
```

## Traits

### IngestionClientTrait

As of Protocol 119, `IngestionClientTrait::checkpoint()` returns a `CheckpointEnvelope` containing both checkpoint data and chain identification.

```rust
#[async_trait]
pub trait IngestionClientTrait: Send + Sync {
    /// Fetch a checkpoint by sequence number (renamed from `fetch` in Protocol 119)
    async fn checkpoint(&self, checkpoint: u64) -> Result<Arc<CheckpointEnvelope>>;
}
```

**Breaking change from Protocol 118:** the method was renamed from `fetch()` to `checkpoint()` and the return type changed from `CheckpointData` to `CheckpointEnvelope` (which adds `chain_id` — full 32-byte Base58-encoded digest). Update existing indexers accordingly.

**Built-in implementations:**
- `StoreIngestionClient` — reads from any `object_store::ObjectStore` (S3, GCS, local filesystem)
- Remote checkpoint fetching via full node gRPC

### Processor

```rust
#[async_trait]
pub trait Processor: Send + Sync + 'static {
    /// Human-readable name for logging and metrics
    const NAME: &'static str;

    /// Process a single checkpoint envelope
    async fn process(&self, envelope: &CheckpointEnvelope) -> Result<()>;
}
```

## Service Builder API

```rust
Service::builder()
    // Required: checkpoint source
    .ingestion_client(client: impl IngestionClientTrait)

    // Required: at least one processor
    .add_processor(processor: impl Processor)

    // Optional: starting checkpoint (default: latest)
    .start_checkpoint(seq: u64)

    // Optional: Prometheus metrics endpoint
    .metrics_address(addr: SocketAddr)

    // Build the service
    .build() -> Result<Service>
```

### Service Methods

```rust
impl Service {
    /// Run the service, blocking until shutdown signal or fatal error.
    /// Handles SIGINT/SIGTERM for clean shutdown.
    pub async fn main(self) -> Result<()>;
}
```

**Key points:**
- `Service` replaces the old `JoinHandle<()>` pattern (breaking change from v1.63).
- Call `service.main()` for clean shutdown handling (responds to SIGINT/SIGTERM).
- Multiple processors run in parallel within a single service; a failure in one processor does not affect others (the service logs and continues).

## Ingestion Client Implementations

### StoreIngestionClient (recommended)

```rust
use sui_indexer_alt_framework::StoreIngestionClient;

// Remote: fetch from full node
let client = StoreIngestionClient::new_remote(
    "https://fullnode.testnet.sui.io:443".to_string(),
)?;

// S3/GCS archive: faster for backfill
let store = object_store::aws::AmazonS3Builder::new()
    .with_bucket_name("my-checkpoint-archive")
    .build()?;
let client = StoreIngestionClient::new(store);

// Local filesystem
let store = object_store::local::LocalFileSystem::new_with_prefix("/data/checkpoints")?;
let client = StoreIngestionClient::new(store);
```

## Processor Examples

### Event Processor

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

### Object State Tracker

Tracks object creation, mutation, and deletion:

```rust
struct ObjectTracker {
    db: PgPool,
}

#[async_trait]
impl Processor for ObjectTracker {
    const NAME: &'static str = "object-tracker";

    async fn process(&self, envelope: &CheckpointEnvelope) -> Result<()> {
        let cp = &envelope.data;
        let seq = cp.checkpoint_summary.sequence_number;

        for tx in &cp.transactions {
            // Created/mutated objects
            for obj in &tx.output_objects {
                sqlx::query(
                    "INSERT INTO objects (object_id, version, type, checkpoint, chain_id)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (object_id) DO UPDATE SET version = $2, checkpoint = $4"
                )
                .bind(obj.id().to_string())
                .bind(obj.version().value() as i64)
                .bind(obj.type_().map(|t| t.to_string()))
                .bind(seq as i64)
                .bind(&envelope.chain_id)
                .execute(&self.db)
                .await?;
            }

            // Deleted objects
            for obj_ref in &tx.effects.deleted() {
                sqlx::query("DELETE FROM objects WHERE object_id = $1")
                    .bind(obj_ref.0.to_string())
                    .execute(&self.db)
                    .await?;
            }
        }
        Ok(())
    }
}
```

### Pipeline Composition

Complete example with multiple processors, metrics, and backfill:

```rust
use sui_indexer_alt_framework::{Service, StoreIngestionClient};
use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let pool = PgPoolOptions::new()
        .max_connections(20)
        .connect(&std::env::var("DATABASE_URL")?)
        .await?;

    // Use S3 archive for fast backfill
    let store = object_store::aws::AmazonS3Builder::from_env()
        .with_bucket_name("sui-testnet-checkpoints")
        .build()?;
    let ingestion = StoreIngestionClient::new(store);

    let service = Service::builder()
        .ingestion_client(ingestion)
        .add_processor(EventProcessor { db: pool.clone() })
        .add_processor(ObjectTracker { db: pool.clone() })
        .start_checkpoint(0)  // Full backfill from genesis
        .metrics_address("0.0.0.0:9184".parse()?)
        .build()
        .await?;

    service.main().await
}
```

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

See the Event Processor example in [Processor Examples](#processor-examples) above.

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

### Sequential pipeline tuning (1.71+)

Both `checkpoint_lag` and `checkpoint_buffer_size` were **removed** in v1.71. Sequential pipelines now participate in the same adaptive ingestion concurrency system as concurrent pipelines.

Available knobs:
- `subscriber_channel_size` — per-pipeline, under the pipeline's `ingestion` section. Defaults to `max(num_cpus / 2, 4)`. Drives fetch concurrency via bounded-channel fill.
- `pipeline-depth` — new in v1.72: lets a sequential pipeline keep building batches while one is flushing.

> **Upgrade note (v1.72):** `rpc-index` DB version bumped to `4`. First start after upgrade triggers a full re-index of object history. Duration scales with object count — plan accordingly.

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

## Archival reads

This section is about the **query side**, not ingestion. Do not confuse it with the `StoreIngestionClient` / checkpoint-archive-bucket content above (see the backfill example using `sui-testnet-checkpoints`). The archival-query facts here come from MystenLabs/skills `accessing-data/archival.md`.

Full nodes enforce limited retention (pruning) for scalability and performance, so they only hold a recent window of transactions, checkpoints, and object versions. Past the pruning horizon, a full node returns "not found". The **Archival Service** is the query-side service that retains and serves that pruned history — old transactions, old checkpoints, and old object versions (point-in-time object state).

**Core rule: gRPC does NOT fall back to archival.** A full node serving gRPC will never proxy or fall back to the Archival Service. For any data beyond a full node's retention window over gRPC, you must query the archival service **directly** at its own endpoint URL. The Archival Service exposes the **same** `LedgerService` gRPC API as a full node, so point any existing gRPC client at it instead of a full node — no code changes beyond the target URL. Public archival gRPC endpoints: mainnet `archive.mainnet.sui.io:443`, testnet `archive.testnet.sui.io:443`. These public endpoints have **strict rate limits**.

**GraphQL** can route to archival, but only when the operator has explicitly deployed GraphQL paired with an Archival Service. This is not automatic; if unconfigured, GraphQL falls back to its Postgres DB, which may itself have limited retention.

**Disambiguation — Archival Store vs Checkpoint store:**
- **Archival Store / Archival Service** (this section): query-side, serves pruned reads to gRPC/GraphQL clients at `archive.*.sui.io:443`.
- **Checkpoint store** (the `StoreIngestionClient` content above): GCS/S3 buckets (e.g. `gs://mysten-mainnet-checkpoints-use4`, `sui-testnet-checkpoints`) — the canonical checkpoint archive used for **ingestion/backfill**. For a custom `sui-indexer-alt` backfill, point the ingestion source at the **GCS checkpoint bucket**, NOT at the archival service.

**Common mistakes:**
- Assuming full nodes hold the whole history — they do not; queries past the pruning horizon return "not found".
- Assuming gRPC full nodes fall back to archival — they do NOT; hit `archive.*.sui.io:443` directly.
