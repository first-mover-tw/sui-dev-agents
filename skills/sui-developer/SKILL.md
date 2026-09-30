---
name: sui-developer
description: Use when writing or modifying SUI Move smart contracts, generating Move code, or following Move development patterns. Triggers on "write a Move module", "implement contract", "add function", "Move code", or any hands-on Move development task. Also use when the user pastes Move code and asks for help. For code review/audit, use move-code-quality instead. For contract architecture design, use sui-architect.
---

# SUI Developer

**High-quality SUI Move smart contract development with multi-level quality assurance.**

## Overview

This skill assists with writing production-ready SUI Move code through:
- Code generation from specifications
- Multi-level quality checks (Fast/Standard/Strict)
- Real-time development suggestions
- Frontend-friendly contract design (see sui-move-ts-bridge for TS type generation)

## Quick Start

```bash
# Generate code from spec
sui-developer generate --spec docs/specs/project-spec.md

# Run quality checks
sui-developer check --mode fast      # Development iteration
sui-developer check --mode standard  # Feature complete
sui-developer check --mode strict    # Pre-deployment (default)

# Watch mode for continuous checking
sui-developer watch
```

## Quality Check Levels

### Fast Mode (Development Iteration)

**Use when:** Rapidly prototyping and iterating

**Checks:**
- ✓ Syntax correctness
- ✓ Compilation (`sui move build`)
- ✓ Basic linter warnings

**Speed:** ~5 seconds

```bash
sui move build
```

### Standard Mode (Feature Complete)

**Use when:** Feature is complete and ready for review

**Checks:**
- ✓ All Fast mode checks
- ✓ Move analyzer deep analysis
- ✓ Basic security patterns:
  - Integer overflow risks
  - Access control verification
  - Capability leak detection
- ✓ Gas usage analysis (basic)
- ✓ Naming convention compliance

**Speed:** ~30 seconds

```bash
sui move build
sui move test
# Custom security checks
```

### Strict Mode (Pre-deployment, Default)

**Use when:** Preparing for deployment, especially mainnet

**Checks:**
- ✓ All Standard mode checks
- ✓ Deep security audit:
  - Reentrancy attack patterns
  - Shared object race conditions
  - Capability escape analysis
  - Integer arithmetic logic errors
  - Authorization bypass attempts
- ✓ Gas optimization analysis (detailed)
- ✓ Move idioms and best practices
- ✓ Documentation completeness (all public functions)
- ✓ Formal verification suggestions (critical logic)
- ✓ Comparison with official security checklist

**Speed:** ~2 minutes

**Cross-reference:** For deep Move semantics review (enum correctness, ability constraints, borrow safety), invoke the `move-code-quality` skill after Strict mode passes.

See [scripts/](scripts/) for implementation details.

## SUI Protocol Updates (now mainnet v1.80.1 / Protocol 137)

**Key changes affecting Move development (as of August 2026):**

### Protocol 137 (mainnet v1.80.1)

> Protocol config verified against `crates/sui-protocol-config/src/lib.rs` @ `mainnet-v1.80.1` (`MAX_PROTOCOL_VERSION = 137`, `lib.rs:32`; per-version comment block `lib.rs:391-400`; `137 =>` arm `lib.rs:4743-4764`). Mainnet also carries every P136 change below. P138 (testnet v1.81.0) appears only as explicitly gated notes (allowances, object-funds check, CLI).

