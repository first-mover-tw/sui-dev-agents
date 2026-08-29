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

## SUI Protocol Updates (now mainnet v1.78.1 / Protocol 135; testnet v1.78.1 / P135)

**Key changes affecting Move development (as of August 2026):**

### Protocol 130 (mainnet v1.76.1, live since 2026-07-29)

- **`sui::scratch` (new module):** per-transaction ephemeral key-value store — write/read scratch data within a transaction with **no storage fee**. Access is gated through `std::internal::Permit<K>` (release notes omit this; verified against framework source). Useful for passing intermediate state without creating objects.
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
- **Address Balances (Mainnet, P125):** Native address-held balances are live on mainnet for supported coin types. For those, PTBs can debit/credit address balances directly without manual `splitCoins`/`mergeCoins` coin-object juggling. This is an *additional* path — Move entry functions and SDK APIs that take `Coin<T>` still require coin objects, so don't drop coin handling wholesale.
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
