# Red Team Attack Pattern Catalog

## 1. Access Control Attacks

### 1.1 Missing Capability Check
**Target:** Public entry functions that should require `AdminCap` or similar.
**Method:** Call the function from a non-admin address without passing any capability object.
**Signal:** If the call succeeds, the function lacks authorization.

### 1.2 Forged Capability
**Target:** Functions accepting capability by reference.
**Method:** Create a fake object with the same struct name in a test module.
**Signal:** Move's type system should reject this — if not, there's a module visibility issue.

### 1.3 Wrong Sender
**Target:** Functions that check `tx_context::sender()` against a stored address.
**Method:** Call from an address that differs from the expected owner.
**Signal:** If it succeeds, the sender check is missing or incorrect.

### 1.4 Shared Object Theft
**Target:** Shared objects with mutable references in entry functions.
**Method:** Pass a shared object the attacker shouldn't control.
**Signal:** If state is modified, access control on the shared object is insufficient.

---

## 2. Integer Abuse

### 2.1 Zero Value
**Target:** Functions accepting amounts (transfer, mint, withdraw, price).
**Method:** Pass `0` as amount.
**Signal:** If it succeeds with zero, missing `assert!(amount > 0)`.

### 2.2 MAX_U64 Overflow
**Target:** Arithmetic operations (add, multiply).
**Method:** Pass `18446744073709551615` (MAX_U64) to trigger overflow.
**Signal:** Move VM aborts on overflow — but if wrapped in unchecked math, exploit possible.

### 2.3 Underflow
**Target:** Subtraction operations (withdraw, reduce balance).
**Method:** Withdraw more than balance.
**Signal:** Should abort; if it wraps around, critical vulnerability.

### 2.4 Precision Loss
**Target:** Division operations (fee calculation, price per unit).
**Method:** Use values that cause integer division truncation (e.g., 1 / 3 * 3 ≠ 1).
**Signal:** If truncation benefits attacker (rounding down fees), economic exploit.

---

## 3. Object Manipulation

### 3.1 Wrong Object Type
**Target:** Functions accepting generic or loosely-typed objects.
**Method:** Pass an object of a different type than expected.
**Signal:** Move type system should catch this — test verifies correct type constraints.

### 3.2 Shared Object Contention
**Target:** Functions modifying shared objects.
**Method:** Simulate concurrent modifications from different senders in same test.
**Signal:** If ordering matters, there may be a race condition in production.

### 3.3 Object Double-Use
**Target:** Functions consuming objects (transfer, burn, merge).
**Method:** Attempt to use the same object reference twice in a transaction.
**Signal:** Move's ownership model should prevent this — verify it does.

### 3.4 Orphan Object Creation
**Target:** Functions that create objects without proper ownership assignment.
**Method:** Call create functions and check if all objects are properly owned or shared.
**Signal:** Orphan objects waste storage and may indicate logic bugs.

---

## 4. Economic Attacks

### 4.1 Flash Loan Simulation
**Target:** DeFi functions (swap, provide liquidity, arbitrage).
**Method:** In a single test transaction: borrow → manipulate price → profit → repay.
**Signal:** If profit is extractable, the protocol is vulnerable to flash loan attacks.

### 4.2 Price Manipulation
**Target:** Functions using on-chain price data or reserves for calculation.
**Method:** Manipulate input to skew price ratios (large deposit → swap → withdraw).
**Signal:** If slippage controls are missing, attacker can extract value.

### 4.3 Fee Bypass
**Target:** Functions that charge fees (marketplace, DEX, lending).
**Method:** Use edge-case amounts where fee rounds to 0 (e.g., amount = 1 with 0.1% fee).
**Signal:** If fee = 0 but transaction succeeds, fee logic is bypassable.

### 4.4 Dust Attack
**Target:** Functions accepting any positive amount.
**Method:** Send minimum possible value (1 unit) repeatedly.
**Signal:** If it creates state (objects, entries), storage can be bloated cheaply.

---

## 5. Input Fuzzing

### 5.1 Empty Vector
**Target:** Functions accepting `vector<u8>` or `vector<T>`.
**Method:** Pass `vector::empty()`.
**Signal:** If it causes abort in unexpected place, error handling is incomplete.

### 5.2 Max-Length Input
**Target:** Functions accepting strings or vectors without length limits.
**Method:** Pass vector with 10,000+ elements.
**Signal:** If gas spikes or function behaves unexpectedly, missing length validation.

### 5.3 Special Bytes
**Target:** Functions processing byte data (names, URIs, metadata).
**Method:** Include `0x00` (null), `0xFF`, control characters.
**Signal:** If it causes parsing issues downstream, input sanitization is missing.

### 5.4 Boundary Values
**Target:** Functions with implicit range assumptions.
**Method:** Test with 0, 1, MAX-1, MAX for all numeric parameters.
**Signal:** Boundary errors often reveal off-by-one bugs.

---

## 6. Ordering / Timing Attacks

### 6.1 Transaction Order Dependency
**Target:** Functions whose outcome depends on execution order.
**Method:** In test_scenario, vary the order of transactions between users.
**Signal:** If outcome changes based on order, front-running is possible.

### 6.2 Epoch Manipulation
**Target:** Functions using `tx_context::epoch()` for time-based logic.
**Method:** Advance epoch in test_scenario and call at different epochs.
**Signal:** If time-lock can be bypassed by epoch advancement, logic is flawed.

### 6.3 Timelock Bypass
**Target:** Functions with cooldown or lock period.
**Method:** Call immediately after lock, at exact unlock time, one epoch before.
**Signal:** Off-by-one in epoch comparison = bypass.

---

## 7. Type Confusion

### 7.1 Wrong Generic Parameter
**Target:** Functions with generic type parameters `<T>`.
**Method:** Instantiate with an unexpected type (e.g., `Coin<FAKE>` instead of `Coin<SUI>`).
**Signal:** If function doesn't validate the type, funds can be drained.

### 7.2 Phantom Type Abuse
**Target:** Structs using `phantom` type parameters for tagging.
**Method:** Create struct with wrong phantom type to bypass type-level restrictions.
**Signal:** If it compiles and runs, phantom type isn't enforced properly.

### 7.3 Ability Constraint Bypass
**Target:** Functions requiring specific abilities (store, copy, drop).
**Method:** Test that objects without required abilities are correctly rejected.
**Signal:** If unconstrained, objects may be duplicated or dropped unexpectedly.

---

## 8. Denial of Service

### 8.1 Gas Exhaustion
**Target:** Functions with loops or recursive-like patterns.
**Method:** Provide input that maximizes iteration count.
**Signal:** If gas exceeds reasonable limits, function is DoS-vulnerable.

### 8.2 Storage Bloat
**Target:** Functions creating dynamic fields or table entries.
**Method:** Call repeatedly with minimal cost to create maximum state.
**Signal:** If 1 SUI can create thousands of entries, storage economics are broken.

### 8.3 Recursive Depth
**Target:** Functions with indirect recursion through module calls.
**Method:** Construct call chain that maximizes stack depth.
**Signal:** Stack overflow = DoS vector (though Move has depth limits).
