# Move Code Quality Checklist

Complete rules from the Move Book Code Quality Checklist. 11 categories, 50+ rules.

---

## 1. Code Organization

**Use Move Formatter**
- Check if code appears formatted consistently
- Recommend formatter tools: CLI (npm), CI/CD integration, VSCode/Cursor plugin

---

## 2. Package Manifest (Move.toml)

**Use Right Edition**
- ✅ MUST have: `edition = "2024.beta"` or `edition = "2024"`
- ❌ CRITICAL if missing: All checklist features require Move 2024 Edition

**Implicit Framework Dependency**
- ✅ For Sui 1.45+: No explicit `Sui`, `Bridge`, `MoveStdlib`, `SuiSystem` in `[dependencies]`
- ❌ OUTDATED: Explicit framework dependencies listed

**Prefix Named Addresses**
- ✅ GOOD: `my_protocol_math = "0x0"` (project-specific prefix)
- ❌ BAD: `math = "0x0"` (generic, conflict-prone)

---

## 3. Imports, Modules & Constants

**Using Module Label (Modern Syntax)**
- ✅ GOOD: `module my_package::my_module;` followed by declarations
- ❌ BAD: `module my_package::my_module { ... }` (legacy curly braces)

**No Single Self in Use Statements**
- ✅ GOOD: `use my_package::my_module;`
- ❌ BAD: `use my_package::my_module::{Self};` (redundant braces)
- ✅ GOOD when importing members: `use my_package::my_module::{Self, Member};`

**Group Use Statements with Self**
- ✅ GOOD: `use my_package::my_module::{Self, OtherMember};`
- ❌ BAD: Separate imports for module and its members

**Error Constants in EPascalCase**
- ✅ GOOD: `const ENotAuthorized: u64 = 0;`
- ❌ BAD: `const NOT_AUTHORIZED: u64 = 0;` (all-caps reserved for regular constants)

**Use `#[error]` Annotation for Human-Readable Messages**
- ✅ GOOD: `#[error] const ENotAuthorized: u64 = 0;` (CLI decodes to readable message at runtime)
- ❌ BAD: `const ENotAuthorized: u64 = 0;` (abort shows raw code only)
- Don't hardcode error code values in off-chain tooling — reference constant names instead

**Regular Constants in ALL_CAPS**
- ✅ GOOD: `const MY_CONSTANT: vector<u8> = b"value";`
- ❌ BAD: `const MyConstant: vector<u8> = b"value";` (PascalCase suggests error)

---

## 4. Structs