- **`allowed_proposers = true` on mainnet and testnet (`lib.rs:4760`):** P136 had it on for devnet only (`lib.rs:4736-4738`); P137 turns it on everywhere. A `TransactionExpiration::Validity` transaction (the variant carrying an allowed-proposer set) is now **accepted** on mainnet — with the flag off, signing-time validation rejects it with `UserInputError::Unsupported("Restricting the proposers of a transaction is not supported")` (`crates/sui-types/src/transaction.rs:3417-3427`). gRPC `SimulateTransaction` only emits a proposer set when the flag is on **and** the fullnode's `enable_simulate_allowed_proposers` node config is set (default **false** — off unless the fullnode operator enables it), `crates/sui-config/src/node.rs:244-248`, **and** the node has a `proposer_selector` that returns a set for the current epoch (`crates/sui-rpc-api/.../simulate/mod.rs:573-585`), so `VALID_DURING` can still come back — treat `VALIDITY` as optional in responses.
- **`LdConst` gas (`charge_ld_const_abstract_size = true`, `lib.rs:4751`):** the Move `LdConst` bytecode is charged by the constant's abstract value size instead of its serialized byte length (`lib.rs:395-396`). Gas for modules with large constants changes — re-run `sui move test` gas-sensitive assertions and re-dry-run deploys.
- **Bulletproofs limit (`lib.rs:4744-4745`):** `verify_bulletproofs_ristretto255_cost_per_bit_and_commitment = 621` (lower per-bit cost) and `max_bulletproofs_total_bits = 1024`, up from 512 — the bound is `batch size * range bits` (`lib.rs:391-392`). A batched range proof over more commitments/bits now verifies instead of aborting.
- **Extra PTB checks:** `validate_ptb_argument_indices = true` (`lib.rs:4762`) validates PTB argument indices at **signing time** (`lib.rs:399`; gate at `crates/sui-types/src/transaction.rs:1721`) — a PTB whose `Input` index is `>= inputs.len()`, or whose `Result`/`NestedResult` index is `>= ` the referencing command's own index (forward reference), is rejected with `UserInputError::InvalidArgumentIndex` (`crates/sui-types/src/transaction.rs:1040-1063`) instead of failing later. `fix_ptb_generated_reads = true` (`lib.rs:4750`) is a correctness fix for reads PTB execution generates itself; `memory_safety_invariant_check_v2 = true` (`lib.rs:4763`) enables the v2 memory-safety invariant check. Only the flag names and the one-line comment are verified — the exact rejection paths for the latter two were not traced (unverified).
- **Not on mainnet:** `enable_allowances` is gated `chain != Mainnet` (`lib.rs:4747-4749`), and `check_object_funds_withdraw_in_execution` is devnet-only (`lib.rs:4752-4754`).
- **Native allowances — `sui::allowance` (devnet/testnet from P137; mainnet only from P138 — NOT active on mainnet as of 2026-09-30):** the module ships in the v1.80.1 framework (`sources/allowance.move`, unchanged at `testnet-v1.81.0`), but creating one asserts `is_feature_enabled("enable_allowances")` and aborts `ENotEnabled` (code 16) where the flag is off (`allowance.move:483`, `:60`). P138 sets `enable_allowances = true` unconditionally, i.e. mainnet too (`lib.rs:4792` @ `testnet-v1.81.0`; v1.81.0 is a testnet release today). It is delegated, bounded, revocable spending **from the funder's address balance** (not from `Coin` objects):
  - `Allowance<T>` (`key`, always shared, `:80`) + soulbound `AllowanceCap<T>` (`key` only, `:116`) sent to the funder for revocation. Funder = tx sender at creation.
  - Create: `entry fun new<T>(name, spender, lifetime_cap: Option<u256>, start_timestamp_ms: Option<u64>, expiration_timestamp_ms: Option<u64>, rate_limit: Option<RateLimit>, ctx)` (`:201`) — `entry`, not `public`, so contracts can't create allowances implicitly. Needs a lifetime cap or a rate limit (`ENoLimit` 5) and an expiration or a rate limit (`ENoExpiration` 15). App-bound: `entry propose_for_app<T, A>` → `public fun issue<T, A>(proposal, SettingsPermit<A>, ctx)` (`:228`, `:251`).
  - Rate limits: `periodic_rate_limit(period_ms, limit: u256)`, `calendar_rate_limit(months: u8, limit)`, `monthly_/quarterly_/yearly_rate_limit(limit)` (`:177-195`).
  - Spend: `balance_spend<C>(&mut Allowance<Balance<C>>, AllowanceWithdrawal<Balance<C>>, &Clock, &TxContext): Balance<C>` (`:260`; sender must be the spender). App-bound allowances go through `app_balance_spend<C, A>(…, SpendPermit<A>, …)` (`:272`; `SpendPermit` is minted from `internal::Permit<A>` via `spend_permit`, `:165`). The `AllowanceWithdrawal` arrives as a PTB input (TS: `tx.withdrawal({ from: 'allowance', … })`, see sui-ts-sdk); Move code can't construct it outside tests.
  - Manage: `revoke<T>(AllowanceCap<T>, Allowance<T>)` (`:284`), `rotate_spender<T, A>` (app-bound only, `:296`). Error codes 0–17 (`:26-62`); sponsor-side allowance withdrawals abort `ESponsorWithdrawalNotEnabled` (17, `:397`).
