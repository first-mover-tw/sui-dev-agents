# SUI Developer - Reference Guide

Complete reference for Move patterns, security checks, and best practices.

## Common Move Patterns Library

### Pattern 1: Capability-Based Administration

```move
module example::admin;

/// Define capability
public struct AdminCap has key, store {
    id: UID
}

/// Initialize (called once during package publish)
fun init(ctx: &mut TxContext) {
    transfer::transfer(
        AdminCap { id: object::new(ctx) },
        ctx.sender()
    );
}

/// Admin-only function
public fun admin_only_function(
    _: &AdminCap,
    // ... other parameters
    ctx: &mut TxContext
) {
    // Only callable by admin cap holder
}

/// Transfer admin rights
public fun transfer_admin(
    cap: AdminCap,
    recipient: address
) {
    transfer::transfer(cap, recipient);
}
```

### Pattern 2: One-Time Witness (OTW) Pattern

```move
module example::marketplace;

/// OTW struct — must match module name in UPPERCASE, have only `drop`
public struct MARKETPLACE has drop {}

/// Called once during package publish
fun init(witness: MARKETPLACE, ctx: &mut TxContext) {
    // OTW can only be created by the runtime in init
    // Verify with sui::types::is_one_time_witness(&witness)

    // Create publisher object (proves package ownership)
    let publisher = package::claim(witness, ctx);
    transfer::public_transfer(publisher, ctx.sender());
}
```

**OTW Rules:**
- Struct name must be module name in UPPERCASE
- Must have only the `drop` ability (no `store`, `key`, `copy`)
- No fields
- Only instantiated by the Move runtime as the first arg of `init`

### Pattern 3: Shared Object with Versioning

```move
module example::marketplace;

public struct Marketplace has key {
    id: UID,
    version: u64,  // Track version for upgrades
    // ... other fields
}

const EWrongVersion: u64 = 0;

public fun create_marketplace(ctx: &mut TxContext) {
    let marketplace = Marketplace {
        id: object::new(ctx),
        version: 1,
    };
    transfer::share_object(marketplace);
}

/// Migration function
public fun migrate(
    marketplace: &mut Marketplace,
    _admin: &AdminCap
) {
    assert!(marketplace.version == 1, EWrongVersion);
    marketplace.version = 2;
    // Migration logic here
}
```

### Pattern 4: Dynamic Fields for Extensibility

```move
use sui::dynamic_field as df;

/// Positional struct as typed key (preferred over bare primitives)
public struct MetadataKey<phantom T>(u64) has copy, drop, store;

/// Add metadata without changing struct
public fun add_metadata<V: store>(
    object: &mut SomeObject,
    index: u64,
    value: V
) {
    df::add(&mut object.id, MetadataKey<V>(index), value);
}

/// Read metadata
public fun get_metadata<V: store>(
    object: &SomeObject,
    index: u64,
): &V {
    df::borrow(&object.id, MetadataKey<V>(index))
}

/// Remove metadata
public fun remove_metadata<V: store>(
    object: &mut SomeObject,
    index: u64,
): V {
    df::remove(&mut object.id, MetadataKey<V>(index))
}
```

### Pattern 5: Safe Math Operations

```move
#[error]
const EOverflow: vector<u8> = b"Arithmetic overflow";
#[error]
const EUnderflow: vector<u8> = b"Arithmetic underflow";
#[error]
const EDivisionByZero: vector<u8> = b"Division by zero";

public fun safe_add(a: u64, b: u64): u64 {
    let result = a + b;
    assert!(result >= a, EOverflow);
    result
}

public fun safe_sub(a: u64, b: u64): u64 {
    assert!(a >= b, EUnderflow);
    a - b
}

public fun safe_mul(a: u64, b: u64): u64 {
    if (a == 0 || b == 0) return 0;
    let result = a * b;
    assert!(result / a == b, EOverflow);
    result
}

public fun safe_div(a: u64, b: u64): u64 {
    assert!(b != 0, EDivisionByZero);
    a / b
}
```

