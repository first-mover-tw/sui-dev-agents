# Continue (VS Code / JetBrains)

[Continue](https://continue.dev) supports custom context providers and `.continuerules` for system instructions.

## Installation

```bash
# Clone the rules
git clone https://github.com/first-mover-tw/sui-dev-agents.git /tmp/sui-dev-agents

# Create .continuerules with SUI rules
cat /tmp/sui-dev-agents/rules/sui-move/conventions.md \
    /tmp/sui-dev-agents/rules/sui-move/security.md \
    /tmp/sui-dev-agents/rules/common/code-quality.md \
    > .continuerules
```

## Using with @file Context

In Continue chat, reference rules directly:

```
@rules/sui-move/conventions.md Build a token contract
```

## Adding Skill Prompts

```bash
# Copy skill prompts to project for @file access
mkdir -p .continue/context
cp /tmp/sui-dev-agents/skills/sui-developer/SKILL.md .continue/context/sui-developer.md
cp /tmp/sui-dev-agents/skills/sui-ts-sdk/SKILL.md .continue/context/sui-ts-sdk.md
```

## What Works

- All rules via `.continuerules` (auto-loaded as system instructions)
- Skill prompts as `@file` context or in `.continue/context/`

## What Doesn't Work

- Skills, agents, hooks, commands (Claude Code plugin system only)
- MCP server (requires Claude Code runtime)
