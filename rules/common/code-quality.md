---
paths: "**/*.move"
---

# Code Quality Standards

## Function Length
- **Max function length: 50 lines**
- Complex logic should be split into helper functions
- Entry functions should be simple orchestrators
- If a function exceeds 50 lines, refactor into smaller pieces

```move
// BAD: 80-line monster function
public entry fun complex_operation(...) {
    // 80 lines of logic
}

// GOOD: Split into logical pieces
public entry fun complex_operation(...) {
    validate_inputs(...);
    let result = compute_value(...);
    finalize_operation(result, ...);
}

fun validate_inputs(...) { /* 10 lines */ }
fun compute_value(...): u64 { /* 15 lines */ }
fun finalize_operation(...) { /* 12 lines */ }
```

## Module Length
- **Max module length: 500 lines**
- If module exceeds 500 lines, consider splitting by functionality
- Separate concerns into different modules
- Keep related functionality together

Example split:
- `nft.move` (core NFT logic) - 300 lines
- `nft_marketplace.move` (marketplace) - 250 lines
- `nft_utils.move` (helpers) - 150 lines

## Documentation

### Public Functions Must Be Documented
- Use `///` for documentation comments
- Explain purpose, parameters, return values
- Document any invariants or assumptions
- Note any error conditions

```move
/// Mints a new NFT and transfers it to the recipient.
///
/// # Parameters
/// - `name`: The name of the NFT (must not be empty)
/// - `description`: Description of the NFT
/// - `url`: Image URL for the NFT
/// - `recipient`: Address to receive the newly minted NFT
/// - `ctx`: Transaction context
///
/// # Errors
/// - `E_INVALID_NAME`: If name is empty
/// - `E_MAX_SUPPLY_REACHED`: If collection is at max supply
///
/// # Gas Cost
/// Approximately 50k gas units
public entry fun mint_nft(
    name: String,
    description: String,
    url: String,
    recipient: address,
    ctx: &mut TxContext
) {
    // Implementation
}
```

### Module-Level Documentation
- Add module documentation at the top
- Explain the purpose and main functionality
- List key types and patterns used

```move
/// # NFT Marketplace
///
/// This module implements a decentralized NFT marketplace with:
/// - Listing and delisting of NFTs
/// - Direct purchase with SUI
/// - Offer/bid system
/// - Royalty payments to creators
///
/// ## Key Types
/// - `Marketplace`: Shared object for the marketplace
/// - `Listing`: Represents an NFT for sale
/// - `Offer`: Represents a bid on an NFT
module project::nft_marketplace {
    // Module implementation
}
```

## Magic Numbers

### Use Constants Instead of Magic Numbers
- Define constants at module level
- Use descriptive names in SCREAMING_SNAKE_CASE
- Add comments explaining the value

```move
// BAD: Magic numbers
public fun calculate_fee(amount: u64): u64 {
    amount * 250 / 10000
}

// GOOD: Named constants
const FEE_NUMERATOR: u64 = 250;        // 2.5% fee
const FEE_DENOMINATOR: u64 = 10000;    // Basis points
const MIN_PRICE: u64 = 1_000_000_000;  // 1 SUI minimum

public fun calculate_fee(amount: u64): u64 {
    amount * FEE_NUMERATOR / FEE_DENOMINATOR
}
```

## Error Handling Patterns

### Consistent Error Handling
- Define all error codes at top of module
- Use descriptive error names
- Document what triggers each error
- Use assertions liberally

```move
// Error codes
const E_NOT_AUTHORIZED: u64 = 0;
const E_INSUFFICIENT_BALANCE: u64 = 1;
const E_INVALID_AMOUNT: u64 = 2;
const E_ALREADY_EXISTS: u64 = 3;
const E_NOT_FOUND: u64 = 4;

public fun process_payment(amount: u64, balance: u64) {
    assert!(amount > 0, E_INVALID_AMOUNT);
    assert!(balance >= amount, E_INSUFFICIENT_BALANCE);
    // Process payment
}
```

### Error Messages in Tests
- Use descriptive error messages in tests
- Include context about what failed

```move
#[test]
fun test_transfer() {
    let balance = get_balance();
    assert!(balance == 100, 0); // BAD: What does 0 mean?

    assert!(balance == 100, E_UNEXPECTED_BALANCE); // GOOD
}
```

## Code Organization

### Logical Grouping
1. Module documentation
2. Imports (grouped and sorted)
3. Constants (errors, then config)
4. Structs (public, then private)
5. Init function
6. Public entry functions
7. Public functions
8. Internal functions
9. Test module

### Function Visibility
- Use `public entry` for user-facing endpoints
- Use `public` for functions called by other modules
- Use `public(package)` for internal package functions
- Default (no visibility) for private helpers

## Naming Conventions

### Clear, Descriptive Names
- Functions: `verb_noun` (e.g., `mint_nft`, `transfer_coin`)
- Structs: `PascalCase` nouns (e.g., `NFTCollection`, `AdminCap`)
- Constants: `SCREAMING_SNAKE_CASE`
- Variables: `snake_case`

### Avoid Abbreviations
```move
// BAD
fun proc_tx(amt: u64, rcpt: address) {}

// GOOD
fun process_transaction(amount: u64, recipient: address) {}
```

## Comments

### When to Comment
- **Do**: Explain WHY, not WHAT
- **Do**: Document complex algorithms
- **Do**: Note invariants and assumptions
- **Don't**: State the obvious
- **Don't**: Leave commented-out code

```move
// BAD: States the obvious
// Increment counter by 1
counter = counter + 1;

// GOOD: Explains why
// Skip version 13 for superstitious users
if counter == 12 {
    counter = 14;
}

// GOOD: Documents invariant
// Invariant: total_supply <= max_supply
assert!(total_supply <= max_supply, E_SUPPLY_EXCEEDED);
```

## Performance Considerations

### Document Gas-Heavy Operations
- Note expensive operations in comments
- Consider gas costs in design
- Batch operations when possible

```move
/// Batch mint multiple NFTs to save on transaction overhead.
/// Gas cost: ~40k per NFT + 20k base cost
public entry fun batch_mint(
    names: vector<String>,
    recipients: vector<address>,
    ctx: &mut TxContext
) {
    // Implementation
}
```

## Type Safety

### Use Strong Types Over Primitives
- Wrap primitives in meaningful types when appropriate
- Use phantom types for type safety
- Leverage Move's type system

```move
// WEAK: Just a u64
public fun set_price(price: u64) {}

// STRONGER: Coin type provides context
public fun set_price(price: Coin<SUI>) {}

// STRONGEST: Custom type with validation
struct Price has store, drop {
    amount: u64,
    currency: TypeName,
}
```

## Quality Checklist

- [ ] No function exceeds 50 lines
- [ ] No module exceeds 500 lines
- [ ] All public functions documented
- [ ] No magic numbers (use constants)
- [ ] Consistent error handling with error codes
- [ ] Clear, descriptive names (no abbreviations)
- [ ] Comments explain WHY, not WHAT
- [ ] Code follows import/organization conventions
- [ ] Gas-heavy operations documented
- [ ] Strong types used where appropriate
