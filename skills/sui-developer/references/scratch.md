# `sui::scratch` — per-transaction ephemeral key-value store

> **Verification source:** every signature below was re-read verbatim from the framework source at tag
> `mainnet-v1.78.1` (not from move-book):
> - `crates/sui-framework/packages/sui-framework/sources/scratch.move`
> - `crates/sui-framework/packages/sui-framework/sources/tx_context.move` (method aliases)
> - `crates/sui-framework/packages/move-stdlib/sources/internal.move` (`std::internal::Permit`)
> - `crates/sui-protocol-config/src/snapshots/sui_protocol_config__test__version_135.snap:316` (`max_scratch_pad_size: 16384`)
> - `sui-execution/latest/sui-move-natives/src/scratch/{runtime.rs,mod.rs}` (limit semantics + abort)
>
> Available since **Protocol 130** (mainnet v1.76.1). Line numbers refer to that tag.

## What it is

A key-value store that lives for exactly one transaction. Entries are **not attached to any object** —
there is no `UID`, no `Bag`, nothing to create or delete — and they are dropped when the transaction
ends, so there is **no storage fee** (only per-op gas: `scratch_add_cost_base`, `scratch_read_cost_base`,
`scratch_read_value_cost`, `scratch_remove_cost_base`, `scratch_exists_cost_base`,
`scratch_exists_with_type_cost_base`, `scratch_exists_with_type_type_cost`).

Access goes through `TxContext`. Each entry is identified by the pair (key type, key value), hashed the
same way as a dynamic field name (`sui::dynamic_field::hash_type_and_key`, against a dummy root `@0`).

## Ability constraints

| Position | Required abilities | Note |
|---|---|---|
| Key `K` | `copy + drop` | one ability **fewer** than a dynamic field name (`copy + drop + store`) — a key never needs to be stored |
| Value `V` (write/remove) | `drop` | |
| Value `V` (read) | `copy + drop` | reads return a **copy**, so `copy` is additionally required |

## Access control — `Permit`

```move
// scratch.move:20
public struct Permit<phantom K: copy + drop>() has copy, drop;

// scratch.move:47
public fun permit<K: copy + drop>(_: internal::Permit<K>): Permit<K>
```

`std::internal::Permit<T>` (`internal.move`) is a privileged witness that **only the module defining `T`
can construct** (`internal::permit<T>()`). So every scratch entry keyed by `K` is reachable only by the
module that declares `K` — or by whoever that module hands a `Permit<K>` to.

`scratch::Permit<K>` has **`copy` but not `store`**: it can be passed freely down a call stack within the
transaction (that is the point — you delegate access), but it cannot be parked in an object or a dynamic
field to outlive the transaction.

## Operations

All take `Permit<K>` and the key. Mutating ops take `&mut TxContext`; pure reads take `&TxContext`.

```move
// mutating — &mut TxContext
public fun add<K: copy + drop, V: drop>(_: &mut TxContext, _: Permit<K>, key: K, value: V)                    // :54
public fun remove<K: copy + drop, V: drop>(_: &mut TxContext, _: Permit<K>, key: K): V                        // :68
public fun remove_opt<K: copy + drop, V: drop>(ctx: &mut TxContext, permit: Permit<K>, key: K): Option<V>     // :96
public fun replace<K: copy + drop, VNew: drop, VOld: drop>(
    ctx: &mut TxContext, permit: Permit<K>, key: K, value: VNew,
): Option<VOld>                                                                                                // :108

// reads — &TxContext
public fun read<K: copy + drop, V: copy + drop>(_: &TxContext, _: Permit<K>, key: K): V                       // :61
public fun read_opt<K: copy + drop, V: copy + drop>(ctx: &TxContext, permit: Permit<K>, key: K): Option<V>    // :86
public fun exists<K: copy + drop>(_: &TxContext, _: Permit<K>, key: K): bool                                  // :74
public fun exists_with_type<K: copy + drop, V: drop>(_: &TxContext, _: Permit<K>, key: K): bool               // :80
```

Aborts (`scratch.move:33-43`):

| Code | Const | When |
|---|---|---|
| 0 | `EEntryAlreadyExists` | `add` onto an occupied key — **regardless of the existing value's type** |
| 1 | `EEntryDoesNotExist` | `read` / `remove` on a missing key |
| 2 | `EEntryTypeMismatch` | entry exists but its value is not `V` |
| 3 | `EBorrowMarkerMismatch` | `end_borrow` found a different marker than it left |

`replace` is `remove_opt<K, VOld>` then `add`, so the old and new value types may differ, and it still
aborts `EEntryTypeMismatch` if the existing value is not `VOld`.

## Method aliases and `internal_*` macros

`tx_context.move:9-81` declares `public use fun` aliases for everything, so the ergonomic form is:

```move
ctx.scratch_add(permit, key, value);
let v: u64 = ctx.scratch_read(permit, key);
ctx.scratch_get_mut_do!(permit, key, |v| *v = *v + 1);
```

For the common case where the calling module is itself the definer of `K`, the `internal_*` **macros**
build the `Permit<K>` inline — note the `!`, they are macros:

```move
ctx.scratch_internal_add!(key, value);          // scratch.move:256 + tx_context.move:45
let v: u64 = ctx.scratch_internal_read!(key);   // scratch.move:267 + tx_context.move:48
```

