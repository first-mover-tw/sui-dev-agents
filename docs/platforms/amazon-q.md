# Amazon Q Developer

[Amazon Q Developer](https://aws.amazon.com/q/developer/) supports custom instructions via `.amazonq/rules/` directory.

## Installation

```bash
# Clone the rules
git clone https://github.com/first-mover-tw/sui-dev-agents.git /tmp/sui-dev-agents

# Copy rules to Amazon Q rules directory
mkdir -p .amazonq/rules
cp /tmp/sui-dev-agents/rules/sui-move/conventions.md .amazonq/rules/sui-conventions.md
cp /tmp/sui-dev-agents/rules/sui-move/security.md .amazonq/rules/sui-security.md
cp /tmp/sui-dev-agents/rules/common/code-quality.md .amazonq/rules/code-quality.md
```

## Adding Skill Prompts

```bash
# Add skill prompts as additional rules
cp /tmp/sui-dev-agents/skills/sui-developer/SKILL.md .amazonq/rules/sui-developer.md
cp /tmp/sui-dev-agents/skills/sui-ts-sdk/SKILL.md .amazonq/rules/sui-ts-sdk.md
```

## What Works

- All rules as Amazon Q rules (auto-loaded in chat)
- Skill prompts as additional rules

## What Doesn't Work

- Skills, agents, hooks, commands (Claude Code plugin system only)
- MCP server (requires Claude Code runtime)
