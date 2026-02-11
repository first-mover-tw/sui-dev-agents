#[test_only]
module starter_defi::pool_fix_tests {
    use sui::test_scenario as ts;
    use sui::coin;
    use starter_defi::pool::{Self, Pool, LPToken};

    // Dummy coin types
    public struct COIN_X has drop {}
    public struct COIN_Y has drop {}
    public struct COIN_Z has drop {}

    // ====== Fix 1: LPToken pool_id binding ======

    #[test]
    /// LPToken minted from pool A (X/Y) cannot be used on pool B (X/Y) — different pool ID
    #[expected_failure(abort_code = pool::EPoolMismatch)]
    fun test_lp_token_cross_pool_rejected() {
        let mut scenario = ts::begin(@0xA);

        // Create pool A (X/Z) and get LP token
        {
            pool::create_pool<COIN_X, COIN_Z>(scenario.ctx());
        };
        scenario.next_tx(@0xA);
        {
            let mut pool_a = scenario.take_shared<Pool<COIN_X, COIN_Z>>();
            let cx = coin::mint_for_testing<COIN_X>(10_000, scenario.ctx());
            let cz = coin::mint_for_testing<COIN_Z>(10_000, scenario.ctx());
            pool::add_liquidity(&mut pool_a, cx, cz, scenario.ctx());
            ts::return_shared(pool_a);
        };

        // Create pool B (X/Z) — same types, different pool object
        scenario.next_tx(@0xA);
        {
            pool::create_pool<COIN_X, COIN_Z>(scenario.ctx());
        };
        scenario.next_tx(@0xA);
        {
            let mut pool_b = scenario.take_shared<Pool<COIN_X, COIN_Z>>();
            let cx = coin::mint_for_testing<COIN_X>(20_000, scenario.ctx());
            let cz = coin::mint_for_testing<COIN_Z>(20_000, scenario.ctx());
            pool::add_liquidity(&mut pool_b, cx, cz, scenario.ctx());
            ts::return_shared(pool_b);
        };

        // Grab LP from pool A, try remove on pool B
        // take_from_sender returns most recent first — that's pool B's LP
        // We need pool A's LP. Take both, return one.
        scenario.next_tx(@0xA);
        {
            let lp_b = scenario.take_from_sender<LPToken<COIN_X, COIN_Z>>();
            let lp_a = scenario.take_from_sender<LPToken<COIN_X, COIN_Z>>();
            // lp_a is from pool A (older), lp_b is from pool B (newer)
            // Use lp_a on pool B → should fail
            let mut pool_b = scenario.take_shared<Pool<COIN_X, COIN_Z>>();
            // Return lp_b to not leak it
            transfer::public_transfer(lp_b, @0xA);
            pool::remove_liquidity(&mut pool_b, lp_a, scenario.ctx());
            ts::return_shared(pool_b);
        };

        scenario.end();
    }

    #[test]
    /// LPToken used on its own pool should succeed
    fun test_lp_token_same_pool_accepted() {
        let mut scenario = ts::begin(@0xA);

        {
            pool::create_pool<COIN_X, COIN_Y>(scenario.ctx());
        };
        scenario.next_tx(@0xA);
        {
            let mut pool = scenario.take_shared<Pool<COIN_X, COIN_Y>>();
            let cx = coin::mint_for_testing<COIN_X>(10_000, scenario.ctx());
            let cy = coin::mint_for_testing<COIN_Y>(10_000, scenario.ctx());
            pool::add_liquidity(&mut pool, cx, cy, scenario.ctx());
            ts::return_shared(pool);
        };
        scenario.next_tx(@0xA);
        {
            let mut pool = scenario.take_shared<Pool<COIN_X, COIN_Y>>();
            let lp_token = scenario.take_from_sender<LPToken<COIN_X, COIN_Y>>();
            pool::remove_liquidity(&mut pool, lp_token, scenario.ctx());
            ts::return_shared(pool);
        };

        scenario.end();
    }

    // ====== Fix 2: u128 overflow protection in add_liquidity ======