Full set: `internal_add`, `internal_read`, `internal_remove`, `internal_exists`,
`internal_exists_with_type`, `internal_read_opt`, `internal_remove_opt`, `internal_replace`,
`internal_get_do`, `internal_get_mut_do`, `internal_get_fold`, `internal_get_mut_fold`.

## Borrow macros — `get_do` / `get_mut_do` / `get_fold` / `get_mut_fold`

```move
public macro fun get_do<$K: copy + drop, $V: drop, $R: drop>(
    $ctx: &mut TxContext, $permit: Permit<$K>, $key: $K, $f: |&$V| -> $R,
)                                                                                          // :167
public macro fun get_mut_do<$K: copy + drop, $V: drop, $R: drop>(
    $ctx: &mut TxContext, $permit: Permit<$K>, $key: $K, $f: |&mut $V| -> $R,
)                                                                                          // :189
public macro fun get_fold<$K: copy + drop, $V: drop, $R>(
    $ctx: &mut TxContext, $permit: Permit<$K>, $key: $K, $none: $R, $some: |&$V| -> $R,
): $R                                                                                      // :211
public macro fun get_mut_fold<$K: copy + drop, $V: drop, $R>(
    $ctx: &mut TxContext, $permit: Permit<$K>, $key: $K, $none: $R, $some: |&mut $V| -> $R,
): $R                                                                                      // :235
```

`*_do` no-op when the key is absent; `*_fold` return `$none` instead.

**Two things that surprise people:**

1. **Even the read-only variants take `&mut TxContext`.** There is no real borrow. Internally
   `begin_borrow` (`:128`) *removes* the value and parks a unique `BorrowMarker<V>` in the slot;
   `end_borrow` (`:148`) puts the value back and asserts the marker is still the one it left. Mutating
   the store is what makes `&mut TxContext` mandatory, read-only callback or not.
2. **Re-entering the same key inside the callback aborts.** During `$f`, the slot holds a
   `BorrowMarker<V>`, not your value — so a nested `read`/`remove` of that key aborts
   `EEntryTypeMismatch` and a nested `add` aborts `EEntryAlreadyExists`. The marker carries a
   transaction-unique id from a monotonic counter kept in its own scratch entry (`borrow_marker`,
   `:363`), so it cannot be forged.

`begin_borrow` / `end_borrow` are public but **not intended for direct use** — the macros are the
supported surface.

## Per-transaction limit

**16,384 entries per transaction** (`max_scratch_pad_size`, protocol config since P130; value confirmed
in the P135 snapshot). Exceeding it is **not** a Move abort code you can catch — the native fails the
transaction with VM `MEMORY_LIMIT_EXCEEDED` / sub-status `SCRATCH_SIZE_LIMIT_EXCEEDED`
(`sui-move-natives/src/scratch/mod.rs:85-89`). Note the counter is **entries**, not bytes
(`runtime.rs:57-68`), and the `BorrowMarker` counter occupies one of them.

## Example

```move
module example::rate_limit;

use sui::scratch;

const ETooMuch: u64 = 0;

/// Key type — declared here, so only this module can mint a `Permit<Spent>`.
public struct Spent(address) has copy, drop;

/// Accumulate per-sender spend across several calls in one PTB, with no object writes.
public fun charge(amount: u64, ctx: &mut TxContext) {
    let who = Spent(ctx.sender());
    let so_far = scratch::internal_read_opt!<Spent, u64>(ctx, who).destroy_or!(0);
    let total = so_far + amount;
    assert!(total <= 1_000_000, ETooMuch);
    let _old: Option<u64> = scratch::internal_replace!<Spent, u64, u64>(ctx, who, total);
}

/// Read-only inspection still takes `&mut TxContext` (see borrow macros above).
public fun report(ctx: &mut TxContext): u64 {
    let who = Spent(ctx.sender());
    scratch::internal_get_fold!<Spent, u64, u64>(ctx, who, 0, |v| *v)
}
```

## `scratch` vs Hot Potato

Both pass intra-transaction state without touching storage. Pick by shape:

| | Hot Potato (a struct with no abilities) | `sui::scratch` |
|---|---|---|
| Enforcement | **Compile/VM-enforced**: the value has no `drop`, so the transaction cannot end without consuming it | **Not enforced**: entries are silently dropped at end of transaction |
| Guarantee it gives you | "this *must* be settled before the tx ends" | "this *may* be read later in the tx, if anyone bothers" |
| Data flow | must be threaded explicitly through every call and PTB command | ambient — any holder of `Permit<K>` reads it, no plumbing |
| PTB ergonomics | the potato must be a PTB result passed to a later command | invisible to the PTB; keys are internal to Move |
| Cost | free (stack values) | per-op gas, no storage fee |
| Failure mode | forget to consume → **transaction will not build/execute** | forget to read → **silently nothing happens** |

Rule of thumb: if skipping the follow-up step is a **bug that must be impossible** (flash loan repayment,
settling a borrow, finalizing an escrow), use a **Hot Potato** — you want the compiler to stop you. If it
is merely **state you would rather not plumb through ten signatures** (accumulators, memoized lookups,
per-sender counters, re-entrancy guards within one tx), use **`scratch`**.

They compose: a Hot Potato can carry the obligation while `scratch` carries the bulky bookkeeping.
