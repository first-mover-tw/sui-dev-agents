<!-- Concept prose sourced from MystenLabs/skills@4c55997 ptbs/ + accessing-data/. TS symbols verified against @mysten/sui d.mts on 2026-06-04: transactions/Transaction.d.mts (fromKind, onlyTransactionKind). -->

# Advanced PTBs: sponsorship, archival reads, and use-case → API mapping

## Contents

- [Sponsored transactions](#sponsored-transactions)
- [Archival reads](#archival-reads)
- [Use-case → API mapping](#use-case--api-mapping)

## Sponsored transactions

In a sponsored transaction one party (the **sender**) authorizes the PTB content while a different party (the **sponsor**) pays the gas. This requires splitting the transaction into its content (the commands) and its gas data so each can be assembled by a different party.

**Flow:**

1. The app builds the PTB **kind-only**: `const kindBytes = await tx.build({ client, onlyTransactionKind: true });` and sends `kindBytes` to the sponsor. `onlyTransactionKind: true` serializes ONLY the transaction content (the commands), deliberately leaving out gas data. This is WHY it exists — it separates the PTB body from gas so the sponsor can supply gas data independently of whatever the app constructed.
2. The sponsor rehydrates the kind-only bytes: `const sponsored = Transaction.fromKind(kindBytes);`. Because `fromKind` produces a transaction with no sender and no gas, the sponsor must set them: `sponsored.setSender(userAddress); sponsored.setGasOwner(sponsorAddress); sponsored.setGasPayment(sponsorCoins);`. The sponsor then signs as the **gas owner**.
3. The user signs as the **sender** over the same fully-assembled transaction.
4. Either party submits the dual-signed bytes. The **user submitting is safer** — if the sponsor submits, the sponsor can censor (withhold or delay) the transaction after collecting the user's signature.

**Why both parties sign the entire TransactionData.** Each signature covers the ENTIRE `TransactionData`, which includes the `GasData`. Signing only a part of the payload would let a malicious full node substitute the gas data (e.g., swap in a different gas owner or gas payment) without invalidating the signature. Signing over everything binds the sender's authorization to the exact gas arrangement.

**Sponsor safety.** The sender can reference `GasCoin` (the sponsor's coin) inside the PTB, so a malicious sender could try to drain or misuse the sponsor's gas coin. The sponsor MUST validate the PTB before signing: reject the transaction if `tx.gas` is passed by value into anything other than the final transfer back, and prefer `coinWithBalance` intents (which let the SDK resolve coins safely) over hand-rolled gas-coin manipulation.

**Rehydration helpers.** `Transaction.from(bytes)` rehydrates a FULL transaction (sender and gas already present). `Transaction.fromKind(kindBytes)` rehydrates a KIND-ONLY transaction — you MUST set sender and gas afterward, as shown above. (`Transaction.fromKind(serialized: string | Uint8Array): Transaction` is verified at `transactions/Transaction.d.mts:53`.)

**App ↔ wallet handoff.** When handing a transaction from app code to a wallet, pass `tx.serialize()` (the JSON form) or the `Transaction` instance itself — do NOT pass `tx.build()` bytes. Passing the unbuilt transaction lets the wallet perform its own gas coin selection and budget dry-run, which it cannot do once you have already built fixed bytes.

## Archival reads

Full nodes prune historical data for scalability, so reads of old state must go to a separate query-side service. The Archival Service is that service, and it is NOT transparently reachable through a full node.

**gRPC does not fall back to archival.** gRPC full-node endpoints do NOT proxy to or fall back on the Archival Service. If you query a gRPC full node for data outside its retention window you get a "not found" — the full node will not silently fetch it from archival. To read history beyond a full node's retention window over gRPC, you must query the **archival service directly** at its own endpoint.

**Archival gRPC endpoints:**
- mainnet: `archive.mainnet.sui.io:443`
- testnet: `archive.testnet.sui.io:443`

The Archival Service exposes the **same `LedgerService` gRPC API** as a full node, so you point any existing gRPC client at the archival endpoint instead of the full node — no API changes needed. These public endpoints have STRICT rate limits, so they are intended for occasional history lookups, not high-throughput querying.

**GraphQL can route to archival, but only if configured.** GraphQL RPC CAN serve archival data, but ONLY when the operator has configured it to do so — it is not automatic. If you rely on GraphQL for history, confirm the endpoint you use is backed by an archival store.

(Note: the `sui-indexer` skill has its own archival rule framed from the indexer angle; this section is deliberately framed from the TS/PTB-client angle — i.e., where the TS gRPC/GraphQL client points.)

## Use-case → API mapping

Pick the data API by walking this decision tree in order; stop at the first match.

1. **Store/retrieve a large file** → Walrus. Stop.
2. **Real-time / streaming feed** → gRPC (streaming).
3. **Single entity read** (one object, one balance, one tx, one coin list) → gRPC `client.core.*`.
4. **Joins across entities, or a historical filtered query that no single gRPC method covers** → GraphQL RPC.
5. **App-specific analytics** (leaderboards, millions of rows) → custom indexer.
6. **Data older than full-node retention** (the read returns "not found") → GraphQL RPC (which routes through the Archival Store **if configured**); if you must use gRPC, query archival directly (see above).
7. **Otherwise** → frontends, tools, and dynamic languages → GraphQL; backends, indexers, and typed languages → gRPC.

**Concrete mappings:**

| Use case | API |
|----------|-----|
| SUI balance | `client.core.listBalances` |
| Owned NFTs | `client.core.listOwnedObjects({ owner, filter: { StructType } })` (paginated, type-indexed) |
| A specific object | `client.core.getObject` |
| Wallet history across time / marketplace listings / dashboard | GraphQL |
| Live feed of new mints | gRPC streaming |
| Send a tx then read its result | gRPC + `client.waitForTransaction({ digest })`, after checking `result.effects.status.status === 'success'` |

**Anti-patterns:**

- v1 `client.getCoins` / `getObject` / `getOwnedObjects` / `getBalance` → use the v2 `client.core.*` equivalents on `SuiGrpcClient`.
- Don't poll `getOwnedObjects` to detect changes — use a gRPC subscription instead.
- JSON-RPC is deprecated; full deactivation is targeted for **July 2026**.

**TS client mapping:**

- gRPC → `SuiGrpcClient` (`@mysten/sui/grpc`)
- GraphQL → `SuiGraphQLClient` (`@mysten/sui/graphql`)
- JSON-RPC (legacy) → `SuiJsonRpcClient` (`@mysten/sui/jsonRpc`)
