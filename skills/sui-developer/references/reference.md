# SUI Developer - Reference Guide

Complete reference for Move patterns, security checks, and best practices.

## Common Move Patterns Library

### Pattern 1: Capability-Based Administration

```move
// Define capability
public struct AdminCap has key, store {
    id: UID
}

// Initialize (called once during package publish)
fun init(ctx: &mut TxContext) {
    transfer::transfer(
        AdminCap { id: object::new(ctx) },
        tx_context::sender(ctx)
    );
}

// Admin-only function
public fun admin_only_function(
    _: &AdminCap,
    // ... other parameters
    ctx: &mut TxContext
) {
    // Only callable by admin cap holder
}

// Transfer admin rights
public fun transfer_admin(
    cap: AdminCap,
    recipient: address
) {
    transfer::transfer(cap, recipient);
}
```

### Pattern 2: Witness Pattern (One-Time Init)

```move
// Witness struct (must match module name in UPPERCASE)
public struct MARKETPLACE has drop {}

// Called once during package publish
fun init(witness: MARKETPLACE, ctx: &mut TxContext) {
    // Witness can only be created by init
    // Use for one-time-key (OTW) pattern

    // Example: Create publisher object
    let publisher = package::claim(witness, ctx);
    transfer::public_transfer(publisher, tx_context::sender(ctx));
}
```

### Pattern 3: Shared Object with Versioning

```move
public struct Marketplace has key {
    id: UID,
    version: u64,  // Track version for upgrades
    // ... other fields
}

public fun create_marketplace(ctx: &mut TxContext) {
    let marketplace = Marketplace {
        id: object::new(ctx),
        version: 1,
    };
    transfer::share_object(marketplace);
}

// Migration function
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

// Add metadata without changing struct
public fun add_metadata<K: copy + drop + store, V: store>(
    object: &mut SomeObject,
    key: K,
    value: V
) {
    df::add(&mut object.id, key, value);
}

// Read metadata
public fun get_metadata<K: copy + drop + store, V: store>(
    object: &SomeObject,
    key: K
): &V {
    df::borrow(&object.id, key)
}

// Remove metadata
public fun remove_metadata<K: copy + drop + store, V: store>(
    object: &mut SomeObject,
    key: K
): V {
    df::remove(&mut object.id, key)
}
```

### Pattern 5: Safe Math Operations

```move
const EOverflow: u64 = 1;
const EUnderflow: u64 = 2;
const EDivisionByZero: u64 = 3;

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

// Define events
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

// Emit events
public fun create_item(ctx: &mut TxContext) {
    let item_id = object::new(ctx);
    let item_id_copy = object::uid_to_inner(&item_id);

    // ... create item logic

    event::emit(ItemCreated {
        item_id: item_id_copy,
        creator: tx_context::sender(ctx),
        created_at: tx_context::epoch(ctx)
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

const EContractPaused: u64 = 100;

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

// Use in functions
public fun some_action(marketplace: &Marketplace, ...) {
    assert!(!marketplace.paused, EContractPaused);
    // ... rest of logic
}
```

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
- [ ] Error messages descriptive (where safe)
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

**Status:** ✅ SUI's object model prevents reentrancy

Move's ownership model ensures objects can only be accessed by one function at a time. External calls during mutable borrows are not possible.

```move
// This is safe in Move (unlike Solidity)
public fun withdraw(vault: &mut Vault, amount: u64, ctx: &mut TxContext) {
    let balance = vault.balance;

    // Transfer happens atomically
    let coin = coin::take(&mut vault.balance, amount, ctx);
    transfer::public_transfer(coin, tx_context::sender(ctx));

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
    let current_time = tx_context::epoch(ctx);

    assert!(current_time >= last_bid_time + MIN_BID_INTERVAL, ETooFast);
    // Process bid
}
```

### Shared Object Race Conditions

```move
// ❌ Unsafe: Multiple users can withdraw more than balance
public fun unsafe_withdraw(vault: &mut Vault, amount: u64, ctx: &mut TxContext) {
    // Race condition: balance checked but not decremented atomically
    assert!(vault.balance >= amount, EInsufficientBalance);

    // Another transaction could withdraw here!

    let coin = coin::take(&mut vault.balance, amount, ctx);
    transfer::public_transfer(coin, tx_context::sender(ctx));
}

// ✅ Safe: Atomic check and update
public fun safe_withdraw(vault: &mut Vault, amount: u64, ctx: &mut TxContext) {
    // coin::take does atomic check and update
    let coin = coin::take(&mut vault.balance, amount, ctx);
    transfer::public_transfer(coin, tx_context::sender(ctx));
}
```

### Authorization Bypass

```move
// ❌ Bad: Address check
public fun admin_function(ctx: &TxContext) {
    assert!(tx_context::sender(ctx) == @0x123, ENotAdmin);
    // Anyone can deploy contract with this address
}

// ✅ Good: Capability check
public fun admin_function(_: &AdminCap, ctx: &TxContext) {
    // Only admin cap holder can call
}
```

---

## Gas Optimization Patterns

### Pattern 1: Cache Vector Length

```move
// ❌ Expensive: Multiple length calls
public fun process_items(items: &vector<Item>) {
    let mut i = 0;
    while (i < vector::length(items)) {  // Called every iteration!
        let item = vector::borrow(items, i);
        // process item
        i = i + 1;
    }
}

// ✅ Efficient: Cache length
public fun process_items(items: &vector<Item>) {
    let len = vector::length(items);  // Called once
    let mut i = 0;
    while (i < len) {
        let item = vector::borrow(items, i);
        // process item
        i = i + 1;
    }
}
```

### Pattern 2: Use Table for Large Collections

```move
use sui::table::{Self, Table};

// ❌ Expensive: Large vector in shared object
public struct Marketplace has key {
    id: UID,
    all_listings: vector<Listing>  // Expensive to modify
}

// ✅ Efficient: Use Table
public struct Marketplace has key {
    id: UID,
    listings: Table<ID, Listing>,  // O(1) access
    listing_count: u64
}
```

### Pattern 3: Batch Operations

```move
// ❌ Expensive: Multiple transactions
// User calls this 10 times = 10 transactions

public fun claim_single_reward(farm: &mut Farm, ctx: &mut TxContext) {
    // claim one reward
}

// ✅ Efficient: Single transaction
public fun claim_all_rewards(farm: &mut Farm, ctx: &mut TxContext) {
    // claim all rewards in one transaction
}
```

### Pattern 4: Minimize Storage

```move
// ❌ Expensive: Redundant storage
public struct Listing has key, store {
    id: UID,
    nft_id: ID,
    nft_name: String,        // Redundant (stored in NFT)
    nft_description: String, // Redundant
    nft_image_url: String,   // Redundant
}

// ✅ Efficient: Reference by ID
public struct Listing has key, store {
    id: UID,
    nft_id: ID,  // Query NFT object for details
    price: u64
}
```

---

## Frontend Integration Patterns

### Event Design for Frontend

```move
// Complete event with all frontend needs
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
