# Move 2024 idioms (write-time)

Patterns AI agents routinely get wrong when writing Move on Sui. Source:
[Move Book Code Quality Checklist](https://move-book.com/guides/code-quality-checklist) via
`MystenLabs/skills@4c55997`. The audit counterpart is the **move-code-quality** skill (same
checklist, review-time). Concept prose — no SDK version pins.

Already covered in [sui-developer/SKILL.md](../SKILL.md), not repeated here: loop/option macros
(`do!`/`fold!`/`tabulate!`/`filter!`/`destroy!`), `#[error]` error constants, dynamic-field
ergonomics, overflow-safe integer math, deprecation cleanups.

## 1. Method syntax (dot notation)

Use method-call syntax instead of module function calls.

```move
// Coin / Balance — WRONG (legacy function-call)
let value = coin::value(&payment);
let balance = coin::into_balance(payment);
balance::join(&mut pool.reserve, balance);

// CORRECT — method syntax
let value = payment.value();
let balance = payment.into_balance();
pool.reserve.join(balance);

// BEST — chained
let balance = payment.split(amount, ctx).into_balance();
```

```move
tx_context::sender(ctx)   // WRONG
ctx.sender()              // CORRECT

object::delete(id)        // WRONG
id.delete()               // CORRECT
```

Vectors — literals + methods + index syntax:

```move
// WRONG
let mut v = vector::empty();
vector::push_back(&mut v, 10);
let first = vector::borrow(&v, 0);
let len = vector::length(&v);

// CORRECT
let mut v = vector[10];
let first = &v[0];
let len = v.length();
v.push_back(20);
```

Collection index syntax: `vec_map::get(&map, &key)` → `&map[&key]`.

String literals — quoted form directly:

```move
let s = string::utf8(b"hello");   // WRONG
let s = "hello";                  // CORRECT (UTF-8 String)
let ascii = b"hello".to_ascii_string(); // explicit ASCII when needed
```

Struct unpack — `..` to ignore unused fields:

```move
let MyStruct { id, field_1: _, field_2: _ } = value;  // WRONG
let MyStruct { id, .. } = value;                      // CORRECT
```

## 2. Naming conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Error constants | `E` + PascalCase (+ `#[error]`) | `ENotAuthorized` |
| Regular constants | ALL_CAPS | `FEE_NUMERATOR` |
| Capabilities | suffix `Cap` | `AdminCap` |
| Events | past tense | `PoolCreated` |
| Getters | field name, no `get_` | `balance()` |
| Mutable getters | field name + `_mut` | `balance_mut()` |
| Hot potatoes | descriptive, no `Potato` | `FlashLoanReceipt` |
| Dynamic field keys | positional + `Key` suffix | `ItemKey()` |

Error constants/`#[error]` are detailed in [sui-developer/SKILL.md](../SKILL.md) — not repeated.

```move
// Capabilities — WRONG / CORRECT
public struct MintAuthority has key, store { id: UID }
public struct MintCap has key, store { id: UID }

// Events past tense — WRONG / CORRECT
public struct CreatePool has copy, drop { pool_id: ID }
public struct PoolCreated has copy, drop { pool_id: ID }

// Getters — WRONG / CORRECT
public fun get_balance(u: &User): u64 { u.balance }
public fun balance(u: &User): u64 { u.balance }

// Hot potato (no abilities) — WRONG / CORRECT name
public struct FlashLoanPotato {}
public struct FlashLoanReceipt {}

// Dynamic field key — positional struct, Key suffix
public struct ItemKey(String) has copy, drop, store;
```

## 3. Composable functions (PTB-friendly)

**No `public entry`** — pick one:

```move
public entry fun do_something() { }              // WRONG — redundant, limits composability
public fun mint(ctx: &mut TxContext): NFT { }    // CORRECT — composable
entry fun mint_and_keep(ctx: &mut TxContext) { } // CORRECT — non-composable endpoint
```

**Return objects, don't transfer internally** — let the PTB caller decide:

```move
// WRONG — couples mint with transfer, can't compose
public fun mint_and_transfer(ctx: &mut TxContext) {
    let nft = NFT { id: object::new(ctx) };
    transfer::transfer(nft, ctx.sender());
}

// CORRECT — return it; add a separate entry wrapper if a convenience endpoint is needed
public fun mint(ctx: &mut TxContext): NFT {
    NFT { id: object::new(ctx) }
}
entry fun mint_and_keep(ctx: &mut TxContext) {
    transfer::transfer(mint(ctx), ctx.sender());
}
```

This applies broadly: `add_liquidity`/`remove_liquidity`/`swap`/`borrow` return coins/assets, never
transfer them. CLI caveat: a function returning a non-`drop` value can't be called via
`sui client call` (`UnusedValueWithoutDrop`) — use `sui client ptb` with `--assign` +
`--transfer-objects`, or provide an `entry` wrapper.

**Parameter ordering** — Object → Capability → Primitives → Clock → `ctx`:

```move
// WRONG — cap before object, primitives mixed in
public fun authorize_action(cap: &AdminCap, value: u8, app: &mut App, ctx: &mut TxContext) { }

// CORRECT — object first, cap second, primitives third, ctx last
public fun authorize_action(app: &mut App, cap: &AdminCap, value: u8, ctx: &mut TxContext) { }

// Clock exception: near the end, just before ctx (even though it's an object)
public fun timed_action(app: &mut App, cap: &AppCap, value: u8, clock: &Clock, ctx: &mut TxContext) { }
```
