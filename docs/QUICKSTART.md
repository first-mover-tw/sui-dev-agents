# SUI Dev Agents - Quick Start Guide

## 🎯 5-Minute Start

### Build Your First SUI dApp

```bash
# Start the complete workflow
/sui-full-stack

# Follow the prompts:
1. Project name? → "my-nft-marketplace"
2. Description? → "NFT marketplace with Kiosk"
3. Use Git? → Yes, with GitHub
4. Project type? → NFT Marketplace
5. Integrate tools? → Kiosk, Walrus, zkLogin

# Plugin handles:
✅ Git initialization
✅ Architecture planning
✅ Move contract generation
✅ Frontend scaffolding
✅ Testing setup
✅ Deployment to devnet
✅ Documentation generation
```

## 📋 Common Workflows

### 1. Architecture Only

```bash
/sui-architect

→ Answer questions about your project
→ Get: docs/specs/YYYY-MM-DD-{project}-spec.md
→ Get: Architecture diagrams
→ Get: Security threat model
```

### 2. Smart Contract Development

```bash
/sui-developer

→ Generates Move code from spec
→ Real-time quality checks
→ Auto-generates TypeScript types
→ Comprehensive unit tests
```

### 3. Frontend Integration

```bash
/sui-frontend

→ Choose framework (React/Next.js/Vue)
→ Wallet integration (@mysten/dapp-kit v2)
→ SDK setup (@mysten/sui v2)
→ API wrappers generated
```

### 4. Testing

```bash
/sui-tester

→ Move unit tests
→ Move integration tests
→ Frontend tests
→ E2E tests
→ Gas benchmarks
```

### 5. Deployment

```bash
/sui-deployer

# Choose network:
→ Devnet: Fully automated
→ Testnet: Confirmation required
→ Mainnet: Full security checklist
```

## 🔧 Individual Skills

### Security & Analysis

```bash
# Security scan
/sui-security-guard --mode strict

# Adversarial testing (10-round default)
/sui-red-team

# Reverse-engineer on-chain contracts
/sui-decompile

# Move code quality checklist
/move-code-quality
```

### Infrastructure

```bash
# Query latest docs
/sui-docs-query "Kiosk transfer policies API"

# Check MCP server + wallet
/mcp-status
/wallet-status
```

### Ecosystem Tools

```bash
# NFT marketplace
/sui-kiosk

# Zero-knowledge auth
/sui-zklogin

# Decentralized storage
/sui-walrus

# DEX integration
/sui-deepbook
```

## ⚡ Commands

Fast, focused operations for common tasks:

```bash
/sui-dev-agents:init      # Initialize new Move project
/sui-dev-agents:build     # Build Move contracts
/sui-dev-agents:test      # Run Move tests
/sui-dev-agents:deploy    # Deploy to network
/sui-dev-agents:audit     # Security audit
/sui-dev-agents:upgrade   # Upgrade contracts
/sui-dev-agents:gas       # Gas usage report
/mcp-status               # Check MCP server connection
/wallet-status            # Check agent wallet address + balance
```

### Command Examples

```bash
# Quick project setup
/sui-dev-agents:init
→ Creates project structure
→ Configures Move.toml (Protocol 117)
→ Generates template files
→ Initializes git

# Build with verification
/sui-dev-agents:build
→ Runs sui move build
→ Shows compilation errors
→ Verifies syntax

# Run comprehensive tests
/sui-dev-agents:test
→ Unit tests
→ Integration tests
→ Gas benchmarks
→ Coverage report
```

## 🪝 Hooks (8 Auto Hooks)

Plugin includes 8 automatic hooks across 5 event types:

- **PreToolUse (3):** Gas budget guard, red-team reminder before deploy, tx-approval guard
- **UserPromptSubmit (1):** Mainnet operation warning
- **PostToolUse (2):** Auto-verify Move syntax, JSON-RPC deprecation warning
- **SessionStart (1):** Show active SUI network
- **Stop (1):** Remind to run tests if .move files were modified

Configuration: `hooks/hooks.json`

## 🤖 Using Agents for Complex Tasks

For multi-step orchestration:

