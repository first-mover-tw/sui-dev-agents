---
description: Routes code review requests to SUI-specific skills instead of generic superpowers:code-reviewer
globs: ["**/*.move", "**/*.ts", "**/*.tsx"]
---

# SUI Code Review Routing

When performing code review, self-review, or dispatching a code-reviewer subagent, check changed files first:

```bash
git diff --name-only {BASE_SHA}..{HEAD_SHA}
```

## If changed files include `.move` files or SUI-related code (dApp Kit, `@mysten/sui`):

**Do NOT use `superpowers:code-reviewer`.** Instead, invoke these plugin skills in order:

1. **`move-code-quality`** (MANDATORY for `.move` files) — Move 2024 Edition compliance, 50+ rules
2. **`sui-security-guard`** (MANDATORY for `.move` files) — secret detection, access control, object ownership safety
3. **`sui-red-team`** (CONDITIONAL — only for auth, token/coin ops, treasury, value transfer modules) — attack vector analysis
4. **`sui-architect`** (if new modules, object types, or cross-module deps changed) — object model, capability pattern, upgrade compatibility
5. **`sui-frontend`** (if dApp Kit / SUI SDK changes) — React patterns, SDK version compatibility, PTB construction

## If no SUI/Move code is involved:

Use `superpowers:code-reviewer` as normal.

## Applies to ALL code review triggers:

- `superpowers:requesting-code-review` dispatching a reviewer
- `superpowers:subagent-driven-development` post-task review steps
- Manual review or self-review requests
- `superpowers:code-reviewer` agent dispatch

## Output Format

After running applicable skills, consolidate into:

```
## SUI Code Review Summary
### Move Code Quality — [issues from move-code-quality]
### Security — [issues from sui-security-guard]
### Red Team (if applicable) — [issues from sui-red-team]
### Architecture (if applicable) — [issues from sui-architect]
### Assessment — Ready to merge / Needs fixes / Needs design review
```
