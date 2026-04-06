# SUI Indexer Framework Reference

> Framework: `sui-indexer-alt-framework` from MystenLabs/sui repository
> Protocol: 119 (testnet v1.69.1)

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
