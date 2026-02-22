---
paths: "**/*.move"
---

# Sui Move Conventions (Move 2024)

## Package Setup

- Edition required in Move.toml: `edition = "2024.beta"`
- Implicit framework dependencies (Sui 1.45+): do NOT list `Sui`, `MoveStdlib`, `Bridge`, or `SuiSystem` in `[dependencies]`
- Named addresses: prefix with project name to avoid conflicts

## Module Declaration

Single-line declaration, no braces (Move 2024):

```move
module my_package::my_module;
```

## Module Layout Order

```
use imports
Constants
Structs / Enums
init
Public functions
public(package) functions
Private functions
Test module
```

Use `=== Section Title ===` comments to delimit sections.

## Imports

- Don't use a lone `{Self}` — import the module directly
- When importing both the module and members, group with `Self`:

```move
use sui::coin::{Self, Coin};
```

## Structs

All structs must use `public struct`:

```move
public struct NFT has key, store {
    id: UID,
    name: String,
}
```

Object rule: any struct with `key` must have `id: UID` as first field.

### Naming

- Capabilities: `Cap` suffix (`AdminCap`, `MintCap`)
- Events: past tense (`ItemPurchased`, `PoolCreated`)
- No `Potato` suffix
- Dynamic field keys: positional structs `public struct BalanceKey() has copy, drop, store;`

## Object Abilities Cheat Sheet

| Ability | Meaning |
|---------|---------|
| `key` | On-chain object, requires `id: UID` |
| `store` | Can be embedded; enables `public_transfer` / `public_share_object` / `public_freeze_object` |
| `copy` | Can be duplicated (not valid on objects with `key`) |
| `drop` | Can be silently discarded |

- Only call non-`public_` transfer variants inside the defining module
- Never construct an object struct literal outside its defining module

## Constants

- Error constants: `EPascalCase` (e.g., `EInsufficientBalance`)
- Other constants: `ALL_CAPS` (e.g., `MAX_SUPPLY`)

### Clever Errors

Use `#[error]` macro for string error messages:

```move
#[error]
const EInsufficientBalance: vector<u8> = b"Balance too low for this operation";
```

`assert!` without abort code auto-derives a clever abort code.
Never pass abort codes to `assert!` — conflicts with app error codes.

## Visibility

- `public` = any module
- `public(package)` = same package only
- `(none)` = same module only
- `public(friend)` is **deprecated** — use `public(package)`
- **Never use `public entry`** — choose one or the other

## Parameter Ordering

`mutable objects → immutable objects → capabilities → primitives → Clock → TxContext`

## Getter Naming

Name after the field, no `get_` prefix: `fee_bps()` not `get_fee_bps()`.

## Mutability

`let mut` required for mutable bindings and function parameters:

```move
let mut v = vector[];
fun process(mut coin: Coin<SUI>) { ... }
```

## Method Syntax

Prefer method form when the first argument matches the type:

```move
ctx.sender()
id.delete()
coin.value()
opt.destroy_or!(default)
```

## Enums (Move 2024)

Use enums for types with multiple variants. Cannot have `key` ability. Pattern match with `match`.

```move
public enum Status has store, drop {
    Active,
    Paused,
    Closed,
}
```

## Macros (Move 2024)

Vector macros: `do!`, `tabulate!`, `do_ref!`, `do_mut!`, `destroy!`, `fold!`, `filter!`
Option macros: `do!`, `destroy_or!`

## Comments

- `///` for doc comments (no `/** */`)
- `//` for non-obvious logic only

## OTW Pattern (One-Time Witness)

```move
public struct MY_MODULE has drop {}

fun init(otw: MY_MODULE, ctx: &mut TxContext) { ... }
```

## Capability Pattern

Use capability objects to gate privileged functions — don't check `ctx.sender()`:

```move
public fun admin_action(cap: &AdminCap, ...) { ... }
```

## Pure Functions & Composability

- Keep core logic functions pure — don't call `transfer` inside core logic
- Return excess coins even if zero

## Common Stdlib Patterns

```move
// Strings
b"hello".to_string()

// Coin/Balance — method syntax
let balance = coin.into_balance();
let value = coin.value();

// Burn pattern
transfer::public_transfer(obj, @0x0)

// Option
opt.destroy_or!(default_value)

// UID deletion
id.delete()

// TxContext sender
ctx.sender()

// Vector literals & index syntax
let v = vector[1, 2, 3];
let x = v[0];

// Struct unpack with ..
let NFT { id, name, .. } = nft;
```

## Dynamic Fields

```move
df::add(&mut obj.id, key, value);
df::borrow(&obj.id, key);
df::borrow_mut(&mut obj.id, key);
df::remove(&mut obj.id, key);
// Dynamic object fields
dof::add(&mut obj.id, key, obj_value);
```

## Events

Emit events for all state-changing operations:

```move
public struct ItemPurchased has copy, drop {
    item_id: ID,
    buyer: address,
    price: u64,
}

event::emit(ItemPurchased { item_id, buyer, price });
```

## What Sui Move is NOT

These do not exist in Sui Move:
`acquires`, `move_to`, `move_from`, `borrow_global`, `signer`, `Script`, `public(friend)`, `struct` without `public`, `let` without `mut` for mutable vars.
