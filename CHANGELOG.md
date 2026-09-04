# Changelog

All notable changes to the SUI Dev Agents plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **New CI gate: `check-move-build`.** The symbol gate proves a framework name exists; it cannot prove a block compiles. This one does: every ` ```move ` block under `skills/` and `rules/` that declares a `module` (16 of the 142) is written into a throwaway package and built with the real Move compiler at the pinned `mainnet-v1.78.1`. Build mode is per block, and both directions matter: a block carrying `#[test]` / `#[test_only]` builds with `--test`, because without it the compiler excludes the module wholesale — the corpus had exactly one such block, importing a package that does not exist, which "compiled" while checking nothing; every other block builds *without* `--test`, because with it the test-only framework surface (`sui::test_scenario`, `sui::test_utils`, `std::unit_test`) resolves in a production example that would not compile for the reader. Fragments — the other ~126 blocks — are not compiled, because a compiler failure on a deliberate excerpt says nothing about the docs. Each block gets its own package: `reference.md` declares `example::marketplace` twice to document two stages of one example, and grouping per file reports EC02001 (duplicate module) for the pair. The compiler version is read from `move-symbols/index.json` rather than configured separately, so the two Move gates cannot drift onto different framework revisions, and a `sui` on `PATH` at another version is refused instead of silently trusted. Framework sources come from a ~9 MB sparse checkout at the same tag; the implicit git dependency would otherwise pull ~284 MB per revision into `~/.move`.
- The gate refuses to run against a `sui` whose version is not the one the index is stamped with, and against a framework checkout at any other tag — the compiler and the sources it compiles against are pinned together or not at all. A stale baseline entry fails the run rather than printing a note under a ✅, and the exemption cap (at most 6 of the 16) is expressed against the baseline rather than as an absolute pass count, so new passing blocks cannot buy room to baseline existing ones. Builds are bounded by a 180s timeout, and an unknown or misspelt flag is rejected instead of falling through to a default while the run still reports "floors enforced".
- **Five real defects the new gate found in shipped examples**, all fixed in place rather than baselined: `skills/sui-walrus` imported `std::string::String` but called `string::utf8(...)` (missing `Self`), and built a URL with `string::utf8(b"walrus://").append(...)` — `append` mutates in place and returns `()`, so the example did not type-check as a `String` return; `skills/sui-seal` had the same missing-`Self` shape for `sui::clock`, and its pay-to-decrypt example took `payment: Coin<SUI>` by value behind a `// ...transfer payment...` placeholder, which is EC06001 (unused value without `drop`) — the example now takes a shared `Paywall` object for the treasury address (a hardcoded address constant is what gets copied into production), splits the price to it, returns the change and mints the receipt, with `#[error]` constants instead of bare `0` abort codes per this plugin's own `rules/sui-move/conventions.md`; `skills/sui-developer`'s OTW example called `package::claim` with no `use sui::package`. Six blocks are baselined in `scripts/ci/move-build/known-failures.txt`, each with its reason (a continuation of an earlier block, reader-supplied placeholder types, Nautilus's external `enclave` package, or a test suite importing the reader's own package under test).
- 40 self-tests (`scripts/ci/tests/check-move-build.test.mjs`), roughly a quarter of them reverse assertions that the gate stays silent on fragments, on `module` declarations sitting inside comments or string literals, and on unusual address names. Every guard was mutation-tested — 19 mutants across two review rounds (de-noising removed; the selection regex reverted to the version that missed `module 0x0::…` and `#[test_only] module …`; `--test` dropped; numeric addresses written into `[addresses]`; baseline comment stripping widened; the version, framework-tag and structural-fence guards removed; the tag parser reverted to mainnet-only; each floor disabled; the exemption cap disabled; unknown-flag rejection removed; the timeout branch removed; the stale-entry failure removed; the `IS_SELF` locks removed; the block-id disambiguation dropped) — each turning a *specific* test red rather than the suite. The real corpus was mutated three times as well (a `use` removed, a baseline line deleted, a baselined id renamed): red each time, green on restore.
- The block extractor and the comment/string de-noiser now live in `scripts/ci/move-symbols/lib/` and are shared by both Move gates. The fence parser is the part of the symbol gate that took the most review rounds to get right (unclosed fences swallowing later blocks, `~~~` fences, indented and blockquoted fences, fence-length comparison, nested ` ```move ` inside a ````markdown wrapper); a second copy in the new gate would have drifted silently, and drift there shows up as blocks nobody checks.
- **New CI gate: `check-move-symbols`.** Fenced ` ```move ` blocks had no check of any kind — the TS gate type-checks 32 ` ```ts ` blocks, while 142 Move blocks shipped on trust, so a fabricated `sui::coin::mint_fake(...)` was invisible. The new job resolves every Move framework reference in `skills/` and `rules/` (all 142 blocks, including those nested inside ````markdown wrappers — nested blocks are checked rather than skipped, because a block lost to a misparse would otherwise be reported under the same label as a deliberate exclusion) against `scripts/ci/move-symbols/index.json`, a vendored symbol table (103 modules / 2436 members) built from the `move-stdlib`, `sui-framework` and `sui-system` packages at `mainnet-v1.78.1`. It resolves `use` paths, members named in a `use`, references through the block's own aliases (`use sui::dynamic_field as df;` → `df::add`), Sui's implicit aliases, unambiguous bare module names, and fully qualified paths — 77 distinct framework symbols across the current corpus, all of which resolve, so the baseline ships empty.
- The gate checks only what the environment can mechanically resolve: it ignores every address the index doesn't carry (`marketplace::`, `nft::`, and **`deepbook::`, which in these skills means the DeepBook v3 app package**, not the framework's DeepBook v2 at `0xdee9`), ignores visibility because `public(package)` members legitimately appear in teaching fragments, and ignores types and arities, which need a compiler. It also does **not** check Move 2024 method syntax (`payment.value()`) — resolving a receiver needs type inference — which leaves roughly 70 call sites in the corpus unchecked; since method syntax is the dominant idiom in these skills, that is the honest limit of what a green run means. Bare (un-imported) module names are resolved only where they cannot mean something else: `sui`, `std` and `sui_system` are excluded because they are addresses as well as module names, and `token` because skills write `use token::deep;` for DeepBook's DEEP package. A `use my_app::transfer;` shadows the implicit alias, and a block that declares `module x::coin;` shadows a bare `coin::` — though not a fully qualified `sui::coin::`, which names the framework whatever the block calls its own modules. Rules 1, 2 and 4 name an address explicitly and cannot misfire; the bare-name fallback is the one judgement call, since a fragment calling a *user* module named after a framework module with no in-block `use` would be reported wrongly — `UNBOUND_DENY` covers the names where that looked likely, and the remedy for any other collision is to add the real `use` line or `// @check:skip`.
- On this repo the floors are **constants**: `--no-floors`, `--min-resolved` and `--min-blocks-*` are affordances for the self-tests' fixture trees and are ignored whenever the scanned root resolves to this repository, symlinks included — a guard its own CI can be told to switch off is not a guard. Every run prints whether floors were enforced, because an exit code alone cannot distinguish "floors met" from "floors skipped".
- Two guards against the gate rotting into a permanently-green watcher: `index.json` is stamped with the release it was built from and the job **fails when that stamp stops matching the `mainnet vX.Y.Z` version declared in `README.md`**, so a sui bump forces a regen (`scripts/freshness/DEEP-INVESTIGATION.md` step 4 now lists it as a registration point); and the job fails if fewer than 70 distinct framework symbols resolve **or** if either scan directory yields fewer blocks than its floor (`skills` 95, `rules` 30), so a parser that silently stops matching cannot pass by checking nothing. The symbol floor alone was not enough: dropping `rules/` entirely — 38 of 142 blocks — still left 72 symbols, comfortably over the floor. A malformed block (unterminated string or block comment, unclosed fence) is now reported rather than skipped, because either one blanks the rest of the block from the scanner and would hide a fabrication behind a stray quote. `// @check:skip` exempts a block's body but never its `use` paths, mirroring the TS skip-import gate.
- 59 self-tests (`scripts/ci/tests/check-move-symbols.test.mjs`), a dozen of them reverse assertions that the gate stays silent on user-defined modules, shadowed aliases, ambiguous bare names and commented-out code. The gate was mutation-tested against the real corpus — a fabricated member reached through an alias, a fabricated module in a `use`, a fabricated member on a bare un-imported name — red each time, green on restore; and the parser's own load-bearing comparisons (fence length, fence character, quote depth, the nested-opener rule, the floor lock and its symlink resolution) were each mutated to confirm a test goes red, since a guard whose tests survive mutation is a comment that executes.

- **New freshness source kind: `endpoint`** — a marker read from one scalar in a live service's JSON, so a deployment can be watched alongside the repository that produces it. `memwal-relayer` (`relayer.memory.walrus.xyz/health` -> `build.commit`) now sits next to the existing `memwal` source, which watches the `dev` branch. The pair is the point: on 2026-09-04 they were 75 commits apart, and only the endpoint says which of the two a skill may describe in the present tense. `jsonPath` names a stable scalar deliberately rather than hashing the body — a whole-body marker would drift on every uptime counter — and it walks own properties only, refusing containers, so a marker can never become the constant `[object Object]` or a prototype method that is identical for every service.
- **`docs-release-notes` moved from `Last-Modified` to a content fingerprint.** docs.sui.io serves `max-age=0, must-revalidate` and rotates *both* `Last-Modified` and `ETag` on every CDN rebuild, so this source produced two consecutive false drifts (2026-09-03, 2026-09-04) over byte-identical release content — each one costing a full deep-investigation round. The marker is now the newest release anchor, the number of releases listed, the highest protocol version, and a digest over the ordered anchor list and the protocol set, so a back-dated entry or a dropped protocol version drifts even though the newest release did not move.
- Extraction failures are now a distinct outcome from fetch failures. `EXTRACT_FAILED` is returned when a source was reachable but its extractor recognised nothing (markup moved, JSON reshaped, a mistyped `fingerprint` name), and unlike `ERROR_MARKER` it is *not* ignored: it surfaces as drift, is never written back as a marker, and `detect.mjs` prints a `NOTE:` telling the reader to fix the extractor rather than dispatch a worker after a change that never happened. Storing it would make the broken extractor its own baseline — a source that is dead but green, which is the failure this repo's floors exist to prevent everywhere else. Each fingerprint carries its own floor for the same reason (at least five releases, at least one protocol id: the page has listed dozens for years, so recognising almost none means the markup moved, not that Sui deleted its history).
- Every marker derived from remote content is sanitized — control characters collapsed, length capped at 200 — before it reaches the cache or the SessionStart banner. Markers are printed into an agent's context, so a watched page or service does not get to decide how many lines that banner has or what escape sequences are in it. Bodies are fetched under `--max-filesize` as well.
- The freshness suite goes 12 -> 41 tests (29 new, a new `fetch-markers.test.mjs` plus additions to `core.test.mjs`), mutation-tested with 14 mutants — each floor removed, the digest narrowed to the newest anchor and to the ids alone, the two failure kinds swapped in both directions at three separate sites (`fetch.mjs`'s endpoint and fingerprint paths, and `compareMarkers` skipping extract failures the way it skips fetch errors), the unknown-fingerprint guard degraded to the header marker it was chosen over, sanitization dropped entirely and then its length cap and its control-character strip dropped one at a time, `Object.hasOwn` relaxed to `in`, the container refusal removed, and the extract-failure exclusion dropped from marker merging — every one turning a *specific* test red rather than the suite. Three survived the first pass and the tests were tightened until they did not: the middle-insertion case had also changed the release count, the new-protocol case had also changed the maximum, and the control-character case used only characters that `\s+` already collapses.

### Changed
- **`skills/sui-deepbook/references/predict.md` rewritten against `predict-testnet-8-21`** (Move source at commit `1f79fe87` — the exact commit `@mysten/deepbook-v3@2.1.4` records in `dist/deployments/testnet.mjs`), replacing the v2.16.0 staleness warning with the real design. The old file documented `predict-testnet-4-16`, several deployments back. What changed: the market root is now a per-expiry shared `ExpiryMarket` (there is no single `Predict` root — it split into `Registry` + `ProtocolConfig` + `PoolVault`); `PredictManager` is gone, user custody and positions live in the shared `account` package's `Account` as a `predict_account::PredictData` slot; `OracleSVI` / `OracleSVICap` moved out to the separate `propbook` package as `BlockScholesSVIStore` / `BlockScholesValueStore` / `PythFeed` bound through an `OracleRegistry`, with **permissionless signed-batch writes** instead of a capability; `RangeKey` / `strike_matrix` became tick pairs with the range packed into a `u256` order id; and PLP went **asynchronous** — `supply`/`withdraw` returning `Coin<PLP>` are replaced by `request_supply` / `request_withdraw` into a FIFO queue that settles in a keeper's `start_pool_valuation → value_expiry×N → finish_flush`. The package has **zero `entry fun`**: everything is `public fun` called from a PTB, and every priced call needs an `expiry_market::load_live_pricer` `Pricer` obtained **in the same PTB** (`copy, drop`, no `store`, bound to one market).
- Documented the SDK surface as it actually is: `@mysten/deepbook-v3/predict` exports a `PredictClient` class but the idiom is to install it as a **client extension** (`$extend(predict({ network }))` → `client.predict.{tx,read,decode}`); `predict()` is a registrar around `new PredictClient(...)`. Added upstream's own startup check — assert `getDeployment('testnet').deployment === 'predict-testnet-8-21'`, because a later SDK release can intentionally move testnet to a newer deployment. That assertion is the countermeasure to exactly the failure this rewrite fixes.
- New safety notes that only show up in the source: the SDK facade **hardcodes `minPlpOut: 0n` / `minDusdcOut: 0n`** (`dist/predict/client.mjs:134,142`) and an omitted `maxCost` / `maxProbability` leaves a mint uncapped — worse, `tx.redeem` exposes **no floor at all** (`CloseOptions` is `{orderId, quantity}` and `redeemLive` fills in `minProbability: 0n, minProceeds: 0n`), so a live redeem through the facade is *always* unprotected and can only be floored by hand-building the `moveCall`. There is no SDK escape hatch: the package's `exports` map is only `.` / `/account` / `/sessions` / `/predict`, so `dist/contracts/**` is not importable, and `/predict` re-exports `loadLivePricer` but **not** `redeemLive` / `mintExactQuantity` / the admin calls (`start_pool_valuation`, `value_expiry`, `finish_flush`, `ProtocolConfig` setters), the permissionless keeper calls (`rebalance_expiry_cash`, `try_settle`, `sponsor_fee_incentives`, `set_reference_tick`, `redeem_settled_permissionless`) or the read-only `quote_mint` / `live_order_value` / `settled_order_payout` — all of those must be hand-built as a `moveCall` off `getConfig(network)`; `value_expiry` against an expired-but-unsettled market **aborts** rather than skipping, so a keeper must `try_settle` first or the whole valuation PTB reverts; a freshly created market cannot be minted against until someone calls the permissionless `rebalance_expiry_cash`; refreshing an oracle and pricing off it in the same transaction aborts with `EOracleWrittenInThisTransaction`; abort codes restart at 0 per module, so `decodeMoveAbort` results must be matched on `.abortName`, never the numeric `.code`.

- sui-walrus Walrus Memory reference: **`namespace` validation on the deployed relayer**, which the reference had never documented. `remember`, `analyze`, `forget`, `stats` and `restore` reject an empty namespace (`400 namespace cannot be empty`) or one over `MAX_NAMESPACE_BYTES = 255` **bytes**, while `recall` / `ask` are not validated at all — an empty namespace reads as a normal `200` with no hits, so the same bug looks like "no memories found" on the read path and a `400` on the next write. Verified against the commit the relayer's `/health` reports, not the repo's default branch.
- sui-walrus Walrus Memory reference: an **unreleased-work note** covering two wire-level changes merged on `MystenLabs/MemWal` `dev` that are **not deployed** — `validate_namespace` extended to `recall` / `ask` plus a NUL-only rejection (`\t` / `\n` / `\r` stay legal, so namespaces already written with them remain readable and deletable), and a rewrite of `restore()`'s `truncated` flag (`restore_is_truncated()` + `SIDECAR_CANDIDATE_CAP_SATURATES_AT_LIMIT = 20`) under which a cap hit alone stops meaning `truncated` once `limit >= 20`. As of 2026-09-04 production runs `build.commit` `559531fe`, which is *diverged* from `dev` HEAD `59d6f0ec` — 75 commits behind — so the existing `truncated = limit_truncated || source_capped` description remains the correct one to code against. The freshness watcher tracks the `dev` branch, which is why this drift looked like a live breaking change until the deployed commit was read: watching a repo is not watching a deployment.

### Fixed
- `scripts/freshness/DEEP-INVESTIGATION.md`: added a **deployment-pointer check** (step 5). When a bumped SDK ships a `dist/deployments/` directory, a `getDeployment()` export, or a generated `deployment` / `sourceCommit` field, the runbook now requires reading it and comparing the named deployment against whatever branch or tag the repo's prose was verified against. "The API exists in the SDK" is layer one; "the SDK points at the same on-chain package our docs describe" is layer two, and only layer two catches a Move-side restructure that no SDK changelog mentions — the gap that shipped the stale Predict reference. Also recorded two verification rules learned this cycle: byte-identity of a package's barrel entry proves nothing about its public surface (diff what the barrel imports), and "why does it fail" claims must be read off the actual control flow rather than inferred from whichever check sounds most likely to stop it.
- The freshness tooling no longer tells the agent to call `gemini` and `codex`, unavailable since 2026-07. `DEEP-INVESTIGATION.md` step 2 now documents the parallel fresh-context subagent fan-out that has been the shipping path since 2026-08-29 — **and so do the two places that actually reach the agent first**: `scripts/freshness/detect.mjs`'s drift ACTION line and `scripts/freshness/core.mjs`'s drift banner, both of which still said "gemini→codex" and are read before the runbook is ever opened. Found by an external reviewer applying this file's own step-4 rule (grep repo-wide, not just the file you meant to change).

## [2.16.0] - 2026-09-03

### Changed
- Bumped all pinned `@mysten/*` SDKs again, to the **sui 2.29.0 generation** — published 2026-09-02, hours after the 2.28.0 pass below (dapp-kit-core 1.6.23, dapp-kit-react 2.1.25, enoki 1.2.20, kiosk 1.4.8, seal 1.4.8, suins 2.0.4, wallet-standard 0.21.22, walrus 1.2.23, zksend 1.2.23, **deepbook-v3 2.0.1 → 2.1.4**; messaging stays 0.3.0). Every sibling that declares a `@mysten/sui` peer — deepbook-v3 now included — peers `^2.29.0` (`dapp-kit-react` declares none, constraining sui transitively through `dependencies: { "@mysten/dapp-kit-core": "^1.6.23" }`), so all peer-constrained `@mysten/sui` accepted ranges move to `^2.29.0`; the standalone rows (ts-sdk, passkey, zklogin) keep `^2.0`. deepbook-v3's own accepted range stays `^2.0.1`: across 2.0.1→2.1.4 the **root export set** is unchanged and every hardcoded package id on that surface is byte-identical. `dist/utils/constants.mjs` is byte-identical, and so is `dist/index.d.mts` — though that alone proves nothing, since it is only a re-export barrel. Diffing what it pulls in: the sole **non-additive** delta on the public type surface is a semantically-irrelevant union reorder on `DeepBookClient.getAccountOrderDetails` (`dist/client.d.mts`); `contracts/utils/index.d.mts` is on that surface too but purely additive (`MoveTuple`, `ConfigValue`, `RawTransactionArgument`). The rest is inert: alias renumbering, plus a dropped `import "./types/bcs.mjs"` in four emitted modules (`dist/index.mjs` and the three `dist/queries/*Queries.mjs`) whose target is `import …; export {}` — no side effect, and not importable by consumers anyway, since 2.0.1's `exports` map has only `.`, so the documented spot / BalanceManager / margin / flash-loan / governance API is unaffected. mcp-server pin `^2.28.0` → `^2.29.0` (installed 2.29.0, `tsc` clean).
- `@mysten/sui` 2.29.0 changes no proto and no existing signature, but three gRPC behaviours change. `GrpcWebFetchTransport` exported from `@mysten/sui/grpc` is now a **subclass** of the upstream `@protobuf-ts/grpcweb-transport` transport (through 2.28.0 it was a plain re-export): status messages are decoded instead of arriving percent-encoded (`Object%20not%20found:%200x1`), and an aborted call takes its status from the reason — `DEADLINE_EXCEEDED` for `AbortSignal.timeout`, `CANCELLED` otherwise — where upstream reports everything but a standard `AbortError` as `INTERNAL`. `SuiGrpcClient` now **forwards the rest of `GrpcWebOptions`** (`fetch`, `format`, `meta`, `timeout`, `interceptors`, `jsonOptions`, `binaryOptions`) to the transport; ≤2.28.0 typed them but the constructor only passed `baseUrl` and `fetchInit`, silently ignoring the rest (2.28.0 `dist/grpc/client.mjs:30-33` vs 2.29.0 `:30-31`). `@mysten/sui/grpc` also re-exports `RpcError` and the `GrpcStatusCode` enum so calls can be narrowed without a direct `@protobuf-ts/*` dependency — note `RpcError.code` is a **string**, so compare against the enum's name. Documented in sui-ts-sdk (new type-checked snippet) and the frontend gRPC reference.
- Bumped all pinned `@mysten/*` SDKs to the **sui 2.28.0 generation** (dapp-kit-core 1.6.22, dapp-kit-react 2.1.24, enoki 1.2.19, kiosk 1.4.7, seal 1.4.7, suins 2.0.3, wallet-standard 0.21.21, walrus 1.2.22, zksend 1.2.22; deepbook-v3 stays 2.0.1 and messaging stays 0.3.0). Eight satellites (dapp-kit-core, enoki, kiosk, seal, suins, wallet-standard, walrus, zksend) now peer `@mysten/sui ^2.28.0`, so compat-matrix accepted ranges for those peer-constrained `@mysten/sui` rows were raised accordingly; deepbook-v3 keeps `^2.26.2` and the genuinely standalone rows (ts-sdk, passkey, zklogin) keep `^2.0`. (`@mysten/deepbook-v3@2.1.3` was published while this change was in review and deferred; its successor 2.1.4 — and the whole 2.29.0 generation — landed in the same release, see the 2.29.0 entries above.) `@mysten/dapp-kit-react` declares no `@mysten/sui` peer at all — it constrains it indirectly through `dependencies: { "@mysten/dapp-kit-core": "^1.6.22" }`. **Fixed a pre-existing wrong range:** sui-frontend's `@mysten/sui` accepted range was `^2.0`, but that skill installs `@mysten/dapp-kit-core`, so `npm i @mysten/sui@2.0.0 @mysten/dapp-kit-core@1.6.22` fails with ERESOLVE; it now carries `^2.28.0`. No existing `@mysten/sui` signature changed in 2.28.0, but it is not purely additive: `TransactionExpiration` gains a union member (a widening for exhaustive `switch`) and v1 JSON restore changes behaviour (below).
- `@mysten/sui` 2.28.0 adds the `Validity` transaction expiration (`allowedProposers` / `minEpoch` / `maxEpoch` / `minTimestamp` / `maxTimestamp` / `chain` / `nonce`) to the `TransactionExpiration` union; `setExpiration()` is unchanged and still the only entry point. The deprecated v1 JSON format now **carries** `ValidDuring` / `Validity` instead of collapsing them to `{ None: true }` in both directions — through 2.27.1 a `serialize()` → `from()` round-trip silently dropped the expiration, letting you sign bytes wider than intended (a security fix). The restore side (`expirationFromV1`) now **throws** on an unrecognized variant. The `allowed_proposers` protocol flag is off on both public networks, so `allowedProposers` is not usable on testnet or mainnet (it is on for devnet, localnet and any self-hosted chain). Documented in sui-ts-sdk; all claims verified against the published `.d.mts`.
- `sui::scratch` expanded from a one-line P130 note into a full API reference (`skills/sui-developer/references/scratch.md`): `Permit<K>` acquisition, the `add`/`read`/`remove`/`exists`/`exists_with_type`/`read_opt`/`remove_opt`/`replace` operation set, the `get_do`/`get_mut_do`/`get_fold`/`get_mut_fold` borrow macros (read-only borrows still take `&mut TxContext`; re-entering the same key aborts), abort codes `EEntryAlreadyExists`/`EEntryDoesNotExist`/`EEntryTypeMismatch`/`EBorrowMarkerMismatch`, and the 16,384-**entry** per-transaction cap (the `max_scratch_pad_size` config name reads like bytes but the runtime compares `entries.len()`; exceeding it is a VM `MEMORY_LIMIT_EXCEEDED` / `SCRATCH_SIZE_LIMIT_EXCEEDED`, not a catchable Move abort). Verified against `scratch.move` / `tx_context.move` / `internal.move` / the P135 config snapshot / `sui-move-natives` at tag `mainnet-v1.78.1` — not from the Move Book prose.
- sui-walrus Walrus Memory reference: relayer recall queries are capped at `MAX_EMBED_INPUT_BYTES = 16384` bytes and return HTTP 400 `input is over the embedding input limit of 16384 bytes` (relayer-side, so `@mysten-incubation/memwal` 0.1.5 is affected too; `maxTokens` / `truncationStrategy` trim results, not the query).
- mcp-server: `@mysten/sui` pin `^2.20.3` → `^2.28.0` (installed 2.28.0, `tsc` clean), aligning the MCP server with the generation used by the skills. `@mysten/messaging` stays 0.3.0 (upstream hard-dep on `@mysten/sui ^1.45.2`; nested copy in snippets env remains unavoidable until upstream releases).

### Removed
- `mcp-server/pnpm-lock.yaml` — a single-use pnpm lockfile last touched in v2.2.0 (2026-02). It recorded `@mysten/sui` specifier `^1.21.0` → resolved `1.45.2` while `package.json` had moved on to `^2.29.0`, so `pnpm install --frozen-lockfile` there would fail on a lie. No CI used it — neither workflow (`validate.yml`, `pages.yml`) nor any script under `scripts/ci/` mentions `mcp-server` or `pnpm` (the only `pnpm` string left under `scripts/` is an `engines` field inside the snippets lockfile) and `.gitignore` already excludes `mcp-server/package-lock.json`, i.e. this directory deliberately ships no committed lockfile — the pnpm file was the odd one out. Deleted rather than regenerated, and added to `.gitignore` so it does not come back.

### Added
- sui-deepbook: `@mysten/deepbook-v3` 2.1.3 (npm published no 2.1.0–2.1.2, though the changesets carry those numbers) consolidated the separate DeepBook SDKs into **subpaths** — `/account` (the shared on-chain account primitive), `/sessions` (time-limited trading sessions over a canonical Account), `/predict` (DeepBook Predict's TypeScript client). Documented with the parts that bite: the package root is unchanged and subpaths are separate module graphs; `Account` from the root (`@deepbook/core::account::Account`) is a *different type* from `/account`'s `Account`; deployed ids come from one shared generated manifest and **throw** on an unrecorded network (testnet is the only one recorded); sessions cap at `MAX_SESSIONS_PER_ACCOUNT = 20` addresses and `MAX_SESSION_DURATION_MS` = 30 days, expired grants still occupy slots, there is no bulk on-chain read (decode client-side via the **static** `SessionsContract.decodeSessions` / `.activeSessions`), and the spot session wrappers exist in `sessionsMoveCalls` but are not wrapped on `SessionsContract`. `PredictConfig` gains two required fields (`coinTypes`, `units`) for hand-built configs. `@mysten/deepbook-account` and `@mysten/deepbook-predict` are `npm deprecate`d and superseded; the Predict reference no longer claims there is no SDK.
- sui-deepbook: a **staleness warning on the Predict reference**, found while wiring the new subpath. `@mysten/deepbook-v3/predict` targets deployment `predict-testnet-8-21`, but `references/predict.md` documents `predict-testnet-4-16` — a restructure, not a bump: the SDK's generated bindings are `expiry_market` / `expiry_cash` / `predict_account` / `order` / `pricing` / `plp` / `registry` / `strike_exposure*`, with no `predict.move`, no `predict_manager` and no `oracle` module, so `PredictManager` and `OracleSVI` do not exist as `deepbook_predict` types in the deployment `PredictClient` talks to (the SVI oracle moved to the separate `propbook` package and still has to be wired via `objects.oracleRegistry` / `underlyings[<symbol>].blockScholesSviStore` (`underlyings` is a `Record`, not an array)). The reference is now explicitly labelled as the superseded 4-16 design with a do-not-build-PTBs-from-this warning; re-verifying it against 8-21 is outstanding.
- sui-red-team + sui-security-guard: the **Seal on-chain decryption** attack vector. `seal::bf_hmac_encryption::{verify_derived_keys, decrypt}` document that *"It is up to the caller to ensure that the given public keys are from the correct key servers"*, and `new_public_key(key_server_id, pk_bytes)` validates only the G2 encoding of the bytes, never their provenance — so a package that accepts both the key-server public keys and the `EncryptedObject` from its caller lets an attacker hand back **a plaintext of their own choosing** as key-server-authorized. This is a forgery break, not a confidentiality break — shares are unmasked with `pairing(derived_key, nonce)`, so a genuine ciphertext yields garbage shares and `decrypt` returns `none()` at the degree / randomness-scalar / `verify_nonce` gates, never reaching the MAC. `decrypt`'s share-consistency check does not stop it: it only covers services for which **no** derived key was supplied, so supplying one per key server makes it pass vacuously. Correct shape: the Move package supplies the public keys from its own stored config or the on-chain key-server objects. Verified against the upstream `bf_hmac_encryption.move` source.
- Forward-looking **Protocol 136 (testnet v1.79.0 — not yet on mainnet)** notes. The repo baseline deliberately stays at **mainnet v1.78.1 / Protocol 135**; these are flagged testnet-only until 136 reaches mainnet.
  - **PTB `TxContext` signature restrictions** (#27451): a PTB Move call may take at most one `&mut TxContext`, or any number of `&TxContext` — never by value, and never in return position (dev-inspect included). Violations fail before execution with `CommandArgumentError::InvalidTxContext` (TS SDK: `GrpcTypes.CommandArgumentError_CommandArgumentErrorKind.INVALID_TX_CONTEXT = 20`, reached via `import { GrpcTypes } from '@mysten/sui/grpc'` — it is neither a named export of that module nor a member of the `ExecutionStatus` message). The release notes tag this P135, but protocol-config snapshots show `ptb_tx_context_restrictions` only turns on at v136 on both mainnet and testnet. (sui-developer)
  - New PTB reference limits, none of which existed before P136: `max_ptb_live_references = 64`, `max_ptb_returned_references = 16` per command, `max_ptb_total_returned_references = 256`, plus `translation_per_live_reference_charge = 1`, which multiplies a **cubic** per-command gas charge of `n(n+1)(n+2)/6` over that command's `n` live references (not a linear per-reference cost). Also `harden_linkage_consistency = true`, which tightens PTB linkage resolution generally (not just publish/upgrade) and can make linkage resolve differently than on P135. All found by reading `sui-protocol-config/src/lib.rs:4678-4681` and `:4686` at `testnet-v1.79.0` — none of them appear in the release notes. (sui-developer)
  - `package_arena_size_in_bytes = 10MB` (#27826) — equal to the previous hardcoded value, no behaviour change; new `sui move test --package-size <MB>` flag, over-limit error `PACKAGE_ARENA_LIMIT_REACHED`. (sui-developer, sui-deployer)
  - gRPC `SimulateTransaction` returns a `VALIDITY` expiration instead of `VALID_DURING` (#27598) **only where the `allowed_proposers` flag is on, which P136 enables for every chain except mainnet and testnet** (devnet, localnet, self-hosted — the `Chain` enum has no devnet variant, so the guard is `chain == Unknown`) — the two public networks both still return `VALID_DURING`. Where it does apply, clients that rebuild the expiration themselves get a digest mismatch if they drop `allowed_proposers`. (sui-indexer, grpc-reference)
  - GraphQL `Query.multiGetBalances(keys: [BalanceKey!]!): [Balance!]!` with the new `BalanceKey { address: SuiAddress!, coinType: String! }` input; `totalBalance = coinBalance + addressBalance` clarified (#27685). (sui-indexer)
  - Operator-breaking: `sui-indexer-alt-jsonrpc` / `-graphql` dropped four `--bigtable-*` flags and `--ledger-grpc-url` is now required, with no Postgres fallback (#27557, #27653). (sui-indexer)

### Unchanged (verified, no action)
- Walrus `testnet-v1.55.2` carries **no developer-facing changes** — confirmed by exhaustive diff, not sampling. It touched only the storage-node WAL price monitor config (`enable_coingecko`/`coinbase`/`binance`, `enable_pyth_hermes`) and one metric.
- Seal `seal-v0.6.15` changes **no code that this repo documents** — `move/`, `seal-cli` and `sdk/` are untouched, so `seal_approve*`, key servers, package ids and allowlist patterns are unchanged. It does carry one substantive **documentation** change: `UsingSeal.mdx` now warns that key-server public keys are a *trusted input* for on-chain decryption — an attacker who supplies both halves of their own key pair passes `verify_derived_keys` and the `decrypt` share-consistency check, so a Move package must supply the public keys itself rather than accept them from the caller. This repo does not yet cover Seal on-chain decryption at all, so nothing here contradicted it; the attack vector is now documented in sui-red-team / sui-security-guard (see the Added section above).
- `@mysten-incubation/memwal` TypeScript SDK is still 0.1.5 (upstream commits touched only the Python SDK and the Rust relayer), so every signature in the Walrus Memory reference still holds.

## [2.15.0] - 2026-08-29

### Changed
- Bumped all pinned @mysten/* SDKs to the sui 2.27.1 generation (every sibling now peers `@mysten/sui ^2.27.1`, deepbook-v3 peers `^2.26.2`; compat-matrix accepted ranges for `@mysten/sui` in peer rows raised accordingly; @mysten/messaging stays 0.3.0). @mysten/sui 2.25.0 lifts `getCurrentSystemState` / `getProtocolConfig` / `getChainIdentifier` / `getDynamicObjectField` to the top-level gRPC/GraphQL clients and `getReferenceGasPrice()` takes an optional options object; 2.26.x exports `ObjectError` / `TransactionError` / `SuiClientError` with a transport-neutral `reason`; 2.27.0 adds `checkpoint` / `timestampMs` to the Core `Transaction` type. All claims verified against the published `.d.mts`.
- **@mysten/deepbook-v3 2.0.1 (breaking)**: margin/liquidation now targets Pyth's upgraded Core via Hermes v2 and **throws `ConfigurationError` without `pythAccessToken`**; `pyth` config becomes `PythConfig { hermesEndpoint?, accessToken? }`; mainnet `MARGIN_PACKAGE_ID` / `LIQUIDATION_PACKAGE_ID` changed. Spot / BalanceManager untouched. Documented in sui-deepbook SKILL + margin reference; compat-matrix range `^2.0`, new `pyth-token` tag.
- **@mysten/suins 2.0.2 (breaking)**: non-USDC register/renew requires `pythAccessToken` (`getPriceInfoObject` throws otherwise); `Config.payments.packageIdV1` is a new required field. Documented in sui-suins SKILL; compat-matrix range `^2.0`.
- Repo baseline realigned to mainnet v1.78.1 / Protocol 135 (P134 = `defer_unpaid_amplification`; P135 live on mainnet since 2026-08-29): version headers across skills, README, agent prompts and landing page. New notes: `sui::package::original_package_id(&UpgradeCap): ID` (native, P135; sui-deployer + `/upgrade` command), Move compiler warning on constant expressions that always error at runtime (#27647), P133 accumulator bound made concrete (16 type nodes, `EAccumulatorTypeTooLarge = 4`). No gRPC/GraphQL shape or CLI flag changes through v1.78.1.
- `sui::test_utils::{destroy, assert_eq, print}` are `#[deprecated]` (since ~v1.72; attribute present in every mainnet tag from v1.72.5 on) — rules, checklist and references now use `std::unit_test::destroy` / `std::unit_test::assert_eq!` and note `std::debug::print` as the `print` replacement (verified against `test_utils.move` / `unit_test.move` at mainnet-v1.78.1).
- sui-walrus Walrus Memory reference re-verified against `@mysten-incubation/memwal@0.1.5`: **`rememberManual` now takes `encryptedData` (was `blobId`)**, default relayer URL is `https://relayer.memory.walrus.xyz`, keys accept `suiprivkey1...` bech32, recall token budget (`maxTokens` / `truncationStrategy` / `countTokens` / `meta`), `dropped_count`, `health.write_ready`.

## [2.14.3] - 2026-08-16

### Changed
- sui-walrus Walrus Memory reference re-verified in full against `@mysten-incubation/memwal@0.1.2` (was 0.0.7; every claim checked against the published `.d.ts`/dist): pin bumped to 0.1.2, zod peer widened to `^3.23.0 || ^4.0.0` with `ai`/`zod`/`@mysten/walrus` now optional peers, Manual mode documents the dapp-kit-style `walletSigner` alternative, new `/ai` `withMemWal` middleware entry point, `restore()` truncation-reporting semantics (`truncated` flag, per-owner candidate cap, no pagination cursor), and a "New in 0.1.x" summary (`MemWalMock`, bulk/analyze wait helpers, default-client `recallManual`, `ScoringWeights`, remember `idempotencyKey`, `getPublicKeyHex`, `Uint8Array` keys). The 0.0.7-era trust-boundary claims (delegate key never transmitted, `x-seal-session`, dynamic `@mysten/seal`+`@mysten/sui` imports) remain true in 0.1.2 and are unchanged.

## [2.14.2] - 2026-08-16

### Changed
- Bumped all pinned @mysten/* SDKs to the sui 2.24.0 generation. @mysten/kiosk 1.4.0 widens `KioskCompatibleClient` to `ClientWithCoreApi` — `SuiGrpcClient` is now accepted (the `no-grpc` matrix flag is retired and the sui-move-ts-bridge kiosk example migrated to gRPC). @mysten/sui 2.24.0 adds `client.core.resolveNameServiceAddress({ name })` (flat `{ address: string | null }` response) across Core/gRPC/GraphQL clients; @mysten/seal 1.4.0 adds an optional `fetch` override to `SealClientOptions`. Remaining packages lockstep; @mysten/messaging stays 0.3.0. All API claims verified against installed 2.24.0-generation `.d.mts`.
- Repo baseline realigned to mainnet v1.77.2 / Protocol 133 (mainnet jumped P130→P133 on 2026-08-13): version headers across skills, README, supreme-agent prompt and landing page; corrected the stale "mainnet has NOT shipped 1.77.x" note. New protocol/CLI notes: P131 `TxContext` mut restrictions (system packages only), `ForwardingAddressRegistry` + `ForwardingAddressRegistryCreate` end-of-epoch tx kind (devnet-gated), `sui client send-funds --stateless` removed in favour of `--from-address-balance`, `sui client verify-source` reworked (path-based, on-chain metadata, toolchain cache), git annotated-tag `rev` now pins the commit. CLI claims verified against installed sui 1.77.2.
- sui-nautilus: documented the new `config_version<T>()` / `version<T>()` enclave accessors (upstream #37).

## [2.14.1] - 2026-08-06

### Changed
- Bumped all pinned @mysten/* SDKs to the sui 2.23.2 generation (npm skipped standalone 2.22.2/2.23.0 — their changelogs shipped inside 2.23.1). @mysten/sui 2.23.x adds `core.listTransactions`/`core.listEvents`, gRPC `SubscriptionService` streaming (`subscribeCheckpoints`/`subscribeTransactions`/`subscribeEvents`), full system-tx `TransactionKind` BCS parsing, real gas selection when simulating with empty gas payment, and (2.23.2) `TransactionEffects.gasObject` typed `ChangedObject | null`. @mysten/deepbook-v3 1.6.x syncs deepbook_margin v6 (`placeMarketOrderAndRepayLoan` family, `executeConditionalOrdersV3`, `setMinOpenRiskRatio`) and rotates testnet package IDs. Remaining packages lockstep; @mysten/messaging stays 0.3.0. All API claims verified against 2.23.2 / 1.6.3 `.d.mts`.
- sui-developer skill: protocol section updated to mainnet v1.76.1 / Protocol 130 — new `sui::scratch` module (per-tx ephemeral KV, `std::internal::Permit<K>` gate, verified vs framework source), gRPC filtered `List*`/subscription APIs stable, chain-id Hex form, per-account net withdraws; JSON-RPC wording moved to past tense (public fullnodes verified shut off live on 2026-08-06).
- JSON-RPC shutdown wording updated from future to past tense across sui-ts-sdk, sui-deepbook, sui-deployer, sui-kiosk, sui-move-ts-bridge and the compat-matrix `no-grpc` glossary note (public `fullnode.*.sui.io` hosts still serve gRPC — verified live; only the JSON-RPC protocol is gone).
- sui-deepbook margin reference: new "Margin v6 additions" section (≥1.6.0) and a warning that testnet package IDs rotate across patch versions.
- Targets banners, sdk-compat-matrix, grpc-reference proto stamp and zklogin signer.d.mts stamp synced to 2.23.2 (all 24 listed gRPC methods re-resolved against shipped protos — SubscriptionService now documents `SubscribeTransactions`/`SubscribeEvents`; signer.d.mts identical to 2.22.0); Tested dates refreshed to 2026-08-06. README header realigned to CLI v1.76+ / Protocol 130 / @mysten/sui 2.23.x.
- Protocol/JSON-RPC status realigned repo-wide beyond the skills diff: stale "now v1.74.1 / P128" headers (sui-deployer, sui-tester, sui-architect, sui-indexer reference) and future-tense July-2026 shutdown wording (rules/common/api-migration.md, docs/QUICKSTART.md, docs/GUIDE.md, agent prompts, ts-sdk references) updated to mainnet v1.76.1 / P130 and past-tense shutdown; sui-developer-subagent prompt bumped from Protocol 124 to 130; ts-sdk advanced-patterns cursor caveat updated now that `list_transactions`/`list_events` are SDK-exposed (2.23.x).
- Bumped all pinned @mysten/* SDKs to the sui 2.22.0 generation (lockstep changesets releases through 2026-07-17; verified via changelogs that only @mysten/sui carries changes — 2.20.4 deprecates all JSON-RPC client/transport APIs and fixes `SuiGrpcClient` AbortSignal forwarding, 2.21.0 exports `parseGrpcTransactionResponse`/`parseGrpcSimulateTransactionResponse`, 2.22.0 adds `include: { protoJson: true }` on gRPC transaction results). @mysten/messaging stays 0.3.0.
- sui-ts-sdk skill: documented the JSON-RPC `@deprecated` markers, the AbortSignal fix, the ≥2.22 `protoJson` include, the ≥2.21 gRPC response parsers, and an opaque-pagination-cursor caveat (sui node v1.75.2 changed its server-side scanning-RPC cursor encoding; those RPCs are not exposed through the TS SDK service clients). All claims verified against installed 2.22.0 `.d.mts`/source.
- Targets banners, sdk-compat-matrix, grpc-reference proto stamp and zklogin signer.d.mts stamp synced to 2.22.0 (proto diff shows only codegen import-alias churn; signer.d.mts unchanged); Tested dates refreshed to 2026-07-18.
- `mcp-server/scripts/smoke.mjs`: replaced the hardcoded transaction-digest fixture (pruned by testnet within days — observed retention < 1 week) with runtime resolution of a live ProgrammableTransaction digest from the latest checkpoints, probing with the same `include` set `sui_get_transaction` uses; getServiceInfo retried 3×, per-checkpoint fetch failures walk back and keep probing. mcp-server dependency installs @mysten/sui 2.22.0 under the existing `^2.20.3` range; build + smoke 14/14.
- Bumped all pinned @mysten/* SDKs to the sui 2.20.3 patch generation (11 packages, lockstep changesets release 2026-07-10; verified via changelogs and .d.mts diffs that only @mysten/sui and @mysten/seal carry behavioral changes). @mysten/messaging stays 0.3.0.
- @mysten/seal 1.3.0: `verifyKeyServers` now defaults to `false` (was `true` in ≤1.2.x; verified against dist/client.mjs). sui-seal skill example keeps explicit `true` and documents the flip, including that committee-mode servers skip /service verification regardless.
- @mysten/sui 2.20.3: kind-only build fix (`onlyTransactionKind: true` referencing owned objects without a sender — the seal use-case); simulation checks disabled during kind-only resolution on gRPC/GraphQL and the dummy `0x0` sender no longer leaks into transaction data. mcp-server already pins `^2.20.3` and picks this up on install.
- Targets banners, sdk-compat-matrix, grpc-reference proto stamp and zklogin signer.d.mts stamp synced to 2.20.3 (both surfaces verified unchanged between 2.20.2 and 2.20.3); Tested dates refreshed to 2026-07-11.

## [2.14.0] - 2026-07-11

### Changed
- `mcp-server` migrated from JSON-RPC (`SuiClient`) to SDK v2 gRPC-only (`SuiGrpcClient`, `@mysten/sui@^2.20.3`) for all 14 tools — the dual-client architecture (gRPC primary + JSON-RPC fallback) is gone; smoke suite 14/14 green.
- Underlying data source changed on the gRPC-only path: list tools (`sui_get_owned_objects`, `sui_get_coins`) now fetch from the v2 core client's `.objects` field, but the MCP tool output keeps the pre-migration `.data` key for compatibility — the tools re-wrap `result.objects` into `{ data: [...] }` before returning. `sui_get_object`'s tool output is now the v2 decoded JSON representation (fetched via `include: { json: true }`), not the raw JSON-RPC object shape. Transaction results (`sui_get_transaction`, `sui_get_events`, wallet execute passthrough) use the v2 discriminated transaction shapes (incl. a `FailedTransaction` branch) instead of the raw JSON-RPC shapes.
- Error handling tightened: `sui_resolve_name` on an unregistered SuiNS name now returns a non-error result with `address: null` / empty `names` instead of surfacing the gRPC NOT_FOUND error; all other gRPC transport errors now surface as `isError` tool results instead of being silently swallowed. Also narrower than before: address→names reverse lookup now returns at most the address's *default* SuiNS name (v1 JSON-RPC returned all names owned by the address).
- README.md, docs/GUIDE.md, docs/ARCHITECTURE.md, docs/platforms/claude-code.md updated to describe the MCP server's gRPC-only architecture (dual-client diagrams/wording removed).
- `skills/sui-frontend/references/grpc-reference.md` GraphQL status corrected from "(Beta)" to "(GA)" in the data-access architecture diagram.

### Added
- `mcp-server/scripts/smoke.mjs` — in-memory smoke-test harness for the 14 MCP tools (`npm run smoke`), with fixtures under `mcp-server/scripts/fixtures/smoke-package/`.
- New declared dependency `@protobuf-ts/runtime-rpc` (required by the gRPC transport).
- GUIDE.md MCP configuration section: notes that `SUI_GRPC_URL` should only point at trusted nodes (transaction resolution depends on its object data) and that localnet gRPC support is unverified.

### Removed
- JSON-RPC fallback path from `mcp-server` (`SuiClient`, `getJsonRpcClient`) and its `SUI_RPC_URL` environment variable — gRPC is now the only transport.

## [2.13.4] - 2026-07-11

### Fixed
- JSON-RPC deprecation timeline corrected repo-wide (13 files): stale "removed April 2026" replaced with the official schedule — public endpoints shutting down July 2026 (Testnet: week of Jul 6; Mainnet: week of Jul 20), permanent deactivation 2026-07-31 (per the 2026-03-24 Sui blog announcement). Affects `rules/common/api-migration.md`, `jsonrpc-warn` hook, `protocol-version-check.sh`, agent prompts, GUIDE/QUICKSTART, and the deepbook/ts-sdk/frontend skills.
- GraphQL RPC status corrected from "beta" to GA (5 sites incl. `sui-architect`, agent prompts, GUIDE, QUICKSTART) — gRPC and GraphQL RPC are both GA, positioned by use case (gRPC: fullnode/backend/streaming default; GraphQL RPC: indexer/frontend/complex queries).
- `mcp-server/src/client.ts` JSON-RPC fallback comment now states the real failure point: the default public-endpoint URLs stop working during July 2026 (before the 2026-07-31 protocol-level deactivation); `sui-kiosk` / `sui-move-ts-bridge` compatibility notes flag the limited shelf life of the kiosk JSON-RPC path.

## [2.13.3] - 2026-07-10

### Fixed
- Examples no longer violate the project's own no-`public entry` rule: 11 GOOD snippets across `rules/common/code-quality.md`, `rules/sui-move/security.md`, and `sui-seal` switched to `entry fun` (or `public fun` returning the object where composability is the point); visibility guidance clarified (entry = non-composable endpoint, public = composable, never `public entry`).
- `#[error]` constants updated from `b"..."` byte-string to `"..."` string-literal form in `rules/sui-move/conventions.md` and `sui-developer` reference (5 sites, compile-verified on sui testnet-v1.75.1).

## [2.13.2] - 2026-07-10

### Changed
- `move-code-quality` checklist re-verified against move-book `d700b88`: string literal constant forms updated to follow upstream, `.to_string()`/`.to_ascii_string()` applicable-scenario guidance clarified (compile-verified).
- `sui-developer` "Move Language Updates (from Move Book)" section rewritten to align with the `d700b88` chapter set — bullets covering the 7 new chapters (macros, internal `permit`, entry functions, address balances, package upgrades, MVR, linting); removed an unsupported Lambda Type Annotations claim.

## [2.13.1] - 2026-07-10

### Changed
- Bumped all pinned @mysten/* SDKs to the sui 2.20.2 patch generation (11 packages, published 2026-07-08 as one lockstep changesets release; verified via npm diff that only @mysten/sui has a behavioral change — pagination fix — the other 10 are pure dependency-range bumps). @mysten/messaging stays 0.3.0.
- Targets banners, sdk-compat-matrix, grpc-reference and zklogin-signer version stamps synced; Tested dates refreshed to 2026-07-10.
- sui-ts-sdk: version note on the paginated coin-fetching example — before sui 2.20.2 the unified core client dropped `limit`/`cursor` options (`listCoins` on gRPC, `listBalances` on GraphQL).

## [2.13.0] - 2026-07-03

### Changed
- Bumped all pinned @mysten/* SDKs to the sui 2.20.1 generation (11 packages; verified zero breaking surface changes via .d.mts diffs). @mysten/messaging stays 0.3.0.
- Targets banners, sdk-compat-matrix, and grpc-reference version stamps synced; Tested dates refreshed to 2026-07-03.

### Added
- sui-zklogin: `ZkLoginSigner` official signer wrapper (sui ≥2.20).
- sui-ts-sdk: boolean signature verification forms `isValid*Signature` (sui ≥2.19).
- sui-enoki: note that `EnokiKeypair` extends `ZkLoginSigner` since enoki 1.2.0.

## [2.12.0] - 2026-07-03

### Added
- **`npm-sdks` freshness source** (new `npm` kind in the upstream watcher): tracks the published npm version of all 12 pinned `@mysten/*` SDKs. Closes the gap where TS SDK releases were unwatched — the ts-sdks monorepo stopped cutting GitHub releases in Apr 2026, so repo-level watching missed every SDK publish.
- **Version-consistency CI gate** in `validate-plugin.sh`: `plugin.json` == `marketplace.json` == README banner == latest CHANGELOG entry must agree.
- Freshness watcher self-tests now run in the GitHub Actions workflow.

### Fixed
- **Fabricated gRPC APIs removed** (all service/method names now verified against `@mysten/sui@2.17.0` shipped protos, `sui.rpc.v2`):
  - `client.core.subscribeEvents` / `GrpcCoreClient.streamEvents` / protobuf `SubscribeEvents`+`SubscribeTransactions` do not exist — the only streaming RPC is `SubscribeCheckpoints`; live events need an indexer/GraphQL or client-side checkpoint filtering (`sui-frontend` references, `sui-ts-sdk`).
  - `sui-frontend` gRPC reference: corrected LedgerService/StateService/MovePackageService/NameService method lists (object reads live on **Ledger**Service; `ListOwnedObjects`/`ListDynamicFields`/`GetFunction`/`LookupName` are the real names), fixed fabricated `sui.*.v1` grpcurl paths to `sui.rpc.v2`, refreshed stale v1.68/"removal April 2026" header.
  - `sui-frontend` migration tables: `client.core.multiGetObjects`/`getOwnedObjects`/`getCoins`/`getDynamicFields` corrected to the real 2.x names `getObjects`/`listOwnedObjects`/`listCoins`/`listDynamicFields` (the old names are the 1.x experimental surface).
  - `sui-developer` examples: three `return txb` undefined-variable bugs, untyped `tx.pure(price)` → `tx.pure.u64(price)`, and a v1 `subscribeEvent` block mislabeled as "SDK v2" replaced with honest indexer/checkpoint guidance.
- `plugin.json` repository/homepage pointed at the wrong GitHub org (`ramonliao` → `first-mover-tw`).
- `marketplace.json` version was frozen at 1.0.0; description synced with `plugin.json`.
- Landing page refreshed from v2.9.0 / Protocol 119 to current.
- `sui-ts-sdk` broken "see section 13" pointer → `references/advanced-patterns.md § Offline Building`.
- `.claude/settings.local.json` untracked from git (local settings shouldn't ship in the plugin).

### Changed
- Network pointers refreshed: **mainnet promoted to v1.74.1 / Protocol 128** (2026-07-01, same commit as testnet tag — pure promotion); "mainnet still P126/v1.73.2" parentheticals updated across 6 skills + README; timestamp-based epoch close noted as live on both networks. P127 feature attribution preserved.

## [2.11.3] - 2026-07-02

### Added
- **`sui-seal` messaging reference** (`references/messaging.md`) documenting the `@mysten/messaging@0.3.0` on-chain encrypted messaging SDK (channels + SEAL-encrypted keys + Walrus attachment storage + on-chain membership). API verified against the installed `0.3.0` `.d.ts`. Shipped as a **preview**: messaging@0.3.0's `SealClient.asClientExtension` composition is locked to `@mysten/seal` 0.9.x and does not compile against the seal 1.x documented elsewhere in this skill — the reference carries a prominent version-incompatibility warning.
- Surfaced the reference: `sui-seal` description triggers (encrypted messaging / chat app / on-chain DM / group channel / `@mysten/messaging`), a `sui-seal` See-Also pointer, and a `sui-walrus` cross-pointer.
- Added `@mysten/messaging@0.3.0` to the CI snippet env so the skip-import gate resolves its imports.

### Changed
- Refreshed current-network-state pointers across skill headers to note testnet now **v1.74.1 / Protocol 128** (mainnet stays v1.73.2 / P126); P127 feature attribution preserved.

## [2.11.2] - 2026-07-01

### Changed
- Bumped alignment to **SUI testnet v1.74.1 / Protocol 128** (mainnet stays v1.73.2 / Protocol 126). P128 adds explicit binary-pool bounds — no user-visible change.
- Corrected version attribution for two CLI features that actually ship in **v1.74.1** (not v1.74.0), verified against the installed `sui 1.74.1` CLI:
  - `sui move lint` command (`sui-developer`, `sui-tester`).
  - `sui client call --forking-mode` → `--skip-signing` rename (`sui-red-team`, `sui-tester`).

## [2.11.1] - 2026-06-24

### Changed
- **SUI banners bumped Protocol 126 → 127** (testnet v1.74.0; mainnet stays v1.73.2 / P126) across README + `sui-developer` / `sui-tester` / `sui-deployer` / `sui-architect` / `sui-indexer`. Added P127 deltas: Bulletproofs domain-separation (`verify_bulletproofs_with_dst_ristretto255`, old fn now aborts), Ristretto255 on testnet, `always_advance_dkg_to_resolution`, timestamp-based mainnet epoch close, gRPC `SimulateTransaction` `gas_price=0` gasless tier, new `sui move lint`.
- **`sui-developer` JSON-RPC note** — documented the public JSON-RPC endpoint shutdown dates (Testnet week of July 6, Mainnet week of July 20, 2026), distinct from and earlier than the 2026-07-31 permanent deactivation.
- **`sui-walrus` MemWal reference** — noted the `analyze({ namespace, occurredAt })` options form (`occurredAt` → `occurred_at` ISO string, server resolves relative dates), per published `@mysten-incubation/memwal@0.0.7`.

### Fixed
- **`sui-tester` / `sui-red-team` sender-impersonation corrected** — replaced the fabricated `sui replay --forking-mode impersonate --sender` command with the real flow: `sui-fork start` (separate `crates/sui-fork` binary, build via `cargo build -p sui-fork`) → point CLI at the fork → `sui client call --sender 0x<addr> --skip-signing` (the `--forking-mode` flag was renamed to `--skip-signing` in v1.74.0; it is a `sui client` tx flag, not a `sui replay` flag).

## [2.11.0] - 2026-06-21

### Added
- **New skill `sui-install`** — Sui CLI install via `suiup`, version-mismatch resolution, and client setup (27 docs; registered in the README Setup lifecycle row).
- **New skill `sui-enoki`** — zkLogin-as-a-service + sponsored transactions over the `@mysten/enoki` `EnokiClient`/`EnokiFlow` surface; cross-linked with `sui-zklogin`.
- **New skill `sui-compat-matrix`** — `@mysten/*` SDK version source-of-truth plus the version-bump SOP, CI-enforced.
- **SUI upstream freshness system** — `scripts/freshness/detect.mjs` entry (24h cache gate, drift/pending detection, never-block, release→commit fallback), a 15-source upstream registry, pure compare/render/cache-gate logic with tests, injectable `gh`/`curl` marker fetchers, and a Layer 2 deep-investigation runbook (gemini→codex + suiup).
- **CI: compat-matrix checker** — strict Targets-line and matrix-table grammar parsers, rules R1–R9 (including matrix→banner consistency and duplicate-row rejection) with fixture-based tests, wired into `validate.yml` with a failure summary table.
- `sui-security-guard`: Move contract finding registry.
- Advanced-API references: `sui-seal` (1.1.3 new exports), `sui-walrus` (1.1.7 new exports), `sui-ts-sdk` (advanced PTB + archival reads), `sui-developer`/`sui-architect` (object-model deep reference), and a `sui-developer` write-time Move 2024 idiom reference.
- One-line mentions for `enoki-connect` / `slush` / `payment-kit` / `pay` (C2 coverage).

### Changed
- **Breaking (skill content): Renamed skill `sui-fullstack-integration` → `sui-move-ts-bridge`** (Move↔TS bridge: type generation, event handling, ABI wrappers; disambiguates from the `sui-full-stack` orchestrator). Updated slug, directory, subagent, cross-links, and compat-matrix paths.
- **SUI banners bumped Protocol 125 → 126** (mainnet v1.73.2), with Display V2 module fix and deepbook 1.4.1 alignment.
- `sui-nautilus` rewritten against the real `MystenLabs/nautilus` repo.
- Normalized 10 skill banners to the strict Targets + Compatibility-notes grammar.
- Large reference extractions (SKILL → `references/*.md` + stub) across `sui-deepbook` (margin / predict / indexer), `sui-frontend` (non-React integration), `sui-indexer`, and `sui-ts-sdk`; added fence-aware TOCs to 8 reference files >300L.
- README banner synced to Protocol 126; `/sui-compat-matrix` and `/sui-install` added to the lifecycle table.

### Fixed
- **P3 polish**: removed `sui-seal` dead `fromHex` block (relocated import to decrypt), corrected `sui-passkey` `rp:{name,id}` typing, added the missing `sui-zklogin` → `sui-enoki` cross-reference.
- `sui-suins`: replaced fabricated `registry::register` Move/TS with the real `SuinsTransaction.register`.
- `sui-kiosk`: replaced broken raw-purchase TS with `KioskTransaction.purchaseAndResolve`.
- `sui-ts-sdk`: replaced wrong sponsored-tx block with a pointer to the canonical `fromKind` flow; fixed §10 sponsored attribution.
- **P1 audit fixes**: test runner correctness, README coverage, and dropped the fictional `sui_docs_query` API.
- Corrected hallucinated APIs and bumped `deepbook-v3` / `wallet-standard`.
- Freshness runner bounded with a timeout and guarded against an all-error false-green.
- Snippet type-check baseline: skipped 100 illustrative blocks (baseline 100 → 0).
- Portable Title Case in `generate-subagents.sh`.

## [2.10.0] - 2026-05-21

### Changed
- **Breaking (skill content): `sui-deepbook` rewritten V2 → V3.** Replaces the legacy `deepbook::clob_v2` / `AccountCap` model with V3 (`Pool` + `BalanceManager` + `TradeProof` + DEEP-token fees). Users copying V2 snippets from earlier versions will need to migrate — the new skill documents `DeepBookClient` / `DeepBookAdminClient`, Margin trading (MarginManager/Pool/TPSL with Pyth price feeds), the Indexer REST API, and the testnet Predict market module.

### Added
- **CI: TS snippet type-check pipeline.** New `scripts/ci/snippets/` harness extracts every ` ```ts ` / ` ```typescript ` block from skill markdown and runs `tsc --noEmit` against the real installed `@mysten/*` `.d.ts` surface. A `known-failures.txt` baseline freezes existing fragment-continuation failures; CI fails only on *new* hallucinations. Wired into `.github/workflows/validate.yml`.

### Fixed
- **16 hallucinated SDK APIs caught by the new pipeline** across skills — including `tx.pure(raw)` → typed `tx.pure.u64/.bool/.id/.address`, JSON-RPC response shapes (`.data` / `.nextCursor` / `coinObjectId`) → gRPC shapes (`.objects` / `.cursor` / `objectId`), non-existent `client.subscribeEvent`, wrong SuiNS API surface, and `Ed25519Keypair.export()` → `.getSecretKey()`. Full list in commit `105c1c7`.

## [2.9.2] - 2026-05-21

### Fixed
- **Critical**: `sui-seal` skill rewritten to match the real `@mysten/seal` 1.1.3 API. Removed fabricated `@aspect/seal-sdk` package, non-existent `client.extend(seal())` factory, non-existent `sealClient.seal.encrypt/decrypt` namespace, wrong `KeyServerConfig.url` field (now `objectId`), and added the mandatory `txBytes` parameter (built from a `seal_approve*` PTB) to every decrypt example.
- **Critical**: `sui-zklogin` skill rewritten. Dropped the deprecated `@mysten/zklogin` package and the fictional `ZkLoginProvider` class. Now uses the real functional API from `@mysten/sui/zklogin` (`generateNonce`, `jwtToAddress`, `genAddressSeed`, `getZkLoginSignature`).
- **Critical**: `sui-passkey` skill imports corrected from `@mysten/wallet-standard` (which has no passkey exports) to `@mysten/sui/keypairs/passkey` (`BrowserPasskeyProvider`, `PasskeyKeypair`).
- `sui-walrus`: removed fabricated `@walrus-sdk/client` stub block; consolidated to the real `@mysten/walrus` `.$extend(walrus())` pattern.
- `sui-ts-sdk` references: removed non-existent `seal` extension factory rows; point readers to the `sui-seal` skill instead.

### Changed
- `sui-frontend` banner: `@mysten/dapp-kit-core` version constraint corrected from `^2.0` to `^1.3` (latest published is 1.3.2; no 2.x exists).
- `sui-full-stack`: install/usage migrated from legacy `@mysten/dapp-kit` to the active split (`@mysten/dapp-kit-react` + `@mysten/dapp-kit-core`), matching `sui-frontend`.
- `sui-ts-sdk` references: unified DeepBook examples on `@mysten/deepbook-v3` (1.3.6); removed legacy `@mysten/deepbook` (V2 CLOB) references.

### Added
- SDK version banners on `sui-kiosk`, `sui-suins`, `sui-deepbook` skills (mirroring the `sui-frontend` pattern).

## [2.9.1] - 2026-05-21

### Changed
- SUI version refs aligned with testnet v1.72.2 (Protocol 124) and mainnet v1.71.1 (Protocol 123).
- SDK banners (`sui-frontend`, `sui-seal`, `sui-walrus`, `sui-ts-sdk`) re-verified for `@mysten/sui` 2.x.

### Added
- `sui-developer`: Move 1.70–1.71 APIs section (dynamic_field helpers, `mul_div`, deprecation list).
- `sui-indexer`: documents `subscriber_channel_size` / `pipeline-depth`; rpc-index DB v4 upgrade note.
- `sui-tester` / `sui-red-team`: `sui replay --forking-mode` + `sui-fork` impersonation usage.
- `sui-frontend`: parser-breaking note on `TypeName` structured-output format.

### Fixed
- `sui-tester`: deduped repeated `## SUI v1.72.2 Testing Updates (Protocol 124)` header; folded Protocol 124 gas/decoded-object notes into the single section.

### Removed
- `sui-indexer`: `checkpoint_lag` / `checkpoint_buffer_size` examples (config keys removed upstream in v1.71).

## [2.7.0] - 2026-04-06

### Added

#### New Skill: sui-indexer
- **`skills/sui-indexer/SKILL.md`:** Complete Indexing Framework skill — custom pipeline development, CheckpointEnvelope API (Protocol 119), Processor trait, Service lifecycle, multi-processor pipelines, backfill strategies, metrics/monitoring
- **`skills/sui-indexer/references/reference.md`:** Type definitions, Service Builder API, StoreIngestionClient examples, processor examples (event indexer, object tracker, pipeline composition)
- Registered in infrastructure agent routing and supreme agent skill list

### Changed

#### Protocol & Version Updates
- **SUI CLI:** >= 1.68 -> >= 1.69 (Protocol 119, testnet v1.69.1 / mainnet v1.67.3 Protocol 115)
- Version sweep: 21+ files (plugin.json, README, scripts, skills, agents, docs, landing page)

#### Skills Updated (aligned with SUI v1.69.1)
- **`skills/sui-developer/SKILL.md`:** Protocol 119 — New Move VM (testnet), `sui move build --dump` offline support, `sui client object` decoded output
- **`skills/sui-tester/SKILL.md`:** Gas re-benchmarking note for New Move VM, decoded object inspection
- **`skills/sui-deployer/SKILL.md`:** Cross-network VM differences note, offline bytecode dump for air-gapped pipelines
- **`skills/sui-frontend/references/grpc-reference.md`:** gRPC chain ID header updated to full 32-byte Base58 format

#### Key Theme: Indexing & New VM
- New Move VM enabled on testnet (Protocol 119) — performance improvements, no behavioural changes
- Custom indexer pipelines via `sui-indexer` skill for data-intensive applications
- gRPC chain ID header now returns full 32-byte Base58-encoded identifier

### Fixed
- **MCP `sui_get_object`:** Ensure decoded content fields are returned

---

## [2.6.0] - 2026-03-25

### Changed

#### Protocol & Version Updates
- **SUI CLI:** >= 1.67 -> >= 1.68 (Protocol 118, testnet v1.68.1 / mainnet v1.67.3 Protocol 115)
- Fixed residual version mismatches from v2.5.0 (protocol-version-check.sh, supreme prompt, docs)

#### Skills Updated (aligned with SUI v1.68.1 + MystenLabs sui-dev-skills)
- **`skills/sui-developer/SKILL.md`:** Updated to Protocol 118 — Display Registry in APIs, MoveValue.asVector, SignatureScheme union, chainIdentifier full digest
- **`skills/sui-developer/references/reference.md`:** Added Pattern 11 (Witness & Capability Authorization) and Pattern 12 (PTB-Composable Object Returns / Hot Potato)
- **`skills/sui-ts-sdk/SKILL.md`:** Added §7.1 PTB Composability Patterns — multi-step swap/stake and flash loan TypeScript examples
- **`skills/move-code-quality/SKILL.md`:** Added Witness struct naming rule, object return composability rule, hot potato enforcement rule

#### Key Theme: Composability & Authorization Patterns
- Witness + Capability dual authorization pattern for production-grade access control
- PTB-composable object returns — functions return objects instead of transferring, enabling PTB chaining
- Hot potato pattern — structs with no abilities enforce atomic multi-step operations
- TypeScript PTB examples showing Move composability from the frontend

---

## [2.5.0] - 2026-03-19

### Changed

#### Protocol & Version Updates
- **SUI CLI:** >= 1.67 -> >= 1.68 (Protocol 117, testnet v1.68.0 / mainnet v1.67.3 Protocol 115)

#### Skills Updated (aligned with SUI v1.68 release + MystenLabs sui-dev-skills)
- **`skills/sui-developer/SKILL.md`:** Updated to v1.68 — Display V2 activation, Address Aliases on mainnet, Adaptive Concurrency Control, `#[error]` annotation, macro patterns (`do!`, `tabulate!`, `fold!`, `filter!`), positional struct keys, GraphQL simulation breaking changes
- **`skills/sui-architect/SKILL.md`:** Updated to v1.68 / Protocol 117 — Display V2, Address Aliases mainnet, Adaptive Concurrency, Quorum Driver disabled
- **`skills/sui-deployer/SKILL.md`:** Updated to v1.68 — Quorum Driver fully disabled, Transaction Driver exclusive, `sui move build --dump` fix, Protocol 117/115 refs
- **`skills/sui-tester/SKILL.md`:** Updated to v1.68 — gRPC required (Quorum Driver disabled), `#[error]` annotation testing, GraphQL simulation events change
- **`skills/sui-deepbook/SKILL.md`:** Version refs updated to testnet-v1.68.0, gRPC client guidance
- **`skills/sui-suins/SKILL.md`:** Version header updated to v1.68
- **`skills/sui-fullstack-integration/SKILL.md`:** Fixed SuiGrpcClient constructor (added `network` + `baseUrl` params)
- **`skills/move-code-quality/SKILL.md`:** Added `#[error]` annotation rule, `public(package)` deprecation of `public(friend)`
- **`skills/sui-frontend/references/grpc-reference.md`:** Updated to v1.68, Quorum Driver disabled note, Adaptive Concurrency indexing changes
- **`skills/sui-frontend/references/reference.md`:** GraphQL API version range updated

#### Key Theme: gRPC-First
- JSON-RPC Quorum Driver is **fully disabled** — transaction submission exclusively via Transaction Driver
- All skills now emphasize gRPC as the primary (not just recommended) API
- JSON-RPC removal deadline remains April 2026

---

## [2.4.0] - 2026-03-06

### Changed

#### Protocol & Version Updates
- **SUI CLI:** >= 1.65 -> >= 1.67 (Protocol 114, testnet v1.67.1 / mainnet v1.66.2)
- **plugin.json:** Version bump to 2.4.0

#### Skills Updated (aligned with official MystenLabs sui-dev-skills)
- **`skills/sui-ts-sdk/SKILL.md`:** Complete rewrite aligned with official skill — added gRPC service clients (`ledgerService`, `movePackageService`, `nameService`), `$extend()` pattern for ecosystem SDKs, `tx.pure.id()`, `tx.object.option()`, `TransactionCommands` rename, MVR built-in, full v1-to-v2 migration table with method renames
- **`skills/sui-frontend/SKILL.md`:** Complete rewrite aligned with official skill — `createDAppKit` API now takes `networks` as string array + `createClient` callback, Web Components renamed to `mysten-dapp-kit-*`, `$connection` store, `connectWallet({ wallet })` / `disconnectWallet()`, `result.FailedTransaction` check pattern, Vue example with `@nanostores/vue`, connect modal web component
- **`skills/sui-developer/SKILL.md`:** Updated to v1.67 — address aliases on mainnet, Sui gas meter for tests, CLI auto-completion, Ristretto255 group ops, gas schedule rebalancing

#### Rules Updated
- **`rules/common/api-migration.md`:** Fixed import paths (`@mysten/sui/rpc` -> `@mysten/sui/jsonRpc`), added `network` param requirement, `$extend()` pattern, dApp Kit migration table, expanded detection patterns
- **`rules/sui-move/conventions.md`:** Added testing conventions section (test naming, assert_eq!, destroy pattern, tx_context::dummy vs test_scenario)

#### Documentation
- **`README.md`:** Version bump v2.4.0, CLI >= 1.67, added dApp Kit package names

---

## [2.1.0] - 2026-02-11

### Added

#### gRPC Migration (JSON-RPC Deprecated)
- **New reference:** `skills/sui-frontend/references/grpc-reference.md` — Complete gRPC API guide with 7 services, migration table, connection examples
- **New rule:** `rules/common/api-migration.md` — Enforces gRPC/GraphQL usage over deprecated JSON-RPC
- **New hook:** PostToolUse JSON-RPC detection — Warns when JSON-RPC patterns found in TS/JS files

### Changed

#### Protocol & Version Updates
- **Protocol Version:** 109 → 110 (testnet v1.65.1)
- **plugin.json:** Version bump to 2.1.0
- **sui-supreme-prompt.md:** Updated platform version, added gRPC as primary data access

#### JSON-RPC → gRPC Migration
- **`scripts/protocol-version-check.sh`:** Replaced JSON-RPC query with `sui client` CLI, JSON-RPC as fallback with deprecation warning
- **`skills/sui-frontend/SKILL.md`:** Added data access migration section, gRPC reference link, Balance API split details
- **`skills/sui-deployer/SKILL.md`:** Added gRPC endpoint table, RPC migration notice
- **`skills/sui-frontend/references/reference.md`:** Added gRPC API section with 7 service descriptions
- **`.mcp.json`:** Updated with gRPC/GraphQL endpoint examples, deprecated JSON-RPC reference

#### GraphQL v1.65 Updates
- **Balance API clarification:** `Balance.coinBalance` (coin-only), `Balance.addressBalance` (address-specific)

#### Documentation
- **`README.md`:** Version bump, gRPC mention
- **`docs/GUIDE.md`:** Added data access architecture section (gRPC vs GraphQL vs Indexer)
- **`docs/QUICKSTART.md`:** Fixed SDK package name, added API migration notice, updated protocol version
- **`hooks/hooks.json`:** Added JSON-RPC detection hook

---

## [2.0.0] - 2026-02-11

### Added

#### Commands (7 total)
New fast-track commands for common operations:
- `/sui-dev-agents:init` - Initialize new SUI Move project with proper structure
- `/sui-dev-agents:build` - Build Move contracts with verification
- `/sui-dev-agents:test` - Run comprehensive test suite
- `/sui-dev-agents:deploy` - Deploy contracts to network
- `/sui-dev-agents:audit` - Security audit and vulnerability scan
- `/sui-dev-agents:upgrade` - Upgrade deployed contracts
- `/sui-dev-agents:gas` - Generate gas usage report

#### Hooks System
Automatic verification and safety checks:
- **PostToolUse Hook** - Auto-verify Move syntax after editing `.move` files
- **SessionStart Hook** - Display active SUI environment on session start
- **Stop Hook** - Warn if `#[test_only]` code leaked into production sources
- Configuration: `hooks/hooks.json`

#### Rules & Best Practices
Installable coding conventions and standards:
- `rules/sui-move/conventions.md` - Move coding standards and patterns
- `rules/sui-move/security.md` - Security best practices and vulnerability prevention
- `rules/sui-move/testing.md` - Test patterns and gas optimization
- `rules/common/code-quality.md` - General code quality guidelines
- `scripts/install-rules.sh` - Auto-installer to `~/.claude/rules/`

#### Developer Tools
- `.mcp.json` - MCP server template configuration
- `.lsp.json` - move-analyzer LSP configuration for IDE integration

#### Example Projects
Complete starter templates:
- `examples/starter-nft/` - NFT collection with Kiosk integration
- `examples/starter-defi/` - DeFi AMM with liquidity pools
- `examples/starter-dao/` - DAO governance with voting
- `examples/CLAUDE.md` - Project-specific Claude instructions template

#### Utility Scripts
- `scripts/install-rules.sh` - Install rules to user's Claude config
- `scripts/check-sui-env.sh` - Verify SUI CLI environment
- `scripts/protocol-version-check.sh` - Check protocol version compatibility
- `scripts/gas-report.sh` - Generate detailed gas usage report

### Changed
- **plugin.json** - Updated to v2.0.0 with new component declarations
- **Directory Structure** - Added `commands/`, `hooks/`, `rules/`, `examples/`, `scripts/`
- **Documentation** - Updated README, QUICKSTART, added GUIDE.md and ARCHITECTURE.md

### Infrastructure
- Hooks system for automated verification
- Rules installation system
- Command registration system
- Enhanced project scaffolding

## [1.1.0] - 2026-02-05

### Updated

#### SUI Platform Updates (v1.62 - v1.64, Protocol 109)
- **TxContext Flexible Positioning:** Updated all skills/agents to reflect that `TxContext` arguments can now appear in any position within PTBs
- **Entry Function Changes:** Documented disabled signature check and hot potato rule for non-public entry functions
- **poseidon_bn254:** Documented availability on all networks for zero-knowledge proof applications
- **Address Alias:** Documented testnet availability of address alias feature
- **Gas Schedule Updates (v1.62):** Added documentation for dynamic field cost changes (~21.5% median gas decrease)
- **DeepBook Explicit Dependency:** Added note that DeepBook must be explicitly added to `Move.toml` since v1.47

#### TypeScript SDK Updates
- **Package Rename:** Updated all code examples from `@mysten/sui.js` → `@mysten/sui`
- **Transaction Rename:** Updated all code examples from `TransactionBlock` → `Transaction` (variable convention: `tx` instead of `txb`)
- **Hook Rename:** Updated `useSignAndExecuteTransactionBlock` → `useSignAndExecuteTransaction`
- **Import Paths:** Updated to `@mysten/sui/client`, `@mysten/sui/transactions`

#### GraphQL API Updates (v1.64)
- **New Query Fields:** `Query.node(id: ID!)`, `MoveValue.extract/format/asAddress`, `DynamicFieldName.literal`
- **Balance API Change:** `Balance.totalBalance` now sums owned coins + accumulator objects
- **SuiNS API Restructure:** `Query.suinsName` → `Query.address(name: ...)`, `defaultSuinsName` → `defaultNameRecord.target`
- **JSON Blob Support:** `effectsJson`, `transactionJson`, `balanceChangeEffectJson` fields
- **Rich Query Limit:** Single budget enforcing database request limits per GraphQL request

#### CLI Updates (v1.64)
- **publish/upgrade fix:** Fixed flag handling for `sui client publish | upgrade`
- **`--no-tree-shaking` flag:** New flag for preserving all dependencies in bytecode dump
- **Compatibility Verification:** Now enabled by default

#### Move Language Updates (from Move Book)
- **Extensions:** New chapter on Move extensions
- **Modes:** New chapter on Move modes and `#[test_only]` attribute
- **Storage Rewrite:** Updated storage model documentation
- **Type Reflection v2:** Enhanced type reflection capabilities
- **Lambda Type Annotations:** Type annotations now supported on lambdas
- **Regex Test Filtering:** Test filtering now uses regex instead of substring matching

### Skills Updated (14 files)
- `sui-developer` - Protocol changes, Move language updates
- `sui-frontend` - SDK rename, GraphQL API changes, Balance API
- `sui-deployer` - CLI changes, Protocol 109
- `sui-suins` - GraphQL API restructure
- `sui-tester` - Gas schedule, regex filtering
- `sui-architect` - Platform considerations
- `sui-deepbook` - Explicit dependency requirement
- `sui-kiosk` - SDK updates
- `sui-walrus` - SDK updates
- `sui-zklogin` - SDK updates
- `sui-passkey` - SDK updates
- `sui-seal` - SDK updates
- `sui-nautilus` - SDK updates
- `sui-full-stack` - SDK reference update

### Agents Updated (5 files)
- `sui-supreme` - Platform version info
- `sui-developer-subagent` - Protocol version, Move 2024 Edition
- `sui-frontend-subagent` - SDK naming
- `sui-deployer-subagent` - CLI changes
- `sui-tester-subagent` - Regex filtering

### Reference Files Updated (4 files)
- `sui-frontend/references/reference.md` - Complete GraphQL API documentation
- `sui-fullstack-integration/references/examples.md` - SDK updates
- `sui-developer/references/examples.md` - SDK updates
- `sui-full-stack/references/phases.md` - SDK reference

---

## [1.0.0] - 2026-02-02

### Added

#### Skills (18 total)
- **Core Orchestrator:**
  - `/sui-full-stack` - Complete end-to-end project workflow with Git integration

- **Development Workflow:**
  - `/sui-architect` - Architecture planning and specification generation
  - `/sui-developer` - Move smart contract development with quality checks
  - `/sui-frontend` - React/Next.js/Vue frontend integration
  - `/sui-fullstack-integration` - TypeScript type generation from Move
  - `/sui-tester` - Comprehensive testing (unit, integration, E2E, gas benchmarks)
  - `/sui-deployer` - Staged deployment (devnet, testnet, mainnet)

- **Infrastructure:**
  - `/sui-security-guard` - Security scanning, Git hooks, vulnerability detection
  - `/sui-docs-query` - Latest SUI documentation lookup

- **Ecosystem Integrations:**
  - `/sui-kiosk` - NFT marketplace protocol (royalties, policies)
  - `/sui-zklogin` - Zero-knowledge authentication
  - `/sui-passkey` - WebAuthn integration
  - `/sui-deepbook` - DEX protocol integration
  - `/sui-walrus` - Decentralized storage
  - `/sui-suins` - SUI name service
  - `/sui-seal` - Asset wrapping protocol
  - `/sui-nautilus` - AMM protocol
  - `/sui-tools-guide` - Tool selection and recommendation

#### Agents (23 total)
- **Supreme Orchestrator:**
  - `sui-supreme` - Top-level task decomposition and coordination

- **Category Agents:**
  - `sui-core-agent` - Full-stack project workflows
  - `sui-infrastructure-agent` - Documentation and security services
  - `sui-development-agent` - Complete development lifecycle
  - `sui-ecosystem-agent` - Protocol integrations

- **Specialized Subagents (18):**
  - Architecture, development, frontend, testing, deployment subagents
  - Ecosystem-specific subagents for Kiosk, zkLogin, DeepBook, Walrus, and more

#### Features
- Hierarchical agent orchestration system
- Complete SUI blockchain development lifecycle support
- Git integration with automatic commit and push
- Security scanning and vulnerability detection
- Multi-network deployment automation
- Comprehensive testing framework
- TypeScript SDK integration
- Move 2024 Edition best practices
- Production-ready code generation

### Infrastructure
- Plugin configuration system with `.sui-full-stack.json`
- Agent registration via `claude-code-agent-config.json`
- Skill discovery and validation
- Documentation and examples

---

## Future Roadmap

### Planned for v2.2.0
- Enhanced error recovery mechanisms
- Additional ecosystem protocol integrations
- Performance optimization for large projects
- Interactive tutorial mode

### Planned for v2.3.0
- CI/CD pipeline integration
- Advanced monitoring and analytics
- Multi-language frontend support
- Enhanced security scanning rules

---

[2.1.0]: https://github.com/ramonliao/sui-dev-agents/releases/tag/v2.1.0
[2.0.0]: https://github.com/ramonliao/sui-dev-agents/releases/tag/v2.0.0
[1.1.0]: https://github.com/ramonliao/sui-dev-agents/releases/tag/v1.1.0
[1.0.0]: https://github.com/ramonliao/sui-dev-agents/releases/tag/v1.0.0