### Pattern 6: Event-Driven Architecture

```move
use sui::event;

/// Define events
public struct ItemCreated has copy, drop {
    item_id: ID,
    creator: address,
    created_at: u64
}

public struct ItemTransferred has copy, drop {
    item_id: ID,
    from: address,
    to: address,
    timestamp: u64
}

/// Emit events
public fun create_item(ctx: &mut TxContext) {
    let item_id = object::new(ctx);
    let item_id_copy = object::uid_to_inner(&item_id);

    // ... create item logic

    event::emit(ItemCreated {
        item_id: item_id_copy,
        creator: ctx.sender(),
        created_at: ctx.epoch()
    });
}
```

### Pattern 7: Pausable Contract

```move
public struct Marketplace has key {
    id: UID,
    paused: bool,
    admin: address
}

#[error]
const EContractPaused: vector<u8> = b"Contract is paused";

public fun pause(
    marketplace: &mut Marketplace,
    _: &AdminCap
) {
    marketplace.paused = true;
}

public fun unpause(
    marketplace: &mut Marketplace,
    _: &AdminCap
) {
    marketplace.paused = false;
}

/// Use in functions
public fun some_action(marketplace: &Marketplace) {
    assert!(!marketplace.paused, EContractPaused);
    // ... rest of logic
}
```

### Pattern 8: Enum Pattern (Move 2024)

```move
module example::order;

/// Enums model variants with different data
public enum OrderStatus has copy, drop, store {
    Pending,
    Active { start_time: u64 },
    Completed { result: u64 },
    Cancelled { reason: vector<u8> },
}

public fun process_order(status: &OrderStatus): u64 {
    match (status) {
        OrderStatus::Pending => 0,
        OrderStatus::Active { start_time } => *start_time,
        OrderStatus::Completed { result } => *result,
        OrderStatus::Cancelled { .. } => abort 0,
    }
}

public fun is_terminal(status: &OrderStatus): bool {
    match (status) {
        OrderStatus::Completed { .. } | OrderStatus::Cancelled { .. } => true,
        _ => false,
    }
}
```

### Pattern 9: Pure Functions & Composability

```move
/// Pure function — no object reads/writes, only computation.
/// Prefer pure helpers for logic that doesn't need on-chain state.
public fun calculate_fee(amount: u64, fee_bps: u64): u64 {
    amount * fee_bps / 10_000
}

public fun is_eligible(score: u64, threshold: u64): bool {
    score >= threshold
}

/// Compose pure helpers in entry/public functions
public fun purchase(
    marketplace: &mut Marketplace,
    payment: Coin<SUI>,
    ctx: &mut TxContext
) {
    let price = marketplace.price;
    let fee = calculate_fee(price, marketplace.fee_bps);
    assert!(payment.value() >= price + fee);
    // ...
}
```

### Pattern 10: Balance Burn (Send to Zero Address)

```move
/// Burn an object by transferring to the zero address.
/// Works for any object with `key + store`.
public fun burn_item(item: Item) {
    transfer::public_transfer(item, @0x0);
}

/// For coins, prefer coin::burn if you hold the TreasuryCap.
/// Otherwise, send to zero address:
public fun burn_coin(coin: Coin<SUI>) {
    transfer::public_transfer(coin, @0x0);
}
```

### Pattern 11: Witness & Capability Authorization

Use `Witness` types for type-level proof (proving the caller is a specific module) combined with `Cap` objects for runtime permission control. This dual-layer approach is widely used by production protocols for maximum security.

**Witness Pattern — Type-Level Proof:**
```move
module example::lending;

/// Witness proves the caller is this module.
/// Created only inside this module — cannot be forged.
public struct Witness has drop {}

/// External protocol calls this to register our lending pool.
/// The Witness proves we are the lending module, not an impersonator.
public fun register_pool(registry: &mut Registry) {
    registry::add_pool(Witness {}, pool_config());
}
```

