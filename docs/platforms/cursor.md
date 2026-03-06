# Cursor

[Cursor](https://cursor.com) supports custom rules in `.cursor/rules/` (project-level) or `~/.cursor/rules/` (global).

## Installation

```bash
# Clone the rules
git clone https://github.com/first-mover-tw/sui-dev-agents.git /tmp/sui-dev-agents

# Copy rules to project
mkdir -p .cursor/rules
cp -r /tmp/sui-dev-agents/rules/sui-move/ .cursor/rules/
cp -r /tmp/sui-dev-agents/rules/common/ .cursor/rules/
```

## Adding Skill Prompts

Copy skill prompts as additional rule files:

```bash
cp /tmp/sui-dev-agents/skills/sui-developer/SKILL.md .cursor/rules/sui-developer.md
cp /tmp/sui-dev-agents/skills/sui-ts-sdk/SKILL.md .cursor/rules/sui-ts-sdk.md
cp /tmp/sui-dev-agents/skills/sui-frontend/SKILL.md .cursor/rules/sui-frontend.md
```

## Using with Composer

You can also reference rules directly in Cursor Composer by adding them to the context with `@file`:

```
@.cursor/rules/sui-move/conventions.md Build a token contract
```

## What Works

- All rules as Cursor rules (auto-loaded in every chat)
- Skill prompts as additional rules or `@file` context
- `.cursorrules` file for project-level instructions

## What Doesn't Work

- Skills, agents, hooks, commands (Claude Code plugin system only)
- MCP server (requires Claude Code runtime)
