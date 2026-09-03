---
name: sui-red-team
description: Use when performing adversarial security testing on SUI Move contracts — generating attack tests for access control bypass, integer overflow, object manipulation, economic exploits, reentrancy, and DoS vectors. Triggers on "red team", "attack test", "find vulnerabilities", "exploit", "pentest", "security test", or when the user wants to stress-test their contract's security. For defensive security setup (scanning, hooks, checklists), use sui-security-guard instead.
---

# SUI Red Team

**Adversarial security testing for SUI Move contracts — think like a hacker, break before they do.**

## Overview

This skill runs automated attack rounds against Move contracts, generating malicious test code that actively tries to exploit vulnerabilities. Unlike static analysis, red-team testing executes real attacks.

- **Access Control Bypass** — Call admin functions without capabilities
- **Integer Abuse** — Overflow, underflow, zero-value exploits
- **Object Manipulation** — Wrong objects, shared object races, reuse attacks
- **Economic Attacks** — Flash loan simulation, price manipulation, fee bypass
- **Input Fuzzing** — Empty vectors, oversized strings, malformed data
- **Ordering Attacks** — Transaction ordering, epoch manipulation, timelock bypass
- **Type Confusion** — Wrong generics, phantom type abuse, ability bypass
- **Denial of Service** — Gas exhaustion, infinite loops, storage bloat

## Usage

```
/sui-red-team                    → 10 rounds (default), delete test files after
/sui-red-team 20                 → 20 rounds
/sui-red-team --rounds 5         → 5 rounds
/sui-red-team --keep-tests       → Keep attack tests in tests/red-team/
```

## Execution Flow

For each round N of {total_rounds}:

1. **Scan** — Read all Move source files, build module dependency graph
2. **Analyze Attack Surface** — Identify public entry functions, shared objects, token flows, admin capabilities
3. **Select Attack Vector** — Pick from attack catalog (rounds 1-8: one category each; 9+: combo attacks)
4. **Generate Attack Test** — Write Move test code with malicious inputs, boundary values, permission bypass attempts
5. **Execute** — Run `sui move test --filter "red_team_round_{N}"`
6. **Classify Result**:
   - Test **PASSES** (attack succeeds) → `EXPLOITED` — vulnerability found
   - Test **FAILS** with `expected_failure` or abort → `DEFENDED` — contract correctly blocked
   - Test shows abnormal gas / unexpected behavior → `SUSPICIOUS`
7. **Cleanup** — Delete generated test file (unless `--keep-tests`)

## Attack Vector Catalog

| # | Category | Attack Vectors |
|---|----------|---------------|
| 1 | Access Control | Call admin func without Cap, forge Cap, wrong sender, stolen shared object |
| 2 | Integer Abuse | 0 value, MAX_U64, overflow trigger, underflow trigger, precision loss |
| 3 | Object Manipulation | Wrong object ID, shared object contention, object double-use, orphan objects |
| 4 | Economic Attack | Flash loan sim, price manipulation, fee bypass, dust attack, rounding exploit |
| 5 | Input Fuzzing | Empty vector, max-length string, special bytes (0x00, 0xFF), deeply nested |
| 6 | Ordering Attack | Tx ordering dependency, epoch manipulation, timelock bypass, front-running sim |
| 7 | Type Confusion | Wrong generic param, phantom type abuse, ability constraint bypass |
| 8 | Denial of Service | Gas exhaustion, large loop trigger, storage bloat, recursive call depth |

### Round Assignment Strategy

- Rounds 1–8: Each round targets one unique category (systematic coverage)
- Rounds 9+: Combination attacks (e.g., integer abuse + economic attack)
- Each round focuses on the **highest-risk** entry point for that category

## Output Report Format

```
Red Team Report ({N} rounds)
============================

🔴 EXPLOITED ({count}):
  Round X: [sources/module.move:line] function_name() vulnerability description
    → Attack: description of successful exploit
    → Fix: suggested remediation

🟡 SUSPICIOUS ({count}):
  Round X: [sources/module.move:line] description of anomaly
    → Concern: why this is suspicious

🟢 DEFENDED ({count}):
  Round X: Category — defense description ✓

Summary: {exploited} exploits / {suspicious} suspicious / {defended} defended
Confidence: {confidence}% (based on round coverage)
```

### Confidence Calculation

- 5 rounds → 40%
- 8 rounds → 60% (all categories covered once)
- 10 rounds → 70% (+ combo attacks)
- 15 rounds → 80%
- 20+ rounds → 90%

## Test File Convention

Generated test files use the naming pattern:
```
tests/red_team_round_{N}_{category}.move
```

With `--keep-tests`, files persist in `tests/red-team/` directory for later review or extension.

## Sender impersonation via `sui-fork` (`--skip-signing`)

`sui-fork` (a local network forked from real state) plus `sui client call --skip-signing` (renamed from `--forking-mode` in v1.74.1) lets a red-teamer submit a transaction under a chosen sender address — without that user's keys. Use to:
- Confirm an exploit path is reachable from a specific privileged address.
- Reproduce a victim's exact pre-state when validating a finding.

