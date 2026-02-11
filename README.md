# SUI Dev Agents

**v2.1.0** - Complete toolkit for building production-ready SUI blockchain applications with skills, agents, commands, hooks, and rules. Now with **gRPC support** (JSON-RPC deprecated April 2026).

## 📦 Installation

### Install from Marketplace

```bash
/plugin marketplace add first-mover-tw/sui-dev-agents
/plugin install sui-dev-agents
```

### Direct Installation (Alternative)

```bash
/plugin install first-mover-tw/sui-dev-agents
```

### Prerequisites

- **SUI CLI** >= 1.65 — `cargo install --locked --git https://github.com/MystenLabs/sui.git sui`
- **Claude Code** >= 1.0 — `npm install -g @anthropic-ai/claude-code`
- **Node.js** >= 18, **Rust** (stable), **Git** >= 2.0
- Recommended: [move-analyzer](https://github.com/MystenLabs/sui/tree/main/external-crates/move/crates/move-analyzer), [jq](https://jqlang.github.io/jq/)

## 🚀 Quick Start

```bash
/sui-full-stack                # Full project: architecture → deploy
/sui-dev-agents:init           # Init new Move project
/sui-dev-agents:build          # Build & verify
/sui-dev-agents:test           # Run tests
/sui-dev-agents:deploy         # Deploy to network
```

## 🔑 Key Features

### 🔒 Security: Audit + Red Team

```bash
/sui-security-guard            # Defensive scan, Git hooks, vulnerability detection
/sui-red-team                  # Adversarial testing & exploit simulation
/sui-dev-agents:audit          # Quick security checklist
```

Red Team simulates real attack vectors against your Move contracts — reentrancy, flash loan exploits, access control bypass, overflow attacks — and generates a security report with fixes.

### ⚡ Full Development Lifecycle

| Phase | Skill | What it does |
|-------|-------|-------------|
| Design | `/sui-architect` | Architecture spec generation |
| Code | `/sui-developer` | Move contract dev + quality checks |
| Frontend | `/sui-frontend` | React/Next.js + wallet integration |
| Test | `/sui-tester` | Unit, integration, E2E, gas benchmarks |
| Deploy | `/sui-deployer` | Staged rollout: devnet → testnet → mainnet |

### 🧩 Ecosystem Integrations

`/sui-kiosk` (NFT marketplace) · `/sui-zklogin` (ZK auth) · `/sui-deepbook` (DEX) · `/sui-walrus` (storage) · `/sui-passkey` (WebAuthn) · `/sui-suins` (name service) · `/sui-seal` (sealed bids) · `/sui-nautilus` (AMM)

### 🤖 Agent Orchestration

For complex multi-step workflows, agents coordinate automatically:

```
sui-supreme → sui-core-agent / sui-development-agent / sui-ecosystem-agent
              └── 20 specialized subagents
```

### 🪝 Auto Hooks

- **PostToolUse** — Auto-verify Move syntax after edits
- **SessionStart** — Show active SUI network
- **Stop** — Warn on test_only code in production

## 🌐 Cross-Platform Usage

Rules and skill prompts are portable markdown — works with Cursor, Windsurf, Codex CLI, Gemini CLI, Aider, Cline, OpenCode.

### Cursor / Windsurf

```bash
# Cursor
cp -r rules/sui-move/ .cursor/rules/
cp -r rules/common/ .cursor/rules/

# Windsurf
cp -r rules/sui-move/ .windsurf/rules/
cp -r rules/common/ .windsurf/rules/
```

### OpenAI Codex CLI

```bash
cat rules/sui-move/conventions.md rules/sui-move/security.md > codex-instructions.md
codex --instructions codex-instructions.md "Build a SUI Move token contract"
```

### Google Gemini CLI

```bash
cat rules/sui-move/conventions.md rules/sui-move/security.md rules/common/code-quality.md > GEMINI.md
```

### Aider

```bash
aider --read rules/sui-move/conventions.md
```

### Cline (VS Code)

```bash
cat rules/sui-move/conventions.md rules/sui-move/security.md > .clinerules
```

### OpenCode

```bash
cp rules/sui-move/conventions.md .opencode/context/sui-conventions.md
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
cargo install --locked --git https://github.com/MystenLabs/sui.git sui
which sui
```

### Move Build Errors
```bash
sui --version
bash scripts/protocol-version-check.sh
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
