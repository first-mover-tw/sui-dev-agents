# Red Team Attack Test Examples

## Example 1: Access Control — Missing AdminCap Check

```move
// Attack: Call admin-only function without AdminCap
#[test]
fun red_team_round_1_access_control() {
    let attacker = @0xBAD;
    let mut scenario = test_scenario::begin(attacker);

    // Setup: create the vault (normally done by admin)
    test_scenario::next_tx(&mut scenario, @0xADMIN);
    {
        vault::init_for_testing(test_scenario::ctx(&mut scenario));
    };

    // Attack: attacker tries to withdraw without AdminCap
    test_scenario::next_tx(&mut scenario, attacker);
    {
        let mut vault = test_scenario::take_shared<Vault>(&scenario);
        // This should abort — if it doesn't, we found a vulnerability
        vault::withdraw(&mut vault, 1000, test_scenario::ctx(&mut scenario));
        test_scenario::return_shared(vault);
    };

    test_scenario::end(scenario);
}
```

**Expected result:** Test should FAIL (abort). If it PASSES → EXPLOITED.

---

## Example 2: Integer Abuse — Zero Amount Withdraw

```move
// Attack: Withdraw 0 amount to test boundary
#[test]
fun red_team_round_2_integer_zero() {
    let user = @0xA;
    let mut scenario = test_scenario::begin(user);

    test_scenario::next_tx(&mut scenario, user);
    {
        let mut vault = test_scenario::take_shared<Vault>(&scenario);
        // Zero withdraw — should be rejected
        vault::withdraw(&mut vault, 0, test_scenario::ctx(&mut scenario));
        test_scenario::return_shared(vault);
    };

    test_scenario::end(scenario);
}
```

---

## Example 3: Integer Abuse — MAX_U64 Overflow

```move
// Attack: Deposit MAX_U64 to trigger overflow in balance tracking
#[test]
fun red_team_round_2_integer_overflow() {
    let attacker = @0xBAD;
    let mut scenario = test_scenario::begin(attacker);

    test_scenario::next_tx(&mut scenario, attacker);
    {
        let mut pool = test_scenario::take_shared<Pool>(&scenario);
        let big_coin = coin::mint_for_testing<SUI>(
            18446744073709551615, // MAX_U64
            test_scenario::ctx(&mut scenario)
        );
        // This should abort on overflow when added to existing balance
        pool::deposit(&mut pool, big_coin, test_scenario::ctx(&mut scenario));
        test_scenario::return_shared(pool);
    };

    test_scenario::end(scenario);
}
```

---

## Example 4: Economic Attack — Fee Bypass via Rounding

```move
// Attack: Buy at amount where fee rounds to 0
#[test]
fun red_team_round_4_economic_fee_bypass() {
    let buyer = @0xBUY;
    let mut scenario = test_scenario::begin(buyer);

    test_scenario::next_tx(&mut scenario, buyer);
    {
        let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
        // If fee is 1% (fee = amount / 100), amount=99 → fee=0
        let payment = coin::mint_for_testing<SUI>(
            99,
            test_scenario::ctx(&mut scenario)
        );
        // If purchase succeeds with 0 fee, fee logic is exploitable
        marketplace::buy(
            &mut marketplace,
            listing_id,
            payment,
            test_scenario::ctx(&mut scenario)
        );
        test_scenario::return_shared(marketplace);
    };

    test_scenario::end(scenario);
}
```

---

## Example 5: Input Fuzzing — Empty Vector Name

```move
// Attack: Create NFT with empty name
#[test]
fun red_team_round_5_fuzz_empty_name() {
    let user = @0xA;
    let mut scenario = test_scenario::begin(user);

    test_scenario::next_tx(&mut scenario, user);
    {
        // Empty name should be rejected
        nft::mint(
            b"",              // empty name
            b"description",
            b"https://img.url",
            test_scenario::ctx(&mut scenario)
        );
    };

    test_scenario::end(scenario);
}
```

---

## Example 6: Object Manipulation — Wrong Coin Type