See `sui-tester` for the full `sui-fork start` → `sui client call --sender … --skip-signing` flow. The red-team angle is using it on adversarial scenarios, not happy-path regressions.

## Protocol-specific vector: Seal on-chain decryption trusts the public keys you hand it

If the target package calls `seal::bf_hmac_encryption::decrypt`, **the key-server public keys are an unauthenticated input**, not something the Seal package validates. Both `verify_derived_keys` and `decrypt` say so outright in their doc comments: *"It is up to the caller to ensure that the given public keys are from the correct key servers."*

The attack applies when the package takes the public keys **and** the `EncryptedObject` from its caller (PTB arguments, a user-supplied config object, entry-function parameters):

1. The attacker generates their **own** IBE key pair and seals **a plaintext of their choosing** under it, with whatever `package_id` / `id` / `services` they like.
2. They wrap the public half with `new_public_key(key_server_id, pk_bytes)`. It runs `g2_from_bytes`, so the bytes must be a well-formed G2 point — but that is the *only* check: nothing binds `pk_bytes` to the real key server behind `key_server_id`.
3. They derive the matching key and pass it to `verify_derived_keys`, which only checks the derived keys **against the public keys they just supplied** — so it verifies happily.
4. `decrypt` returns their plaintext, and the package believes the real key servers released it.

**Get the impact class right.** This is a **forgery / authenticity** break, not a confidentiality break. A genuine ciphertext the attacker has no keys for stays safe: shares are unmasked with `pairing(derived_key, nonce)`, so a foreign derived key yields garbage shares and `decrypt` fails at the first gate that trips. Past the input checks — those *do* abort (`EWrongVerifiedKeys`, `EWrongPublicKeys`, `EInsufficientDerivedKeys`, and a stdlib `option::destroy_some` abort when a listed service has no supplied public key) — every remaining failure is a quiet **`none()`**, with no error code to catch. In order those gates are: the Shamir degree check (`polynomials.any!(|p| p.degree() + 1 > threshold)`, which only fires when **more shares than `threshold`** are supplied — a key server listed several times in `services` contributes several indices per derived key, so `threshold` *keys* can still yield more than `threshold` *shares*; at exactly `threshold` shares, or `threshold == n`, it cannot fire), then the randomness scalar check (~55% of garbage 32-byte values are ≥ the BLS12-381 scalar order), then `verify_nonce`. The `hmac256ctr` MAC is the *last* gate and is never reached on this path in practice (`verify_nonce` is a cryptographic equality — it lets garbage through with probability ~2⁻²⁵⁵), so do not instrument for a MAC failure and conclude the mechanism is misdescribed when you see it bail earlier. Do not write "Seal-encrypted data can be decrypted by anyone" in a report — write "the package accepts an attacker-chosen plaintext as key-server-authorized". (Conversely, do not dismiss the finding after testing that a real ciphertext still returns `none` — that is the expected behaviour and does not clear the package.)

**Why `decrypt`'s share-consistency check does not save you:** it only runs over `remaining_indices` — the services for which **no** derived key was supplied. Supply one derived key per key server and that set is empty, so the check passes **vacuously**. It is not a weak check to be strengthened; on this path it does not execute at all.

**Correct shape:** the Move package holds its own `PublicKey` values — stored at publish/config time under an `AdminCap`, or read from the on-chain key-server objects — and passes *those* to `verify_derived_keys` / `decrypt`. A caller-supplied public key is only safe when the *caller* is the only party the plaintext belongs to.

**Red-team probes:**
- Does any public/entry function accept `vector<PublicKey>`, raw pubkey bytes, or a `key_server_id` from the caller and feed it into `verify_derived_keys` / `decrypt`?
- Does the caller **also** supply the `EncryptedObject` bytes? That is what turns the trusted-input weakness into a working forgery.
- Is `key_server_id` compared against anything the package knows, or just carried along?
- Does the package act on the returned plaintext as if it were authorized (mint, transfer, unlock)? That is where the forgery cashes out.

Category: **Access Control (#1)** — an unauthenticated trust anchor — often reached with Input Fuzzing (#5) over the attacker-supplied encrypted object.

## Integration with Other Skills

- After red-team: Run `sui-security-guard` for static analysis complement
- Before deployment: `sui-deployer` should check red-team report
- Fix cycle: Exploit found → fix → re-run that specific round to verify

## Common Mistakes

❌ **Running too few rounds**
- 5 rounds only covers ~40% attack surface
- Minimum recommended: 10 rounds for meaningful coverage

❌ **Ignoring SUSPICIOUS results**
- These often indicate subtle bugs that only manifest under load
- Investigate gas anomalies and unexpected state changes

❌ **Not re-testing after fixes**
- Always re-run the specific attack round after applying a fix
- Regression: `sui move test --filter "red_team_round_{N}"`

See [reference.md](references/reference.md) for attack pattern details and [examples.md](references/examples.md) for attack test code examples.
