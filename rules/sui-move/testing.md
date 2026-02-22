---
paths: "**/tests/**/*.move"
---

# Sui Move Testing Conventions

## Test Coverage Requirements

### Every Public Function Needs a Test
- All `public` and `entry` functions must have at least one test
- Test both success and failure cases
- Document what each test validates

## Test Module Structure

### Use #[test_only] Module

```move
#[test_only]
module project::nft_tests;

use sui::test_scenario::{Self, Scenario};
use sui::test_utils;
use project::nft::{Self, NFT, AdminCap};

const ADMIN: address = @0xAD;
const USER: address = @0x1;

#[test]
fun mint_nft() {
    // Test implementation
}
```

### Naming

`#[test]` attribute is sufficient — `test_` prefix is optional, not required. Use descriptive names: `<action>_<scenario>_<expected>`.

### Simple Tests — Use `tx_context::dummy()`

Don't reach for `test_scenario` when `tx_context::dummy()` suffices:

```move
#[test]
fun create_object() {
    let mut ctx = tx_context::dummy();
    let obj = nft::create(&mut ctx);
    sui::test_utils::destroy(obj);
}
```

## Integration Tests with test_scenario

### Use test_scenario for Multi-Transaction Tests

```move
#[test]
fun nft_transfer() {
    let mut scenario = test_scenario::begin(ADMIN);

    // Transaction 1: Mint NFT
    {
        nft::mint_nft(b"Test NFT".to_string(), USER, scenario.ctx());
    };

    // Transaction 2: Check USER received NFT
    scenario.next_tx(USER);
    {
        let nft = scenario.take_from_sender<NFT>();
        assert_eq!(nft.name(), b"Test NFT".to_string());
        scenario.return_to_sender(nft);
    };

    scenario.end();
}
```

### Test Scenario Best Practices
- Use `scenario.next_tx(sender)` to switch transactions
- Use `scenario.take_from_sender<T>()` to retrieve owned objects
- Use `scenario.take_shared<T>()` for shared objects
- Always return objects with `scenario.return_to_sender()` or `scenario.return_shared()`
- Call `scenario.end()` to clean up

## Assertions

- Prefer `assert_eq!` over `assert!(a == b)` — shows both sides on failure
- **Never pass abort codes to `assert!`** — conflicts with app error codes

```move
// Good
assert_eq!(nft.name(), b"Test NFT".to_string());
assert!(nft.is_active());

// Bad
assert!(nft.name() == b"Test NFT".to_string(), 0);
```

## Cleanup

Use `sui::test_utils::destroy(obj)` for cleanup — don't write custom `destroy_for_testing` functions.

## Error Testing

### Use #[expected_failure] for Error Cases

Merge attributes on one line. Expected failure tests don't need cleanup (`scenario.end()` not required).

```move
#[test, expected_failure(abort_code = nft::ENotAuthorized)]
fun unauthorized_mint() {
    let mut scenario = test_scenario::begin(USER);
    {
        let admin_cap = scenario.take_from_sender<AdminCap>();
        // This should fail - USER doesn't own AdminCap
    };
}

#[test, expected_failure(abort_code = nft::EInvalidAmount)]
fun zero_amount_fails() {
    let mut ctx = tx_context::dummy();
    nft::mint_with_amount(0, &mut ctx);
}
```

## Multiple Signers

### Test with Different Addresses

```move
const ADMIN: address = @0xAD;
const USER1: address = @0x1;
const USER2: address = @0x2;
const ATTACKER: address = @0xBAD;

#[test]
fun transfer_between_users() {
    let mut scenario = test_scenario::begin(ADMIN);

    // ADMIN mints to USER1
    {
        nft::mint_nft(b"NFT".to_string(), USER1, scenario.ctx());
    };

    // USER1 transfers to USER2
    scenario.next_tx(USER1);
    {
        let nft = scenario.take_from_sender<NFT>();
        transfer::public_transfer(nft, USER2);
    };

    // USER2 owns the NFT
    scenario.next_tx(USER2);
    {
        let nft = scenario.take_from_sender<NFT>();
        scenario.return_to_sender(nft);
    };

    scenario.end();
}
```

## Epoch and Time Testing

### Test with Clock and Epochs

```move
#[test]
fun time_locked_feature() {
    let mut scenario = test_scenario::begin(ADMIN);

    {
        let mut clock = clock::create_for_testing(scenario.ctx());
        clock.set_for_testing(1000);

        nft::time_locked_mint(&clock, scenario.ctx());

        clock.destroy_for_testing();
    };

    scenario.end();
}
```

## Gas Benchmarks

### Profile Gas Usage for Critical Paths
- Run with `sui move test --gas-limit 1000000000`
- Document expected gas costs
- Flag unexpectedly expensive operations

## Running Tests

```bash
# Run all tests
sui move test

# Run tests with gas profiling
sui move test --gas-limit 1000000000

# Run specific test
sui move test mint_nft

# Run with verbose output
sui move test -v

# Run with coverage
sui move test --coverage
```

## Testing Checklist

- [ ] Every public function has at least one test
- [ ] Error cases tested with `#[expected_failure]`
- [ ] Multi-transaction flows tested with `test_scenario`
- [ ] Access control validated (unauthorized access fails)
- [ ] Edge cases covered (zero amounts, max values, empty strings)
- [ ] Gas costs documented for expensive operations
- [ ] Time/epoch-dependent logic tested with mocks
- [ ] Cleanup uses `test_utils::destroy()`, not custom functions
