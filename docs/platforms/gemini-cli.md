# Google Gemini CLI

[Gemini CLI](https://github.com/google-gemini/gemini-cli) reads `GEMINI.md` in your project root as system instructions.

## Installation

```bash
# Clone the rules
git clone https://github.com/first-mover-tw/sui-dev-agents.git /tmp/sui-dev-agents

# Concatenate rules into GEMINI.md
cat /tmp/sui-dev-agents/rules/sui-move/conventions.md \
    /tmp/sui-dev-agents/rules/sui-move/security.md \
    /tmp/sui-dev-agents/rules/common/code-quality.md \
    > GEMINI.md
```

## Adding Skill Prompts

For task-specific guidance, append skill prompts:

```bash
# For Move development
cat /tmp/sui-dev-agents/skills/sui-developer/SKILL.md >> GEMINI.md

# For TypeScript SDK
cat /tmp/sui-dev-agents/skills/sui-ts-sdk/SKILL.md >> GEMINI.md

# For frontend
cat /tmp/sui-dev-agents/skills/sui-frontend/SKILL.md >> GEMINI.md
```

> **Tip:** Keep `GEMINI.md` focused — include only the skills relevant to your current task to stay within context limits.

## What Works

- All rules as system instructions via `GEMINI.md`
- Skill prompts as additional context

## What Doesn't Work

- Skills, agents, hooks, commands (Claude Code plugin system only)
- MCP server (requires Claude Code runtime)
