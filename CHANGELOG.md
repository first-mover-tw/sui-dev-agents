# Changelog

All notable changes to the SUI Dev Agents plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
