# Walrus Memory (MemWal) — portable agent memory

**Beta.** `@mysten-incubation/memwal@0.1.8` (npm `latest`; the `dev` dist-tag is `0.1.8-dev.7`). Peer
deps are ranges, not pins. The relayer ships a runtime compatibility contract
(`MEMWAL_TYPESCRIPT_COMPATIBILITY_VERSION`).

**This file does not replace upstream's own docs.** MemWal ships canonical, agent-facing material of its
own, and it is more complete than anything this repo can keep current by hand. Read *this* file for the
three things upstream does not give you: (1) **errata**, where upstream's own docs contradict upstream's
source or the live relayer; (2) **which contract the deployed relayer actually runs**, which no upstream
doc states; and (3) **TypeScript detail verified against the published `.d.ts`** that the upstream
`SKILL.md` omits.

| Canonical upstream source | Read it for |
| --- | --- |
| `MystenLabs/MemWal` → `SKILL.md` (repo root) | The agent-facing API reference: entry points, response shapes, namespace + restore semantics, config, troubleshooting |
| `MystenLabs/MemWal` → `.claude-plugin/marketplace.json` | The **official Claude Code plugin** (`memwal` — MemWal MCP + lifecycle hooks). Prefer installing it over hand-wiring proactive recall/save. `.agents/plugins/` is the Codex equivalent |
| <https://docs.wal.app/walrus-memory/llms.txt> | Machine-readable docs index (`llms-full.txt` for the expanded corpus) |
| <https://memory.walrus.xyz> | Docs site and account dashboard |

**Maturity (checked 2026-09-30).** The relayer reports `apiVersion 1.0.0`, a `minSupportedSdk` floor
(ts `0.0.4` / py `0.1.0` / mcp `0.0.1`), runtime `featureFlags`, and a `deprecations[]` list carrying
`removalApiVersion` plus migration guidance — the **HTTP surface has a stated compatibility contract**,
even while the TypeScript SDK stays `0.1.x` and incubation-scoped. Sibling packages:
`@mysten-incubation/memwal-mcp` 0.0.14, `memwal` 0.1.11 on PyPI (upstream's source dir is
`packages/python-sdk-memwal`; there is no `memwal-python` package to install),
`@mysten-incubation/oc-memwal` (OpenClaw) 0.0.6. The npm names are scoped — unscoped `memwal-mcp` /
`oc-memwal` do not exist on npm.

## Errata — where upstream's own docs disagree with source or the live relayer

The two errata this section used to carry — upstream `SKILL.md` claiming namespaces have "no length cap",
and its restore field table omitting `truncated` — are **fixed upstream** (`SKILL.md` blob `5d628ed8` on
`dev`: "Namespace Semantics → Validation" and "Restore Semantics" now match the source, including
`failed` and the 1–100 `limit` clamp). Read upstream for both. One open erratum remains, against the live
relayer rather than the source: upstream `dev`'s `docs/relayer/api-reference.md` still describes a
mainnet `AccountRegistry` scan for requests without `x-account-id`; the live relayer does not scan (see
the auth bullet under Gotchas).

> **Note:** these examples are NOT type-checked by this repo's snippet gate (the package is not installed
> in the CI snippet env, so the fences are `// @check:skip`). Symbols below were verified by hand against
> the published `0.1.8` `.d.ts`. Re-verify against the then-current `.d.ts` before relying on them.

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
- **Use the object form of `recall`.** `recall({ query, limit?, namespace?, maxDistance?, topK?, maxTokens?, truncationStrategy?, countTokens?, scoringWeights?, sort? })`.
  The positional `recall(query, limit, namespace)` is `@deprecated` (easy to misread as
  `recall(query, namespace)`). `topK` and `limit` are aliases; `topK` wins if both are set.
- **`recall` query is capped at 16,384 bytes (relayer-side).** The relayer's embedder rejects any
  query whose UTF-8 length exceeds `MAX_EMBED_INPUT_BYTES = 16384` with HTTP **400**
  `input is over the embedding input limit of 16384 bytes`. This is relayer behavior, not an SDK
  check — it applies whatever the SDK version, and no client-side option (`maxTokens`, `truncationStrategy`)
  affects it, since those trim *results*, not the query. Truncate long queries yourself.
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
  `restore(namespace, limit?=10)` (rebuild the local vector index from Walrus; the relayer clamps `limit`
  to 1–100),
  `embed(text)`, `health()` (`HealthResult.write_ready?: boolean` since 0.1.5 — `false` = relayer not
  accepting writes, absent = not reported), `compatibility()`.
- **`namespace` is relayer-validated on every path, reads included** (live relayer build 79f241ec,
  2026-09-30). The rules — empty, over 255 **bytes**, or containing NUL (`\0`) → HTTP 400; `\t` / `\n` /
  `\r` stay legal — are in upstream `SKILL.md` ("Namespace Semantics → Validation"). What upstream does
  not flag is that the **read side changed**: `recall`, `recallManual` and `ask` now call the same
  `validate_namespace()` (`services/server/src/types.rs`), so an explicit `namespace: ""` that used to
  return `200` with an empty result set now returns `400`. A client that sends `""` to mean "unset" must
  omit the field instead and let the server default to `"default"`.
