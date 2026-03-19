# SUI Developer - Complete Examples

Real-world code generation and quality check examples.

## Example 1: Complete Generated Module - NFT Marketplace Listing

### Input Specification

From `docs/specs/nft-marketplace-spec.md`:

```markdown
## Module: listing

**Purpose:** Fixed-price listing management

**Functions:**
- create_listing(nft, price) → Listing
- cancel_listing(listing)
- buy_from_listing(listing, payment)

**Events:**
- ListingCreated
- ListingCancelled
- NFTPurchased
```

### Generated Code

```move
module marketplace::listing {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;

    // ==========================================
    // Error Codes
    // ==========================================
    const ENotOwner: u64 = 1;
    const EInvalidPrice: u64 = 2;
    const EListingNotFound: u64 = 3;
    const EInsufficientPayment: u64 = 4;
    const EMarketplacePaused: u64 = 5;

    // ==========================================
    // Structs
    // ==========================================

    /// A fixed-price listing for an NFT
    public struct Listing has key, store {
        id: UID,
        nft_id: ID,
        seller: address,
        price: u64,
        created_at: u64,
    }

    // ==========================================
    // Events
    // ==========================================

    public struct ListingCreated has copy, drop {
        listing_id: ID,
        nft_id: ID,
        seller: address,
        price: u64,
    }

    public struct ListingCancelled has copy, drop {
        listing_id: ID,
        seller: address,
    }

    public struct NFTPurchased has copy, drop {
        listing_id: ID,
        nft_id: ID,
        buyer: address,
        seller: address,
        price: u64,
    }

    // ==========================================
    // Public Functions
    // ==========================================

    /// Create a new listing for an NFT
    ///
    /// # Frontend Usage
    /// ```typescript
    /// const tx = new Transaction();
    /// tx.moveCall({
    ///   target: `${PACKAGE_ID}::listing::create_listing`,
    ///   arguments: [tx.object(nftId), tx.pure(price)]
    /// });
    /// ```
    public fun create_listing<T: key + store>(
        nft: T,
        price: u64,
        ctx: &mut TxContext
    ): Listing {
        assert!(price > 0, EInvalidPrice);

        let nft_id = object::id(&nft);
        let listing_id = object::new(ctx);
        let listing_id_copy = object::uid_to_inner(&listing_id);

        let listing = Listing {
            id: listing_id,
            nft_id,
            seller: tx_context::sender(ctx),
            price,
            created_at: tx_context::epoch(ctx),
        };

        // Emit event
        event::emit(ListingCreated {
            listing_id: listing_id_copy,
            nft_id,
            seller: tx_context::sender(ctx),
            price,
        });

        // Store NFT in listing (simplified - real impl uses Kiosk)
        transfer::public_transfer(nft, @marketplace);

        listing
    }

    /// Cancel a listing and return the NFT
    public fun cancel_listing(
        listing: Listing,
        ctx: &mut TxContext
    ) {
        let Listing {
            id,
            nft_id: _,
            seller,
            price: _,
            created_at: _,
        } = listing;

        // Only seller can cancel
        assert!(seller == tx_context::sender(ctx), ENotOwner);

        event::emit(ListingCancelled {
            listing_id: object::uid_to_inner(&id),
            seller,
        });

        object::delete(id);

        // Return NFT to seller (simplified)
        // Real implementation retrieves from Kiosk
    }

    /// Purchase NFT from listing
    public fun buy_from_listing(
        listing: Listing,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let Listing {
            id,
            nft_id,
            seller,
            price,
            created_at: _,
        } = listing;

        // Verify payment amount
        assert!(coin::value(&payment) >= price, EInsufficientPayment);

        let buyer = tx_context::sender(ctx);

        // Emit event
        event::emit(NFTPurchased {
            listing_id: object::uid_to_inner(&id),
            nft_id,
            buyer,
            seller,
            price,
        });

        // Transfer payment to seller
        transfer::public_transfer(payment, seller);

        // Transfer NFT to buyer (simplified)
        // Real implementation uses Kiosk

        object::delete(id);
    }

    // ==========================================
    // Getters
    // ==========================================

    public fun price(listing: &Listing): u64 {
        listing.price
    }

    public fun seller(listing: &Listing): address {
        listing.seller
    }

    public fun nft_id(listing: &Listing): ID {
        listing.nft_id
    }
}

#[test_only]
module marketplace::listing_tests {
    use marketplace::listing;
    use sui::test_scenario;
    use sui::coin;
    use sui::sui::SUI;

    public struct TestNFT has key, store {
        id: UID,
    }

