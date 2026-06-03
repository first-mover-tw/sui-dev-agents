---
name: sui-nautilus
description: Use when building verifiable off-chain computation, integrating external APIs with on-chain proof, or running trusted execution environments on SUI. Triggers on Nautilus, off-chain oracle, "verify API data on-chain", "connect external API to Move", "prove off-chain result", trusted compute, AWS Nitro Enclave, attestation, price feed, weather data on-chain, or any scenario requiring cryptographically verified external data. Also use when the user asks "how do I get real-world data into my SUI contract" or needs an oracle-like pattern.
---

# SUI Nautilus — Verifiable Off-Chain Computation

**AWS Nitro Enclaves + on-chain attestation & signature verification for trusted external data.**

## What Nautilus Does

Nautilus is a framework/template for hybrid on-chain/off-chain apps on SUI:

1. **Run Rust code inside an AWS Nitro Enclave** (a TEE) that fetches/processes external data.
2. **Attest the enclave** — AWS produces a signed attestation document over the enclave's fresh public key.
3. **Register on-chain** — a Move contract stores the expected PCRs and, after verifying the attestation against the AWS root of trust (held in the Sui framework), records the enclave public key.
4. **Verify signed responses on-chain** — the enclave signs each `process_data` result; Move re-derives the intent message and checks the ed25519 signature against the registered key.

Trust model: reproducible builds mean PCRs are deterministic hashes of the enclave image, so anyone can rebuild the published source and confirm the PCRs match. The expensive AWS cert-chain verification happens **once at registration**; afterward only the cheap enclave-key signature is checked per response.

> **Note:** Nautilus is a reference template from MystenLabs (Apache-2.0, no security audit, not production-ready as-is). Repo: `MystenLabs/nautilus` (the full end-to-end example with a frontend lives in `MystenLabs/nautilus-twitter`).

## Architecture

```
┌────────────┐   POST /process_data   ┌──────────────────────────┐
│ Frontend / │ ─────────────────────→ │  AWS Nitro Enclave        │
│ Backend    │                        │  - fetch external API     │
│            │ ←───────────────────── │  - process_data           │
│            │  {response, signature} │  - sign with enclave key  │
└─────┬──────┘                        └──────────────────────────┘
      │ submit tx (data + timestamp + signature)
      ▼
┌──────────────┐  enclave.verify_signature<T,P>(intent, ts, payload, &sig)
│  SUI Move    │  against the registered Enclave<T> public key
│  Contract    │  (Enclave<T> was registered via attestation vs EnclaveConfig<T> PCRs)
└──────────────┘
```

## Code structure (real repo layout)

```shell
/move
  /enclave            The enclave::enclave module — config, registration, signature verification.
  /weather-example    Example onchain app logic (Move). Use as a template.
  /twitter-example    Another example app.
  /seal-policy        Seal + Nautilus integration example.
/src
  /nautilus-server
    /src/apps/<app>/
      mod.rs                  Your process_data logic (customize this).
      allowed_endpoints.yaml  External domains the enclave may reach (compiled INTO the build).
    /src/common.rs            get_attestation handler (do not modify).
    /src/main.rs              Ephemeral keypair init + HTTP server (do not modify).
    run.sh                    Runs the server in the enclave (generated; do not modify).
```

To make a new app: add `move/<my_app>/` for Move + `src/nautilus-server/src/apps/<my_app>/` (mod.rs + allowed_endpoints.yaml), modeled on `weather-example`.

## Enclave HTTP endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health_check` | Probes all allowed domains; returns `{ pk, endpoints_status }`. Built-in. |
| `GET /get_attestation` | Returns the signed attestation document over the enclave pubkey — used at on-chain registration. Built-in (needs the NSM driver → only works **inside** the enclave, not locally). |
| `POST /process_data` | Your custom logic: fetch → process → sign → return `{ response: { intent, timestamp_ms, data }, signature }`. |

