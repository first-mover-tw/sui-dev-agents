# Aider

[Aider](https://aider.chat) supports read-only context files via `--read` flag or `.aider.conf.yml`.

## Installation

```bash
# Clone the rules
git clone https://github.com/first-mover-tw/sui-dev-agents.git /tmp/sui-dev-agents

# Copy rules to project
cp -r /tmp/sui-dev-agents/rules/ ./sui-rules/
```

## Usage

```bash
# Load rules as read-only context
aider --read sui-rules/sui-move/conventions.md \
      --read sui-rules/sui-move/security.md \
      --read sui-rules/common/code-quality.md

# With skill prompts
aider --read sui-rules/sui-move/conventions.md \
      --read /tmp/sui-dev-agents/skills/sui-developer/SKILL.md
```

## Persistent Configuration

Create `.aider.conf.yml` in your project root:

```yaml
read:
  - sui-rules/sui-move/conventions.md
  - sui-rules/sui-move/security.md
  - sui-rules/common/code-quality.md
```

## What Works

- All rules as read-only context files
- Skill prompts as additional context

## What Doesn't Work

- Skills, agents, hooks, commands (Claude Code plugin system only)
- MCP server (requires Claude Code runtime)
