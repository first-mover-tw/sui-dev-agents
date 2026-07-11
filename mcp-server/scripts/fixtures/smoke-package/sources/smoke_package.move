/// Minimal package for smoke.mjs's sui_wallet_publish case.
/// No entry/public functions needed — the smoke test only exercises
/// `sui move build` + dry-run/simulate, never publishes on-chain.
module smoke_package::smoke_package;

const VERSION: u64 = 1;

public fun version(): u64 {
    VERSION
}