**Witness + Capability — Dual Authorization:**
```move
module example::vault;

/// Type-level witness — proves module identity
public struct Witness has drop {}

/// Runtime capability — proves admin permission
public struct VaultAdminCap has key, store { id: UID }

/// Multi-tier capability hierarchy
public struct VaultOperatorCap has key, store {
    id: UID,
    max_withdrawal: u64,  // Operator has limited permissions
}

fun init(ctx: &mut TxContext) {
    transfer::transfer(
        VaultAdminCap { id: object::new(ctx) },
        ctx.sender()
    );
}

/// Admin-only: create operator capabilities with bounded permissions
public fun create_operator(
    _: &VaultAdminCap,
    max_withdrawal: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    transfer::transfer(
        VaultOperatorCap { id: object::new(ctx), max_withdrawal },
        recipient
    );
}

/// Operator can withdraw up to their limit
public fun operator_withdraw(
    vault: &mut Vault,
    cap: &VaultOperatorCap,
    amount: u64,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(amount <= cap.max_withdrawal, EExceedsOperatorLimit);
    coin::take(&mut vault.balance, amount, ctx)
}

/// Cross-module integration: witness proves identity, cap proves permission
public fun register_with_protocol(
    registry: &mut ProtocolRegistry,
    _admin: &VaultAdminCap,
) {
    // Witness proves we are the vault module
    // AdminCap proves the caller has admin permission
    protocol::register<Witness>(registry, Witness {});
}
```

**When to use which:**

| Pattern | Use Case |
|---------|----------|
| `Cap` only | Single-module admin control (most common) |
| `Witness` only | Cross-module type proof (e.g., registering with a registry) |
| `Witness` + `Cap` | Cross-module integration with permissioned access |
| Multi-tier `Cap` | Role-based access (admin > operator > viewer) |

**Key rules:**
- Witness structs: only `drop` ability, no fields, created only inside their module
- Cap structs: `key + store` abilities, created in `init` or admin functions
- Never store Caps in shared objects — they should be owned by addresses
- Prefer Cap over `ctx.sender()` checks — Caps are composable with other contracts

### Pattern 12: PTB-Composable Object Returns (Hot Potato)

Design functions to **return objects** instead of transferring or destructuring them. This enables callers to compose operations in a PTB, while hot potato patterns enforce that certain steps must be completed atomically.

**Anti-pattern: Transfer inside core logic**
```move
// ❌ Not composable — caller can't chain the result
public fun swap<X, Y>(
    pool: &mut Pool<X, Y>,
    coin_in: Coin<X>,
    ctx: &mut TxContext,
) {
    let coin_out = internal_swap(pool, coin_in);
    transfer::public_transfer(coin_out, ctx.sender()); // ❌ locks the result
}
```

**Composable pattern: Return objects**
```move
// ✅ Composable — caller decides what to do with the result
public fun swap<X, Y>(
    pool: &mut Pool<X, Y>,
    coin_in: Coin<X>,
): Coin<Y> {
    // Return the coin — let the PTB chain it into the next operation
    internal_swap(pool, coin_in)
}

// ✅ Also return excess/remainder coins
public fun swap_exact_out<X, Y>(
    pool: &mut Pool<X, Y>,
    coin_in: Coin<X>,
    exact_out: u64,
): (Coin<Y>, Coin<X>) {
    // Returns both output coin AND remaining input coin
    let (out, remainder) = internal_swap_exact(pool, coin_in, exact_out);
    (out, remainder)  // Caller handles both
}
```

