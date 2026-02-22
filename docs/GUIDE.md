# SUI Dev Agents - Complete Usage Guide

**Version 2.3.0**

Complete guide to building production-ready SUI blockchain applications using the sui-dev-agents plugin. Aligned with SUI SDK v2, dApp Kit v2, and Move 2024 Edition.

## Table of Contents

1. [Installation](#installation)
2. [Commands](#commands)
3. [Skills](#skills)
4. [Agents](#agents)
5. [MCP Server & Agent Wallet](#mcp-server--agent-wallet)
6. [Hooks](#hooks)
7. [Rules](#rules)
8. [Developer Tools](#developer-tools)
9. [Examples](#examples)
10. [Workflows](#workflows)

---

## Installation

### Install from Marketplace

```bash
/plugin marketplace add first-mover-tw/sui-dev-agents
/plugin install sui-dev-agents
```

### Direct Installation

```bash
/plugin install first-mover-tw/sui-dev-agents
```

### Post-Installation Setup

1. Install rules for code quality:
```bash
bash ~/.claude/plugins/sui-dev-agents/scripts/install-rules.sh
```

2. Verify SUI environment:
```bash
bash ~/.claude/plugins/sui-dev-agents/scripts/check-sui-env.sh
```

---

## Commands

Fast, focused operations for common tasks. Commands are invoked with `/sui-dev-agents:` prefix.

### `/sui-dev-agents:init`

Initialize new SUI Move project with proper structure.

**Usage:**
```bash
/sui-dev-agents:init
```

**Prompts:**
- Project name (required)
- Description (optional)
- Target directory (default: current)

**Creates:**
- Project structure via `sui move new`
- Enhanced `Move.toml` with Protocol 111
- Test directories and scaffolds
- Git repository with initial commit
- Documentation files

**Example:**
```bash
/sui-dev-agents:init
→ Project name: my-nft-collection
→ Description: NFT collection with dynamic traits
→ ✅ Created at ./my-nft-collection/
```

### `/sui-dev-agents:build`

Build Move contracts with syntax verification.

**Usage:**
```bash
/sui-dev-agents:build
```

**Actions:**
- Runs `sui move build --skip-fetch-latest-git-deps`
- Shows compilation errors with line numbers
- Verifies syntax correctness
- Reports build time

**Example:**
```bash
/sui-dev-agents:build
→ Building...
→ ✅ Build successful (2.3s)
→ 📦 Package ID: 0x...
```

### `/sui-dev-agents:test`

Run comprehensive test suite.

**Usage:**
```bash
/sui-dev-agents:test
```

**Includes:**
- Unit tests in `sources/`
- Integration tests in `tests/`
- Gas benchmarks
- Test coverage report

**Options:**
- Filter tests by pattern (regex)
- Gas profiling mode
- Verbose output

**Example:**
```bash
/sui-dev-agents:test
→ Running 15 tests...
→ ✅ 15 passed, 0 failed
→ Gas usage: 1.2M avg
```

### `/sui-dev-agents:deploy`

Deploy contracts to network.

**Usage:**
```bash
/sui-dev-agents:deploy
```

**Prompts:**
- Target network (devnet/testnet/mainnet)
- Confirmation for testnet/mainnet
- Gas budget

**Actions:**
- Builds contracts
- Publishes to selected network
- Saves package ID to config
- Updates deployment docs

**Example:**
```bash
/sui-dev-agents:deploy
→ Network: devnet
→ Gas budget: 100000000
→ ✅ Deployed at 0xABC...
```

### `/sui-dev-agents:audit`

Security audit and vulnerability scan.

**Usage:**
```bash
/sui-dev-agents:audit
```

**Checks:**
- OWASP vulnerability patterns
- Reentrancy risks
- Integer overflow/underflow
- Access control issues
- Gas optimization opportunities

**Output:**
- Severity levels (Critical/High/Medium/Low)
- Line numbers and descriptions
- Remediation suggestions

**Example:**
```bash
/sui-dev-agents:audit
→ Scanning 8 Move files...
→ ⚠️  2 medium issues found
→ ✅ No critical issues
```

### `/sui-dev-agents:upgrade`

Upgrade deployed contracts.

**Usage:**
```bash
/sui-dev-agents:upgrade
```

**Prompts:**
- Package ID to upgrade
- Upgrade capability object
- Migration strategy

**Actions:**
- Compatibility verification
- Upgrade policy validation
- Publishes upgrade
- Updates package references

**Example:**
```bash
/sui-dev-agents:upgrade
→ Current: 0xABC...
→ ✅ Upgraded to 0xDEF...
```

### `/sui-dev-agents:gas`

Generate gas usage report.

**Usage:**
```bash
/sui-dev-agents:gas
```

**Reports:**
- Per-function gas costs
- Transaction gas estimates
- Storage costs
- Optimization suggestions

**Output:**
- Detailed CSV report
- Summary statistics
- Cost comparison

**Example:**
```bash
/sui-dev-agents:gas
→ mint_nft: 1.2M gas
→ transfer: 800K gas
→ Total: 2.0M gas
```

### `/sui-dev-agents:mcp-status`

Check MCP server connection and available tools.

**Usage:**
```bash
/mcp-status
→ Server: sui-dev-mcp (gRPC)
→ Network: testnet
→ Tools: 14 available
```

### `/sui-dev-agents:wallet-status`

Check agent wallet address and balance.

**Usage:**
```bash
/wallet-status
→ Address: 0x1234...
→ Balance: 1.5 SUI
→ Network: testnet
```

---

## Skills

Skills are invoked with `/` prefix (e.g., `/sui-architect`).

### Core Development Skills

#### `/sui-full-stack`
Complete end-to-end project workflow with Git integration.

**Phases:**
0. Git initialization
1. Architecture planning
2. Smart contract development
3. Frontend integration
4. Full-stack integration
5. Testing
6. Deployment
7. Documentation

**Best for:** New complete projects

#### `/sui-architect`
Architecture planning and specification generation.

**Outputs:**
- `docs/specs/YYYY-MM-DD-{project}-spec.md`
- Architecture diagrams (text-based)
- Security threat model
- Component interactions

**Best for:** Design phase, complex systems

#### `/sui-developer`
Move smart contract development with quality checks.

**Features:**
- Move 2024 Edition best practices
- Real-time syntax validation
- Gas optimization suggestions
- Security pattern enforcement

**Best for:** Contract implementation

#### `/sui-ts-sdk`
TypeScript SDK v2 integration — PTB construction, queries, sponsored transactions, BCS encoding.

**Features:**
- Programmable Transaction Blocks (PTB)
- Client queries and event subscriptions
- Sponsored transactions
- v1 → v2 migration reference

**Best for:** Backend/CLI SDK usage, transaction construction

#### `/sui-frontend`
React/Next.js/Vue frontend integration.

**Includes:**
- Wallet integration (@mysten/dapp-kit v2)
- SDK setup (@mysten/sui v2)
- Transaction builders
- Component templates

**Best for:** Frontend development

#### `/sui-tester`
Comprehensive testing framework.

**Test Types:**
- Unit tests (Move)
- Integration tests (Move)
- E2E tests (TypeScript)
- Gas benchmarks

**Best for:** Quality assurance

#### `/sui-deployer`
Staged deployment to networks.

**Networks:**
- Devnet (fully automated)
- Testnet (confirmation required)
- Mainnet (full security checklist)

**Best for:** Production deployment

### Security & Analysis Skills

#### `/sui-red-team`
Adversarial security testing with automated attack simulation.

**Features:**
- 8 attack categories (reentrancy, flash loan, overflow, access control, etc.)
- Configurable rounds (default 10)
- `--keep-tests` to preserve generated attack tests
- Security report with EXPLOITED/SUSPICIOUS/DEFENDED classification

**Best for:** Pre-deployment security validation

#### `/sui-decompile`
On-chain contract reverse engineering and source retrieval.

**Methods:**
- SUI CLI (fastest, no browser)
- Suivision Explorer (verified source)
- Suiscan Explorer (fallback)

**Best for:** Studying existing on-chain contracts

#### `/move-code-quality`
Move Book code quality checklist analysis.

**Best for:** Code quality gate before deployment

#### `/sui-wallet`
Agent wallet operations via MCP server.

**Features:**
- Dry-run → approve → execute workflow
- Transfer, call, publish operations
- SDK-based PTB (no CLI shell injection risk)

**Best for:** On-chain transactions from Claude Code

### Infrastructure Skills

#### `/sui-security-guard`
Security scanning and vulnerability detection.

**Modes:**
- `standard` - Common vulnerabilities
- `strict` - Enhanced checks
- `paranoid` - Maximum scrutiny

**Best for:** Security audits

#### `/sui-docs-query`
Latest SUI documentation lookup.

**Sources:**
- Official SUI docs
- Move Book
- API references
- Protocol updates

**Best for:** Looking up APIs

### Ecosystem Integration Skills

#### `/sui-kiosk`
NFT marketplace protocol integration.

**Features:**
- Transfer policies
- Royalty enforcement
- List/purchase flows
- Kiosk management

#### `/sui-zklogin`
Zero-knowledge authentication.

**Features:**
- OAuth provider integration
- zkProof generation
- On-chain verification
- Session management

#### `/sui-deepbook`
DEX protocol integration.

**Features:**
- Order book management
- Liquidity pools
- Trading flows
- Price oracles

#### `/sui-walrus`
Decentralized storage integration.

**Features:**
- Blob storage
- Metadata management
- IPFS-like addressing
- Storage costs

---

## Agents

Agents are used for complex multi-step orchestration via the Task tool.

### Agent Hierarchy

```
sui-supreme
├── sui-core-agent
│   └── sui-full-stack-subagent
├── sui-infrastructure-agent
│   ├── sui-docs-query-subagent
│   └── sui-security-guard-subagent
├── sui-development-agent
│   ├── sui-architect-subagent
│   ├── sui-developer-subagent
│   ├── sui-frontend-subagent
│   ├── sui-tester-subagent
│   └── sui-deployer-subagent
└── sui-ecosystem-agent
    ├── sui-kiosk-subagent
    ├── sui-zklogin-subagent
    ├── sui-deepbook-subagent
    ├── sui-walrus-subagent
    └── [more ecosystem subagents]
```

### Using Agents

**Example 1: Complete Project Build**
```typescript
Task({
  subagent_type: "sui-supreme",
  prompt: "Build a DeFi AMM with DeepBook integration",
  description: "DeFi AMM complete build"
})
```

**Example 2: Specific Development Phase**
```typescript
Task({
  subagent_type: "sui-development-agent",
  prompt: "Implement staking contract with time-locks",
  description: "Staking contract"
})
```

**Example 3: Ecosystem Integration**
```typescript
Task({
  subagent_type: "sui-ecosystem-agent",
  prompt: "Add Walrus storage for NFT metadata",
  description: "Walrus integration"
})
```

---

## MCP Server & Agent Wallet

### Overview

Built-in MCP server (`mcp-server/`) provides 14 tools for on-chain data queries and wallet operations. Uses a **dual-client architecture**: gRPC primary (`SuiGrpcClient`) for most tools, with JSON-RPC fallback (`SuiClient`) for endpoints where gRPC has BigInt serialization or schema incompatibilities (transactions, events, dry-run, name resolution). All responses use `safeStringify` for consistent BigInt handling.

### Query Tools (10)

| Tool | Description |
|------|-------------|
| `sui_get_balance` | All coin balances for an address |
| `sui_get_object` | Object details by ID |
| `sui_get_owned_objects` | Objects owned by address |
| `sui_get_coins` | Coin objects with pagination |
| `sui_get_events` | Events by transaction digest |
| `sui_get_transaction` | Transaction details |
| `sui_dry_run` | Simulate transaction execution |
| `sui_get_latest_checkpoint` | Latest checkpoint number |
| `sui_resolve_name` | SuiNS bidirectional name resolution |
| `sui_get_package` | Package modules, structs, functions |

### Wallet Tools (4)

| Tool | Description |
|------|-------------|
| `sui_wallet_status` | Active address + balance |
| `sui_wallet_transfer` | Transfer SUI/coins |
| `sui_wallet_call` | Call Move function |
| `sui_wallet_publish` | Publish Move package |

**Security model:** Wallet tools use dry-run → `PENDING_APPROVAL` → execute flow. The `tx-approval-guard` hook catches any attempt to bypass MCP wallet tools via direct CLI.

### Configuration

Set `SUI_NETWORK` (default: testnet) and optionally `SUI_GRPC_URL` to override the gRPC endpoint.

---

## Hooks

Automatic verification hooks in `hooks/hooks.json`.

### PreToolUse Hooks (3)

| Hook | Trigger | Purpose |
|------|---------|---------|
| `gas-budget-guard` | `Bash` with `sui client publish` | Block abnormally large gas budgets |
| `red-team-guard` | `Bash` with deploy/publish/upgrade | Suggest red-team testing before deploy |
| `tx-approval-guard` | `Bash` with `sui client` tx commands | Warn when bypassing MCP wallet tools |

### UserPromptSubmit Hook (1)

| Hook | Trigger | Purpose |
|------|---------|---------|
| `mainnet-guard` | User mentions mainnet publish/upgrade/deploy | Warn about mainnet operations |

### PostToolUse Hooks (2)

| Hook | Trigger | Purpose |
|------|---------|---------|
| `move-lint` | `Edit`/`Write` on `.move` files | Auto-verify Move syntax |
| `jsonrpc-warn` | `Edit`/`Write` on `.ts`/`.js` files | Warn about deprecated JSON-RPC patterns |

### SessionStart Hook (1)

| Hook | Trigger | Purpose |
|------|---------|---------|
| `active-env` | Session starts | Display active SUI network |

### Stop Hook (1)

| Hook | Trigger | Purpose |
|------|---------|---------|
| `test-reminder` | Session ends | Remind to run tests if .move files were modified |

**Configuration:** `hooks/hooks.json` — all hook scripts in `scripts/hooks/`

---

## Rules

Installable coding conventions in `rules/`.

### Installation

```bash
bash ~/.claude/plugins/sui-dev-agents/scripts/install-rules.sh
```

Installs to: `~/.claude/rules/`

### Rule Files

#### `sui-move/conventions.md`
- Module structure patterns
- Naming conventions (PascalCase, snake_case)
- Entry function patterns
- TxContext positioning (Protocol 111)
- Error handling conventions

#### `sui-move/security.md`
- Access control patterns
- Reentrancy prevention
- Integer overflow checks
- Capability management
- Shared object safety

#### `sui-move/testing.md`
- Test organization (sources/ vs tests/)
- `#[test_only]` usage
- Mock object creation
- Gas profiling patterns
- Test coverage goals

#### `common/code-quality.md`
- Code review checklist
- Documentation standards
- Git commit conventions
- Refactoring guidelines
- Performance considerations

### Using Rules

Rules are automatically applied by Claude in all SUI projects. They provide:
- Consistent code style
- Security best practices
- Test patterns
- Quality standards

---

## Developer Tools

### MCP Server (`.mcp.json` + `mcp-server/`)

Built-in MCP server with 14 gRPC tools. Auto-loaded via plugin `mcpServers` field.

**Custom setup (optional):**
```bash
cp ~/.claude/plugins/sui-dev-agents/.mcp.json ./
# Edit to add project-specific MCP servers
```

### LSP Configuration (`.lsp.json`)

move-analyzer LSP configuration for IDE integration.

**Usage:**
```bash
cp ~/.claude/plugins/sui-dev-agents/.lsp.json ./
```

**Provides:**
- Move syntax highlighting
- Autocomplete
- Go to definition
- Type checking

---

## Examples

Complete starter projects in `examples/`.

### starter-nft

NFT collection with Kiosk integration.

**Includes:**
- `sources/nft.move` - NFT module
- `sources/collection.move` - Collection management
- TypeScript SDK integration
- Frontend components
- Deployment scripts

**Usage:**
```bash
cp -r ~/.claude/plugins/sui-dev-agents/examples/starter-nft ./my-nft
cd my-nft
/sui-dev-agents:build
/sui-dev-agents:test
/sui-dev-agents:deploy
```

### starter-defi

DeFi AMM with liquidity pools.

**Includes:**
- `sources/pool.move` - Liquidity pool
- `sources/swap.move` - Token swapping
- `sources/farming.move` - Yield farming
- Price oracle integration
- Frontend dashboard

### starter-dao

DAO governance with voting.

**Includes:**
- `sources/governance.move` - Proposal system
- `sources/voting.move` - Voting mechanism
- `sources/treasury.move` - Treasury management
- Multi-sig support
- Admin dashboard

### CLAUDE.md Template

Project-specific Claude instructions.

**Usage:**
```bash
cp ~/.claude/plugins/sui-dev-agents/examples/CLAUDE.md ./.claude/
# Edit to customize for your project
```

**Includes:**
- Project context
- Coding conventions
- Deployment procedures
- Testing strategies

---

## Workflows

### Workflow 1: Quick Iteration

For fast development cycles:

```bash
# 1. Initialize
/sui-dev-agents:init

# 2. Write code
# ... edit Move files ...

# 3. Build (hook auto-verifies on save)
/sui-dev-agents:build

# 4. Test
/sui-dev-agents:test

# 5. Audit
/sui-dev-agents:audit

# 6. Deploy
/sui-dev-agents:deploy

# 7. Check gas
/sui-dev-agents:gas
```

### Workflow 2: Complete Project

For full project setup:

```bash
# 1. Install rules first
bash ~/.claude/plugins/sui-dev-agents/scripts/install-rules.sh

# 2. Run full-stack skill
/sui-full-stack
→ Guided through all phases
→ Git integration automatic
→ Production-ready output

# 3. Verify deployment
/sui-dev-agents:audit
```

### Workflow 3: Example-Based Start

Start from template:

```bash
# 1. Copy starter
cp -r ~/.claude/plugins/sui-dev-agents/examples/starter-nft ./my-project

# 2. Customize
cd my-project
# ... edit Move files ...

# 3. Quick deploy
/sui-dev-agents:build
/sui-dev-agents:test
/sui-dev-agents:deploy
```

### Workflow 4: Existing Project Enhancement

Add features to existing project:

```bash
# 1. Update architecture
/sui-architect --update

# 2. Add ecosystem integration
/sui-zklogin

# 3. Modify contracts
/sui-developer

# 4. Update frontend
/sui-frontend

# 5. Test and upgrade
/sui-dev-agents:test
/sui-dev-agents:upgrade
```

---

## Advanced Topics

### Custom Hooks

Modify `hooks/hooks.json` for project-specific automation.

### Custom Rules

Add project rules to `.claude/rules/` for consistent patterns.

### Agent Composition

Combine multiple agents for complex workflows.

### Performance Optimization

Use gas reports and profiling for optimization.

---

## Troubleshooting

### Commands Not Found

```bash
# Verify plugin installation
/plugin list

# Reinstall if needed
/plugin install sui-dev-agents
```

### Hooks Not Running

Check hooks configuration:
```bash
cat ~/.claude/plugins/sui-dev-agents/hooks/hooks.json
```

### Rules Not Applied

Reinstall rules:
```bash
bash ~/.claude/plugins/sui-dev-agents/scripts/install-rules.sh
```

### Build Failures

Verify SUI environment:
```bash
bash ~/.claude/plugins/sui-dev-agents/scripts/check-sui-env.sh
```

---

## Resources

- **Quick Start:** `docs/QUICKSTART.md`
- **Architecture:** `docs/ARCHITECTURE.md`
- **Changelog:** `CHANGELOG.md`
- **Skills:** `skills/*/skill.md`
- **Agents:** `agents/*/prompt.md`

---

## Data Access Architecture (v1.65+)

SUI provides three data access methods:

| Method | Status | Best For |
|--------|--------|----------|
| **gRPC** | GA (primary) | Backend services, real-time streaming, transaction execution |
| **GraphQL** | Beta | Frontend queries, complex object graphs, Relay integration |
| **JSON-RPC** | **Deprecated** (removed April 2026) | Legacy — migrate away |

- `@mysten/sui` SDK handles transport automatically
- The plugin's MCP server uses `SuiGrpcClient` for all operations
- Custom RPC users must migrate to gRPC endpoints
- `jsonrpc-warn` hook detects deprecated patterns in your code
- See `skills/sui-frontend/references/grpc-reference.md` for details

**Built for Protocol 111, Move 2024 Edition, SUI SDK v2, dApp Kit v2**