- **Object-funds withdrawals abort on insufficiency:** `sui::funds_accumulator` adds `#[error(code = 5)] EObjectFundsInsufficient` (`funds_accumulator.move:40-42` @ `mainnet-v1.80.1`). `withdraw_from_object` (still `public(package)`) now reserves via the native `reserve_object_funds_for_withdrawal` (`:109`), which aborts at withdraw time when `limit` exceeds the object's available balance — but only when `check_object_funds_withdraw_in_execution` is on (`sui-execution/latest/sui-move-natives/src/funds_accumulator.rs:177`): devnet at P137, testnet at P138 (`lib.rs:4793-4795` @ `testnet-v1.81.0`), **never mainnet** in either.
- **CLI (v1.81, testnet release only):** `sui client ptb` accepts address-balance withdrawal inputs `withdrawal(<amount>)` (SUI) and `withdrawal<COIN_TYPE>(<amount>)` (`crates/sui/src/client_ptb/parser.rs:494,714-717` @ `testnet-v1.81.0`; no such parser arm at `mainnet-v1.80.1`).

### Protocol 136 (mainnet v1.79.1+, so live on v1.80.1)

> Mainnet is on **P137**, which includes everything here. Verified against protocol-config, not just release notes; line cites below re-checked at `mainnet-v1.80.1`.

- **PTB `TxContext` signature restrictions (PR 27451):** a Move call inside a PTB may take **at most one `&mut TxContext`**, or **any number of `&TxContext`** — never both, never `TxContext` **by value**, and `TxContext` may **not appear in return position**. This applies to dev-inspect too. A violating command fails **before execution** with `CommandArgumentError::InvalidTxContext` (TS SDK: `GrpcTypes.CommandArgumentError_CommandArgumentErrorKind.INVALID_TX_CONTEXT = 20`, reached via `import { GrpcTypes } from '@mysten/sui/grpc'` — it is **not** a named export of that module, and **not** a member of the `ExecutionStatus` message; both mistakes fail `tsc`). The release notes label this P135, but the `ptb_tx_context_restrictions` flag is off in the mainnet **and** testnet P135 snapshots and only turns on at **v136** — so it applies on mainnet now (P137 ≥ 136; `lib.rs:4729`). Audit entry functions that thread `TxContext` through helper calls in the same PTB.
- **New PTB reference limits (P136 — every chain; mainnet is on 137, so live):** `max_ptb_live_references = 64`, `max_ptb_returned_references = 16` (per command), `max_ptb_total_returned_references = 256`, and a new `translation_per_live_reference_charge = 1` multiplier on a **cubic** per-command gas charge — each command pays `n(n+1)(n+2)/6 × translation_per_live_reference_charge` for its `n` live references (cubic at `metering/translation_meter.rs:140-146`, multiplied by the charge at `:88-99`), so at the 64 ceiling one command alone costs 45,760 units, not 64. None of these existed before P136 (`sui-protocol-config/src/lib.rs:4731-4734` @ `mainnet-v1.80.1`; zero assignments at `mainnet-v1.78.1`). Deeply-chained PTBs that pass many references between commands are the ones that will hit these. **Watch the error type:** exceeding `max_ptb_live_references` / `max_ptb_returned_references` currently surfaces as `ExecutionErrorKind::InsufficientGas` (`metering/typing/live_references.rs:158-188`; upstream has a `// TODO introduce an ExecutionErrorKind for limits`), so a PTB that is too deeply chained looks like it merely needs a bigger gas budget. Raising the budget will not help — split the PTB.
- **`harden_linkage_consistency = true` (P136, every chain):** tightens **PTB** linkage resolution, not just publish/upgrade (`lib.rs:4739`). With it on, Fixed-input types and withdrawal-compatible inputs are folded into the resolution table (`linkage/single_linkage.rs:130-172`) and framework `MoveCall`s are forced onto unified linkage (`env.rs:202`), so linkage can resolve differently than it did on P135. Those three extra checks (`linkage_consistency.rs`, `validate_init_linkage_pinning`, `check_published_packages`) are `invariant_violation!` assertions, so they surface as InvariantViolation rather than a normal validation error. That does **not** mean every `harden_linkage_consistency` failure is an invariant: a linkage unification conflict from the widened resolution table is an ordinary user-facing `ExecutionErrorKind::InvalidLinkage` (`single_linkage.rs:436-449`).
- **`package_arena_size_in_bytes = 10MB` (PR 27826):** the previously hardcoded package arena limit becomes a protocol config with the same value — **no behavior change**. The CLI side (`sui move test --package-size`) is covered in sui-deployer.
- **Baseline bump rule:** when mainnet moves past P137, update this repo's baseline strings (`Protocol 137` / `mainnet v1.80.1`) and fold the new section in above.

