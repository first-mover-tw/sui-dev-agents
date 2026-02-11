/// A simple constant product AMM pool
#[allow(unused_const, lint(self_transfer))]
module starter_defi::pool {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};

    // ====== Error Codes ======
    const EInsufficientLiquidity: u64 = 0;
    const EInsufficientAmount: u64 = 1;
    const ESlippageExceeded: u64 = 2;
    const EBelowMinimumDeposit: u64 = 3;
    const EBelowMinimumSwap: u64 = 4;
    const EZeroLPMinted: u64 = 5;
    const EPoolMismatch: u64 = 6;

    // ====== Constants ======
    const FEE_DENOMINATOR: u64 = 10000;
    const FEE_NUMERATOR: u64 = 30; // 0.3% fee
    const MIN_LIQUIDITY: u64 = 1000; // Minimum initial LP to prevent first-depositor attack
    const MIN_SWAP_AMOUNT: u64 = 334; // Minimum swap to guarantee fee >= 1 (334*30/10000=1)
    const MIN_DEPOSIT_AMOUNT: u64 = 100; // Minimum deposit to prevent dust spam

    // ====== Structs ======

    /// Liquidity pool for two token types
    public struct Pool<phantom X, phantom Y> has key {
        id: UID,
        balance_x: Balance<X>,
        balance_y: Balance<Y>,
        lp_supply: u64,
    }

    /// LP token representing pool ownership, bound to a specific pool
    public struct LPToken<phantom X, phantom Y> has key, store {
        id: UID,
        pool_id: ID,
        amount: u64,
    }

    // ====== Public Functions ======

    /// Create a new liquidity pool
    public fun create_pool<X, Y>(ctx: &mut TxContext) {
        let pool = Pool<X, Y> {
            id: object::new(ctx),
            balance_x: balance::zero(),
            balance_y: balance::zero(),
            lp_supply: 0,
        };
        transfer::share_object(pool);
    }

    /// Add liquidity to the pool
    public fun add_liquidity<X, Y>(
        pool: &mut Pool<X, Y>,
        coin_x: Coin<X>,
        coin_y: Coin<Y>,
        ctx: &mut TxContext
    ) {
        let amount_x = coin_x.value();
        let amount_y = coin_y.value();

        assert!(amount_x >= MIN_DEPOSIT_AMOUNT && amount_y >= MIN_DEPOSIT_AMOUNT, EBelowMinimumDeposit);

        let lp_amount = if (pool.lp_supply == 0) {
            // Use u128 to prevent overflow: u64 * u64 can exceed u64::MAX
            let product = (amount_x as u128) * (amount_y as u128);
            let lp = (product.sqrt() as u64);
            assert!(lp >= MIN_LIQUIDITY, EBelowMinimumDeposit);
            lp
        } else {
            let lp_from_x = (amount_x * pool.lp_supply) / pool.balance_x.value();
            let lp_from_y = (amount_y * pool.lp_supply) / pool.balance_y.value();
            if (lp_from_x < lp_from_y) lp_from_x else lp_from_y
        };

        assert!(lp_amount > 0, EZeroLPMinted);

        coin::put(&mut pool.balance_x, coin_x);
        coin::put(&mut pool.balance_y, coin_y);
        pool.lp_supply = pool.lp_supply + lp_amount;

        let lp_token = LPToken<X, Y> {
            id: object::new(ctx),
            pool_id: object::id(pool),
            amount: lp_amount,
        };
        transfer::transfer(lp_token, ctx.sender());
    }

    /// Swap X for Y with slippage protection
    public fun swap_x_to_y<X, Y>(
        pool: &mut Pool<X, Y>,
        coin_x: Coin<X>,
        min_amount_out: u64,
        ctx: &mut TxContext
    ) {
        let amount_in = coin_x.value();
        assert!(amount_in >= MIN_SWAP_AMOUNT, EBelowMinimumSwap);

        let reserve_x = pool.balance_x.value();
        let reserve_y = pool.balance_y.value();

        // Use u128 to prevent overflow on large amounts
        let amount_in_with_fee = (amount_in as u128) * ((FEE_DENOMINATOR - FEE_NUMERATOR) as u128);
        let numerator = (reserve_y as u128) * amount_in_with_fee;
        let denominator = (reserve_x as u128) * (FEE_DENOMINATOR as u128) + amount_in_with_fee;
        let amount_out = (numerator / denominator as u64);

        assert!(amount_out > 0 && amount_out < reserve_y, EInsufficientLiquidity);
        assert!(amount_out >= min_amount_out, ESlippageExceeded);

        coin::put(&mut pool.balance_x, coin_x);
        let coin_out = coin::take(&mut pool.balance_y, amount_out, ctx);
        transfer::public_transfer(coin_out, ctx.sender());
    }

    /// Swap Y for X with slippage protection
    public fun swap_y_to_x<X, Y>(
        pool: &mut Pool<X, Y>,
        coin_y: Coin<Y>,
        min_amount_out: u64,
        ctx: &mut TxContext
    ) {
        let amount_in = coin_y.value();
        assert!(amount_in >= MIN_SWAP_AMOUNT, EBelowMinimumSwap);

        let reserve_x = pool.balance_x.value();
        let reserve_y = pool.balance_y.value();

        let amount_in_with_fee = (amount_in as u128) * ((FEE_DENOMINATOR - FEE_NUMERATOR) as u128);
        let numerator = (reserve_x as u128) * amount_in_with_fee;
        let denominator = (reserve_y as u128) * (FEE_DENOMINATOR as u128) + amount_in_with_fee;
        let amount_out = (numerator / denominator as u64);

        assert!(amount_out > 0 && amount_out < reserve_x, EInsufficientLiquidity);
        assert!(amount_out >= min_amount_out, ESlippageExceeded);

        coin::put(&mut pool.balance_y, coin_y);
        let coin_out = coin::take(&mut pool.balance_x, amount_out, ctx);
        transfer::public_transfer(coin_out, ctx.sender());
    }

    /// Remove liquidity from pool
    public fun remove_liquidity<X, Y>(
        pool: &mut Pool<X, Y>,
        lp_token: LPToken<X, Y>,
        ctx: &mut TxContext
    ) {
        let LPToken { id, pool_id, amount } = lp_token;
        assert!(pool_id == object::id(pool), EPoolMismatch);
        object::delete(id);

        assert!(amount > 0, EInsufficientAmount);

        let reserve_x = pool.balance_x.value();
        let reserve_y = pool.balance_y.value();

        let amount_x = (reserve_x * amount) / pool.lp_supply;
        let amount_y = (reserve_y * amount) / pool.lp_supply;

        pool.lp_supply = pool.lp_supply - amount;

        let coin_x = coin::take(&mut pool.balance_x, amount_x, ctx);
        let coin_y = coin::take(&mut pool.balance_y, amount_y, ctx);

        transfer::public_transfer(coin_x, ctx.sender());
        transfer::public_transfer(coin_y, ctx.sender());
    }

    // ====== View Functions ======

    public fun get_reserves<X, Y>(pool: &Pool<X, Y>): (u64, u64) {
        (pool.balance_x.value(), pool.balance_y.value())
    }

    public fun get_lp_supply<X, Y>(pool: &Pool<X, Y>): u64 {
        pool.lp_supply
    }
}
