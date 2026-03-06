# Antigravity

[Antigravity](https://antigravity.dev) supports custom rules via its context system.

## Installation

```bash
# Clone the rules into your project
git clone https://github.com/first-mover-tw/sui-dev-agents.git /tmp/sui-dev-agents

# Copy rules to Antigravity context directory
cp -r /tmp/sui-dev-agents/rules/sui-move/ .antigravity/rules/
cp -r /tmp/sui-dev-agents/rules/common/ .antigravity/rules/
```

## Using Skill Prompts as Context

```bash
# Add specific skill prompts for focused tasks
cp /tmp/sui-dev-agents/skills/sui-developer/SKILL.md .antigravity/context/sui-developer.md
cp /tmp/sui-dev-agents/skills/sui-ts-sdk/SKILL.md .antigravity/context/sui-ts-sdk.md
cp /tmp/sui-dev-agents/skills/sui-frontend/SKILL.md .antigravity/context/sui-frontend.md
```

## What Works

- All rules (Move conventions, security, testing, code quality, API migration)
- Skill prompts as context files (the LLM reads them as system instructions)

## What Doesn't Work

- Skills, agents, hooks, commands (Claude Code plugin system only)
- MCP server (requires Claude Code runtime)