### Protocol 130 (mainnet v1.76.1, live since 2026-07-29)

- **`sui::scratch` (new module):** per-transaction ephemeral key-value store — write/read scratch data within a transaction with **no storage fee**, not attached to any `UID`, accessed through `TxContext`. Access is gated by `scratch::Permit<K>`, issued from `std::internal::Permit<K>`, so only the module declaring the key type `K` can reach entries keyed by it (release notes omit this; verified against framework source). Key `K` needs `copy + drop`, values need `drop` (`copy` too, to read). Limit **16,384 entries per transaction**. Full API surface — operations, `TxContext` method aliases, `internal_*` macros, the `get_do` / `get_fold` borrow macros (read-only variants still take `&mut TxContext`; re-entering the same key inside the callback aborts), and when to prefer a Hot Potato instead → see **[references/scratch.md](references/scratch.md)**.
- **gRPC filtered `List*` / subscription APIs are stable:** the filtered list and subscription endpoints graduated from experimental to stable — prefer them over polling.
- **Chain identifier Hex format:** the CLI and `Move.toml` `[environments]` accept the chain id in both Base58 and Hex forms.
- **Address balances — per-account net withdraws:** protocol-level accounting change for address-held balances.

### Protocol 134-135 (mainnet v1.78.1, live since 2026-08-29)

