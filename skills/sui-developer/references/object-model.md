<!-- Concept prose sourced from MystenLabs/skills@4c55997 object-model/. No SDK version pin — conceptual. -->

# Sui Object Model — Deep Reference

This is the conceptual reference for how Sui's object model interacts with storage
layout, ownership, transfers, and parallel execution. It exists so you can make the
right structural call *before* writing Move — most performance and correctness pain
in Sui comes from picking the wrong storage primitive or ownership type up front, and
those decisions are expensive to reverse once objects exist on-chain.

## Contents

1. [Derived objects vs dynamic fields](#1-derived-objects-vs-dynamic-fields)
2. [Transfer-to-object as an index vs Table](#2-transfer-to-object-as-an-index-vs-table)
3. [Ownership and parallel execution](#3-ownership-and-parallel-execution)
4. [Transfers: Receiving, receive vs public_receive](#4-transfers-receiving-receive-vs-public_receive)
5. [The hot-potato clique (brief)](#5-the-hot-potato-clique-brief)

---

## 1. Derived objects vs dynamic fields

Both derived objects and dynamic fields let you attach storage to a parent without
declaring every field up front. They look interchangeable from a distance. They are
not — the difference is *where the access path runs through*, and that difference
decides whether your design parallelizes or bottlenecks.

A **derived object** has a deterministic ID computed from its parent and a key:
`derived_object::derive_address(parent_id, key)`. The crucial property is that you
compute the address *before* the object is created. The address is a pure function of
`(parent_id, key)`, so anyone who knows the parent and the key can name the slot
without reading chain state.

Why this matters, broken down:

- **Deterministic.** The same `(parent, key)` always maps to the same address. You can
  address an entry before it exists — there is no "look it up to find where it lives"
  round-trip, because the location *is* the key. This is what makes registries and
  per-user config slots trivial: the lookup is arithmetic, not a query.
- **Not hierarchical.** A derived object is an *independent* object, not a child living
  inside the parent. The parent only guarantees *uniqueness of the address at creation
  time* — it does not act as an owner or an access gate afterward. Once created, the
  derived object stands on its own with whatever ownership type you gave it. Don't
  reach for derived objects expecting parent-mediated access control; that's the
  dynamic-field model, not this one.
- **Parallel-friendly.** Two derived objects under unrelated keys can be updated
  simultaneously because each is its own object with its own version line. Contrast
  this with dynamic fields, which **sequence through the parent**: every dynamic-field
  write touches the parent object, so concurrent writes to different fields still
  contend on the single parent. That parent becomes the serialization point. Derived
  objects sidestep it entirely.
- **Receive-before-creation.** Because the address is known ahead of time, assets can
  be *sent to a derived address before the object at that address even exists*. The
  slot is reservable. This is the basis for the transfer-to-object index pattern in
  section 2.

### Decision table

| Aspect | Derived objects | Dynamic fields |
|---|---|---|
| Address predictable before creation | Yes | Yes |
| Parent required for access | Only at creation | Always |
| Independent ownership | Yes (any ownership type) | No (always owned by parent) |
| Can receive objects | Yes | No |
| Parallel access | Yes | Limited (sequenced through parent) |
| Supports deletion | Yes | Yes |

**Use derived objects for:** registries, per-user config, soulbound tokens, and any
case where you want parallel access without bottlenecking every reader/writer through
a single parent object.

**Use dynamic fields for:** parent-owned heterogeneous or extensible storage where
the parent legitimately *should* own and gate the data, and where write contention on
that parent is not your concern.

---

## 2. Transfer-to-object as an index vs Table

Transfer-to-object (TTO) can replace a shared-object collection when what you actually
need is an *index* — a way to enumerate "all the things belonging to X" — rather than
on-chain readable structured storage.

The pattern: create "box" objects at *derived addresses* (one box per index key), then
transfer items *to the box*. Off-chain, you enumerate a box's contents with
`listOwnedObjects(owner = derived_addr)` — paginated, type-filterable, and with no BCS
decoding needed because each item is a first-class object the RPC already understands.
On-chain, you access items by accepting them with `Receiving<T>` and
`transfer::public_receive`, holding a `&mut UID` of the box (the box's mutable `UID` is
the access-control gate; see section 4).

The two designs trade off cleanly:

- **Table + shared object.** All writes serialize on the single shared object — every
  insert goes through consensus ordering on that one object. The upside: the index is
  **readable from Move**, so on-chain logic can iterate or check membership directly.
- **TTO + derived boxes.** Writes to *different keys* are independent (different boxes,
  different version lines), so write throughput scales with key spread instead of
  collapsing onto one object. The cost: the index is **off-chain only** — you read it
  via RPC (`listOwnedObjects`), and Move code *cannot* read the index. There is no
  Move-side "give me everything in this box" without receiving each item.

**Rule:** Use TTO + derived boxes when write contention is the bottleneck *and* you do
not need to read the index from Move. Use a Table on a shared object when on-chain
readability of the collection matters.

---

## 3. Ownership and parallel execution

This is the load-bearing section. Sui's parallelism is a direct consequence of object
ownership: which objects a transaction touches, and *how* it touches them, determines
whether that transaction can skip consensus and run on the fastpath, or must be
sequenced. Get this wrong and you've built a system that serializes under load no
matter how clean the Move is.

There are five ownership situations to reason about.

### Address-owned

Owned by exactly one address; only that address can use the object. A transaction that
touches **only** address-owned (and immutable) objects runs on the **fastpath**: it
*skips consensus ordering* entirely, giving the lowest latency and full parallelism
across unrelated objects. The constraint: only **one inflight transaction per object
version** — because there's no consensus to order competing spends, you must reference
the exact current version and can't have two in-flight transactions racing on it.

### Party objects (consensus-address-owned)

Single-address ownership, like address-owned, *but consensus-sequenced*. The owner
variant is `ConsensusAddressOwner`. Move API: `sui::transfer::party_transfer` /
`sui::transfer::public_party_transfer`, using the type `sui::party::Party` (currently
only `party::single_owner`).

The point of party objects is to keep single-owner semantics while gaining
**pipelining**: because they go through consensus, you can have **multiple inflight
transactions against the same object** — you're not limited to one-in-flight the way
address-owned objects are. The cost is consensus latency on every use. Versus shared
objects: a party object is still single-owner, and unlike a shared object it can be
**transferred or wrapped** (shared objects cannot). So party objects are the right
choice when you want "one owner, but high transaction rate against this object."

### Shared objects

Usable by anyone; they **require consensus ordering** (Mysticeti), which costs latency
and gas. Created via `share_object` / `public_share_object`. A shared object **cannot
be unshared** — sharing is permanent.

**Access-mode → parallel rule (the key insight):** how a function *takes* a shared
object decides whether transactions using it can run in parallel.

- A function taking a shared object by `&` (immutable reference) causes the system to
  mark that usage `mutable: false`. Multiple read-only transactions against the same
  shared object then **schedule in parallel** — no two of them need to be ordered
  against each other.
- A function taking it by `&mut` or **by value** marks the usage `mutable: true`, and
  consensus **must sequence** those transactions against each other.

The consequence: **prefer `&` on shared objects whenever you don't mutate.** A shared
object accessed only immutably stops being a serialization point. Front-end note: you
reference a shared object directly by its ID as a transaction input — there's no fetch
step to grab the current version first (the system resolves it through consensus).

### Immutable (frozen)

Read-only forever; created via `freeze_object` / `public_freeze_object`. Like
address-owned access, frozen objects skip consensus and run on the **fastpath** — they
can never change, so there is nothing to order. Good for config/reference data that's
read by everyone and written by no one.

### Wrapped

Stored *inside* another object. While wrapped, the object is **not addressable by its
ID** — you can only reach it through the wrapper. Wrapping requires the `store`
ability. Wrap and unwrap happen **atomically within a single transaction**; there is no
"partially wrapped" intermediate state visible on-chain.

### Versioning (Lamport timestamps)

Every object a transaction touches is bumped to `1 + max(input versions)` — a single
Lamport-style version for all of them. This ties back to scheduling:

- Address-owned and immutable objects **skip consensus**, so a transaction must name
  the **exact current version** and only **one transaction can be inflight** against
  that version at a time.
- Shared and party objects **go through consensus**, which is precisely what makes
  **concurrent inflight** transactions against them legal — consensus assigns the
  ordering the fastpath can't.

---

## 4. Transfers: Receiving, receive vs public_receive

Sui has six transfer functions split across two tiers, and the split exists to let you
**enforce custom transfer rules**.

**Module-restricted (no `store` ability required):** `transfer::transfer`,
`transfer::share_object`, `transfer::freeze_object`. These are callable **only from the
module that defines the type**. That restriction is the feature: by *not* giving a type
the `store` ability, you force every transfer/share/freeze to route through your own
module's functions, where you can impose rules (allowlists, fees, soulbound behavior).
The catch is permanent — **adding `store` to a type gives up custom-transfer
enforcement forever**, because it unlocks the public tier below for anyone.

**Public (requires `store`):** `transfer::public_transfer`, `public_share_object`,
`public_freeze_object`. Anyone can call these on any object that has `key + store`.

### Transfer-to-object

Sui treats 32-byte **addresses and object IDs identically**, so a "transfer to an
address" and a "transfer to an object" are the same operation —
`transfer::public_transfer(sword, @0x0B)` sends `sword` to the object whose ID is
`@0x0B`. Note the deliberate contrast with Ethereum: the recipient is **not
auto-credited** the way an ETH balance increments. The object lands at the recipient
address, but the recipient must **explicitly accept** it.

Acceptance goes through `Receiving<T>`:

- `transfer::receive(parent_uid, receiving)` — for objects whose type is defined in the
  **current module**. The received child does **not** need the `store` ability.
- `transfer::public_receive(parent_uid, receiving)` — for **any** object with
  `key + store`.

Both functions require **mutable access to the parent's `UID`**. That mutable-`UID`
requirement *is* the access-control gate: only code that can produce a `&mut UID` of the
recipient can pull objects out of it. `Receiving<T>` has only the `drop` ability, which
means you can selectively receive **some, none, or all** of the objects sent to a
parent — you're never forced to accept everything.

### Deletion

- Objects **without** the `drop` ability must be **unpacked**, then `object::delete()`
  is called on the `UID`.
- Deleting a parent that still has **dynamic fields renders those fields permanently
  inaccessible** — always remove the dynamic fields *before* deleting the parent.
- A **shared object can be destroyed** if a function takes it **by value** and deletes
  it within the same transaction (consistent with the access-mode rule in section 3:
  by-value is `mutable: true`).

---

## 5. The hot-potato clique (brief)

A **hot potato** is a struct with **no abilities** — it can't be stored, copied, or
dropped, so it **must be consumed before the transaction ends**. This is the mechanism
behind enforced flash-loan-style flows: you hand someone a value they're obligated to
resolve.

The clique aspect, in brief: **consuming a shared object by value permanently marks its
clique "hot"**, and **non-public entry calls require their argument's clique hot-count
to be zero**. Practically, this means you must **resolve outstanding hot potatoes
before making non-public entry calls** on objects in the same clique — otherwise the
PTB is rejected ("went hot"). When a PTB unexpectedly fails on a hot-clique check, this
is usually why.

Full mechanics (PTB construction, clique propagation, ordering of receives and entry
calls) live in the sui-ts-sdk references — see `references/ptbs-advanced.md` in the
sui-ts-sdk skill.
