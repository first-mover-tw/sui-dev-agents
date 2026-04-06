---
name: sui-nautilus
description: Use when building verifiable off-chain computation, integrating external APIs with on-chain verification, or running trusted execution environments (TEE) on SUI. Triggers on Nautilus, Nitro Enclave, off-chain oracle, trusted compute, enclave attestation, or any scenario requiring cryptographically verified external data on-chain. Also use when the user needs to fetch real-world data (weather, prices, social media) and prove its authenticity to a Move contract.
---

# SUI Nautilus — Verifiable Off-Chain Computation

**AWS Nitro Enclaves + on-chain signature verification for trusted external data.**

## What Nautilus Does

Nautilus is a framework for building hybrid on-chain/off-chain applications on SUI:

1. **Run code inside AWS Nitro Enclaves** (Trusted Execution Environment)
2. **Fetch external data** (APIs, databases, web services) from inside the enclave
3. **Cryptographically sign** results with the enclave's attested key
4. **Verify signatures on-chain** in Move smart contracts

The enclave guarantees: even the server operator cannot tamper with the computation or forge results.

> **Note:** Nautilus is a reference template from MystenLabs, not a production-ready service. Adapt it for your use case.

## Architecture

```
┌─────────────┐     HTTP      ┌──────────────────────┐
│  Frontend /  │ ──────────→  │  AWS Nitro Enclave    │
│  Backend     │              │                       │
│              │  ←────────── │  - Fetch external API  │
│              │  signed data │  - Process data        │
└──────┬──────┘              │  - Sign with enclave   │
       │                      │    attestation key     │
       │ submit tx            └──────────────────────┘
       ▼
┌──────────────┐
│  SUI Move    │  Verifies enclave signature
│  Contract    │  using registered PCR values
└──────────────┘
```

## Core Components

### Off-Chain: Rust Enclave Server

Each Nautilus app lives in `apps/<name>/mod.rs`:

```rust
// apps/weather-example/mod.rs
use nautilus_server::{NautilusApp, NautilusResponse};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct WeatherData {
    city: String,
    temperature: f64,
    timestamp: u64,
}

pub async fn process_data(city: &str) -> NautilusResponse<WeatherData> {
    // Fetch from external API (must be in allowed_endpoints.yaml)
    let resp = reqwest::get(format!(
        "https://api.weather.example.com/current?city={}", city
    )).await?;

    let data: WeatherData = resp.json().await?;

    // Response is automatically signed by the enclave
    NautilusResponse::ok(data)
}
```

### Allowed Endpoints

Enclaves whitelist which external domains they can reach:

```yaml
# allowed_endpoints.yaml
- api.weather.example.com
- api.twitter.com
- api.coingecko.com
```

### Enclave HTTP Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health_check` | Verify enclave connectivity to allowed domains |
| `GET /get_attestation` | Return signed attestation for on-chain registration |
| `POST /process_data` | Custom computation — fetch, process, sign, return |

### On-Chain: Move Verification

```move
module example::weather_oracle {
    use nautilus::enclave;

    /// Register enclave PCR values (admin-only, one-time setup)
    public fun register_enclave(
        config: &mut OracleConfig,
        pcr0: vector<u8>,
        pcr1: vector<u8>,
        pcr2: vector<u8>,
        public_key: vector<u8>,
        ctx: &mut TxContext,
    ) {
        enclave::register(config, pcr0, pcr1, pcr2, public_key, ctx);
    }

    /// Verify enclave-signed data and use it on-chain
    public fun submit_weather(
        config: &OracleConfig,
        signed_data: vector<u8>,
        signature: vector<u8>,
        ctx: &mut TxContext,
    ) {
        // Verify signature matches registered enclave key
        assert!(
            enclave::verify_signature(config, &signed_data, &signature),
            EInvalidSignature
        );

        // Deserialize and use the verified data
        let weather = deserialize_weather(signed_data);
        // ... update on-chain state with trusted data
    }
}
```

## Development Flow

### 1. Write App Logic

Create `apps/<your-app>/mod.rs` with your data fetching and processing logic.

### 2. Configure Allowed Endpoints

Add external domains to `allowed_endpoints.yaml`.

### 3. Build & Get PCR Values

```bash
make ENCLAVE_APP=<your-app>
# Outputs PCR0, PCR1, PCR2 values — needed for on-chain registration
```

PCR (Platform Configuration Register) values are deterministic hashes of the enclave image. They prove which code is running.

### 4. Deploy Move Contracts

Deploy contracts that store PCR values and verify enclave signatures.

### 5. Launch Enclave on EC2

```bash
# Launch EC2 instance with Nitro Enclave support
# Start the enclave with your app
nitro-cli run-enclave --eif-path <your-app>.eif --memory 512 --cpu-count 2
```

### 6. Register Enclave On-Chain

Call `register_enclave()` with PCR values and the enclave's public key.

## Use Cases

| Use Case | External Data Source |
|----------|---------------------|
| Price oracle | CoinGecko, Binance API |
| Weather derivatives | Weather API |
| Social verification | Twitter/X API |
| Sports betting | Sports data API |
| Insurance claims | IoT sensor data |
| Identity verification | KYC provider API |

## Best Practices

- **Pin PCR values** — only update when you intentionally change enclave code
- **Minimize allowed endpoints** — reduce attack surface
- **Rotate enclave keys** periodically and update on-chain registrations
- **Test locally first** — use `make test` before deploying to EC2
- **Log attestation verification failures** for security monitoring

## Common Mistakes

❌ **Trusting enclave output without on-chain signature verification**
- Always verify in Move — the signature is the whole point

❌ **Overly broad allowed_endpoints.yaml**
- Only whitelist domains your app actually needs

❌ **Not handling enclave restarts**
- Enclaves get new keys on restart — re-register or use key derivation

❌ **Skipping PCR verification during registration**
- PCR values prove code integrity — verify they match your build output

## Resources

- [GitHub — MystenLabs/nautilus](https://github.com/MystenLabs/nautilus)
- [Using Nautilus Guide](https://github.com/MystenLabs/nautilus/blob/main/UsingNautilus.md)