- **P134/P135 `defer_unpaid_amplification` disabled:** mainnet's P134 (v1.77.3) only turned this flag off; P135 (v1.78.1) turns it off on every chain and applies the rest of the v134 set (below) to mainnet. No Move-level API change.
- **`sui::package::original_package_id(cap: &UpgradeCap): ID` (new, P135 on mainnet):** returns the first-version ID of the package the cap governs, via a native `original_package_id_impl`. Aborts with `EUpgradeInProgress` if an upgrade ticket is outstanding (`cap.package == @0x0`) or `EInvalidPackageVersion` if `cap.version == 0` or the on-chain package is not at `cap.version`. Gas: base 52 + per-byte object-read cost. Use it instead of hand-maintaining "original package id" in deployment records; deployment flow → see sui-deployer.
- **Consensus block limits (P135 all chains, P134 non-mainnet):** `consensus_max_transactions_in_block_bytes` = 288 KiB, `consensus_max_num_transactions_in_block` = 128 — throughput tuning, no developer action.
- **Move compiler (v1.78):** new warning for constant expressions that always error at runtime (e.g. `0 - 1u64`, via constant folding); cast optimization bug fixed (#27604). Warnings only — existing code still builds.

### Protocol 131-133 (mainnet v1.77.2, live since 2026-08-13)

- **P131 `framework_tx_context_mut_restrictions`:** system-package functions that take `&mut TxContext` **and** return a mutable reference must now also take a non-`TxContext` `&mut` parameter, or publish is rejected. Scope is **system packages only** — user packages are unaffected. This limit is now live on mainnet as of P133 (mainnet jumped straight from P130 to P133; there was no mainnet-v1.77.0/1.77.1).
- **P132/P133 protocol config bounds:** release notes describe bounds tuning ("added additional bounds while relaxing others"); P133 concretely sets `include_function_signatures_in_instantiation_limits = true` and `max_accumulator_type_nodes = 16` (accumulator-type DoS guard — the framework's `funds_accumulator` aborts with `EAccumulatorTypeTooLarge = 4` on oversized types). No developer-facing API change.
- **`ForwardingAddressRegistry` (`0x2::forwarding_address`, object ID `0xfa`):** new system object created at epoch change, paired with a new end-of-epoch system tx `ForwardingAddressRegistryCreate`. **Devnet-gated** — the creation flag is not enabled on mainnet, so the `0xfa` object does not exist there yet.
- **Git dependency `rev` pinning:** for `Move.toml` git dependencies that reference an annotated tag, `rev` now pins to the underlying commit rather than the tag object — affects reproducibility of builds that pin via annotated tags.

### Protocol 127 (shipped testnet v1.74.0)

- **Bulletproofs domain separation (breaking):** `sui::rangeproofs::verify_bulletproofs_ristretto255` is deprecated and now **always aborts**. Use `verify_bulletproofs_with_dst_ristretto255(proof, bits, commitments, dst, version)` — adds a domain-separation tag (`dst`, max length 64).
- **Ristretto255 on testnet:** Ristretto255 group operations + Bulletproof range-proof verification moved from devnet-only to **devnet + testnet** (gas prices re-tuned).
- **DKG fix:** P127 enables `always_advance_dkg_to_resolution` (corrects a bad P126 modification).
- `sui::accumulator` gains `#[test_only] create_for_testing`.

### Platform & Runtime

- **gRPC Data Access (GA):** gRPC is the primary data access method. **JSON-RPC is now shut off on public fullnodes** (permanent deactivation landed 2026-07-31; public endpoints return "Method not found … migrate to gRPC or GraphQL" — verified live 2026-08-06). Quorum Driver for transaction submission is **fully disabled**; use **Transaction Driver** exclusively. All reads against public infrastructure must go through gRPC or GraphQL (your own full node can still opt to serve JSON-RPC).
- **Address Balances (Mainnet, P125):** Native address-held balances are live on mainnet for supported coin types. For those, PTBs can debit/credit address balances directly without manual `splitCoins`/`mergeCoins` coin-object juggling. This is an *additional* path — Move entry functions and SDK APIs that take `Coin<T>` still require coin objects, so don't drop coin handling wholesale. Delegated spending from an address balance (`sui::allowance`) is covered under Protocol 137 above — not mainnet-active until P138.
- **Gasless Stablecoin Transfers (Mainnet, P125, rolling out):** Accumulator + coin reservations enable sponsored stablecoin (USDC) transfers without the sender holding SUI for gas.
- **Display V2 (Activated):** Display Registry (system object `0xd`) is live on all networks. JSON-RPC and GraphQL now prioritize Display V2 lookups over legacy Display v1. Use the `sui::display_registry` module (the legacy `sui::display` module is deprecated): `display_registry::new_with_publisher<T>(registry, &publisher, ctx)` or `display_registry::new<T>(registry, internal::permit<T>(), ctx)` → both return `(Display<T>, DisplayCap<T>)`; update with `display_registry::set(&mut d, &cap, name, value)` then `display_registry::share(d)`.
- **Address Aliases (Mainnet):** Human-readable address mappings now enabled on mainnet (`v1.72.2+`).
- **Adaptive Concurrency Control:** Indexing framework replaces fixed worker counts with automatic scaling. `Processor::FANOUT` is **removed** — use `ConcurrencyConfig` enum instead.
- **Display Registry in APIs:** JSON-RPC (`showDisplay`) and GraphQL now prioritize Display Registry (V2) over legacy Display v1. New `MoveValue.asVector` for paginating vector data in GraphQL.
- **SignatureScheme Union:** GraphQL introduces `SignatureScheme` union type for `UserSignature`, replacing flat fields.
- **chainIdentifier Full Digest:** `chainIdentifier` now returns full Base58-encoded 32-byte digest (previously truncated). Since v1.76 the CLI and `Move.toml` `[environments]` also accept the Hex form.
- **Metadata Hardening:** Sui System metadata validation tightened (`v1.68.0`).

### Move Runtime

- **TxContext Flexible Positioning:** `TxContext` arguments can appear in any position within PTBs.
- **poseidon_bn254 Enabled:** Available on all networks. Use `sui::poseidon::poseidon_bn254` for zero-knowledge proof applications.
- **Hot Potato Rule:** Non-public entry functions cannot have arguments entangled with hot potatoes.
- **Ristretto255 Group Ops:** Ristretto255 group operations available for cryptographic applications (`v1.67+`).
- **`#[error]` Annotation:** Annotate error constants with `#[error]` for human-readable abort messages. The CLI decodes these automatically at runtime.
- **Gas Schedule Changes:** Dynamic field operations rebalanced — first loads more expensive, subsequent loads significantly cheaper (`v1.62.1+`).

### Tooling

- **DeepBook No Longer Implicit:** Since v1.47, DeepBook is no longer an implicit dependency. Add it explicitly in `Move.toml` if needed.
- **Sui Gas Meter for Tests:** `sui move test` now uses the Sui gas meter (`v1.66.2+`), providing more accurate gas measurements.
- **CLI Auto-completion:** Use `sui completion --generate [shell]` for shell auto-completion (`v1.66.2+`).
- **Regex Test Filtering:** Test filtering now uses regex — use `sui move test --filter "regex_pattern"`.
- **Move Linter:** `sui move lint` runs Move linters on the package (P128 / v1.74.1+). Default lints run in `sui move build`/`test`; `--no-lint` disables them, `--lint` enables extra linters.
- **Move Formatter:** `sui move format` formats Move source via `prettier-move` (P126 / v1.73.1+). It's a passthrough — on first run it errors `prettier-move is not installed`; install once with `npm i -g prettier @mysten/prettier-plugin-move`, then `sui move format` (formats the package) works.

### GraphQL Breaking Changes (v1.71.1+)

- **Simulation:** `events` field removed from `simulateResult` and `ExecutionResult`. Access events via `effects.events()` instead.
- **Error field:** `error` field removed from `ExecutionResult`; use `effects.status` for error information.

### Move Language Updates (from Move Book)

- **Extending Modules:** `2024.alpha`-only `extend module` adds functions/types/constants/use-statements to a foreign or your own module, gated by any mode attribute (`#[test_only]` is just the most common); additive-only, root-package-only.
- **Modes:** `#[mode(name,...)]` generalizes `#[test_only]`; build with `--mode <name>` — any mode-enabled build (including `--test`) is non-publishable.
- **Storage Functions:** Rewritten chapter on the transfer/freeze/share operations that move objects between ownership states, plus their `public_*` cross-module counterparts.
- **Type Reflection:** `std::type_name::with_defining_ids`/`with_original_ids` inspect a type at runtime, distinguishing the defining ID (introduced the type) from the original ID (first-published version).
- **BCS:** Binary Canonical Serialization chapter — deterministic encoding rules (little-endian ints, ULEB128-length-prefixed sequences, enums as variant index) for hand-decoding tx args/objects/events.
- **Positional Structs:** `public struct MyKey(u64) has copy, drop, store;` — fields identified by position (`.0`, `.1`, ...), a good fit for small wrapper/key types.
- **Macro Functions:** New chapter on `macro fun`/`$`-parameters — compile-time expansion enables lambda arguments (`|x| expr`) and generic-unfriendly operations; prefer stdlib macros (`do!`, `map!`, `fold!`, ...) over hand-written loops.
- **Internal Permit:** `std::internal::Permit<T>`/`permit<T>()` — a compiler/network-enforced token only the module defining `T` can produce, used to gate generic functions to callers authorized by that module.
- **Entry Functions:** The `entry` modifier's second restriction — arguments to a non-`public` `entry` function can't be entangled with a hot potato from an earlier PTB command (Sui v1.62+ rule; e.g. flash loans).
- **Address Balances:** `send_funds`/`redeem_funds` and the accumulator-backed per-address balance model — an alternative to `Coin` objects; withdrawals require a `Withdrawal<Balance<T>>` authorization supplied by the transaction.
- **Package Upgrades:** `UpgradeCap`-gated upgrades publish at a new address (old versions stay callable forever); default policy allows new modules/functions but freezes existing `public` signatures and type definitions. Since P135, `sui::package::original_package_id(&cap)` recovers the first-version package ID from the cap.
- **Using Move Registry:** Guide on adding MVR (`@org/package`) dependencies — `mvr search`, adding to the manifest, and resolving names to per-network addresses.
- **Linting:** `sui move lint`'s default vs extra lint tiers, and suppressing a specific warning with `#[allow(lint(...))]` — complements the Move Linter CLI note above (Tooling).

## Move 1.70–1.71 APIs (mainnet v1.71.1)

### Dynamic field ergonomics (1.71)

`sui::dynamic_field` and `sui::dynamic_object_field` gained these helpers — use them instead of hand-rolling existence checks:

- `borrow_or_add(parent, key, default)` / `borrow_mut_or_add` — get or insert.
- `get_do(parent, key, |v| ...)` / `get_mut_do` — apply a closure if present.
- `get_fold(parent, key, init, |acc, v| ...)` / `get_mut_fold` — fold pattern over optional value.
- `replace(parent, key, new)` — swap value, return old.
- `remove_opt(parent, key)` — returns `Option<V>` (use this; `remove_if_exists` is deprecated).
- `exists(parent, key)` — replaces deprecated `exists_`.

### Overflow-safe integer math (1.70)

`std::u{8,16,32,64,128,256}` gained `mul_div(a, b, c)` and `mul_div_ceil(a, b, c)` — computes `(a * b) / c` without intermediate overflow. Prefer over manual widening.

`div_ceil(a, b)` replaces deprecated `divide_and_round_up`.

### Deprecations to clean up

| Deprecated | Replacement |
|---|---|
| `vector::empty<T>()` | `vector[]` literal |
| `vector::singleton(x)` | `vector[x]` |
| `dynamic_field::exists_` | `dynamic_field::exists` |
| `dynamic_field::remove_if_exists` | `dynamic_field::remove_opt` |
| `dynamic_object_field::exists_` | `dynamic_object_field::exists` |
| `std::u*::divide_and_round_up` | `std::u*::div_ceil` |

## Core Features

### 1. Code Generation from Specification

Generate complete module structure from architecture spec:

```typescript
// @check:skip
// Read specification
const spec = readSpec("docs/specs/project-spec.md")

// Query latest Move patterns first — invoke the `sui-docs-query` skill
// (routes to Context7 MCP) with "Move module structure best practices"

// Generate modules
for (const module of spec.modules) {
  await generateModule(module, patterns)
}
```

**Generated structure:**
- Error codes
- Structs with proper abilities
- Public functions with doc comments
- Internal helper functions
- Events for state changes
- Test module skeleton

See [examples.md](references/examples.md) for complete generated code examples.

### 2. Real-time Development Suggestions

Auto-suggest better patterns while coding:

```move
// Detect hardcoded address
const ADMIN_KEY: address = @0x123;

// Suggest improvement:
// Warning: Use capability instead:
public struct AdminCap has key { id: UID }
```

To detect deprecations, check current API/version behavior via the **sui-docs-query** skill (Context7 MCP) before flagging functions as deprecated.

### 3. Frontend Integration

For TypeScript type generation from Move ABI, event design for frontends, and contract API wrappers, use the **sui-move-ts-bridge** skill.

### 4. Best Practices Enforcement

Query and apply latest Move best practices via the **sui-docs-query** skill (Context7 MCP), then check code against them:

```text
// Check code against practices
// - Proper error handling
// - Event emissions
// - Capability usage
// - Safe math operations
```

## Development Workflow

```
1. Generate code from spec
   ↓
2. Developer writes/modifies Move code
   ↓
3. Run Fast mode checks (while developing)
   ↓
4. Feature complete → Run Standard mode
   ↓
5. Fix any issues
   ↓
6. Before commit → Run Strict mode (auto via git hook)
   ↓
7. Generate TypeScript types
   ↓
8. Ready for frontend integration
```

## Configuration

`.sui-developer.json`:

```json
{
  "quality_mode": "strict",
  "auto_format": true,
  "generate_types": true,
  "frontend_integration": {
    "enabled": true,
    "output_dir": "frontend/src/types"
  },
  "checks": {
    "security": true,
    "gas_optimization": true,
    "documentation": true,
    "naming_conventions": true
  },
  "patterns": {
    "use_capabilities": true,
    "emit_events": true,
    "validate_inputs": true
  }
}
```

**Configuration options:**
- `quality_mode` - Default check level (fast/standard/strict)
- `auto_format` - Auto-format code on save
- `generate_types` - Auto-generate TypeScript types after build
- `frontend_integration.output_dir` - Where to output TS types
- `checks` - Enable/disable specific checks
- `patterns` - Enforce specific coding patterns

## Integration

### Called By
- `sui-full-stack` (Phase 2: Development)
- `sui-architect` (after spec generation)

### Calls
- `sui-docs-query` - Query latest Move APIs and best practices

### Next Step
After development complete, suggest:
```
✅ Move development complete!
Next: Ready for testing with sui-tester?
```

## Watch Mode

Continuous checking during development:

```bash
sui-developer watch
```

Automatically runs Fast mode checks on file changes.

## Common Mistakes

❌ **Skipping quality checks during rapid iteration**
- **Problem:** Bugs accumulate, major refactor needed before deployment
- **Fix:** Use Fast mode during development, Standard mode before commits

❌ **Ignoring Move analyzer warnings**
- **Problem:** Subtle bugs (dead code, unused variables) slip through
- **Fix:** Treat warnings as errors, fix all before committing

❌ **Using Strict mode during prototyping**
- **Problem:** Slow iteration, premature optimization
- **Fix:** Fast mode for prototyping, Strict mode for production code

❌ **Not testing with realistic gas budgets**
- **Problem:** Works in dev, fails in production due to gas limits
- **Fix:** Test with mainnet-equivalent gas budgets (--gas-budget)

❌ **Hardcoding addresses in Move code**
- **Problem:** Cannot deploy to multiple networks
- **Fix:** Use capabilities instead of address checks

❌ **Missing doc comments on public functions**
- **Problem:** Strict mode fails, poor developer experience
- **Fix:** Add /// comments to all public functions before Standard mode

❌ **Not querying latest Move patterns**
- **Problem:** Using deprecated APIs, outdated patterns
- **Fix:** Use the `sui-docs-query` skill before implementing complex features

## See Also

- [reference.md](references/reference.md) - Common patterns library, complete security checklist
- [examples.md](references/examples.md) - Complete generated code examples, TypeScript integration
- [scripts/](scripts/) - Quality check implementation scripts
- [object-model.md](references/object-model.md) — Read when deciding derived objects vs dynamic fields, implementing transfer-to-object (`Receiving<T>`), or reasoning about why a PTB went hot
- [move-idioms.md](references/move-idioms.md) — Read when writing Move 2024 code: method (dot) syntax, naming conventions (Cap/event/getter/hot-potato/field-key), and PTB-composable function design (no `public entry`, return-don't-transfer, param order). Audit counterpart: the `move-code-quality` skill.

---

**Write Move code with confidence - comprehensive quality checks ensure production-ready smart contracts!**