```typescript
// Complete project from scratch
Task({
  subagent_type: "sui-supreme",
  prompt: "Build a DeFi AMM with DeepBook integration and farming rewards",
  description: "DeFi AMM complete build"
})

// Just development phase
Task({
  subagent_type: "sui-development-agent",
  prompt: "Implement staking contract with time-locks",
  description: "Staking contract"
})

// Just ecosystem integration
Task({
  subagent_type: "sui-ecosystem-agent",
  prompt: "Add Walrus storage for NFT metadata",
  description: "Walrus integration"
})
```

## 📋 Rules & Best Practices

Install recommended SUI Move conventions:

```bash
bash scripts/install-rules.sh
```

Installs to `~/.claude/rules/`:
- `sui-move/conventions.md` - Move coding standards
- `sui-move/security.md` - Security best practices
- `sui-move/testing.md` - Test patterns
- `common/code-quality.md` - General code quality

Rules are automatically applied in all SUI projects.

## ⚙️ Configuration

Create `.sui-full-stack.json` in your project:

```json
{
  "auto_commit": true,
  "git_enabled": true,
  "github_sync": true,
  "auto_verify_tests": true,
  "max_test_retries": 5,
  "default_quality_mode": "standard"
}
```

### LSP & MCP Server

Plugin includes:
- **MCP Server** — 14 gRPC tools (auto-loaded, no setup needed)
- `.lsp.json` — move-analyzer LSP configuration (copy to project root if needed)

## 📚 Example Projects

Get started with templates:

```bash
# Copy NFT starter
cp -r ~/.claude/plugins/sui-dev-agents/examples/starter-nft ./my-nft-project

# Copy DeFi starter
cp -r ~/.claude/plugins/sui-dev-agents/examples/starter-defi ./my-defi-project

# Copy DAO starter
cp -r ~/.claude/plugins/sui-dev-agents/examples/starter-dao ./my-dao-project
```

Each includes:
- Move contracts with tests
- TypeScript SDK integration
- Frontend components
- Deployment scripts
- Documentation

### CLAUDE.md Template

Copy project-specific Claude instructions:

```bash
cp ~/.claude/plugins/sui-dev-agents/examples/CLAUDE.md ./.claude/
```

## 🎓 Learning Path

### Beginner

1. Install rules: `bash scripts/install-rules.sh`
2. Initialize project: `/sui-dev-agents:init`
3. Run `/sui-full-stack` for guided project creation
4. Explore generated code
5. Modify contracts and test with `/sui-dev-agents:test`
6. Deploy to devnet with `/sui-dev-agents:deploy`

### Intermediate

1. Use individual skills for specific tasks
2. Customize architecture with `/sui-architect`
3. Integrate ecosystem tools (Kiosk, zkLogin)
4. Use commands for faster iteration
5. Deploy to testnet

### Advanced

1. Use agents for complex orchestration
2. Create custom workflows
3. Extend with your own skills
4. Use hooks for automation
5. Production mainnet deployments

## 🆘 Getting Help

```bash
# View skill documentation
cat ~/.claude/plugins/sui-dev-agents/skills/sui-full-stack/skill.md

# Check command reference
ls ~/.claude/plugins/sui-dev-agents/commands/

# Check agent hierarchy
cat ~/.claude/plugins/sui-dev-agents/agents/README.md

# Tool selection guide
/sui-tools-guide

# Check installed rules
ls ~/.claude/rules/sui-move/
```

## 📦 Next Steps

1. ✅ Read full README: `README.md`
2. ✅ Complete guide: `docs/GUIDE.md`
3. ✅ Understand architecture: `docs/ARCHITECTURE.md`
4. ✅ Install rules: `bash scripts/install-rules.sh`
5. ✅ Try example projects: `examples/`
6. ✅ Build your first dApp!

---

## ⚠️ API Migration Notice

**JSON-RPC is deprecated** and will be removed in **April 2026**.
- New projects should use **gRPC** (GA) or **GraphQL** (beta) for data access
- The `@mysten/sui` SDK handles this automatically for most use cases
- See `skills/sui-frontend/references/grpc-reference.md` for migration guide

**Happy building on SUI!**
