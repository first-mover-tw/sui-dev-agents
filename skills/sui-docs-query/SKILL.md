---
name: sui-docs-query
description: Use when searching SUI documentation, querying API references, checking tool versions, or finding integration examples. Triggers on documentation lookup, API usage questions, or version compatibility checks.
---

# SUI Documentation Query Engine

**Centralized service for querying latest SUI documentation, GitHub examples, and version information.**

## Overview

This skill provides a unified interface for all other SUI skills to query:
- Official documentation (via Context7 MCP)
- GitHub repositories (latest code, examples, issues)
- Version detection and comparison
- Cached results to reduce API calls

**Key Principle:** Other skills don't query directly - they call this skill with standardized parameters.

## Query Types

### Type 1: Official Documentation Query

```typescript
{
  type: "docs",
  target: "sui-core" | "walrus" | "zklogin" | "deepbook",
  query: "specific question or topic",
  options: { use_cache: true, max_results: 5 }
}
```

### Type 2: GitHub Repository Query

```typescript
{
  type: "github",
  target: "sui-core" | "walrus",
  query: "search query",
  options: { include_examples: true, include_issues: false }
}
```

### Type 3: Version Detection

```typescript
{
  type: "version",
  target: "sui"
}
```

## Usage

Called by all other skills to query latest documentation:

```typescript
const info = await sui_docs_query({
  type: "docs",
  target: "kiosk",
  query: "Transfer policy implementation"
});
```

## Configuration

Cache duration: 1 hour for docs, 15 minutes for GitHub.

## Common Mistakes

❌ **Querying with vague questions**
- **Problem:** Irrelevant results, wasted API calls
- **Fix:** Be specific - "Transfer policy royalty implementation" not "royalties"

❌ **Not using cached results**
- **Problem:** Hitting rate limits, slow responses
- **Fix:** Set `use_cache: true` for repeated queries

❌ **Querying deprecated targets**
- **Problem:** Outdated information, wrong implementation
- **Fix:** Check version first with `type: "version"` before querying docs

❌ **Skipping GitHub examples**
- **Problem:** Implementing from scratch when examples exist
- **Fix:** Set `include_examples: true` for implementation queries

❌ **Not specifying target correctly**
- **Problem:** Wrong documentation source, confusing results
- **Fix:** Use exact target names: "sui-core", "walrus", "kiosk", "zklogin"

❌ **Ignoring version compatibility**
- **Problem:** Using API that doesn't exist in user's SUI version
- **Fix:** Query version, verify compatibility before suggesting code

❌ **Over-querying during development**
- **Problem:** Rate limited, blocked from Context7/GitHub
- **Fix:** Cache aggressively, query only when truly needed

See [reference.md](references/reference.md) for complete API and [examples.md](references/examples.md) for integration patterns.