The signed `response` is an **intent message** `{ intent, timestamp_ms, data }` — the `data` struct must match the Move `T` used in `verify_signature` (BCS field order matters), or verification fails.

## On-chain: the `enclave::enclave` API

Two objects: `EnclaveConfig<T>` (shared — holds the PCRs + version) and `Enclave<T>` (shared — holds a registered enclave public key, tagged with the config version). `Cap<T>` (owned, created from your one-time witness) authorizes PCR/name updates. `T` is your app's OTW type, so every enclave object is phantom-typed to your package.

```move
module app::weather {
    use enclave::enclave::{Self, Enclave};
    use std::string::String;

    const WEATHER_INTENT: u8 = 0;
    const EInvalidSignature: u64 = 1;

    public struct WeatherNFT has key, store { id: UID, location: String, temperature: u64, timestamp_ms: u64 }

    /// Must match the inner struct `T` used for IntentMessage<T> in the Rust server.
    public struct WeatherResponse has copy, drop { location: String, temperature: u64 }

    public struct WEATHER has drop {} // one-time witness

    fun init(otw: WEATHER, ctx: &mut TxContext) {
        let cap = enclave::new_cap(otw, ctx);
        // create the shared EnclaveConfig<WEATHER> with placeholder PCRs (filled later via update_pcrs)
        cap.create_enclave_config(b"weather enclave".to_string(), x"00", x"00", x"00", ctx);
        transfer::public_transfer(cap, ctx.sender());
    }

    public fun update_weather<T>(
        location: String,
        temperature: u64,
        timestamp_ms: u64,
        sig: &vector<u8>,
        enclave: &Enclave<T>,
        ctx: &mut TxContext,
    ): WeatherNFT {
        let ok = enclave.verify_signature(
            WEATHER_INTENT,
            timestamp_ms,
            WeatherResponse { location, temperature },
            sig,
        );
        assert!(ok, EInvalidSignature);
        WeatherNFT { id: object::new(ctx), location, temperature, timestamp_ms }
    }
}
```

Key `enclave::enclave` functions (all phantom-typed on `T`, the app OTW):

| Function | Purpose |
|---|---|
| `new_cap<T: drop>(otw, ctx): Cap<T>` | Mint the admin capability from your one-time witness |
| `create_enclave_config<T: drop>(cap, name, pcr0, pcr1, pcr2, ctx)` | Create & share `EnclaveConfig<T>` (called as `cap.create_enclave_config(...)`) |
| `update_pcrs<T: drop>(config, cap, pcr0, pcr1, pcr2)` | Set the real PCRs after a reproducible build (bumps `version`) |
| `register_enclave<T>(config, document, ctx)` | Verify the attestation `document` against `config` PCRs + AWS root, then share `Enclave<T>` holding the pubkey |
| `verify_signature<T, P: drop>(enclave, intent_scope, timestamp_ms, payload, &sig): bool` | Rebuild the intent message and ed25519-verify against `enclave.pk` |
| `update_name`, `pcr0/1/2`, `pk`, `destroy_old_enclave`, `deploy_old_enclave_by_owner` | Management/accessors |

Note `register_enclave` takes a **`NitroAttestationDocument`** (parsed from `/get_attestation`), not raw PCR bytes — PCRs live in `EnclaveConfig`, and the document is checked against them on-chain.

## Build & deploy flow (real commands)