**Hot Potato pattern: Enforce atomic completion**
```move
/// Hot potato — no abilities, MUST be consumed in the same PTB
public struct FlashLoanReceipt {
    pool_id: ID,
    amount: u64,
}

/// Step 1: Borrow — returns coins AND a receipt that must be repaid
public fun flash_borrow(
    pool: &mut Pool,
    amount: u64,
    ctx: &mut TxContext,
): (Coin<SUI>, FlashLoanReceipt) {
    let coin = coin::take(&mut pool.balance, amount, ctx);
    let receipt = FlashLoanReceipt {
        pool_id: object::id(pool),
        amount,
    };
    (coin, receipt)  // Both must be handled in the same PTB
}

/// Step 2: Repay — consumes the hot potato
public fun flash_repay(
    pool: &mut Pool,
    payment: Coin<SUI>,
    receipt: FlashLoanReceipt,
) {
    let FlashLoanReceipt { pool_id, amount } = receipt;
    assert!(object::id(pool) == pool_id, EWrongPool);
    assert!(payment.value() >= amount, EInsufficientRepayment);
    pool.balance.join(payment.into_balance());
    // receipt is destructured and consumed — hot potato resolved
}
```

**Multi-step composable flow with constraints:**
```move
/// Hot potato enforces that configure() is called before use
public struct SetupReceipt {
    config_applied: bool,
}

/// Step 1: Create a session — returns hot potato
public fun begin_session(app: &mut App): SetupReceipt {
    SetupReceipt { config_applied: false }
}

/// Step 2: Configure — updates the hot potato
public fun configure_session(
    receipt: SetupReceipt,
    params: vector<u8>,
): SetupReceipt {
    let SetupReceipt { .. } = receipt;
    // Apply configuration...
    SetupReceipt { config_applied: true }
}

/// Step 3: Execute — consumes the hot potato (must be configured)
public fun execute_session(
    app: &mut App,
    receipt: SetupReceipt,
): ActionResult {
    let SetupReceipt { config_applied } = receipt;
    assert!(config_applied, ENotConfigured);
    // Execute and return result object
    create_result(app)
}
```

**Composability rules:**
1. **Return, don't transfer** — let callers decide where objects go
2. **Return excess** — even zero-value remainders; let callers handle them
3. **Hot potatoes for constraints** — structs with no abilities enforce PTB-atomic steps
4. **No `entry` on composable functions** — use `public` so other packages can call them
5. **entry for final endpoints only** — use `entry` (without `public`) when you want a PTB-only endpoint that wraps composable functions with transfer logic

---

## Complete Security Checklist

### Access Control

- [ ] All admin functions protected by capability
- [ ] No hardcoded addresses for authorization
- [ ] Capabilities cannot be accidentally copied or duplicated
- [ ] Transfer functions properly restrict who can transfer
- [ ] No privilege escalation paths

### Integer Safety

- [ ] All arithmetic operations checked for overflow/underflow
- [ ] Division operations check for zero divisor
- [ ] Percentage calculations use basis points (avoid precision loss)
- [ ] Large numbers use u128 or u256 when needed
- [ ] No unchecked type conversions

### Object Safety

- [ ] Shared objects handle concurrent access safely
- [ ] No dangling object references
- [ ] Objects properly destroyed when no longer needed
- [ ] Dynamic fields cleaned up before object deletion
- [ ] No object ID collisions possible

### Capability Safety

- [ ] Capabilities only created in init or protected functions
- [ ] Capabilities cannot escape through public functions
- [ ] No capability stored in public/shared objects
- [ ] Capability transfer is intentional and controlled
- [ ] One-time capabilities properly consumed

### Event Completeness

- [ ] All state changes emit events
- [ ] Events contain sufficient info for frontend
- [ ] Event names clearly describe what happened
- [ ] Sensitive data not exposed in events
- [ ] Event timestamps included where relevant

### Gas Optimization

- [ ] Vector operations minimized in hot paths
- [ ] Avoid repeated vector length calls (cache it)
- [ ] Use appropriate data structures (Table vs vector)
- [ ] Batch operations where possible
- [ ] Minimal storage in shared objects

### Error Handling

- [ ] All error codes defined as constants
- [ ] Use `#[error]` macro for human-readable messages where possible
- [ ] All inputs validated
- [ ] Proper assertions before critical operations
- [ ] No silent failures

### Documentation

