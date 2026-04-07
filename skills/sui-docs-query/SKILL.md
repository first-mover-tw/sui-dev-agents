---
name: sui-docs-query
description: Use when searching SUI-specific documentation, querying Move framework API references, or checking SUI CLI/tool versions. Triggers on "check SUI docs", "what's the API for", "sui client command", "Move stdlib function", "sui move build flags", or any SUI/Move-specific documentation lookup. Prefer this over generic web search for SUI-specific questions — it routes to Context7 MCP with optimized SUI queries. For non-SUI library docs (React, Node, etc.), use context7 directly.
---

# SUI Documentation Query Engine

**Query SUI/Move documentation via Context7 MCP for up-to-date answers.**

## How It Works

This skill uses the **Context7 MCP server** (available as `mcp__plugin_context7_context7__*` tools) to fetch current documentation. Two-step process:

### Step 1: Resolve the library ID

```
Tool: mcp__plugin_context7_context7__resolve-library-id
Input: { "libraryName": "sui" }
```

Common library mappings:
| Topic | libraryName to resolve |
|-------|----------------------|
| SUI core / Move stdlib / framework | `sui` |
| Walrus storage | `walrus` |
| DeepBook | `deepbook` |
| SuiNS | `suins` |
| dApp Kit | `mysten dapp-kit` |
| TypeScript SDK | `mysten sui sdk` |

### Step 2: Query docs with the resolved ID

```
Tool: mcp__plugin_context7_context7__query-docs
Input: {
  "context7CompatibleLibraryID": "<id-from-step-1>",
  "topic": "specific question here"
}
```

## Query Tips

- **Be specific:** "Transfer policy royalty enforcement in Kiosk" not "royalties"
- **Include version context:** "sui client publish flags in v1.69" helps get relevant results
- **One topic per query:** Split compound questions into separate queries

## When to Use

- User asks about a SUI CLI command or flag
- Need to check Move stdlib / framework API signatures
- Verifying current SUI version behavior or breaking changes
- Any SUI-specific question where your training data might be outdated

## When NOT to Use

- Non-SUI libraries (React, Node, Vite) → use Context7 MCP directly
- General Move language questions → use `sui-developer` skill
- Architecture decisions → use `sui-architect` or `sui-tools-guide`
