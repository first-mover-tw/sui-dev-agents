# SUI Dev Agents - Complete Usage Guide

**Version 2.1.0**

Complete guide to building production-ready SUI blockchain applications using the sui-dev-agents plugin.

## Table of Contents

1. [Installation](#installation)
2. [Commands](#commands)
3. [Skills](#skills)
4. [Agents](#agents)
5. [Hooks](#hooks)
6. [Rules](#rules)
7. [Developer Tools](#developer-tools)
8. [Examples](#examples)
9. [Workflows](#workflows)

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
- Enhanced `Move.toml` with Protocol 110
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

#### `/sui-frontend`
React/Next.js/Vue frontend integration.

**Includes:**
- Wallet integration (@mysten/dapp-kit)
- SDK setup (@mysten/sui)
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

## Hooks

Automatic verification hooks in `hooks/hooks.json`.

### PostToolUse Hook

**Trigger:** After `Edit` or `Write` tools used on `.move` files

**Action:**
```bash
sui move build --skip-fetch-latest-git-deps 2>&1 | tail -5
```

**Purpose:** Immediate syntax verification

**Example:**
```
[You edit nft.move]
→ Hook runs automatically
→ Build output: ✅ BUILDING nft
→ Build output: Success
```

### SessionStart Hook

**Trigger:** When Claude Code session starts

**Action:**
```bash
sui client active-env 2>/dev/null
```

**Purpose:** Display active SUI environment

**Example:**
```
[Session starts]
→ Active environment: devnet
```

### Stop Hook

**Trigger:** When session stops

**Action:**
```bash
grep -rn "#\[test_only\]" sources/ 2>/dev/null | head -3
```

**Purpose:** Warn if test_only code in production

**Example:**
```
[Session ends]
→ Warning: test_only code in sources/nft.move:45
```

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
- TxContext positioning (Protocol 110)
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

### MCP Server Template (`.mcp.json`)

Template configuration for MCP servers.

**Usage:**
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
- Custom RPC users must migrate to gRPC endpoints
- See `skills/sui-frontend/references/grpc-reference.md` for details

**Built for Protocol 110, Move 2024 Edition**
