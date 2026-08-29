# Walrus Memory (MemWal) — portable agent memory

**Beta.** `@mysten-incubation/memwal@0.1.5` (peer deps are ranges, not pins). The relayer ships a
runtime compatibility contract (`MEMWAL_TYPESCRIPT_COMPATIBILITY_VERSION`) — expect the API to churn
while it is incubation-scoped. Deep/authoritative API: <https://memory.walrus.xyz>,
<https://docs.wal.app/llms.txt>, and `MystenLabs/MemWal` `SKILL.md`.

> **Note:** these examples are NOT type-checked by this repo's snippet gate (the package is not installed
> in the CI snippet env, so the fences are `// @check:skip`). Symbols below were verified by hand against
> the published `0.1.5` `.d.ts`. Re-verify against the then-current `.d.ts` before relying on them.

## What it is — and when to reach for it

Walrus Memory is a **high-level agent memory layer**: it stores memories as blobs on Walrus, encrypts
them with SEAL, enforces ownership onchain via Sui smart contracts, and retrieves them by **semantic
(vector) search**. Memory is scoped by `owner + namespace` and is portable across apps/agents/sessions.

| You want… | Use |
| --- | --- |
| Store / fetch a file or blob yourself | raw `@mysten/walrus` (the rest of this skill) |
| Give an AI agent durable, semantically-searchable memory | **Walrus Memory (this file)** |

Reach for MemWal when an agent needs memory that survives the context window, moves across runtimes, is
owner-controlled, and is retrievable by meaning. Do NOT use it for transient session context or large
file storage — that is raw Walrus.

## Three modes (pick the entry point)

| Mode | Import | Who stores (SEAL + Walrus) | Needs `@mysten/sui` + `@mysten/seal` at runtime |
| --- | --- | --- | --- |
| **Relayer** (default, simplest) | `@mysten-incubation/memwal` | Server-side TEE | **Yes** — dynamically imported to build the SEAL session (see below) |
| **Manual** (client-side encrypt) | `@mysten-incubation/memwal/manual` (`MemWalManual`) | Client embeds + SEAL-encrypts; relayer relays the Walrus upload | Yes — as your own deps; configured via `suiPrivateKey` *or* a dapp-kit-style `walletSigner`, plus `packageId`; no delegate-key session |
| **Account** (account mgmt) | `@mysten-incubation/memwal/account` | n/a | Yes (`@mysten/sui`) |
| **AI middleware** (≥0.1.x) | `@mysten-incubation/memwal/ai` (`withMemWal`) | Server-side TEE (wraps Relayer mode) | Yes — same as Relayer, plus the `ai` peer dep |

**Trust boundary (Relayer mode):** the raw delegate private key is **never** transmitted. The SDK builds
a SEAL `SessionKey` client-side — ephemeral (5-min TTL), scoped to the relayer's `packageId`, signed by
the delegate key — and sends only the exported session bytes via the `x-seal-session` header, so the
server's TEE can SEAL-decrypt on recall with a bounded blast radius. Building that session **dynamically
imports `@mysten/seal` + `@mysten/sui` at runtime**, so both must be installed even though the default
`.` entry has no static import of them. In **Manual mode** (`MemWalManual`)
no delegate-key SEAL session is sent: the client embeds and SEAL-encrypts locally with its own
`suiPrivateKey`, then ships `{ encrypted_data, vector }` to the relayer, which relays the Walrus upload.
(A still-lower-level variant exists on the default client — `MemWal.rememberManual({ encryptedData, vector, namespace? })` —
where *you* SEAL-encrypt and embed, pass the ciphertext as base64 `encryptedData`, and the **relayer uploads
it to Walrus** and stores the `blobId ↔ vector` mapping. **Breaking in 0.1.5:** the option was `blobId` (you
uploaded first) in ≤0.1.4.)

## Quickstart (Relayer mode)

```typescript
// @check:skip
import { MemWal } from "@mysten-incubation/memwal";

const memwal = MemWal.create({
  key: process.env.MEMWAL_PRIVATE_KEY!, // Ed25519 delegate key: hex (0x optional), suiprivkey1... bech32, or Uint8Array
  accountId: process.env.MEMWAL_ACCOUNT_ID!, // Walrus Memory account object ID
  // serverUrl defaults to https://relayer.memory.walrus.xyz — usually omit it
  namespace: "demo",
});

// remember() returns an ACCEPTED job (202), not the final result.
const accepted = await memwal.remember("User is allergic to peanuts.");
await memwal.waitForRememberJob(accepted.job_id);

// recall() — object form is preferred; positional form is @deprecated.
const result = await memwal.recall({ query: "food allergies", limit: 5 });
console.log(result.results[0]?.text, result.results[0]?.distance);

memwal.destroy(); // zeroes the SDK's key buffers + drops cached session material
// (in production wrap the calls above in try/finally so destroy() runs even on error)
```

## Gotchas

- **`remember` returns a job, not a memory.** It resolves with `{ job_id }` (202 Accepted). Await
  `waitForRememberJob(job_id)` for the terminal state, or use `rememberAndWait(text)`. Drive your own
  polling/UI with `getRememberStatus(jobId)` (`pending|running|uploaded|done|failed|not_found`).
