# SUI Dev Agents

**v2.6.0** — An open-source toolkit built for the SUI community to streamline blockchain development. Provides skills, agents, commands, hooks, rules, and a built-in **MCP Server** for on-chain queries + agent wallet. Aligned with **SUI CLI v1.68+** (Protocol 118), **SUI SDK v2**, **dApp Kit v2** (`@mysten/dapp-kit-react` / `@mysten/dapp-kit-core`), **Move 2024 Edition**, and **gRPC transport** (JSON-RPC deprecated, Quorum Driver disabled, removal April 2026). Integrates [MystenLabs sui-dev-skills](https://github.com/MystenLabs/sui-dev-skills) as source of truth.

Works with **Claude Code** (full plugin) and other AI development tools (rules-only) — see [Platform Guides](docs/platforms/).

## 📦 Installation

### Claude Code (Full Plugin)

```bash
# From Marketplace
/plugin marketplace add first-mover-tw/sui-dev-agents
/plugin install sui-dev-agents

# Or direct install
/plugin install first-mover-tw/sui-dev-agents
```

### Other AI Tools (Rules-Only)

Rules and skill prompts are portable markdown — works with any AI-powered development tool. Quick setup for popular CLI tools:

| Tool | Quick Start |
|------|-------------|
| **Antigravity** | `cp -r rules/sui-move/ .antigravity/rules/` |
| **Gemini CLI** | `cat rules/sui-move/conventions.md rules/sui-move/security.md > GEMINI.md` |
| **Codex CLI** | `cat rules/sui-move/conventions.md rules/sui-move/security.md > codex-instructions.md` |
| **OpenCode** | `cp rules/sui-move/conventions.md .opencode/context/sui-conventions.md` |

> Detailed guides for 14 platforms (Cursor, Windsurf, Cline, GitHub Copilot, Zed, Continue, Aider, Augment Code, Amazon Q, and more): **[docs/platforms/](docs/platforms/)**

### Prerequisites

- **SUI CLI** >= 1.68 — `cargo install --locked --git https://github.com/MystenLabs/sui.git sui`
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
/sui-dev-agents:audit          # Security audit
```

## 🔑 Key Features

### 🔒 Security: Audit + Red Team + Decompile

```bash
/sui-security-guard            # Defensive scan, Git hooks, vulnerability detection
/sui-red-team                  # Adversarial testing & exploit simulation (10-round default)
/sui-decompile                 # Reverse-engineer on-chain contracts for analysis
/sui-dev-agents:audit          # Quick security checklist
```

Red Team simulates real attack vectors against your Move contracts — reentrancy, flash loan exploits, access control bypass, overflow attacks, fee rounding bypass — and generates a security report with fixes. Decompile lets you study any on-chain contract via CLI or block explorer.

### ⚡ Full Development Lifecycle

| Phase | Skill | What it does |
|-------|-------|-------------|
| Design | `/sui-architect` | Architecture spec generation |
| Code | `/sui-developer` | Move contract dev + quality checks |
| SDK | `/sui-ts-sdk` | TypeScript SDK v2 — PTB, queries, sponsored tx |
| Frontend | `/sui-frontend` | React/Next.js + dApp Kit v2 wallet integration |
| Test | `/sui-tester` | Unit, integration, E2E, gas benchmarks, coverage analysis |
| Deploy | `/sui-deployer` | Staged rollout: devnet → testnet → mainnet |
| Quality | `/move-code-quality` | Move Book code quality checklist |

### 🧩 Ecosystem Integrations

`/sui-kiosk` (NFT marketplace) · `/sui-zklogin` (ZK auth) · `/sui-deepbook` (DEX) · `/sui-walrus` (storage) · `/sui-passkey` (WebAuthn) · `/sui-suins` (name service) · `/sui-seal` (sealed bids) · `/sui-nautilus` (cross-chain)

### 🔌 MCP Server + Agent Wallet

Built-in MCP server with 14 tools for on-chain queries and wallet operations (gRPC primary, JSON-RPC fallback for BigInt-sensitive endpoints):

```bash
# Query tools (no approval needed)
sui_get_balance, sui_get_object, sui_get_coins, sui_get_events,
sui_get_transaction, sui_get_package, sui_resolve_name, ...

# Wallet tools (dry-run → approve → execute)
sui_wallet_status, sui_wallet_transfer, sui_wallet_call, sui_wallet_publish
```

```bash
/wallet-status                 # Check agent wallet address + balance
/mcp-status                    # Verify MCP server connection
```

### 🤖 Agent Orchestration

For complex multi-step workflows, agents coordinate automatically:

```
sui-supreme → sui-core-agent / sui-development-agent / sui-ecosystem-agent
              └── 14 specialized subagents (including red-team)
```

### 🪝 Auto Hooks (8 hooks across 5 event types)

- **PreToolUse** — Gas budget guard, red-team reminder before deploy, tx-approval guard
- **UserPromptSubmit** — Mainnet operation warning
- **PostToolUse** — Auto-verify Move syntax, JSON-RPC deprecation warning
- **SessionStart** — Show active SUI network
- **Stop** — Remind to run tests if .move files were modified

## 🌐 Cross-Platform Usage

Rules and skill prompts are portable markdown — see **[docs/platforms/](docs/platforms/)** for detailed installation guides covering 14 platforms including Cursor, Windsurf, Codex CLI, Gemini CLI, Aider, Cline, OpenCode, Zed, Continue, GitHub Copilot, Augment Code, Amazon Q, and Antigravity.

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

- **Quick Start:** `docs/QUICKSTART.md` — 5-minute introduction
- **Complete Guide:** `docs/GUIDE.md` — Full usage guide
- **Architecture:** `docs/ARCHITECTURE.md` — Component design
- **Platform Guides:** `docs/platforms/` — Installation for 14 AI tools
- **Commands:** `commands/*.md` — 9 command references
- **Skills:** `skills/*/SKILL.md` — 23 skill docs
- **Agents:** `agents/*.md` — 19 agent definitions
- **Rules:** `rules/**/*.md` — 5 coding conventions
- **MCP Server:** `mcp-server/` — 14 gRPC tools source
- **Examples:** `examples/` — Starter projects

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

This is an open-source project for the SUI developer community. Contributions are welcome!

- **Bug reports & feature requests** — [Open an issue](https://github.com/first-mover-tw/sui-dev-agents/issues)
- **Pull requests** — Fork the repo, create a branch, submit a PR
- **New platform guides** — Add to `docs/platforms/` and update the platform README
- **Skill improvements** — Edit `skills/*/SKILL.md` with better prompts or patterns

---

**From idea to production-ready SUI dApp — guided every step of the way.**
