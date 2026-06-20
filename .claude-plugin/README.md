# SUI Dev Agents Plugin

**Comprehensive SUI Move development toolkit with hierarchical AI agents and specialized skills.**

## Overview

The SUI Dev Agents plugin provides a complete development environment for building SUI Move applications, from architecture to deployment. It features:

- **Hierarchical Agent System** - Supreme → Category → Subagents coordination
- **18 Specialized Skills** - Core development + ecosystem integrations
- **End-to-End Workflows** - Architecture → Development → Testing → Deployment
- **Ecosystem Integrations** - Kiosk, Walrus, zkLogin, DeepBook, and more

## Quick Start

### Using the Supreme Agent

The simplest way to start any SUI development task:

```
@sui-supreme Build an NFT marketplace with Kiosk integration
```

The supreme agent will:
1. Analyze your requirements
2. Route to appropriate category agents
3. Coordinate specialized subagents
4. Return complete implementation

### Using Skills Directly

For specific tasks, invoke skills directly:

```bash
# Full-stack project
/sui-full-stack

# Architecture only
/sui-architect

# Move development
/sui-developer

# Frontend development
/sui-frontend

# Deployment
/sui-deployer
```

## Agent Hierarchy

### Level 1: Supreme Agent

**@sui-supreme** - Top-level task router and orchestrator

- Analyzes user requests
- Routes to appropriate category agents
- Manages cross-category coordination
- Provides unified responses

### Level 2: Category Agents (4)

| Agent | Responsibility |
|-------|---------------|
| **@sui-core-agent** | Core full-stack workflows (architecture → deployment) |
| **@sui-development-agent** | Development tasks (contracts + frontend) |
| **@sui-ecosystem-agent** | Ecosystem integrations (Kiosk, Walrus, zkLogin, etc.) |
| **@sui-infrastructure-agent** | Infrastructure (docs, security, monitoring) |

### Level 3: Subagents (18+)

#### Development Subagents (5)
- `sui-architect-subagent` - Architecture and specs
- `sui-developer-subagent` - Move smart contracts
- `sui-frontend-subagent` - TypeScript/React frontend
- `sui-tester-subagent` - Testing and QA
- `sui-deployer-subagent` - Multi-stage deployment

#### Ecosystem Subagents (8)
- `sui-kiosk-subagent` - NFT marketplaces
- `sui-walrus-subagent` - Decentralized storage
- `sui-zklogin-subagent` - OAuth authentication
- `sui-passkey-subagent` - WebAuthn login
- `sui-deepbook-subagent` - DEX integration
- `sui-suins-subagent` - Name service
- `sui-nautilus-subagent` - Cross-chain bridge
- `sui-seal-subagent` - Sealed auctions

#### Infrastructure Subagents (3)
- `sui-docs-query-subagent` - Documentation queries
- `sui-security-guard-subagent` - Security scanning
- `sui-move-ts-bridge-subagent` - Contract-frontend integration

## Skills Reference

### Core Development Skills (7)

| Skill | Use When |
|-------|----------|
| **sui-full-stack** | Starting complete SUI projects (architecture → deployment) |
| **sui-architect** | Planning architecture, generating specs |
| **sui-developer** | Writing Move contracts, quality checks |
| **sui-frontend** | Building TypeScript/React dApps |
| **sui-deployer** | Deploying to devnet/testnet/mainnet |
| **sui-tester** | Testing contracts and integration |
| **sui-move-ts-bridge** | Connecting contracts to frontend |

### Ecosystem Integration Skills (8)

| Skill | Integration |
|-------|-------------|
| **sui-kiosk** | NFT marketplace with transfer policies |
| **sui-walrus** | Decentralized blob storage |
| **sui-zklogin** | OAuth login (Google/Facebook) |
| **sui-passkey** | WebAuthn passwordless auth |
| **sui-deepbook** | Orderbook DEX |
| **sui-suins** | SUI name service |
| **sui-nautilus** | Cross-chain bridge |
| **sui-seal** | Sealed-bid auctions |

### Infrastructure Skills (3)

| Skill | Purpose |
|-------|---------|
| **sui-docs-query** | Query SUI documentation and APIs |
| **sui-security-guard** | Security scanning and secret detection |
| **sui-tools-guide** | Navigate ecosystem tools |

## Usage Examples

### Example 1: Full-Stack NFT Marketplace

```
@sui-supreme Build an NFT marketplace with:
- Kiosk integration for royalties
- Walrus for metadata storage
- zkLogin for easy onboarding
```