- [ ] All public functions have doc comments
- [ ] Complex logic explained
- [ ] Assumptions documented
- [ ] Frontend integration examples provided
- [ ] Security considerations noted

---

## Security Patterns Reference

### Reentrancy Protection

**Status:** SUI's object model prevents reentrancy

Move's ownership model ensures objects can only be accessed by one function at a time. External calls during mutable borrows are not possible.

```move
// This is safe in Move (unlike Solidity)
public fun withdraw(vault: &mut Vault, amount: u64, ctx: &mut TxContext) {
    // Transfer happens atomically
    let coin = coin::take(&mut vault.balance, amount, ctx);
    transfer::public_transfer(coin, ctx.sender());

    // No reentrancy possible - object was mutably borrowed
}
```

### Front-Running Protection

**For auctions/bids:**

```move
// Option 1: Commit-reveal scheme
public struct Bid has store {
    commitment: vector<u8>,  // hash(amount + salt)
    revealed: bool
}

public fun commit_bid(auction: &mut Auction, commitment: vector<u8>, ctx: &mut TxContext) {
    // Store commitment
}

public fun reveal_bid(auction: &mut Auction, amount: u64, salt: vector<u8>, ctx: &mut TxContext) {
    // Verify: hash(amount + salt) == commitment
    // Process bid
}

// Option 2: Minimum time between actions
public fun place_bid(auction: &mut Auction, amount: u64, ctx: &mut TxContext) {
    let last_bid_time = auction.last_bid_time;
    let current_time = ctx.epoch();

    assert!(current_time >= last_bid_time + MIN_BID_INTERVAL, ETooFast);
    // Process bid
}
```

### Shared Object Race Conditions

```move
// Bad: Multiple users can withdraw more than balance
public fun unsafe_withdraw(vault: &mut Vault, amount: u64, ctx: &mut TxContext) {
    // Race condition: balance checked but not decremented atomically
    assert!(vault.balance >= amount, EInsufficientBalance);

    // Another transaction could withdraw here!

    let coin = coin::take(&mut vault.balance, amount, ctx);
    transfer::public_transfer(coin, ctx.sender());
}

// Good: Atomic check and update
public fun safe_withdraw(vault: &mut Vault, amount: u64, ctx: &mut TxContext) {
    // coin::take does atomic check and update
    let coin = coin::take(&mut vault.balance, amount, ctx);
    transfer::public_transfer(coin, ctx.sender());
}
```

### Authorization Bypass

```move
// Bad: Address check
public fun admin_function(ctx: &TxContext) {
    assert!(ctx.sender() == @0x123, ENotAdmin);
    // Anyone can deploy contract with this address
}

// Good: Capability check
public fun admin_function(_: &AdminCap, ctx: &TxContext) {
    // Only admin cap holder can call
}
```

---

## Gas Optimization Patterns

### Pattern 1: Cache Vector Length

```move
// Bad: Multiple length calls
public fun process_items(items: &vector<Item>) {
    let mut i = 0;
    while (i < items.length()) {  // Called every iteration!
        let item = &items[i];
        // process item
        i = i + 1;
    }
}

// Good: Cache length
public fun process_items(items: &vector<Item>) {
    let len = items.length();  // Called once
    let mut i = 0;
    while (i < len) {
        let item = &items[i];
        // process item
        i = i + 1;
    }
}
```

### Pattern 2: Use Table for Large Collections

```move
use sui::table::{Self, Table};

// Bad: Large vector in shared object
public struct Marketplace has key {
    id: UID,
    all_listings: vector<Listing>  // Expensive to modify
}

// Good: Use Table
public struct Marketplace has key {
    id: UID,
    listings: Table<ID, Listing>,  // O(1) access
    listing_count: u64
}
```

### Pattern 3: Batch Operations

```move
// Bad: Multiple transactions
// User calls this 10 times = 10 transactions

public fun claim_single_reward(farm: &mut Farm, ctx: &mut TxContext) {
    // claim one reward
}

// Good: Single transaction
public fun claim_all_rewards(farm: &mut Farm, ctx: &mut TxContext) {
    // claim all rewards in one transaction
}
```