    #[test]
    fun test_create_listing() {
        let seller = @0xA;
        let mut scenario = test_scenario::begin(seller);

        // Create NFT
        let nft = TestNFT {
            id: object::new(test_scenario::ctx(&mut scenario))
        };

        // Create listing
        let listing = listing::create_listing(
            nft,
            1000,
            test_scenario::ctx(&mut scenario)
        );

        // Verify listing
        assert!(listing::price(&listing) == 1000, 0);
        assert!(listing::seller(&listing) == seller, 1);

        transfer::public_share_object(listing);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_buy_listing() {
        let seller = @0xA;
        let buyer = @0xB;

        let mut scenario = test_scenario::begin(seller);

        // Seller creates listing
        {
            let nft = TestNFT {
                id: object::new(test_scenario::ctx(&mut scenario))
            };

            let listing = listing::create_listing(
                nft,
                1000,
                test_scenario::ctx(&mut scenario)
            );

            transfer::public_share_object(listing);
        };

        // Buyer purchases
        test_scenario::next_tx(&mut scenario, buyer);
        {
            let listing = test_scenario::take_shared<listing::Listing>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1000, test_scenario::ctx(&mut scenario));

            listing::buy_from_listing(listing, payment, test_scenario::ctx(&mut scenario));
        };

        test_scenario::end(scenario);
    }
}
```

---

## Example 2: TypeScript Type Generation

### Input: Move ABI (after build)

```json
{
  "structs": [
    {
      "name": "Listing",
      "fields": [
        { "name": "id", "type": "UID" },
        { "name": "nft_id", "type": "ID" },
        { "name": "seller", "type": "address" },
        { "name": "price", "type": "u64" },
        { "name": "created_at", "type": "u64" }
      ]
    }
  ],
  "functions": [
    {
      "name": "create_listing",
      "visibility": "public",
      "parameters": [
        { "name": "nft", "type": "T" },
        { "name": "price", "type": "u64" }
      ]
    }
  ]
}
```

### Generated TypeScript

```typescript
// Auto-generated from Move ABI
// Generated: 2024-01-28

export interface Listing {
  id: string;
  nft_id: string;
  seller: string;
  price: number | bigint;
  created_at: number | bigint;
}

export interface ListingCreated {
  listing_id: string;
  nft_id: string;
  seller: string;
  price: number | bigint;
}

export interface NFTPurchased {
  listing_id: string;
  nft_id: string;
  buyer: string;
  seller: string;
  price: number | bigint;
}

// Contract Functions

export function create_listing(
  nft: any,
  price: number | bigint,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::listing::create_listing`,
    arguments: [tx.object(nft), tx.pure(price)],
  });
  return txb;
}

export function cancel_listing(
  listing_id: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::listing::cancel_listing`,
    arguments: [tx.object(listing_id)],
  });
  return txb;
}

