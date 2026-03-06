# Claude Code (Primary)

Full plugin support — skills, agents, hooks, commands, rules, and MCP server.

## Installation

### From Marketplace

```bash
/plugin marketplace add first-mover-tw/sui-dev-agents
/plugin install sui-dev-agents
```

### Direct Install

```bash
/plugin install first-mover-tw/sui-dev-agents
```

## What You Get

- **23 skills** — `/sui-full-stack`, `/sui-developer`, `/sui-frontend`, `/sui-ts-sdk`, `/sui-tester`, `/sui-deployer`, `/sui-architect`, `/sui-red-team`, `/sui-decompile`, `/sui-security-guard`, `/move-code-quality`, and more
- **19 agents** — `sui-supreme` orchestrator with specialized subagents
- **9 commands** — `:init`, `:build`, `:test`, `:deploy`, `:audit`, `:gas`, `:upgrade`, and more
- **8 hooks** — auto-verify syntax, gas budget guard, tx-approval, mainnet warnings
- **5 rules** — Move conventions, security, testing, code quality, API migration
- **MCP server** — 14 on-chain query tools + agent wallet (gRPC primary, JSON-RPC fallback)

## Quick Start

```bash
/sui-full-stack                # Full project lifecycle
/sui-dev-agents:init           # Init new Move project
/sui-dev-agents:build          # Build & verify
/sui-dev-agents:test           # Run tests
/sui-dev-agents:deploy         # Deploy to network
/sui-dev-agents:audit          # Security audit
```

## Prerequisites

- **SUI CLI** >= 1.67 — `cargo install --locked --git https://github.com/MystenLabs/sui.git sui`
- **Claude Code** >= 1.0 — `npm install -g @anthropic-ai/claude-code`
- **Node.js** >= 18, **Rust** (stable), **Git** >= 2.0
- Recommended: [move-analyzer](https://github.com/MystenLabs/sui/tree/main/external-crates/move/crates/move-analyzer), [jq](https://jqlang.github.io/jq/)
