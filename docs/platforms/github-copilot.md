# GitHub Copilot

[GitHub Copilot](https://github.com/features/copilot) supports custom instructions via `.github/copilot-instructions.md` (project-level).

## Installation

```bash
# Clone the rules
git clone https://github.com/first-mover-tw/sui-dev-agents.git /tmp/sui-dev-agents

# Create Copilot instructions
mkdir -p .github
cat /tmp/sui-dev-agents/rules/sui-move/conventions.md \
    /tmp/sui-dev-agents/rules/sui-move/security.md \
    /tmp/sui-dev-agents/rules/common/code-quality.md \
    > .github/copilot-instructions.md
```

## Adding Skill Prompts

```bash
# Append specific skill for focused tasks
cat /tmp/sui-dev-agents/skills/sui-developer/SKILL.md >> .github/copilot-instructions.md
```

## Using with #file in Chat

In Copilot Chat (VS Code / JetBrains), reference rules directly:

```
#file:rules/sui-move/conventions.md Build a SUI Move token contract
```

## What Works

- All rules via `.github/copilot-instructions.md` (auto-loaded in Copilot Chat)
- Skill prompts as additional instructions or `#file` context

## What Doesn't Work

- Skills, agents, hooks, commands (Claude Code plugin system only)
- MCP server (requires Claude Code runtime)
