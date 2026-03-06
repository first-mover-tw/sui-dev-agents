# OpenCode

[OpenCode](https://github.com/opencode-ai/opencode) supports context files in `.opencode/context/`.

## Installation

```bash
# Clone the rules
git clone https://github.com/first-mover-tw/sui-dev-agents.git /tmp/sui-dev-agents

# Create context directory
mkdir -p .opencode/context

# Copy rules
cp /tmp/sui-dev-agents/rules/sui-move/conventions.md .opencode/context/sui-conventions.md
cp /tmp/sui-dev-agents/rules/sui-move/security.md .opencode/context/sui-security.md
cp /tmp/sui-dev-agents/rules/common/code-quality.md .opencode/context/code-quality.md
```

## Adding Skill Prompts

```bash
# Add specific skills as context
cp /tmp/sui-dev-agents/skills/sui-developer/SKILL.md .opencode/context/sui-developer.md
cp /tmp/sui-dev-agents/skills/sui-ts-sdk/SKILL.md .opencode/context/sui-ts-sdk.md
cp /tmp/sui-dev-agents/skills/sui-frontend/SKILL.md .opencode/context/sui-frontend.md
```

## What Works

- All rules as context files
- Skill prompts as additional context

## What Doesn't Work

- Skills, agents, hooks, commands (Claude Code plugin system only)
- MCP server (requires Claude Code runtime)
