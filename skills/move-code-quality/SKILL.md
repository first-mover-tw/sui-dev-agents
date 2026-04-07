---
name: move-code-quality
description: Analyzes Move packages against the official Move Book Code Quality Checklist. Use when reviewing Move code quality, checking Move 2024 Edition compliance, auditing best practices, or when the user says "review my Move code", "check code quality", "Move lint", or "does this follow best practices". Activates automatically when working with .move files. Different from sui-developer (which writes code) — this skill reviews and audits existing code.
---

# Move Code Quality Checker

Analyze Move packages against the [Move Book Code Quality Checklist](https://move-book.com/guides/code-quality-checklist/) — 11 categories, 50+ rules based on Move 2024 Edition.

## Analysis Workflow

### Phase 1: Discovery

1. **Find Move project** — look for `Move.toml`, glob for `*.move` files
2. **Read Move.toml** — check edition (must be `2024` or `2024.beta`), dependencies (should be implicit for Sui 1.45+), named address prefixing
3. **Ask scope** — full package scan or specific file/category?

### Phase 2: Systematic Analysis

Read [references/checklist.md](references/checklist.md) for the complete 50+ rules across these categories:

| # | Category | Key Checks |
|---|----------|-----------|
| 1 | Code Organization | Formatter usage |
| 2 | Package Manifest | Edition, implicit deps, address prefixing |
| 3 | Imports & Constants | Module label syntax, EPascalCase errors, `#[error]` annotation |
| 4 | Structs | Cap suffix, no Potato, past-tense events, witness `drop` only |
| 5 | Functions | `public(package)` not friend, no `public entry`, PTB composability, param order |
| 6 | Function Body | Method syntax (`.split()`, `.delete()`, `.sender()`), index syntax |
| 7 | Option Macros | `do!`, `destroy_or!` |
| 8 | Loop Macros | `do!`, `tabulate!`, `do_ref!`, `destroy!`, `fold!`, `filter!` |
| 9 | Other | `..` unpack syntax |
| 10 | Testing | Merged attrs, no `test_` prefix, `assert_eq!`, `destroy` util |
| 11 | Comments | `///` doc comments |

### Phase 3: Reporting

```markdown
## Move Code Quality Analysis

### Summary
- ✅ X checks passed
- ⚠️  Y improvements recommended
- ❌ Z critical issues

### Critical Issues (Fix These First)
#### 1. [Issue title]
**File**: `path:line`
**Issue**: What's wrong
**Fix**: Code snippet showing the fix

### Important Improvements
[...]

### Recommended Enhancements
[...]
```

Always include: file paths with line numbers, before/after code snippets, why the fix matters.

### Phase 4: Interactive Review

After presenting findings:
- Offer to fix issues automatically
- Can analyze specific categories in depth
- Reference checklist.md for detailed rule explanations

## Guidelines

1. **Be Specific** — file paths and line numbers always
2. **Show Examples** — bad and good code snippets
3. **Explain Why** — benefit of the fix, not just the rule
4. **Prioritize** — critical (Move 2024 required) before recommended
5. **All features require Move 2024 Edition** — check this first
