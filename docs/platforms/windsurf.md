# Windsurf

[Windsurf](https://windsurf.com) (by Codeium) supports custom rules in `.windsurf/rules/`.

## Installation

```bash
# Clone the rules
git clone https://github.com/first-mover-tw/sui-dev-agents.git /tmp/sui-dev-agents

# Copy rules to project
mkdir -p .windsurf/rules
cp -r /tmp/sui-dev-agents/rules/sui-move/ .windsurf/rules/
cp -r /tmp/sui-dev-agents/rules/common/ .windsurf/rules/
```

## Adding Skill Prompts

```bash
cp /tmp/sui-dev-agents/skills/sui-developer/SKILL.md .windsurf/rules/sui-developer.md
cp /tmp/sui-dev-agents/skills/sui-ts-sdk/SKILL.md .windsurf/rules/sui-ts-sdk.md
cp /tmp/sui-dev-agents/skills/sui-frontend/SKILL.md .windsurf/rules/sui-frontend.md
```

## What Works

- All rules as Windsurf rules (auto-loaded in Cascade)
- Skill prompts as additional rules

## What Doesn't Work

- Skills, agents, hooks, commands (Claude Code plugin system only)
- MCP server (requires Claude Code runtime)
