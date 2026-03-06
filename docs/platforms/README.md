# Platform Installation Guides

SUI Dev Agents rules and skill prompts are portable markdown — they work with any AI-powered development tool.

## Feature Support

| Platform | Rules | Skill Prompts | Agents | Hooks | Commands | MCP Server |
|----------|:-----:|:-------------:|:------:|:-----:|:--------:|:----------:|
| [Claude Code](./claude-code.md) | Full | Full | Full | Full | Full | Full |
| [Antigravity](./antigravity.md) | Full | As context | - | - | - | - |
| [Gemini CLI](./gemini-cli.md) | Full | As context | - | - | - | - |
| [Codex CLI](./codex-cli.md) | Full | As context | - | - | - | - |
| [OpenCode](./opencode.md) | Full | As context | - | - | - | - |
| [Cursor](./cursor.md) | Full | As context | - | - | - | - |
| [Windsurf](./windsurf.md) | Full | As context | - | - | - | - |
| [Cline](./cline.md) | Full | As context | - | - | - | - |
| [Aider](./aider.md) | Full | As context | - | - | - | - |
| [Continue](./continue.md) | Full | As context | - | - | - | - |
| [Zed](./zed.md) | Full | As context | - | - | - | - |
| [GitHub Copilot](./github-copilot.md) | Full | As context | - | - | - | - |
| [Augment Code](./augment-code.md) | Full | As context | - | - | - | - |
| [Amazon Q Developer](./amazon-q.md) | Full | As context | - | - | - | - |

> **Note:** "Full" for rules means the markdown content is fully usable. Skills, agents, hooks, and commands use Claude Code's plugin system and won't run natively on other platforms. However, the prompt content within each skill/agent markdown file can be used as system instructions or context files for any LLM-powered tool.

## Portable Resources

| Resource | Path | Use As |
|----------|------|--------|
| Move conventions | `rules/sui-move/conventions.md` | System prompt / rules file |
| Security rules | `rules/sui-move/security.md` | System prompt / rules file |
| Testing patterns | `rules/sui-move/testing.md` | System prompt / rules file |
| Code quality | `rules/common/code-quality.md` | System prompt / rules file |
| API migration | `rules/common/api-migration.md` | Reference document |
| gRPC reference | `skills/sui-frontend/references/grpc-reference.md` | Migration guide |
| Skill prompts | `skills/*/SKILL.md` | Task-specific system prompts |
| Agent prompts | `agents/*.md` | Multi-step workflow templates |
| Example projects | `examples/starter-*/` | Project scaffolding |
| LSP config | `.lsp.json` | Editor LSP setup |
