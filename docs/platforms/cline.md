# Cline (VS Code)

[Cline](https://github.com/cline/cline) reads `.clinerules` in your project root as custom instructions.

## Installation

```bash
# Clone the rules
git clone https://github.com/first-mover-tw/sui-dev-agents.git /tmp/sui-dev-agents

# Concatenate rules into .clinerules
cat /tmp/sui-dev-agents/rules/sui-move/conventions.md \
    /tmp/sui-dev-agents/rules/sui-move/security.md \
    /tmp/sui-dev-agents/rules/common/code-quality.md \
    > .clinerules
```

## Adding Skill Prompts

```bash
# Append specific skill for focused tasks
cat /tmp/sui-dev-agents/skills/sui-developer/SKILL.md >> .clinerules
```

> **Tip:** Keep `.clinerules` focused — too much content may dilute instruction effectiveness.

## What Works

- All rules as custom instructions via `.clinerules`
- Skill prompts as additional instructions

## What Doesn't Work

- Skills, agents, hooks, commands (Claude Code plugin system only)
- MCP server (requires Claude Code runtime)