```move
// Attack: Pay with wrong coin type
#[test]
fun red_team_round_3_wrong_coin_type() {
    let attacker = @0xBAD;
    let mut scenario = test_scenario::begin(attacker);

    test_scenario::next_tx(&mut scenario, attacker);
    {
        let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
        // Mint a fake coin type
        let fake_payment = coin::mint_for_testing<FAKE_TOKEN>(
            1000000,
            test_scenario::ctx(&mut scenario)
        );
        // Type system should reject this at compile time
        // If function uses generic Coin<T>, it might accept any coin
        marketplace::buy_generic(
            &mut marketplace,
            listing_id,
            fake_payment,
            test_scenario::ctx(&mut scenario)
        );
        test_scenario::return_shared(marketplace);
    };

    test_scenario::end(scenario);
}
```

---

## Example 7: Ordering Attack — Epoch-Based Unlock Bypass

```move
// Attack: Bypass timelock by calling at exact epoch boundary
#[test]
fun red_team_round_6_ordering_epoch_bypass() {
    let user = @0xA;
    let mut scenario = test_scenario::begin(user);

    // Lock tokens for 10 epochs
    test_scenario::next_tx(&mut scenario, user);
    {
        let coin = coin::mint_for_testing<SUI>(1000, test_scenario::ctx(&mut scenario));
        vault::lock_tokens(coin, 10, test_scenario::ctx(&mut scenario));
    };

    // Try to unlock at exactly epoch 10 (off-by-one test)
    // Advance to epoch 10
    let mut i = 0;
    while (i < 10) {
        test_scenario::next_epoch(&mut scenario, user);
        i = i + 1;
    };

    test_scenario::next_tx(&mut scenario, user);
    {
        let mut lock = test_scenario::take_from_sender<TokenLock>(&scenario);
        // Should this succeed at epoch 10 or require epoch 11?
        vault::unlock(&mut lock, test_scenario::ctx(&mut scenario));
        test_scenario::return_to_sender(&scenario, lock);
    };

    test_scenario::end(scenario);
}
```

---

## Example 8: DoS — Storage Bloat via Dust

```move
// Attack: Create many small entries to bloat storage
#[test]
fun red_team_round_8_dos_storage_bloat() {
    let attacker = @0xBAD;
    let mut scenario = test_scenario::begin(attacker);

    // Create 100 minimum-value entries
    let mut i = 0;
    while (i < 100) {
        test_scenario::next_tx(&mut scenario, attacker);
        {
            let mut registry = test_scenario::take_shared<Registry>(&scenario);
            let dust = coin::mint_for_testing<SUI>(1, test_scenario::ctx(&mut scenario));
            // If each call creates a new dynamic field, storage grows linearly
            registry::register(&mut registry, dust, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(registry);
        };
        i = i + 1;
    };

    // Check: was attacker able to create 100 entries with only 100 units?
    // If yes, storage economics need minimum deposit requirement
    test_scenario::end(scenario);
}
```

---

## Example 9: Combination Attack — Flash Loan + Price Manipulation

```move
// Attack: Combine flash loan with price manipulation
#[test]
fun red_team_round_9_combo_flashloan_price() {
    let attacker = @0xBAD;
    let mut scenario = test_scenario::begin(attacker);

    test_scenario::next_tx(&mut scenario, attacker);
    {
        let mut pool = test_scenario::take_shared<Pool>(&scenario);

        // Step 1: Simulate flash loan (large borrow in same tx)
        let borrowed = coin::mint_for_testing<SUI>(
            1000000000, // 1B units
            test_scenario::ctx(&mut scenario)
        );

        // Step 2: Dump into pool to skew price
        pool::swap_a_to_b(&mut pool, borrowed, test_scenario::ctx(&mut scenario));

        // Step 3: Buy at manipulated price
        let cheap_buy = coin::mint_for_testing<TOKEN_B>(
            100,
            test_scenario::ctx(&mut scenario)
        );
        pool::swap_b_to_a(&mut pool, cheap_buy, test_scenario::ctx(&mut scenario));

        // Step 4: Check if attacker profited
        // If net positive after repay, flash loan attack works

        test_scenario::return_shared(pool);
    };

    test_scenario::end(scenario);
}
```

---

## Test Naming Convention

All red-team test functions follow: `red_team_round_{N}_{category}[_{detail}]`

Examples:
- `red_team_round_1_access_control`
- `red_team_round_2_integer_zero`
- `red_team_round_3_object_wrong_type`
- `red_team_round_4_economic_fee_bypass`
- `red_team_round_9_combo_flashloan_price`
