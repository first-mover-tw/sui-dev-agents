# Walrus Memory (MemWal) — portable agent memory

**Beta.** `@mysten-incubation/memwal@0.0.7` (peer deps are ranges, not pins). The relayer ships a
runtime compatibility contract (`MEMWAL_TYPESCRIPT_COMPATIBILITY_VERSION`) — expect the API to churn
while it is incubation-scoped. Deep/authoritative API: <https://memory.walrus.xyz>,
<https://docs.wal.app/llms.txt>, and `MystenLabs/MemWal` `SKILL.md`.

> **Note:** these examples are NOT type-checked by this repo's snippet gate (the package is not installed
> in the CI snippet env, so the fences are `// @check:skip`). Symbols below were verified by hand against
> the published `0.0.7` `.d.ts`. Re-verify against the then-current `.d.ts` before relying on them.

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
| **Manual** (client-side encrypt) | `@mysten-incubation/memwal/manual` (`MemWalManual`) | Client embeds + SEAL-encrypts; relayer relays the Walrus upload | Yes — as your own deps; configured via `suiPrivateKey` + `packageId`, no delegate-key session |
| **Account** (account mgmt) | `@mysten-incubation/memwal/account` | n/a | Yes (`@mysten/sui`) |

**Trust boundary (Relayer mode):** the raw delegate private key is **never** transmitted. The SDK builds
a SEAL `SessionKey` client-side — ephemeral (5-min TTL), scoped to the relayer's `packageId`, signed by
the delegate key — and sends only the exported session bytes via the `x-seal-session` header, so the
server's TEE can SEAL-decrypt on recall with a bounded blast radius. Building that session **dynamically
imports `@mysten/seal` + `@mysten/sui` at runtime**, so both must be installed even though the default
`.` entry has no static import of them. In **Manual mode** (`MemWalManual`)
no delegate-key SEAL session is sent: the client embeds and SEAL-encrypts locally with its own
`suiPrivateKey`, then ships `{ encrypted_data, vector }` to the relayer, which relays the Walrus upload.
(A still-lower-level variant exists on the default client — `MemWal.rememberManual({ blobId, vector })` —
where *you* upload the encrypted blob to Walrus yourself and the server only stores the `blobId ↔ vector`
mapping.)

## Quickstart (Relayer mode)

```typescript
// @check:skip
import { MemWal } from "@mysten-incubation/memwal";

const memwal = MemWal.create({
  key: process.env.MEMWAL_PRIVATE_KEY!, // Ed25519 delegate private key (hex)
  accountId: process.env.MEMWAL_ACCOUNT_ID!, // Walrus Memory account object ID
  // serverUrl defaults to https://relayer.memwal.ai/ — usually omit it
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
- **Use the object form of `recall`.** `recall({ query, limit?, namespace?, maxDistance?, topK? })`.
  The positional `recall(query, limit, namespace)` is `@deprecated` (easy to misread as
  `recall(query, namespace)`). `topK` and `limit` are aliases; `topK` wins if both are set.
- **`serverUrl` is built-in.** Default `https://relayer.memwal.ai/` — only set it for a self-hosted
  relayer. (The repo README's `your-relayer-url.com` is a placeholder, not a required value.)
- **Peer deps are version ranges:** `@mysten/sui >=2.5.0`, `@mysten/seal >=1.1.0`,
  `@mysten/walrus >=1.0.3`, `ai >=4.0.0`, `zod ^3.23.0`. Note the default `.` entry has no *static*
  import of `@mysten/sui`/`@mysten/seal`, but Relayer-mode recall *dynamically* imports both to build
  the SEAL session — install them regardless (recall throws without them).
- **Delegate-key hygiene.** The key is an Ed25519 secret. `destroy()` zeroes the SDK's own key
  buffers (the `Uint8Array` copies it holds) and drops cached session material — it does NOT erase the
  original hex string / env var you passed in (JS can't reliably wipe those), so don't treat it as a
  full-memory scrub. The key never leaves the client (only its public key, a per-request signature, and the ephemeral
  `x-seal-session` bytes go on the wire) — but it can still sign Sui transactions from the delegate
  address, so keep it server-side and never ship it to a browser.
- **Other useful calls:** `rememberBulk(items)` (≤20/call), `analyze(text)` (extract facts from
  conversation), `restore(namespace, limit?=10)` (rebuild the local vector index from Walrus),
  `embed(text)`, `health()`, `compatibility()`.
