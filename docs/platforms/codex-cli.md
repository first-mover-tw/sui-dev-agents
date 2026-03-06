# OpenAI Codex CLI

[Codex CLI](https://github.com/openai/codex) accepts instructions via the `--instructions` flag or an `instructions.md` file.

## Installation

```bash
# Clone the rules
git clone https://github.com/first-mover-tw/sui-dev-agents.git /tmp/sui-dev-agents

# Create instructions file
cat /tmp/sui-dev-agents/rules/sui-move/conventions.md \
    /tmp/sui-dev-agents/rules/sui-move/security.md \
    /tmp/sui-dev-agents/rules/common/code-quality.md \
    > codex-instructions.md
```

## Usage

```bash
# Use with --instructions flag
codex --instructions codex-instructions.md "Build a SUI Move token contract"

# Or place as instructions.md in project root for auto-loading
mv codex-instructions.md instructions.md
```

## Adding Skill Prompts

```bash
# Append specific skill for focused tasks
cat /tmp/sui-dev-agents/skills/sui-developer/SKILL.md >> codex-instructions.md

# For TypeScript SDK tasks
cat /tmp/sui-dev-agents/skills/sui-ts-sdk/SKILL.md >> codex-instructions.md
```

## What Works

- All rules as instruction context
- Skill prompts as additional instructions

## What Doesn't Work

- Skills, agents, hooks, commands (Claude Code plugin system only)
- MCP server (requires Claude Code runtime)
