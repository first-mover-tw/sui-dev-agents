# Sui Move Security Best Practices

## Access Control

### Never Transfer Without Checks
- Always verify ownership before transferring objects
- Use capability pattern for privileged operations
- Check sender matches expected address when needed

```move
// BAD: No access check
public entry fun admin_action(ctx: &mut TxContext) {
    // Anyone can call this!
}

// GOOD: Capability check
public entry fun admin_action(_admin: &AdminCap, ctx: &mut TxContext) {
    // Only AdminCap holder can call
}
```

### Capability-Based Access Over Address Checks
- Prefer capabilities (`AdminCap`, `MintCap`) over hardcoded addresses
- Capabilities are transferable and composable
- Address checks are brittle and hard to update

```move
// AVOID: Hardcoded address check
const ADMIN_ADDRESS: address = @0x123;
assert!(tx_context::sender(ctx) == ADMIN_ADDRESS, E_NOT_AUTHORIZED);

// PREFER: Capability pattern
public entry fun privileged_action(_admin: &AdminCap, ctx: &mut TxContext) {
    // Capability proves authorization
}
```

## Input Validation

### Validate All User Inputs at Entry Points
- Check for zero amounts, empty strings, invalid ranges
- Validate before expensive operations
- Use meaningful error codes

```move
public entry fun transfer_amount(amount: u64, ctx: &mut TxContext) {
    assert!(amount > 0, E_INVALID_AMOUNT);
    assert!(amount <= MAX_TRANSFER, E_EXCEEDS_LIMIT);
    // Process transfer
}
```

### Check Object States
- Verify object hasn't been used/consumed if needed
- Check timestamp/epoch validity
- Validate relationships between objects

## Type Authority

### Use Witness Pattern
- One-time-use type proves authority at module initialization
- Prevents unauthorized creation of certain types
- Pattern: `struct WITNESS has drop {}`

```move
struct WITNESS has drop {}

fun init(witness: WITNESS, ctx: &mut TxContext) {
    // witness can only be created by init
    let publisher = package::claim(witness, ctx);
    // Use publisher for type authority
}
```

### Protect Type Creation
- Don't expose constructors for sensitive types
- Use witness or capability patterns
- Ensure only authorized code can create certain objects

## Object Transfer Safety

### Public Transfer vs Private Transfer
- Use `transfer::public_transfer` for objects with `store` ability
- Use `transfer::transfer` for objects without `store` (more restrictive)
- Don't give `store` ability unless object should be composable

```move
// NFT should be transferable and storable
struct NFT has key, store { id: UID, ... }

// Capability should be transferable but carefully
struct AdminCap has key, store { id: UID }

// Singleton should not be transferable
struct Registry has key { id: UID, ... }
```

### Avoid Accidental Public Transfer
- Objects with `store` can be wrapped/transferred freely
- Remove `store` if object should have transfer restrictions
- Use custom transfer functions for business logic

## Enforce Sequential Operations (Hot Potato)

### Hot Potato Pattern
- Struct without abilities forces return or destruction
- Ensures function sequence is completed
- Use for multi-step operations

```move
struct Receipt { amount: u64 }

public fun start_operation(): Receipt {
    Receipt { amount: 100 }
}

public fun complete_operation(receipt: Receipt) {
    let Receipt { amount } = receipt;
    // Must be called to destroy receipt
}
```

## Time-Based Validation

### Clock-Based Timestamps
- Use `sui::clock::Clock` for on-chain time
- Don't trust client-provided timestamps
- Validate time windows for time-sensitive operations

```move
use sui::clock::{Self, Clock};

public entry fun time_locked_action(
    clock: &Clock,
    unlock_time: u64,
    ctx: &mut TxContext
) {
    let current_time = clock::timestamp_ms(clock);
    assert!(current_time >= unlock_time, E_TOO_EARLY);
    // Proceed with action
}
```

## Reentrancy Protection

### Sui's Move VM Prevents Classic Reentrancy
- No external calls during execution
- All effects are atomic
- But still validate object states if they're shared

### Shared Object Concurrency
- Shared objects can be accessed concurrently
- Use version/epoch fields for optimistic locking
- Check for unexpected state changes

```move
struct SharedPool has key {
    id: UID,
    version: u64,
    balance: u64,
}

public fun update_pool(pool: &mut SharedPool, expected_version: u64) {
    assert!(pool.version == expected_version, E_VERSION_MISMATCH);
    pool.version = pool.version + 1;
    // Update pool state
}
```

## Arithmetic Safety

### Check for Overflow/Underflow
- Move aborts on overflow/underflow by default
- Use checked arithmetic when needed
- Validate ranges before operations

```move
public fun safe_subtract(a: u64, b: u64): u64 {
    assert!(a >= b, E_INSUFFICIENT_BALANCE);
    a - b
}
```

## Common Vulnerabilities to Avoid

1. **Missing access control** - Always verify who can call what
2. **Unchecked transfers** - Validate before transferring ownership
3. **Integer overflow** - Be aware of limits (u64 max = 18,446,744,073,709,551,615)
4. **Unvalidated inputs** - Check amounts, addresses, lengths
5. **Exposed internal functions** - Keep implementation details private
6. **Missing capability checks** - Don't forget to use the capability parameter
7. **Incorrect ability usage** - Understand key/store/copy/drop implications