```shell
# 1. Configure + launch the EC2 + enclave (compiles allowed_endpoints.yaml into the build,
#    sets up AWS Secrets Manager for API keys, generates run.sh + expose_enclave.sh — COMMIT those)
export KEY_PAIR=<key>  AWS_ACCESS_KEY_ID=...  AWS_SECRET_ACCESS_KEY=...  AWS_SESSION_TOKEN=...
sh configure_enclave.sh <APP>          # e.g. weather-example

# 2. On the EC2 instance: build the enclave image, run it, expose port 3000
cd nautilus/
make ENCLAVE_APP=<APP>                  # builds the EIF; `cat out/nitro.pcrs` for PCR0/1/2
make run                                # (use `make run-debug` for logs; debug PCRs are ALL ZEROS, invalid for prod)
sh expose_enclave.sh

# 3. Deploy Move + register on-chain
cd move/enclave && sui client publish   # -> ENCLAVE_PACKAGE_ID
cd ../<APP>     && sui client publish    # -> APP_PACKAGE_ID, CAP_OBJECT_ID, ENCLAVE_CONFIG_OBJECT_ID

# set the real PCRs (reusable whenever the Rust server changes)
sui client call --function update_pcrs --module enclave --package $ENCLAVE_PACKAGE_ID \
  --type-args "$APP_PACKAGE_ID::$MODULE_NAME::$OTW_NAME" \
  --args $ENCLAVE_CONFIG_OBJECT_ID $CAP_OBJECT_ID 0x$PCR0 0x$PCR1 0x$PCR2

# fetch attestation from the enclave and register the pubkey -> creates the shared Enclave object
sh register_enclave.sh $ENCLAVE_PACKAGE_ID $APP_PACKAGE_ID $ENCLAVE_CONFIG_OBJECT_ID \
  $ENCLAVE_URL $MODULE_NAME $OTW_NAME    # -> ENCLAVE_OBJECT_ID
```

`MODULE_NAME`/`OTW_NAME` are your Move module name and one-time-witness type (e.g. `weather` / `WEATHER`). One `EnclaveConfig<T>` can back multiple `Enclave<T>` instances (different keys, same PCRs); register new ones at the latest `config_version`.

## Local testing

`process_data` can be tested locally; `get_attestation` cannot (needs the NSM driver, enclave-only):

```shell
cd src/nautilus-server/
RUST_LOG=debug API_KEY=<secret> cargo run --features=<app> --bin nautilus-server
curl -d '{"payload":{"location":"San Francisco"}}' -X POST http://localhost:3000/process_data
```

## Use Cases

| Use Case | External Data Source |
|---|---|
| Price oracle | CoinGecko / exchange API |
| Weather derivatives | Weather API |
| Social verification | Twitter/X API (see `twitter-example`) |
| Sealed-data policy | Seal + Nautilus (see `seal-policy` / `seal-example`) |
| Sports / insurance | Sports feed, IoT sensor data |

## Common Mistakes

| ❌ Mistake | ✅ Reality |
|---|---|
| `enclave::register(config, pcr0, pcr1, pcr2, pubkey)` / a single `OracleConfig` | Two objects: `EnclaveConfig<T>` (PCRs) + `Enclave<T>` (pubkey). Register via `register_enclave(config, attestationDocument, ctx)`. |
| Signing/verifying raw bytes | Responses are **intent messages** `{intent, timestamp_ms, data}`; the Move response struct field order must match the Rust struct (BCS) or verification fails. |
| `nitro-cli run-enclave ...` by hand | Use `make ENCLAVE_APP=<app>` then `make run` / `make run-debug`. |
| Editing `allowed_endpoints.yaml` without rebuilding | It's compiled into the enclave image — re-run `configure_enclave.sh` and rebuild. |
| Trusting `make run-debug` PCRs | Debug PCRs are all zeros — invalid for production registration. |
| Hardcoding API keys in source | Use AWS Secrets Manager (passed into the enclave as an env var). |
| Skipping the AWS root-of-trust check | The Sui framework holds the AWS Nitro root cert; `register_enclave` verifies the attestation chain against it once. |

## Resources

- GitHub: `MystenLabs/nautilus` · full example: `MystenLabs/nautilus-twitter`
- `UsingNautilus.md` (build/deploy guide) and `Design.md` (trust model) in the repo
- AWS Nitro Enclaves: https://docs.aws.amazon.com/enclaves/latest/user/
