# SUI Dev Agents

**v2.1.0** - Complete toolkit for building production-ready SUI blockchain applications with skills, agents, commands, hooks, and rules. Now with **gRPC support** (JSON-RPC deprecated April 2026).

## 📋 Prerequisites

Before using this plugin, ensure you have the following installed:

| Tool | Version | Required | Install |
|------|---------|----------|---------|
| [SUI CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) | >= 1.65 | **Yes** | `cargo install --locked --git https://github.com/MystenLabs/sui.git sui` |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | >= 1.0 | **Yes** | `npm install -g @anthropic-ai/claude-code` |
| [Node.js](https://nodejs.org/) | >= 18 | **Yes** | `brew install node` or [nvm](https://github.com/nvm-sh/nvm) |
| [Rust](https://www.rust-lang.org/tools/install) | latest stable | **Yes** | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| [Git](https://git-scm.com/) | >= 2.0 | **Yes** | `brew install git` |
| [move-analyzer](https://github.com/MystenLabs/sui/tree/main/external-crates/move/crates/move-analyzer) | latest | Recommended | `cargo install --git https://github.com/MystenLabs/sui.git move-analyzer` |
| [jq](https://jqlang.github.io/jq/) | >= 1.6 | Recommended | `brew install jq` |

### Verify Installation

```bash
sui --version          # Should show >= 1.65
sui client envs        # Should list devnet/testnet/mainnet
node --version         # Should show >= 18
git --version
```

### SUI Network Setup

```bash
# Add networks if not already configured
sui client new-env --alias devnet --rpc https://fullnode.devnet.sui.io:443
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443

# Get devnet tokens
sui client faucet --url https://faucet.devnet.sui.io/v2/gas

# Switch network
sui client switch --env devnet
```

## 📦 Installation

### Install from Marketplace

```bash
/plugin marketplace add Thalassia/sui-dev-agents
/plugin install sui-dev-agents
```

### Direct Installation (Alternative)

```bash
/plugin install Thalassia/sui-dev-agents
```

## 🚀 Quick Start

### Using Skills (Direct Commands)

Start a complete SUI project:
```bash
/sui-full-stack
```

Use individual skills:
```bash
/sui-architect      # Architecture planning
/sui-developer      # Smart contract development
/sui-frontend       # Frontend integration
/sui-tester         # Comprehensive testing
/sui-deployer       # Multi-network deployment
```

### Using Agents (Task Delegation)

For complex orchestrated workflows, use agents via the Task tool:

```typescript
// Complete project build
Task({
  subagent_type: "sui-supreme",
  prompt: "Build an NFT marketplace with Kiosk integration",
  description: "NFT marketplace build"
})

// Specific development phase
Task({
  subagent_type: "sui-development-agent",
  prompt: "Generate architecture for a DeFi AMM",
  description: "AMM architecture"
})
```

## 🧩 What's Included

### ⚡ Commands (7 Fast Operations)

Quick, focused operations for common tasks:
- `/sui-dev-agents:init` - Initialize new Move project
- `/sui-dev-agents:build` - Build contracts with verification
- `/sui-dev-agents:test` - Run comprehensive tests
- `/sui-dev-agents:deploy` - Deploy to network
- `/sui-dev-agents:audit` - Security audit
- `/sui-dev-agents:upgrade` - Upgrade contracts
- `/sui-dev-agents:gas` - Gas usage report

### 🛠️ Skills (20 User-Invocable Skills)

**Core Orchestrator:**
- `/sui-full-stack` - Complete end-to-end project workflow with Git integration

**Development Workflow:**
- `/sui-architect` - Architecture planning and specification generation
- `/sui-developer` - Move smart contract development with quality checks
- `/sui-frontend` - React/Next.js/Vue frontend integration
- `/sui-fullstack-integration` - TypeScript type generation from Move
- `/sui-tester` - Comprehensive testing (unit, integration, E2E, gas benchmarks)
- `/sui-deployer` - Staged deployment (devnet, testnet, mainnet)

**Infrastructure & Quality:**
- `/sui-security-guard` - Security scanning, Git hooks, vulnerability detection
- `/sui-red-team` - Adversarial testing and exploit simulation
- `/sui-docs-query` - Latest SUI documentation lookup
- `/move-code-quality` - Move code quality checklist analysis
- `/sui-tools-guide` - Tool selection and recommendation

**Ecosystem Integrations:**
- `/sui-kiosk` - NFT marketplace protocol (royalties, policies)
- `/sui-zklogin` - Zero-knowledge authentication
- `/sui-passkey` - WebAuthn integration
- `/sui-deepbook` - DEX protocol integration
- `/sui-walrus` - Decentralized storage
- `/sui-suins` - SUI name service
- `/sui-seal` - Asset wrapping protocol
- `/sui-nautilus` - AMM protocol

### 🤖 Agents (25 Orchestration Agents)

**Supreme Orchestrator:**
- `sui-supreme` - Top-level task decomposition and coordination

**Category Agents:**
- `sui-core-agent` - Full-stack project workflows
- `sui-infrastructure-agent` - Documentation and security services
- `sui-development-agent` - Complete development lifecycle
- `sui-ecosystem-agent` - Protocol integrations

**Specialized Subagents (20):**
- Architecture, development, frontend, testing, deployment subagents
- Security guard, red-team subagents
- Ecosystem-specific subagents (Kiosk, zkLogin, DeepBook, Walrus, etc.)

### 🪝 Hooks (Automatic Verification)

Three lifecycle hooks for automation:
- **PostToolUse** - Auto-verify Move syntax after edits
- **SessionStart** - Show active SUI environment
- **Stop** - Warn if test_only code in production

### 📏 Rules (Best Practices)

Installable coding standards:
- `sui-move/conventions.md` - Move coding patterns
- `sui-move/security.md` - Security guidelines
- `sui-move/testing.md` - Test patterns
- `common/code-quality.md` - Code quality rules
- `common/api-migration.md` - gRPC migration guide

Install: `bash scripts/install-rules.sh`

### 🔧 Developer Tools

- `.mcp.json` - MCP server template
- `.lsp.json` - move-analyzer LSP config

### 📁 Examples

Complete starter projects:
- `starter-nft/` - NFT collection with Kiosk
- `starter-defi/` - DeFi AMM
- `starter-dao/` - DAO governance
- `CLAUDE.md` - Project instructions template

### 📜 Scripts

Utility scripts:
- `install-rules.sh` - Install rules to ~/.claude/rules/
- `check-sui-env.sh` - Verify SUI environment
- `protocol-version-check.sh` - Check protocol version
- `gas-report.sh` - Generate gas report

## 🏗️ Architecture

### Three-Tier System

**Commands** - Fast, focused operations:
- Single-purpose tasks
- Minimal interaction
- Quick execution
- Example: `/sui-dev-agents:build` to compile contracts

**Skills** - Direct user invocation for specific tasks:
- More complex than commands
- Interactive workflows
- Immediate execution
- Example: `/sui-architect` to plan architecture

**Agents** - Complex multi-step orchestration:
- Hierarchical delegation
- State management
- Inter-agent communication
- Example: `sui-supreme` orchestrates entire project

### Component Hierarchy

```
Commands (7)           Skills (20)              Agents (25)
    |                      |                         |
  init              sui-full-stack          sui-supreme
  build             sui-architect           +-- sui-core-agent
  test              sui-developer           +-- sui-infrastructure-agent
  deploy            sui-frontend            +-- sui-development-agent
  audit             sui-tester              +-- sui-ecosystem-agent
  upgrade           sui-deployer                 +-- [20 subagents]
  gas               [14 more skills]

        |
    Hooks (3)               Rules (5)
PostToolUse             sui-move/conventions.md
SessionStart            sui-move/security.md
Stop                    sui-move/testing.md
                        common/code-quality.md
                        common/api-migration.md
```

See `docs/ARCHITECTURE.md` for detailed component interactions.

## 📖 Usage Examples

### Example 1: Quick Start (Commands)

```bash
# Fast iteration workflow
/sui-dev-agents:init               # 1. Initialize project
# ... write some Move code ...
/sui-dev-agents:build              # 2. Build & verify
/sui-dev-agents:test               # 3. Run tests
/sui-dev-agents:audit              # 4. Security scan
/sui-dev-agents:deploy             # 5. Deploy to devnet
/sui-dev-agents:gas                # 6. Check gas usage

# Live on devnet in minutes!
```

### Example 2: Complete New Project (Skills)

```bash
User: "Build an NFT marketplace"

/sui-full-stack
-> Phase 0: Initialize project with Git + GitHub
-> Phase 1: Architecture planning (/sui-architect)
-> Phase 2: Smart contract development (/sui-developer)
-> Phase 3: Frontend integration (/sui-frontend)
-> Phase 4: Full-stack integration
-> Phase 5: Testing (/sui-tester)
-> Phase 6: Deployment (/sui-deployer)
-> Phase 7: Documentation generation

# Production-ready NFT marketplace with Git history!
```

### Example 3: Add Feature to Existing Project

```bash
User: "Add zkLogin to my existing dApp"

/sui-architect --update    # Update architecture spec
/sui-zklogin              # Integration guide
/sui-developer            # Modify contracts
/sui-frontend             # Add auth UI
/sui-dev-agents:test      # Run tests quickly
/sui-dev-agents:upgrade   # Upgrade deployment
```

### Example 4: Security Audit + Red Team

```bash
/sui-security-guard --mode strict    # Defensive scan
/sui-red-team                        # Adversarial testing

-> Scans all Move contracts
-> Simulates attack vectors
-> Checks for OWASP vulnerabilities
-> Validates Git hooks
-> Generates security report
```

### Example 5: Using Example Projects

```bash
# Start from template
cp -r ~/.claude/plugins/sui-dev-agents/examples/starter-nft ./my-nft

cd my-nft
/sui-dev-agents:build
/sui-dev-agents:test
/sui-dev-agents:deploy

# NFT project running in 60 seconds!
```

## 🌐 Using on Other Platforms

This plugin is built for **Claude Code**, but the underlying skills, prompts, and rules are portable markdown files. Here's how to leverage them on other AI coding platforms:

### Cursor / Windsurf

Copy the rules into your project's AI rules directory:

```bash
# Cursor
cp -r rules/sui-move/ .cursor/rules/
cp -r rules/common/ .cursor/rules/

# Windsurf
cp -r rules/sui-move/ .windsurf/rules/
cp -r rules/common/ .windsurf/rules/
```

You can also paste skill prompts (e.g. `skills/sui-developer/SKILL.md`) into the system instructions or rules file for specific workflows.

### OpenAI Codex CLI

Use the rules as [Codex instructions](https://github.com/openai/codex):

```bash
# Copy rules to Codex instructions
cat rules/sui-move/conventions.md rules/sui-move/security.md > codex-instructions.md

# Use as system prompt
codex --instructions codex-instructions.md "Build a SUI Move token contract"
```

For skill-level guidance, prepend a skill file to your prompt:

```bash
codex --instructions skills/sui-developer/SKILL.md "Create an NFT module"
```

### Google Gemini CLI

Use with [Gemini CLI](https://github.com/google-gemini/gemini-cli) via `GEMINI.md` or system instructions:

```bash
# Copy rules to Gemini system instructions
cp rules/sui-move/conventions.md GEMINI.md

# Or use as a context file
gemini -s rules/sui-move/conventions.md "Write a Move coin module"
```

You can also create a `GEMINI.md` in your project root combining relevant rules:

```bash
cat rules/sui-move/conventions.md rules/sui-move/security.md rules/common/code-quality.md > GEMINI.md
```

### OpenCode

For [OpenCode](https://github.com/opencode-ai/opencode), use as context files:

```bash
# Add rules to OpenCode's context
cp rules/sui-move/conventions.md .opencode/context/sui-conventions.md
cp rules/sui-move/security.md .opencode/context/sui-security.md
```

### Aider

Use rules as [Aider conventions](https://aider.chat/docs/usage/conventions.html):

```bash
# Add to .aider.conf.yml
cat > .aider.conf.yml << 'EOF'
read:
  - rules/sui-move/conventions.md
  - rules/sui-move/security.md
EOF

# Or pass directly
aider --read rules/sui-move/conventions.md
```

### Cline (VS Code)

Add rules to Cline's custom instructions in VS Code settings, or place them in `.clinerules`:

```bash
cat rules/sui-move/conventions.md rules/sui-move/security.md > .clinerules
```

### Portable Resources Summary

| Resource | Path | Use As |
|----------|------|--------|
| Move conventions | `rules/sui-move/conventions.md` | System prompt / rules file |
| Security rules | `rules/sui-move/security.md` | System prompt / rules file |
| Testing patterns | `rules/sui-move/testing.md` | System prompt / rules file |
| Code quality | `rules/common/code-quality.md` | System prompt / rules file |
| API migration | `rules/common/api-migration.md` | Reference document |
| Skill prompts | `skills/*/SKILL.md` | Task-specific system prompts |
| Agent prompts | `agents/*.md` | Multi-step workflow templates |
| Example projects | `examples/starter-*/` | Project scaffolding (any platform) |
| LSP config | `.lsp.json` | Editor LSP setup (any editor) |

> **Note:** Skills, agents, hooks, and commands use Claude Code's plugin system and won't run natively on other platforms. However, the prompt content within each skill/agent markdown file can be adapted as system instructions or custom prompts for any LLM-powered tool.

## ⚙️ Configuration

Skills can be configured via `.sui-full-stack.json`:

```json
{
  "auto_commit": true,
  "git_enabled": true,
  "github_sync": true,
  "quality_gates": true,
  "auto_verify_tests": true,
  "max_test_retries": 5,
  "default_quality_mode": "strict"
}
```

## 🎯 Best Practices

1. **Install rules first** - `bash scripts/install-rules.sh` for consistent code quality
2. **Start with commands** for quick iterations - `/sui-dev-agents:init`, `:build`, `:test`
3. **Use `/sui-full-stack` skill** for new complete projects - handles entire lifecycle
4. **Let hooks verify automatically** - PostToolUse hook checks syntax after edits
5. **Use agents for complex tasks** - let `sui-supreme` orchestrate multi-step workflows
6. **Security first** - run `/sui-dev-agents:audit` or `/sui-security-guard` before commits
7. **Test-driven** - use `/sui-dev-agents:test` throughout development
8. **Git integration** - enable auto-commit for clean history
9. **Start from examples** - copy starter projects for faster setup
10. **Ecosystem tools** - leverage SUI protocols (Kiosk, zkLogin, Walrus)

## 📚 Documentation

- **Quick Start:** `docs/QUICKSTART.md` - 5-minute introduction
- **Complete Guide:** `docs/GUIDE.md` - Full usage guide (v2.0.0)
- **Architecture:** `docs/ARCHITECTURE.md` - Component design (v2.0.0)
- **Commands:** `commands/*.md` - Command reference
- **Skills:** `skills/*/SKILL.md` - Skill documentation
- **Agents:** `agents/*/prompt.md` - Agent documentation
- **Rules:** `rules/**/*.md` - Coding conventions
- **Examples:** `examples/` - Starter projects

## 🔗 Integration with CLAUDE.md

This plugin integrates with your global CLAUDE.md rules:

- **auto_verify:** Automatic test execution and fixing (max 5 retries)
- **auto_quality_suggest:** Prompts for code review after major changes
- **error_recovery:** Auto-retry on API errors (max 5 times)
- **no_overengineering:** Focused, minimal solutions

## 🛠️ Troubleshooting

### SUI CLI Not Found
```bash
# Install SUI CLI
cargo install --locked --git https://github.com/MystenLabs/sui.git sui

# Or check PATH
which sui
echo $PATH
```

### Skills Not Found
```bash
# Plugin may need to be loaded
# Restart Claude Code or reload plugins
```

### Agent Not Found
```bash
# Verify agent registration
cd ~/.claude/plugins/sui-dev-agents/agents
cat claude-code-agent-config.json
```

### Move Build Errors
```bash
# Verify SUI version matches protocol
sui --version
bash scripts/protocol-version-check.sh

# Clean build
sui move build --force
```

## 📄 License

MIT License - Free to use and modify

## 👤 Author

Ramon Liao

## 🤝 Contributing

This is a personal plugin. Fork and customize for your needs!

---

**From idea to production-ready SUI dApp - guided every step of the way!**