- **Namespaces are flat and opaque — there is no hierarchy.** Slashes and dots carry no meaning:
  `"chat/user-42"` is one label, not a path. Every read is exact-equality (`WHERE namespace = $1`) —
  no prefix match, no wildcard, no parent/child traversal. Build hierarchy in your own layer by
  recalling across known namespaces and merging client-side. There is also **no normalisation**:
  `"my-app"`, `" my-app"`, `"My-App"` and `"my-app/"` are four different namespaces. Omitting the
  namespace falls back to the literal string `"default"`.
- **`remember()` is always append, never upsert.** Every accepted call creates a new entry with a fresh
  UUID, so sending identical text to the same `(owner, namespace)` twice yields **two** entries and both
  surface in later recalls. The namespace is a filter, not a dedup key — dedupe before writing, or
  delete the prior entry.
- **Isolation is enforced in SQL, not by filtering.** Cross-namespace and cross-owner rows are excluded
  by the `WHERE` clause, so they are never decrypted or transferred — same owner + same namespace is the
  only combination a recall can see.
- **`restore()` latency scales linearly with `limit`.** The relayer caps itself at 10 concurrent Walrus
  aggregator downloads and 3 concurrent SEAL decrypts (CPU-bound, intentional), with embedding requests
  bounded by its own pool. Budget **seconds per blob** on a cold cache: keep `limit` small (≤50) for
  interactive flows and run bigger restores out-of-band. `limit` caps the *inspected* blob set
  (newest-first), not `restored` — if all inspected blobs are already indexed you get `restored: 0`,
  `skipped: limit`.
- **Which contract is live: read `/health`, never infer it from a branch.** The deployed build is
  whatever `https://relayer.memory.walrus.xyz/health` reports as `build.commit`; it has been `main` HEAD
  and, on 2026-09-30, an unmerged PR branch. On 2026-09-30 it reported `79f241ec` (`mode: "production"`),
  the head of `fix/enoki-not-found-rebuild-register` (PR #997, open, base `dev`); GitHub's compare API
  shows it contained in none of `main`, `staging` or `dev`. So upstream docs on any branch can be
  *behind* production as well as ahead of it. Resolve a new `build.commit` with
  `gh api repos/MystenLabs/MemWal/commits/<sha>/branches-where-head` and
  `gh api repos/MystenLabs/MemWal/compare/<branch>...<sha>`. (On 2026-09-04 the build was `559531fe`,
  then `main` HEAD; the two `dev` changes this file then called unreleased — read-path namespace
  validation and the `restore()` `truncated` rewrite — are both live now.)
- **A cold delegate key without `x-account-id` gets `401`** (live relayer build 79f241ec, 2026-09-30).
  The relayer no longer scans `AccountRegistry` to find the account for a delegate key: it resolves
  from its delegate-key cache, the signed `x-account-id` header, or a server-side `MEMWAL_ACCOUNT_ID`,
  and rejects otherwise (`services/server/src/auth.rs` at that commit). Official SDKs always send
  `x-account-id` (TS `MemWalConfig.accountId` is non-optional in 0.1.8 `types.d.ts`; Python `memwal` 0.1.11 `account_id: str` is required and signed requests send `x-account-id`), so SDK users are unaffected; raw-HTTP clients
  and any "recover a lost account id" flow are not. **Caveat:** this change exists only on that
  unmerged PR branch — upstream `dev`'s `docs/relayer/api-reference.md` (`GET /api/whoami`) still
  describes the mainnet registry scan. If a later deploy is cut from a branch without it, the scan may
  return; check `build.commit`.
- **`restore()` reports `failed` and `truncated`** (live relayer build 79f241ec, 2026-09-30). Semantics
  are in upstream `SKILL.md` ("Restore Semantics"). The practical consequence: permanent decrypt /
  UTF-8 failures now land in `failed` (SDK `RestoreResult.failed: number`, defaulted to `0` on older
  relayers) instead of vanishing; only transient errors stay uncounted. Once `limit >= 20`, raising
  `limit` no longer widens discovery and `truncated: false` does not imply completeness — the
  `sourceCapped` field that would tell the cases apart is not implemented (upstream tracks it as
  WALM-451), and there is no pagination cursor, so treat a large-`limit` restore as possibly partial
  regardless of the flag.
- **New in 0.1.x (verified vs `0.1.5` `.d.ts`, still present in `0.1.8`):** `MemWalMock` (deterministic, dependency-free
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
- **New in 0.1.6–0.1.8 (verified vs `0.1.8` `.d.ts`; absent from upstream `SKILL.md`):**
  `RecallOptions.sort?: "relevance" | "recent"` — `"recent"` over-fetches semantic candidates
  server-side (5× `limit`, capped at 50, never below `limit`) and orders them newest-first; setting
  `sort` at all, `"relevance"` included, makes the relayer ignore `scoringWeights`, which object-form
  `recall` now also accepts. Each hit carries `created_at?: string` (write time, not any event time in
  the text; omitted by older relayers). `listNamespaces({ cursor?, limit? })` →
  `{ namespaces, next_cursor, has_more, snapshot_version }` (page size defaults to 100, clamped to 500
  server-side). `MemWalConfig.requestTimeoutMs?` (default 30000) is a per-request deadline;
  `restore` / `analyze` carry their own larger one. Plus `RestoreResult.failed` (see the restore bullet).