- **Use the object form of `recall`.** `recall({ query, limit?, namespace?, maxDistance?, topK?, maxTokens?, truncationStrategy?, countTokens? })`.
  The positional `recall(query, limit, namespace)` is `@deprecated` (easy to misread as
  `recall(query, namespace)`). `topK` and `limit` are aliases; `topK` wins if both are set.
- **Token budget on `recall` (≥0.1.3).** Pass `maxTokens` and the SDK trims hits client-side per
  `truncationStrategy` (`"high-relevance-only"` default — drop lowest-relevance hits whole;
  `"drop-tail"` — cut the end of the concatenated payload; `"per-hit-cap"` — each hit gets
  `floor(maxTokens / n)`). Counting is a `CHARS_PER_TOKEN` estimate unless you supply
  `countTokens: (text) => number`. When `maxTokens` was set the result carries
  `meta: { tokenEstimate, truncated }` (assert `meta.tokenEstimate <= maxTokens`). `memwal.countTokens(text)`
  exposes the same estimator; `estimateTokens` / `truncateToTokenBudget` / `applyTokenBudget` are exported
  pure helpers.
- **`RecallResult.dropped_count?` (≥0.1.5):** number of hits the relayer skipped because the blob could not
  be downloaded/decrypted — non-zero means the answer is silently incomplete.
- **`serverUrl` is built-in.** Default `https://relayer.memory.walrus.xyz` (changed from
  `relayer.memwal.ai` in 0.1.3) — only set it for a self-hosted relayer. (The GitHub repo README's `your-relayer-url.com` is a placeholder, not a required value.)
- **Peer deps are version ranges:** `@mysten/sui >=2.5.0`, `@mysten/seal >=1.1.0`,
  `@mysten/walrus >=1.0.3`, `ai >=4.0.0`, `zod ^3.23.0 || ^4.0.0`. `ai`/`zod` (only needed by the
  `/ai` middleware) and `@mysten/walrus` (only needed by Manual mode) are marked *optional* peers
  since 0.1.x. Note the default `.` entry has no *static*
  import of `@mysten/sui`/`@mysten/seal`, but Relayer-mode recall *dynamically* imports both to build
  the SEAL session — install them regardless (recall throws without them).
- **Delegate-key hygiene.** The key is an Ed25519 secret. `destroy()` zeroes the SDK's own key
  buffers (the `Uint8Array` copies it holds) and drops cached session material — it does NOT erase the
  original hex string / env var you passed in (JS can't reliably wipe those), so don't treat it as a
  full-memory scrub. The key never leaves the client (only its public key, a per-request signature, and the ephemeral
  `x-seal-session` bytes go on the wire) — but it can still sign Sui transactions from the delegate
  address, so keep it server-side and never ship it to a browser.
- **Other useful calls:** `rememberBulk(items)` (≤20/call), `analyze(text)` (extract facts from
  conversation — also takes an options form `analyze({ namespace, occurredAt })` where
  `occurredAt?: string | Date` is sent as `occurred_at` via `Date.toISOString()`, omitted when
  absent, and throws on an invalid Date; the server resolves relative dates like "yesterday"),
  `restore(namespace, limit?=10)` (rebuild the local vector index from Walrus),
  `embed(text)`, `health()` (`HealthResult.write_ready?: boolean` since 0.1.5 — `false` = relayer not
  accepting writes, absent = not reported), `compatibility()`.
- **`restore()` truncation is reported, not silent (≥0.1.x).** `RestoreResult` now carries
  `truncated: boolean` — `true` when the restore is known-incomplete, either because more missing
  blobs existed than `limit` allowed, or because the server's per-owner candidate-fetch cap (shared
  across namespaces) was hit before this namespace was even scanned (so `truncated` can be `true`
  with `total === 0`). Raising `limit` only helps the first case; there is no pagination cursor, so a
  cap hit cannot be worked around by retrying. Decrypt/embed failures are still dropped silently
  (counted as neither `restored` nor `skipped`). Older relayers omit the field; the SDK defaults it
  to `false`.
- **New in 0.1.x (verified vs `0.1.5` `.d.ts`):** `MemWalMock` (deterministic, dependency-free
  in-memory stand-in for the core API — never opens a socket or touches keys; token-overlap distance;
  plus test-only `forget(blobId)` / `clear(namespace?)`); `withMemWal(model, options)` AI SDK
  middleware via `@mysten-incubation/memwal/ai` (auto-recalls memories into the prompt before each
  LLM call, fire-and-forget `analyze`-saves after); batch/polling completions `rememberBulkAndWait`,
  `waitForRememberJobs`, `getRememberBulkStatus`, `analyzeAndWait`; `recallManual({ vector, limit?,
  namespace?, scoringWeights? })` on the default client (vector search returning `blob_id` +
  `distance`, no decryption); optional `ScoringWeights` (semantic / recency / importance composite
  ranking); a per-request `idempotencyKey` on `remember` / `rememberAsync` / `rememberAndWait`
  (transport-timeout retries collapse onto the original paid job — not on the bulk calls);
  `getPublicKeyHex()`; and `MemWalConfig.key` now also accepts `Uint8Array` and a `suiprivkey1...`
  bech32 string (0.1.4; decoding is internal — `decodeSuiPrivateKey` / `normalizePrivateKey` are not part of the package `exports`). Relayer
  clock-drift 401s surface as a readable `ERR_TIMESTAMP_OUT_OF_BOUNDS` error (mapped internally; no public helper).
