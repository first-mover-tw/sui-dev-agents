# Changelog

All notable changes to the SUI Dev Agents plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
