---
paths: "**/*.move"
---

# Sui Move Conventions

## Module Naming
- Use `snake_case` for module names
- One module per file, filename matches module name
- Example: `nft_marketplace.move` contains `module nft_marketplace`

## Struct Naming
- Use `PascalCase` for struct names
- Prefix capability structs with purpose: `AdminCap`, `MintCap`, `TreasuryCap`
- Use descriptive names: `NFTCollection`, `MarketplaceListing`

## Object Patterns

### Shared Objects
- Use for objects that need concurrent access
- Include version/epoch fields for optimistic concurrency
- Example: `public fun create_shared_pool(ctx: &mut TxContext) { transfer::share_object(Pool { ... }) }`

### Owned Objects
- Default for user-owned assets (NFTs, coins, etc.)
- Transferred using `transfer::public_transfer` or `transfer::transfer`
- Example: `transfer::public_transfer(nft, recipient)`

### Wrapped Objects
- Use for composability (wrapping one object in another)
- Parent object owns the child
- Example: storing NFT inside a staking position

## Capability Pattern
- Use empty structs for capabilities: `struct AdminCap has key, store { id: UID }`
- Store capabilities in `TxContext` sender or as owned objects
- Pass capabilities as immutable references: `_admin: &AdminCap`
- Name parameter with underscore if only used for access control

## Entry Functions
- Mark user-facing functions with `entry` or `public entry`
- Entry functions should be simple orchestrators
- Keep complex logic in internal functions
- Entry function naming: verb_noun (e.g., `mint_nft`, `list_item`, `cancel_listing`)

## Error Codes
- Use constants for error codes: `const E_NOT_AUTHORIZED: u64 = 0;`
- Naming: `E_SNAKE_CASE_DESCRIPTION`
- Start from 0, increment by 1
- Group related errors together
- Document what each error means

```move
const E_NOT_AUTHORIZED: u64 = 0;
const E_INSUFFICIENT_BALANCE: u64 = 1;
const E_INVALID_AMOUNT: u64 = 2;
const E_ALREADY_EXISTS: u64 = 3;
```

## Import Ordering
1. Standard library (`std::`)
2. Sui framework (`sui::`)
3. Project modules (relative imports)
4. Alphabetical within each group

```move
use std::string::{Self, String};
use std::vector;

use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::transfer;
use sui::tx_context::{Self, TxContext};

use project::utils;
```

## Struct Field Ordering
1. `id: UID` (always first for objects)
2. Capability/permission fields
3. Core data fields (sorted by importance)
4. Metadata fields
5. Timestamp/version fields

```move
struct NFT has key, store {
    id: UID,
    owner: address,
    name: String,
    description: String,
    url: String,
    created_at: u64,
}
```

## Function Ordering in Module
1. Constants (error codes, config values)
2. Structs
3. Init function
4. Public entry functions
5. Public functions
6. Internal functions
7. Test-only functions

## Comments and Documentation
- Use `///` for public function documentation
- Include @param and @return annotations for complex functions
- Explain invariants and assumptions
- Document gas implications for expensive operations

```move
/// Mints a new NFT and transfers it to the recipient.
/// @param name: The name of the NFT
/// @param recipient: The address to receive the NFT
/// @param ctx: The transaction context
public entry fun mint_nft(
    name: String,
    recipient: address,
    ctx: &mut TxContext
) {
    // Implementation
}
```

## Constants
- Use SCREAMING_SNAKE_CASE for constants
- Group by purpose (errors, config, limits)
- Add inline comments for non-obvious values

```move
const MAX_SUPPLY: u64 = 10000;
const DECIMALS: u8 = 9;
const BASIS_POINTS: u64 = 10000; // 100% = 10000 basis points
```

## Abilities
- `key`: Object can be owned, stored in global storage
- `store`: Object can be stored inside other objects
- `copy`: Object can be copied (use sparingly)
- `drop`: Object can be dropped (use sparingly)

Common patterns:
- NFTs: `has key, store`
- Capabilities: `has key, store`
- Singletons: `has key`
- Pure data: `has store, drop, copy`