export function buy_from_listing(
  listing_id: string,
  payment: any,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::listing::buy_from_listing`,
    arguments: [tx.object(listing_id), tx.object(payment)],
  });
  return txb;
}

// Event subscription helpers
// ✅ subscribeEvent in SDK v2 uses gRPC streaming internally (replaces WebSocket)

export function subscribeToListingCreated(
  client: SuiClient,
  callback: (event: ListingCreated) => void
) {
  return client.subscribeEvent({
    filter: {
      MoveEventType: `${PACKAGE_ID}::listing::ListingCreated`
    },
    onMessage: (event) => {
      callback(event.parsedJson as ListingCreated);
    }
  });
}
```

---

## Example 3: Quality Check Outputs

### Fast Mode Output

```bash
🚀 Fast Mode Quality Check

1️⃣ Checking compilation...
BUILDING marketplace
UPDATING GIT DEPENDENCY https://github.com/MystenLabs/sui.git
INCLUDING DEPENDENCY Sui
INCLUDING DEPENDENCY MoveStdlib
BUILDING marketplace
✅ Compilation successful

2️⃣ Running linter...
✅ No linter warnings

✅ Fast mode checks passed!
⏱️  Time: 5.2 seconds
```

### Standard Mode Output

```bash
🔍 Standard Mode Quality Check

1️⃣ Checking compilation...
✅ Compilation successful

2️⃣ Running linter...
✅ No linter warnings

3️⃣ Running Move analyzer...
Analyzing module marketplace::listing
  ✓ No unused variables
  ✓ No dead code
  ✓ All functions reachable
✅ Analyzer passed

4️⃣ Checking security patterns...
  ✓ No unchecked arithmetic
  ✓ No hardcoded addresses
  ✓ Capabilities properly protected
✅ Security patterns OK

5️⃣ Checking naming conventions...
  ✓ Structs: PascalCase
  ✓ Functions: snake_case
  ✓ Constants: UPPER_CASE
✅ Naming conventions compliant

✅ Standard mode checks passed!
⏱️  Time: 28.7 seconds
```

### Strict Mode Output

```bash
🔒 Strict Mode Quality Check

1️⃣ Checking compilation...
✅ Compilation successful

2️⃣ Running linter...
✅ No linter warnings

3️⃣ Running Move analyzer...
✅ Analyzer passed

4️⃣ Checking security patterns...
✅ Security patterns OK

5️⃣ Checking naming conventions...
✅ Naming conventions compliant

6️⃣ Running deep security audit...
  ✓ No reentrancy patterns
  ✓ Shared object access safe
  ✓ No capability escapes
  ✓ Authorization properly enforced
✅ Deep security audit passed

7️⃣ Analyzing gas usage...

Function Gas Costs:
  create_listing                   1,234 gas units
  cancel_listing                     456 gas units
  buy_from_listing                 2,345 gas units

💡 Optimization suggestions:
  - Consider caching vector::length calls in loops
  - Use Table instead of vector for large collections

✅ Gas analysis complete

8️⃣ Checking documentation...
  Public functions: 6
  Doc comments: 6
✅ All public functions documented

9️⃣ Comparing with SUI security checklist...
  ✓ Access control: Capability-based ✅
  ✓ Integer safety: Checked arithmetic ✅
  ✓ Object safety: Proper lifecycle ✅
  ✓ Event completeness: All state changes ✅
✅ Security checklist compliant

✅ Strict mode checks passed!
⏱️  Time: 1m 52s
```

---

## Example 4: Real-time Development Suggestions

### Scenario 1: Hardcoded Address Detection

**User writes:**
```move
const ADMIN_ADDRESS: address = @0x123abc...;

public fun admin_function(ctx: &TxContext) {
    assert!(tx_context::sender(ctx) == ADMIN_ADDRESS, 0);
    // ...
}
```

**Suggestion:**
```
⚠️  Hardcoded address detected for access control

💡 Consider using a capability instead:

public struct AdminCap has key, store {
    id: UID
}

fun init(ctx: &mut TxContext) {
    transfer::transfer(
        AdminCap { id: object::new(ctx) },
        tx_context::sender(ctx)
    );
}

public fun admin_function(_: &AdminCap, ctx: &TxContext) {
    // Only admin cap holder can call
}

Benefits:
  ✓ Secure: Cannot be spoofed
  ✓ Transferable: Can change admin
  ✓ Auditable: Cap ownership tracked on-chain
```

### Scenario 2: Deprecated API Detection

**User writes:**
```move
transfer::transfer(obj, recipient);
```

**Suggestion:**
```
⚠️  transfer::transfer is deprecated in SUI v1.18.0

Use public_transfer instead:
  transfer::public_transfer(obj, recipient);

Or for objects without 'store' ability:
  transfer::transfer(obj, recipient);  // Still valid

Current function signature suggests 'store' ability - use public_transfer.
```

### Scenario 3: Missing Event Emission

**User writes:**
```move
public fun create_listing(nft: NFT, price: u64, ctx: &mut TxContext) {
    let listing = Listing {
        id: object::new(ctx),
        nft,
        price,
    };

    transfer::share_object(listing);
}
```

**Suggestion:**
```
💡 Consider emitting an event for this state change

public struct ListingCreated has copy, drop {
    listing_id: ID,
    price: u64,
    seller: address,
}

// Add before transfer::share_object:
event::emit(ListingCreated {
    listing_id: object::uid_to_inner(&listing.id),
    price,
    seller: tx_context::sender(ctx),
});

Benefits:
  ✓ Frontend can track new listings
  ✓ Analytics and monitoring
  ✓ Debugging and auditing
```

---

## Example 5: Frontend Integration Complete Flow

### Step 1: Build Move Contract

```bash
sui move build
```

### Step 2: Generate TypeScript Types

```bash
sui-developer gen-types
```

**Output:** `frontend/src/types/marketplace.ts`

### Step 3: Frontend Implementation

```typescript
import { create_listing, subscribeToListingCreated } from './types/marketplace';
import { useDAppKit } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';

export function CreateListingButton({ nftId, price }: Props) {
  const dAppKit = useDAppKit();

  const handleCreateListing = async () => {
    // Use generated function
    const txb = create_listing(nftId, price);

    // Execute transaction
    const result = await dAppKit.signAndExecuteTransaction({
      transaction: txb,
    });

    if (result.FailedTransaction) throw new Error('Transaction failed');
    console.log('Listing created:', result.Transaction.digest);
  };

  return (
    <button onClick={handleCreateListing}>
      Create Listing
    </button>
  );
}

// Subscribe to events
export function useListingEvents() {
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToListingCreated(
      suiClient,
      (event) => {
        setListings(prev => [...prev, event]);
      }
    );

    return () => unsubscribe();
  }, []);

  return listings;
}
```

---

These examples demonstrate the complete development workflow from specification to production-ready frontend integration.