### Pattern 4: Minimize Storage

```move
// Bad: Redundant storage
public struct Listing has key, store {
    id: UID,
    nft_id: ID,
    nft_name: String,        // Redundant (stored in NFT)
    nft_description: String, // Redundant
    nft_image_url: String,   // Redundant
}

// Good: Reference by ID
public struct Listing has key, store {
    id: UID,
    nft_id: ID,  // Query NFT object for details
    price: u64
}
```

---

## Testing Patterns (Move 2024)

### Basic Test Structure

```move
#[test]
fun test_create_marketplace() {
    let mut ctx = tx_context::dummy();
    let marketplace = create_marketplace(&mut ctx);

    assert_eq!(marketplace.version, 1);
    assert_eq!(marketplace.paused, false);

    test_utils::destroy(marketplace);
}

#[test]
#[expected_failure(abort_code = EWrongVersion)]
fun test_migrate_wrong_version() {
    let mut ctx = tx_context::dummy();
    let mut marketplace = create_marketplace(&mut ctx);
    marketplace.version = 99;

    let admin = AdminCap { id: object::new(&mut ctx) };
    migrate(&mut marketplace, &admin);

    test_utils::destroy(marketplace);
    test_utils::destroy(admin);
}
```

### Key Testing APIs

- `tx_context::dummy()` — create a test TxContext
- `assert_eq!(a, b)` — equality assertion (preferred over `assert!(a == b, code)`)
- `test_utils::destroy(obj)` — destroy any object in tests (avoids writing custom destructors)
- `test_scenario::begin(sender)` — start a multi-tx test scenario

---

## Frontend Integration Patterns

### Event Design for Frontend

```move
/// Complete event with all frontend needs
public struct ListingCreated has copy, drop {
    // IDs for object references
    listing_id: ID,
    nft_id: ID,

    // User addresses
    seller: address,

    // Amounts and prices
    price: u64,

    // Timestamps
    created_at: u64,
    expires_at: Option<u64>,

    // Frontend display
    payment_token: String,  // "SUI" or "USDC"
}
```

### TypeScript Type Mapping

| Move Type | TypeScript Type | Notes |
|-----------|----------------|-------|
| `u8` | `number` | 0-255 |
| `u64` | `number \| bigint` | Use bigint for large values |
| `u128` | `bigint` | Always use bigint |
| `u256` | `bigint` | Always use bigint |
| `bool` | `boolean` | - |
| `address` | `string` | Hex string with 0x prefix |
| `vector<u8>` | `Uint8Array` | Byte array |
| `String` | `string` | UTF-8 string |
| `ID` | `string` | Object ID (hex) |
| `UID` | `string` | Object UID (hex) |
| `Option<T>` | `T \| null` | Nullable type |

---

## Advanced Configuration Options

```json
{
  "quality_mode": "strict",
  "auto_format": true,
  "generate_types": true,

  "frontend_integration": {
    "enabled": true,
    "output_dir": "frontend/src/types",
    "watch_mode": true
  },

  "checks": {
    "security": {
      "enabled": true,
      "level": "strict",
      "custom_rules": []
    },
    "gas_optimization": {
      "enabled": true,
      "report_threshold": 1000000
    },
    "documentation": {
      "enabled": true,
      "require_examples": true
    },
    "naming_conventions": {
      "enabled": true,
      "snake_case_functions": true,
      "pascal_case_structs": true,
      "upper_case_constants": true
    }
  },

  "patterns": {
    "use_capabilities": true,
    "emit_events": true,
    "validate_inputs": true,
    "safe_math": true,
    "version_shared_objects": true
  },

  "git_hooks": {
    "pre_commit": "strict",
    "pre_push": "strict"
  }
}
```

---

This reference guide provides complete patterns, security checklists, and best practices for SUI Move development.