**What happens:**
1. Supreme routes to `sui-core-agent`
2. Core agent invokes `sui-full-stack` skill
3. Delegates to:
   - `sui-architect-subagent` → Generate spec
   - `sui-developer-subagent` → Write Move contracts
   - Ecosystem agents → Integrate Kiosk, Walrus, zkLogin
   - `sui-frontend-subagent` → Build React UI
   - `sui-tester-subagent` → Run tests
   - `sui-deployer-subagent` → Deploy to networks

### Example 2: Add Kiosk to Existing Project

```
@sui-supreme Add Kiosk integration to my NFT contract
```

**What happens:**
1. Supreme routes to `sui-ecosystem-agent`
2. Ecosystem agent delegates to `sui-kiosk-subagent`
3. Kiosk subagent invokes `sui-kiosk` skill
4. Returns Kiosk integration code

### Example 3: Architecture Planning Only

```
/sui-architect

I want to build a DeFi lending protocol on SUI
```

**What happens:**
1. Guided Q&A about project requirements
2. Generates comprehensive specification
3. Outputs: `docs/specs/lending-spec.md`

### Example 4: Deploy to Mainnet

```
@sui-supreme Deploy my contracts to mainnet
```

**What happens:**
1. Supreme routes to `sui-development-agent`
2. Development agent delegates to `sui-deployer-subagent`
3. Deployer executes staged deployment:
   - ✅ Devnet (auto)
   - ✅ Testnet (auto)
   - ⏸️ Mainnet (awaits approval)
4. Returns package IDs and deployment report

## Agent Coordination Flow

### How Agents Work Together

```
User Request
    ↓
[sui-supreme] - Analyzes intent
    ↓
[Category Agent] - Determines workflow
    ↓
[Subagent(s)] - Execute specialized tasks
    ↓
[Skills] - Provide implementation guidance
    ↓
Complete Implementation
```

### Cross-Category Coordination

Agents can coordinate across categories:

**Example: NFT Marketplace**
```
sui-supreme
  ├─ sui-core-agent (orchestrates)
  ├─ sui-development-agent
  │   ├─ sui-architect-subagent
  │   ├─ sui-developer-subagent
  │   └─ sui-frontend-subagent
  ├─ sui-ecosystem-agent
  │   ├─ sui-kiosk-subagent
  │   └─ sui-walrus-subagent
  └─ sui-infrastructure-agent
      └─ sui-security-guard-subagent
```

## Best Practices

### When to Use Each Entry Point

**Use @sui-supreme when:**
- You have a high-level goal or requirement
- You're unsure which agent/skill to use
- You need multiple agents to coordinate

**Use Category Agents (@sui-development-agent, etc.) when:**
- You know the category of work (development, ecosystem, infrastructure)
- You want direct access to a specific workflow

**Use Skills (/sui-architect, etc.) when:**
- You know exactly which skill you need
- You want to bypass agent routing
- You're following a specific workflow

### Workflow Recommendations

**New Projects:**
1. Start with `/sui-full-stack` or `@sui-supreme`
2. Let the full workflow guide you through all phases

**Existing Projects:**
1. Use specific skills for targeted updates
2. Example: `/sui-kiosk` to add NFT marketplace features

**Learning/Exploration:**
1. Use `/sui-tools-guide` to understand ecosystem
2. Use `/sui-docs-query` for specific documentation

## Configuration

The plugin is configured via `.claude-plugin/plugin.json`:

```json
{
  "name": "sui-dev-agents",
  "version": "1.0.0",
  "description": "Comprehensive SUI Move development toolkit",
  "agents_dir": "agents",
  "skills_dir": "skills"
}
```

## Directory Structure

```
sui-dev-agents/
├── .claude-plugin/
│   ├── plugin.json          # Plugin configuration
│   └── README.md            # This file
├── agents/
│   ├── sui-supreme.md       # Supreme agent
│   ├── sui-*-agent.md       # Category agents (4)
│   └── sui-*-subagent.md    # Subagents (18+)
└── skills/
    ├── sui-full-stack/      # Full-stack workflow
    ├── sui-architect/       # Architecture planning
    ├── sui-developer/       # Move development
    ├── sui-frontend/        # Frontend development
    ├── sui-kiosk/           # Kiosk integration
    ├── sui-walrus/          # Walrus storage
    └── ...                  # 18 total skills
```

## Getting Help

### Documentation Queries

```
/sui-docs-query "How to use Object Display Standard?"
```

### Tool Selection

```
/sui-tools-guide
```

### Security Scanning

```
/sui-security-guard
```

## Version

**Current Version:** 1.0.0

## License

[Your License Here]

## Contributing

[Contribution Guidelines]
