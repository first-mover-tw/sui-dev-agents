# Augment Code

[Augment Code](https://augmentcode.com) supports custom instructions in its settings and context files.

## Installation

```bash
# Clone the rules
git clone https://github.com/first-mover-tw/sui-dev-agents.git /tmp/sui-dev-agents

# Copy rules to project
cp -r /tmp/sui-dev-agents/rules/ ./sui-rules/
```

## Configuration

1. Open Augment Code settings in your IDE
2. Under **Custom Instructions**, paste the content from:
   - `rules/sui-move/conventions.md`
   - `rules/sui-move/security.md`
   - `rules/common/code-quality.md`

Or generate a combined instructions file:

```bash
cat /tmp/sui-dev-agents/rules/sui-move/conventions.md \
    /tmp/sui-dev-agents/rules/sui-move/security.md \
    /tmp/sui-dev-agents/rules/common/code-quality.md \
    > augment-instructions.md
```

## Adding Skill Prompts

Reference skill prompts as context in Augment chat by adding files to your workspace.

## What Works

- All rules as custom instructions
- Skill prompts as chat context

## What Doesn't Work

- Skills, agents, hooks, commands (Claude Code plugin system only)
- MCP server (requires Claude Code runtime)
