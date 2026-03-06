# Zed

[Zed](https://zed.dev) supports custom assistant instructions via `.zed/instructions.md` or project-level settings.

## Installation

```bash
# Clone the rules
git clone https://github.com/first-mover-tw/sui-dev-agents.git /tmp/sui-dev-agents

# Create .zed directory with instructions
mkdir -p .zed
cat /tmp/sui-dev-agents/rules/sui-move/conventions.md \
    /tmp/sui-dev-agents/rules/sui-move/security.md \
    /tmp/sui-dev-agents/rules/common/code-quality.md \
    > .zed/instructions.md
```

## Adding Skill Prompts

```bash
# Append specific skill for focused tasks
cat /tmp/sui-dev-agents/skills/sui-developer/SKILL.md >> .zed/instructions.md
```

## Using with /file Slash Command

In Zed's assistant panel, reference files directly:

```
/file rules/sui-move/conventions.md
Build a SUI Move token contract
```

## What Works

- All rules via `.zed/instructions.md` (auto-loaded in assistant)
- Skill prompts as additional instructions or `/file` context

## What Doesn't Work

- Skills, agents, hooks, commands (Claude Code plugin system only)
- MCP server (requires Claude Code runtime)
