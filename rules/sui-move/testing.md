---
paths: "**/tests/**/*.move"
---

# Sui Move Testing Conventions

## Test Coverage Requirements

### Every Public Function Needs a Test
- All `public` and `public entry` functions must have at least one test
- Test both success and failure cases
- Document what each test validates

## Test Module Structure

### Use #[test_only] Module
- Create companion test module in same file or separate test file
- Import module under test
- Keep test helpers isolated

```move
#[test_only]
module project::nft_tests {
    use sui::test_scenario::{Self, Scenario};
    use sui::test_utils;
    use project::nft::{Self, NFT, AdminCap};

    const ADMIN: address = @0xAD;
    const USER: address = @0x1;

    #[test]
    fun test_mint_nft() {
        // Test implementation
    }
}
```

## Integration Tests with test_scenario

### Use test_scenario for Multi-Transaction Tests
- Simulate multiple transactions and signers
- Test object ownership transfers
- Validate state changes across transactions

```move
#[test]
fun test_nft_transfer() {
    let mut scenario = test_scenario::begin(ADMIN);

    // Transaction 1: Mint NFT
    {
        nft::mint_nft(string::utf8(b"Test NFT"), USER, scenario.ctx());
    };

    // Transaction 2: Check USER received NFT
    scenario.next_tx(USER);
    {
        let nft = scenario.take_from_sender<NFT>();
        assert!(nft.name() == string::utf8(b"Test NFT"), 0);
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

## Error Testing

### Use #[expected_failure] for Error Cases
- Test that functions abort with correct error codes
- Validate input validation logic
- Test access control failures

```move
#[test]
#[expected_failure(abort_code = nft::E_NOT_AUTHORIZED)]
fun test_unauthorized_mint() {
    let mut scenario = test_scenario::begin(USER);
    {
        let admin_cap = scenario.take_from_sender<AdminCap>();
        // This should fail - USER doesn't own AdminCap
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = nft::E_INVALID_AMOUNT)]
fun test_zero_amount_fails() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        nft::mint_with_amount(0, scenario.ctx());
    };
    scenario.end();
}
```

## Multiple Signers

### Test with Different Addresses
- Test ownership and permissions
- Validate multi-party interactions
- Use descriptive constant addresses

```move
const ADMIN: address = @0xAD;
const USER1: address = @0x1;
const USER2: address = @0x2;
const ATTACKER: address = @0xBAD;

#[test]
fun test_transfer_between_users() {
    let mut scenario = test_scenario::begin(ADMIN);

    // ADMIN mints to USER1
    {
        nft::mint_nft(string::utf8(b"NFT"), USER1, scenario.ctx());
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
- Use `test_scenario::next_epoch()` to advance epochs
- Create mock `Clock` objects for time-based logic
- Test time-locked features

```move
#[test]
fun test_time_locked_feature() {
    let mut scenario = test_scenario::begin(ADMIN);

    {
        let mut clock = clock::create_for_testing(scenario.ctx());
        clock::set_for_testing(&mut clock, 1000); // Set timestamp

        // Test with specific timestamp
        nft::time_locked_mint(&clock, scenario.ctx());

        clock::destroy_for_testing(clock);
    };

    scenario.end();
}
```

## Gas Benchmarks

### Profile Gas Usage for Critical Paths
- Run with `sui move test --gas-limit 1000000000`
- Document expected gas costs
- Flag unexpectedly expensive operations

```move
// Gas benchmark: ~50k gas
#[test]
fun bench_mint_nft() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        nft::mint_nft(string::utf8(b"Test"), USER, scenario.ctx());
    };
    scenario.end();
}
```

## Test Organization

### Group Related Tests
- One test file per module
- Group tests by feature/function
- Use descriptive test names: `test_<action>_<scenario>_<expected>`

```move
// Basic functionality
#[test] fun test_mint_creates_nft() {}
#[test] fun test_transfer_changes_owner() {}
#[test] fun test_burn_destroys_nft() {}

// Error cases
#[test] #[expected_failure] fun test_mint_zero_amount_fails() {}
#[test] #[expected_failure] fun test_unauthorized_burn_fails() {}

// Edge cases
#[test] fun test_mint_max_supply() {}
#[test] fun test_concurrent_shared_access() {}
```

## Test Helpers

### Create Reusable Setup Functions
- Initialize common test state
- Create mock objects
- Keep tests DRY

```move
#[test_only]
fun setup_admin_scenario(): (Scenario, AdminCap) {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        nft::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    let admin_cap = scenario.take_from_sender<AdminCap>();
    (scenario, admin_cap)
}

#[test]
fun test_with_setup() {
    let (mut scenario, admin_cap) = setup_admin_scenario();
    // Use setup
    scenario.return_to_sender(admin_cap);
    scenario.end();
}
```

## Running Tests

### Common Test Commands
```bash
# Run all tests
sui move test

# Run tests with gas profiling
sui move test --gas-limit 1000000000

# Run specific test
sui move test test_mint_nft

# Run with verbose output
sui move test -v

# Run with coverage
sui move test --coverage
```

## Testing Checklist

- [ ] Every public function has at least one test
- [ ] Error cases tested with #[expected_failure]
- [ ] Multi-transaction flows tested with test_scenario
- [ ] Access control validated (unauthorized access fails)
- [ ] Edge cases covered (zero amounts, max values, empty strings)
- [ ] Gas costs documented for expensive operations
- [ ] Time/epoch-dependent logic tested with mocks
