# SUI Dev Agents - Architecture Overview

**Version 2.3.0**

Detailed architecture of the sui-dev-agents plugin, covering components, interactions, and design principles. Aligned with SUI SDK v2, dApp Kit v2, and Move 2024 Edition.

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Directory Structure](#directory-structure)
4. [Interaction Patterns](#interaction-patterns)
5. [Design Principles](#design-principles)

---

## System Overview

The sui-dev-agents plugin is a multi-layered toolkit for SUI blockchain development, organized into five primary component types:

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│         (Claude Code CLI / Chat Interface)              │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Component Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Commands │  │  Skills  │  │  Agents  │             │
│  │   (9)    │  │   (23)   │  │   (19)   │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │  Hooks   │  │  Rules   │  │MCP Server│             │
│  │   (8)    │  │   (5)    │  │(14 tools)│             │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   External Systems                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │SUI gRPC  │  │   Git    │  │   LSP    │             │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Commands

**Purpose:** Fast, focused operations for common tasks

**Characteristics:**
- Single-purpose
- Minimal user interaction
- Quick execution (< 30 seconds typically)
- Direct CLI integration

**Location:** `commands/*.md`

**Invocation:** `/sui-dev-agents:command-name`

**Command List:**
```
init          → Initialize new Move project
build         → Build contracts with verification
test          → Run test suite
deploy        → Deploy to network
audit         → Security audit
upgrade       → Upgrade contracts
gas           → Gas usage report
mcp-status    → Check MCP server connection
wallet-status → Check agent wallet address + balance
```

**Flow:**
```
User → /sui-dev-agents:init → Command Handler → SUI CLI → Result
                                    ↓
                              Hooks Triggered
```

### 2. Skills

**Purpose:** Interactive workflows for specific development tasks

**Characteristics:**
- More complex than commands
- Interactive prompts
- May use multiple tools
- Can orchestrate commands

**Location:** `skills/*/skill.md`

**Invocation:** `/skill-name`

**Skill Categories:**

```
Core Orchestrator (1)
├── sui-full-stack

Development Workflow (8)
├── sui-architect
├── sui-developer
├── sui-ts-sdk
├── sui-frontend
├── sui-fullstack-integration
├── sui-tester
├── sui-deployer
└── move-code-quality

Security & Analysis (4)
├── sui-security-guard
├── sui-red-team
├── sui-decompile
└── sui-wallet

Infrastructure (2)
├── sui-docs-query
└── sui-tools-guide

Ecosystem Integrations (8)
├── sui-kiosk
├── sui-zklogin
├── sui-passkey
├── sui-deepbook
├── sui-walrus
├── sui-suins
├── sui-seal
└── sui-nautilus
```

**Flow:**
```
User → /sui-architect → Skill Handler → Multi-step Workflow
                             ↓
                       ┌──────────┐
                       │ Commands │
                       │ External │
                       │ Tools    │
                       └──────────┘
```

### 3. Agents

**Purpose:** Hierarchical orchestration for complex multi-step tasks

**Characteristics:**
- Task decomposition
- State management
- Inter-agent delegation
- Long-running operations

**Location:** `agents/*.md`

**Invocation:** Via Task tool

**Agent Hierarchy:**

```
sui-supreme (Supreme Orchestrator)
│
├── sui-core-agent (Full-Stack Workflows)
│
├── sui-infrastructure-agent (Infrastructure Services)
│   ├── sui-docs-query-subagent
│   └── sui-security-guard-subagent
│
├── sui-development-agent (Development Lifecycle)
│   ├── sui-architect-subagent
│   ├── sui-developer-subagent
│   ├── sui-frontend-subagent
│   ├── sui-tester-subagent
│   ├── sui-deployer-subagent
│   ├── sui-red-team-subagent
│   └── sui-fullstack-integration-subagent
│
└── sui-ecosystem-agent (Ecosystem Integrations)
    ├── sui-kiosk-subagent
    ├── sui-zklogin-subagent
    ├── sui-passkey-subagent
    ├── sui-deepbook-subagent
    └── sui-walrus-subagent
```

**Agent Types:**

- **Supreme Orchestrator:** Top-level task decomposition
- **Category Agents:** Domain-specific coordination (4 agents)
- **Subagents:** Specialized task execution (14 agents)

**Flow:**
```
Task Tool → sui-supreme → Analyze Request
                ↓
           ┌────────────────────┐
           │   Category Agent   │
           └────────────────────┘
                ↓
           ┌────────────────────┐
           │     Subagent       │
           └────────────────────┘
                ↓
         ┌──────────────────┐
         │ Skills/Commands  │
         └──────────────────┘
```

### 4. Hooks

**Purpose:** Automatic verification and lifecycle events

**Characteristics:**
- Event-driven
- Non-blocking
- Transparent to user
- Configurable

**Location:** `hooks/hooks.json`

**Hook Types (8 hooks across 5 event types):**

```
PreToolUse (3)
├── gas-budget-guard     → Block abnormally large gas budgets
├── red-team-guard       → Suggest red-team testing before deploy
└── tx-approval-guard    → Warn when bypassing MCP wallet tools

UserPromptSubmit (1)
└── mainnet-guard        → Warn about mainnet operations

PostToolUse (2)
├── move-lint            → Auto-verify Move syntax after .move edits
└── jsonrpc-warn         → Warn about deprecated JSON-RPC patterns

SessionStart (1)
└── active-env           → Display active SUI network

Stop (1)
└── test-reminder        → Remind to run tests if .move files modified
```

**Event Flow (PostToolUse example):**

```
[User edits file.move]
    ↓
[Edit tool completes]
    ↓
[PostToolUse hook triggers]
    ↓
[move-lint.sh runs sui move build]
    ↓
[Output shown to user]
```

### 5. Rules

**Purpose:** Coding conventions and best practices

**Characteristics:**
- Declarative guidelines
- Applied automatically by Claude
- Project-agnostic
- Version-controlled

**Location:** `rules/**/*.md`

**Installation:** `scripts/install-rules.sh` → `~/.claude/rules/`

**Rule Categories:**

```
sui-move/
├── conventions.md    → Move coding patterns
├── security.md       → Security best practices
└── testing.md        → Test patterns

common/
├── code-quality.md   → General quality standards
└── api-migration.md  → JSON-RPC → gRPC migration guide
```

**Application:**

```
User writes code → Claude applies rules → Code generated
                        ↓
                  ┌─────────────┐
                  │ conventions │
                  │ security    │
                  │ testing     │
                  │ quality     │
                  └─────────────┘
```

### 6. MCP Server

**Purpose:** On-chain data queries and wallet operations via gRPC

**Location:** `mcp-server/` (TypeScript, `@modelcontextprotocol/sdk` + `@mysten/sui`)

**Tools:** 10 query tools + 4 wallet tools (14 total)

**Transport:** stdio, auto-loaded via `plugin.json` → `.mcp.json`

**Architecture:**
```
Claude Code → MCP Protocol (stdio) → mcp-server/dist/index.js
                                          ↓
                                    SuiGrpcClient
                                          ↓
                                    SUI gRPC Endpoint
```

### 7. Developer Tools

**Purpose:** IDE and tooling integration

**Location:**
- `.mcp.json` - MCP server config (auto-loaded by plugin)
- `.lsp.json` - move-analyzer LSP config

**Usage:** LSP config can be copied to project root for IDE integration

---

## Directory Structure

```
sui-dev-agents/
├── .claude-plugin/
│   ├── plugin.json                    # Plugin metadata (v2.3.0)
│   └── plugin-marketplace-metadata.json
│
├── commands/                          # 9 commands
│   ├── init.md
│   ├── build.md
│   ├── test.md
│   ├── deploy.md
│   ├── audit.md
│   ├── upgrade.md
│   ├── gas.md
│   ├── mcp-status.md
│   └── wallet-status.md
│
├── skills/                            # 23 skills
│   ├── sui-full-stack/
│   ├── sui-architect/
│   ├── sui-developer/
│   ├── sui-frontend/
│   ├── sui-tester/                    # + coverage analysis scripts
│   ├── sui-deployer/
│   ├── sui-security-guard/
│   ├── sui-red-team/                  # Adversarial testing (new)
│   ├── sui-ts-sdk/                    # TypeScript SDK v2 (new)
│   ├── sui-decompile/                 # On-chain analysis
│   ├── sui-wallet/                    # Agent wallet
│   ├── move-code-quality/             # Code quality
│   ├── sui-docs-query/
│   ├── sui-tools-guide/
│   ├── sui-kiosk/
│   ├── sui-zklogin/
│   ├── sui-passkey/
│   ├── sui-deepbook/
│   ├── sui-walrus/
│   ├── sui-suins/
│   ├── sui-seal/
│   ├── sui-nautilus/
│   └── sui-fullstack-integration/
│
├── agents/                            # 19 agents (1 supreme + 4 category + 14 subagents)
│   ├── sui-supreme.md
│   ├── sui-core-agent.md
│   ├── sui-infrastructure-agent.md
│   ├── sui-development-agent.md
│   ├── sui-ecosystem-agent.md
│   ├── sui-red-team-subagent.md       # (new)
│   ├── [13 other subagent files]
│   └── subagents/                     # Agent prompt files
│
├── mcp-server/                        # Built-in MCP server (new)
│   ├── src/
│   │   ├── index.ts                   # Server entry, 14 tools
│   │   ├── client.ts                  # SuiGrpcClient wrapper
│   │   └── tools/                     # Tool implementations
│   ├── dist/                          # Compiled output
│   ├── package.json
│   └── tsconfig.json
│
├── hooks/
│   └── hooks.json                     # 8 hook configurations
│
├── rules/                             # 5 rule files
│   ├── sui-move/
│   │   ├── conventions.md
│   │   ├── security.md
│   │   └── testing.md
│   └── common/
│       ├── code-quality.md
│       └── api-migration.md
│
├── examples/                          # 3 starters + template
│   ├── starter-nft/
│   ├── starter-defi/
│   ├── starter-dao/
│   └── CLAUDE.md
│
├── scripts/
│   ├── install-rules.sh
│   ├── check-sui-env.sh
│   ├── protocol-version-check.sh
│   ├── gas-report.sh
│   ├── ci/validate-plugin.sh
│   └── hooks/                         # 7 hook scripts
│
├── docs/
│   ├── QUICKSTART.md
│   ├── GUIDE.md
│   └── ARCHITECTURE.md
│
├── .mcp.json                          # MCP server config
├── .lsp.json                          # LSP config
├── README.md
├── CHANGELOG.md
└── LICENSE
```

---

## Interaction Patterns

### Pattern 1: Command → Hook

Fast iteration with automatic verification:

```
User: /sui-dev-agents:build
  ↓
Command: runs sui move build
  ↓
Result: shows output
  ↓
(later)
  ↓
User: edits nft.move
  ↓
PostToolUse Hook: auto-runs build
  ↓
Result: immediate feedback
```

### Pattern 2: Skill → Commands

Skill orchestrates multiple commands:

```
User: /sui-full-stack
  ↓
Skill: Phase 0 - Git init
Skill: Phase 1 - /sui-architect
Skill: Phase 2 - /sui-developer
  ↓ uses /sui-dev-agents:build internally
  ↓ hooks trigger automatically
Skill: Phase 3 - /sui-frontend
Skill: Phase 4 - Integration
Skill: Phase 5 - /sui-tester
  ↓ uses /sui-dev-agents:test internally
Skill: Phase 6 - /sui-deployer
  ↓ uses /sui-dev-agents:deploy internally
Skill: Phase 7 - Documentation
  ↓
Complete project output
```

### Pattern 3: Agent → Subagent → Skill

Complex orchestration:

```
Task({
  subagent_type: "sui-supreme",
  prompt: "Build NFT marketplace"
})
  ↓
sui-supreme: analyzes request
  ↓
delegates to → sui-development-agent
  ↓
delegates to → sui-architect-subagent
  ↓
invokes skill → /sui-architect
  ↓
generates spec
  ↓
back to → sui-development-agent
  ↓
delegates to → sui-developer-subagent
  ↓
invokes skill → /sui-developer
  ↓
uses command → /sui-dev-agents:build
  ↓
hooks trigger → PostToolUse
  ↓
... continues through deployment
```

### Pattern 4: Rules → Code Generation

Rules applied throughout:

```
User: asks for NFT contract
  ↓
Claude reads rules:
  - conventions.md → naming patterns
  - security.md → access control
  - testing.md → test structure
  - quality.md → documentation
  ↓
Generates code following all rules
  ↓
PostToolUse hook verifies syntax
  ↓
Code meets standards
```

---

## Design Principles

### 1. Layered Abstraction

```
High Level (Complex) → Agents       → Task decomposition
Mid Level (Guided)   → Skills       → Interactive workflows
Low Level (Fast)     → Commands     → Direct operations
Background           → Hooks        → Automatic checks
Foundation           → Rules        → Consistent standards
```

### 2. Composition Over Duplication

- Commands are atomic operations
- Skills compose commands
- Agents orchestrate skills
- No functionality duplicated

### 3. Progressive Enhancement

```
Beginner  → Use /sui-full-stack (guided)
          → Commands handle details
          → Hooks verify automatically
          ↓
Advanced  → Use individual skills
          → Compose custom workflows
          → Use agents for orchestration
```

### 4. Fail-Safe Defaults

- Hooks run automatically (non-blocking)
- Rules applied by default
- Commands prompt for dangerous operations
- Examples provide safe starting points

### 5. Developer Experience

```
Fast Feedback
  → Commands execute quickly
  → Hooks verify immediately

Clear Separation
  → Commands vs Skills vs Agents
  → Each has clear use case

Easy Discovery
  → /sui-dev-agents:tab shows commands
  → /sui-tab shows skills
  → Task tool for agents

Gradual Learning
  → Start with examples
  → Use commands for speed
  → Skills for guidance
  → Agents for complexity
```

---

## Version History

- **v2.3.0** (2026-02-22)
  - Integrated MystenLabs sui-dev-skills as source of truth
  - Added sui-ts-sdk skill (TypeScript SDK v2 — PTB, queries, sponsored tx)
  - Updated all skills/rules for SUI SDK v2, dApp Kit v2, Move 2024 Edition
  - Updated to Protocol 111
  - Skills: 22 → 23

- **v2.2.0** (2026-02-12)
  - Added MCP Server with 14 gRPC tools (query + wallet)
  - Added Agent Wallet with dry-run → approve → execute flow
  - Added Red Team adversarial testing (sui-red-team skill + subagent)
  - Added on-chain decompile skill (sui-decompile)
  - Added Move code quality checklist (move-code-quality)
  - Added coverage analysis tools (Python scripts in sui-tester)
  - Added 2 new commands (mcp-status, wallet-status)
  - Added 5 new hooks (red-team-guard, tx-approval-guard, jsonrpc-warn, mainnet-guard, gas-budget-guard)
  - Migrated all code examples from JSON-RPC to gRPC
  - Skills: 19 → 22, Commands: 7 → 9, Hooks: 3 → 8, Rules: 4 → 5

- **v2.0.0** (2026-02-11)
  - Added Commands (7)
  - Added Hooks (3)
  - Added Rules (4)
  - Added Examples (3 + template)
  - Added Scripts (4)
  - Added Developer Tools (2)

- **v1.1.0** (2026-02-05)
  - Updated for SUI v1.65, Protocol 110
  - TypeScript SDK rename
  - GraphQL API updates

- **v1.0.0** (2026-02-02)
  - Initial release
  - 18 Skills
  - 23 Agents

---

## Component Selection Guide

### When to Use Commands

✅ Quick operations
✅ Clear, single purpose
✅ Frequent use (build, test, deploy)
✅ Fast feedback needed

❌ Complex workflows
❌ Need user guidance
❌ Multi-step processes

### When to Use Skills

✅ Interactive workflows
✅ Need user input
✅ Multi-step but guided
✅ Specific domain task

❌ Just need speed
❌ No interaction needed
❌ Requires orchestration

### When to Use Agents

✅ Complex orchestration
✅ Task decomposition
✅ Long-running workflows
✅ State management needed

❌ Simple operations
❌ Fast iteration
❌ Single-purpose task

---

## Extension Points

### Adding Custom Commands

1. Create `commands/my-command.md`
2. Follow existing format
3. Add to `.claude-plugin/plugin.json`

### Adding Custom Skills

1. Create `skills/my-skill/` directory
2. Add `skill.md` with frontmatter
3. Claude auto-discovers

### Adding Custom Agents

1. Create `agents/my-agent.md`
2. Use frontmatter format
3. Add to `.claude-plugin/plugin.json`

### Adding Custom Hooks

1. Edit `hooks/hooks.json`
2. Add hook configuration
3. Test with matching events

### Adding Custom Rules

1. Create `.claude/rules/my-rules.md`
2. Follow declarative format
3. Claude applies automatically

---

**Architecture designed for Protocol 111, Move 2024 Edition, SUI SDK v2, dApp Kit v2, gRPC GA**