**Capabilities Suffixed with Cap**
- ✅ GOOD: `public struct AdminCap has key, store { id: UID }`
- ❌ BAD: `public struct Admin has key, store { id: UID }` (unclear it's a capability)

**No Potato in Names**
- ✅ GOOD: `public struct Promise {}`
- ❌ BAD: `public struct PromisePotato {}` (redundant, abilities show it's hot potato)

**Events Named in Past Tense**
- ✅ GOOD: `public struct UserRegistered has copy, drop { user: address }`
- ❌ BAD: `public struct RegisterUser has copy, drop { user: address }` (ambiguous)

**Positional Structs for Dynamic Field Keys**
- ✅ CANONICAL: `public struct DynamicFieldKey() has copy, drop, store;`
- ⚠️ ACCEPTABLE: `public struct DynamicField has copy, drop, store {}`

**Witness Structs Have Only `drop`**
- ✅ GOOD: `public struct Witness has drop {}`
- ❌ BAD: `public struct Witness has key, store { id: UID }` (witness is not an object)
- Witness types prove module identity — they need only `drop`, no fields, and should only be instantiated inside their defining module

---

## 5. Functions

**Use `public(package)` Not `public(friend)`**
- ✅ GOOD: `public(package) fun internal_helper() { ... }`
- ❌ DEPRECATED: `public(friend) fun internal_helper() { ... }`

**No Public Entry - Use Public or Entry**
- ✅ GOOD: `public fun do_something(): T { ... }` (composable, returns value)
- ✅ GOOD: `entry fun mint_and_transfer(...) { ... }` (transaction endpoint only)
- ❌ BAD: `public entry fun do_something() { ... }` (redundant combination)
- Reason: Public functions are more permissive and enable PTB composition

**Composable Functions for PTBs**
- ✅ GOOD: `public fun mint(ctx: &mut TxContext): NFT { ... }`
- ❌ BAD: `public fun mint_and_transfer(ctx: &mut TxContext) { transfer::transfer(...) }` (not composable)

**Return Objects for PTB Composability**
- ✅ GOOD: `public fun swap(pool: &mut Pool, coin_in: Coin<X>): Coin<Y> { ... }`
- ❌ BAD: `public fun swap(..., ctx: &mut TxContext) { transfer::public_transfer(coin_out, ctx.sender()); }`
- Core logic should return objects, not transfer them. This enables PTB chaining.

**Hot Potatoes Enforce Atomic Steps**
- ✅ GOOD: `public struct Receipt {}` (no abilities — must be consumed)
- ❌ BAD: `public struct Receipt has drop {}` (can be silently discarded)
- Hot potato structs have NO abilities. They force the caller to call a consuming function in the same PTB.

**Objects Go First (Except Clock)**
Parameter order:
1. Objects (mutable, then immutable)
2. Capabilities
3. Primitive types (u8, u64, bool, etc.)
4. Clock reference
5. TxContext (always last)

```move
// ✅ GOOD
public fun call_app(
    app: &mut App, cap: &AppCap, value: u8, is_smth: bool,
    clock: &Clock, ctx: &mut TxContext,
) { }
```

**Getters Named After Field + _mut**
- ✅ GOOD: `public fun name(u: &User): String`
- ✅ GOOD: `public fun details_mut(u: &mut User): &mut Details`
- ❌ BAD: `public fun get_name(u: &User): String` (unnecessary prefix)

---

## 6. Function Body: Struct Methods

**Common Coin Operations**
- ✅ GOOD: `payment.split(amount, ctx).into_balance()`
- ✅ BETTER: `payment.balance_mut().split(amount)`
- ❌ BAD: `coin::into_balance(coin::split(&mut payment, amount, ctx))`

**Don't Import std::string::utf8**
- ✅ GOOD: `b"hello, world!".to_string()`
- ❌ BAD: `use std::string::utf8; let str = utf8(b"hello, world!");`

**UID Has Delete Method**
- ✅ GOOD: `id.delete();`
- ❌ BAD: `object::delete(id);`

**Context Has sender() Method**
- ✅ GOOD: `ctx.sender()`
- ❌ BAD: `tx_context::sender(ctx)`

**Vector Has Literal & Associated Functions**
- ✅ GOOD: `let mut my_vec = vector[10];` / `my_vec[0]` / `my_vec.length()`
- ❌ BAD: `vector::empty()` / `vector::push_back(&mut my_vec, 10);`

**Collections Support Index Syntax**
- ✅ GOOD: `&x[&10]` and `&mut x[&10]`
- ❌ BAD: `x.get(&10)` and `x.get_mut(&10)`

---

## 7. Option Macros

**do! — Destroy and call function**
- ✅ GOOD: `opt.do!(|value| call_function(value));`
- ❌ BAD: `if (opt.is_some()) { let inner = opt.destroy_some(); call_function(inner); }`

**destroy_or! — Destroy some with default**
- ✅ GOOD: `let value = opt.destroy_or!(default_value);`
- ✅ GOOD: `let value = opt.destroy_or!(abort ECannotBeEmpty);`

---

## 8. Loop Macros

- `32u8.do!(|_| do_action());` — do N times
- `vector::tabulate!(32, |i| i);` — create vector from iteration
- `vec.do_ref!(|e| call_function(e));` — iterate by reference
- `vec.destroy!(|e| call(e));` — consume vector
- `source.fold!(0, |acc, v| acc + v);` — fold into value
- `source.filter!(|e| e > 10);` — filter (requires T: drop)

---

## 9. Other Improvements

**Ignored Values in Unpack (.. syntax)**
- ✅ GOOD: `let MyStruct { id, .. } = value;` (Move 2024)
- ❌ BAD: `let MyStruct { id, field_1: _, field_2: _, field_3: _ } = value;`

---

## 10. Testing

- `#[test, expected_failure]` — merge on one line
- Don't clean up expected_failure tests — end with abort
- Don't prefix tests with `test_` — redundant in test module
- Use `tx_context::dummy()` for simple tests, not full TestScenario
- `assert!(is_success);` without abort codes (may conflict with app error codes)
- `assert_eq!(result, expected_value);` — shows both values on failure
- `use sui::test_utils::destroy;` — don't write custom destroy_for_testing()

---

## 11. Comments

- Doc comments: `///` (not `/** */`)
- Comment non-obvious logic, potential issues, TODOs