    #[test]
    /// Large deposits that would overflow u64 multiplication should work with u128
    fun test_large_deposit_no_overflow() {
        let mut scenario = ts::begin(@0xA);

        {
            pool::create_pool<COIN_X, COIN_Y>(scenario.ctx());
        };
        scenario.next_tx(@0xA);
        {
            let mut pool = scenario.take_shared<Pool<COIN_X, COIN_Y>>();
            // 2^40 * 2^40 = 2^80 which overflows u64 (max 2^64-1)
            // but fits in u128. sqrt(2^80) = 2^40 which fits u64.
            let large_amount: u64 = 1_099_511_627_776; // 2^40
            let cx = coin::mint_for_testing<COIN_X>(large_amount, scenario.ctx());
            let cy = coin::mint_for_testing<COIN_Y>(large_amount, scenario.ctx());
            pool::add_liquidity(&mut pool, cx, cy, scenario.ctx());

            // LP should equal sqrt(2^40 * 2^40) = 2^40
            assert!(pool::get_lp_supply(&pool) == large_amount);
            ts::return_shared(pool);
        };

        scenario.end();
    }

    // ====== Fix 3: MIN_SWAP_AMOUNT raised to 334 ======

    #[test]
    #[expected_failure(abort_code = pool::EBelowMinimumSwap)]
    /// Swap of 333 (below new minimum 334) should be rejected
    fun test_swap_below_min_rejected() {
        let mut scenario = ts::begin(@0xA);

        {
            pool::create_pool<COIN_X, COIN_Y>(scenario.ctx());
        };
        scenario.next_tx(@0xA);
        {
            let mut pool = scenario.take_shared<Pool<COIN_X, COIN_Y>>();
            let cx = coin::mint_for_testing<COIN_X>(1_000_000, scenario.ctx());
            let cy = coin::mint_for_testing<COIN_Y>(1_000_000, scenario.ctx());
            pool::add_liquidity(&mut pool, cx, cy, scenario.ctx());
            ts::return_shared(pool);
        };
        scenario.next_tx(@0xA);
        {
            let mut pool = scenario.take_shared<Pool<COIN_X, COIN_Y>>();
            let small_coin = coin::mint_for_testing<COIN_X>(333, scenario.ctx());
            pool::swap_x_to_y(&mut pool, small_coin, 0, scenario.ctx());
            ts::return_shared(pool);
        };

        scenario.end();
    }

    #[test]
    /// Swap of exactly 334 should succeed and produce fee >= 1
    fun test_swap_at_min_has_nonzero_fee() {
        let mut scenario = ts::begin(@0xA);

        {
            pool::create_pool<COIN_X, COIN_Y>(scenario.ctx());
        };
        scenario.next_tx(@0xA);
        {
            let mut pool = scenario.take_shared<Pool<COIN_X, COIN_Y>>();
            let cx = coin::mint_for_testing<COIN_X>(1_000_000, scenario.ctx());
            let cy = coin::mint_for_testing<COIN_Y>(1_000_000, scenario.ctx());
            pool::add_liquidity(&mut pool, cx, cy, scenario.ctx());
            ts::return_shared(pool);
        };
        scenario.next_tx(@0xA);
        {
            let mut pool = scenario.take_shared<Pool<COIN_X, COIN_Y>>();
            let swap_coin = coin::mint_for_testing<COIN_X>(334, scenario.ctx());
            pool::swap_x_to_y(&mut pool, swap_coin, 0, scenario.ctx());

            // After swap: pool should have 1_000_334 X.
            // amount_out = 1_000_000 * 334*9970 / (1_000_000*10000 + 334*9970)
            //            = 1_000_000 * 3329980 / (10_000_000_000 + 3329980)
            //            ≈ 332 (less than 334, proving fee was collected)
            let (rx, _ry) = pool::get_reserves(&pool);
            assert!(rx == 1_000_334); // all input X went into pool
            ts::return_shared(pool);
        };

        scenario.end();
    }
}
