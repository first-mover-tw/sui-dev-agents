---
name: sui-developer
description: Use when developing SUI Move contracts, generating Move code, running quality checks, or integrating with frontend. Triggers on Move development tasks, code quality verification, or smart contract implementation.
---

# SUI Developer

**High-quality SUI Move smart contract development with multi-level quality assurance.**

## Overview

This skill assists with writing production-ready SUI Move code through:
- Code generation from specifications
- Multi-level quality checks (Fast/Standard/Strict)
- Real-time development suggestions
- Frontend-friendly contract design
- TypeScript type generation from Move ABI

## Quick Start

```bash
# Generate code from spec
sui-developer generate --spec docs/specs/project-spec.md

# Run quality checks
sui-developer check --mode fast      # Development iteration
sui-developer check --mode standard  # Feature complete
sui-developer check --mode strict    # Pre-deployment (default)

# Generate TypeScript types
sui-developer gen-types

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

## SUI v1.68.1 Updates (Protocol 118)

**Key changes affecting Move development (as of March 2026):**

### Platform & Runtime

- **gRPC Data Access (GA):** gRPC is the primary data access method. JSON-RPC is deprecated (removal April 2026) — Quorum Driver for transaction submission is **fully disabled**. Use **Transaction Driver** exclusively.
- **Display V2 (Activated):** Display Registry (system object `0xd`) is live on all networks. JSON-RPC and GraphQL now prioritize Display V2 lookups over legacy Display v1. Use `sui::display::DisplayRegistry` for new projects.
- **Address Aliases (Mainnet):** Human-readable address mappings now enabled on mainnet (`v1.68.0+`).
- **Adaptive Concurrency Control:** Indexing framework replaces fixed worker counts with automatic scaling. `Processor::FANOUT` is **removed** — use `ConcurrencyConfig` enum instead.
- **Display Registry in APIs:** JSON-RPC (`showDisplay`) and GraphQL now prioritize Display Registry (V2) over legacy Display v1. New `MoveValue.asVector` for paginating vector data in GraphQL.
- **SignatureScheme Union:** GraphQL introduces `SignatureScheme` union type for `UserSignature`, replacing flat fields.
- **chainIdentifier Full Digest:** `chainIdentifier` now returns full Base58-encoded 32-byte digest (previously truncated).
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

### GraphQL Breaking Changes (v1.67.3+)

- **Simulation:** `events` field removed from `simulateResult` and `ExecutionResult`. Access events via `effects.events()` instead.
- **Error field:** `error` field removed from `ExecutionResult`; use `effects.status` for error information.

### Move Language Updates (from Move Book)

- **Extensions:** New chapter on Move extensions for extending module capabilities
- **Modes:** New chapter on Move modes (`#[test_only]`, etc.) for conditional compilation
- **Storage Rewrite:** Updated storage model documentation with latest patterns
- **Type Reflection v2:** Enhanced type reflection capabilities for advanced metaprogramming
- **BCS Improvements:** Better BCS serialization documentation and patterns
- **Lambda Type Annotations:** Type annotations are now supported on lambdas
- **Macro Patterns:** Prefer `do!`, `tabulate!`, `fold!`, `filter!`, `destroy!` macros over manual loops for vector/option operations
- **Positional Struct Keys:** Use `public struct MyKey() has copy, drop, store;` for dynamic field keys

## Core Features

### 1. Code Generation from Specification

Generate complete module structure from architecture spec:

```typescript
// Read specification
const spec = readSpec("docs/specs/project-spec.md")

// Query latest Move patterns
const patterns = await sui_docs_query({
  type: "docs",
  target: "sui-core",
  query: "Move module structure best practices"
})

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

Query latest APIs to detect deprecations:

```typescript
const versionInfo = await sui_docs_query({
  type: "version",
  target: "sui"
});

// Warn if using deprecated functions
```

### 3. Frontend Integration Support

**TypeScript Type Generation:**

Automatically generate TypeScript types from Move ABI:

```typescript
// After building Move code
sui-developer gen-types

// Generates: frontend/src/types/contracts.ts
export interface Listing {
  id: string;
  nft_id: string;
  seller: string;
  price: number | bigint;
  created_at: number | bigint;
}
```

**Frontend-Friendly Events:**

Ensure events contain all info frontend needs:

```move
// ✅ Good: Complete event
public struct NFTPurchased has copy, drop {
    listing_id: ID,
    nft_id: ID,
    buyer: address,
    seller: address,
    price: u64,
    timestamp: u64
}
```

See [reference.md](references/reference.md) for event design patterns.

### 4. Best Practices Enforcement

Query and apply latest Move best practices:

```typescript
const practices = await sui_docs_query({
  type: "docs",
  target: "sui-core",
  query: "Move programming best practices patterns"
});

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

❌ **Not generating TypeScript types from Move ABI**
- **Problem:** Frontend uses wrong types, runtime errors
- **Fix:** Run `sui-developer gen-types` after every Move contract change

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
- **Fix:** Call sui_docs_query() before implementing complex features

## See Also

- [reference.md](references/reference.md) - Common patterns library, complete security checklist
- [examples.md](references/examples.md) - Complete generated code examples, TypeScript integration
- [scripts/](scripts/) - Quality check implementation scripts

---

**Write Move code with confidence - comprehensive quality checks ensure production-ready smart contracts!**
