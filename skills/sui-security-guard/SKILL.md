---
name: sui-security-guard
description: Use when setting up security scanning, detecting secrets in code, implementing pre-commit hooks, or auditing SUI projects. Triggers on security setup, API key exposure risks, or security checklist verification.
---

# SUI Security Guard

**Automated security scanning and secret detection for SUI projects.**

## Overview

This skill provides comprehensive security scanning:
- Secret detection (private keys, API keys, mnemonics)
- Pre-commit hook installation
- Security checklist validation
- Best practices enforcement

## Quick Start

```bash
# Install pre-commit hook
sui-security-guard install-hook

# Manual scan
sui-security-guard scan

# Verify configuration
sui-security-guard check
```

## Core Features

### 1. Secret Detection

Scans for:
- SUI private keys (`suiprivkey1...`)
- Mnemonics (12/24 word phrases)
- API keys (OpenAI, Anthropic, etc.)
- AWS credentials
- Environment files (.env)

### 2. Pre-commit Hook

Automatically runs before each commit to prevent secrets from being committed.

**Installation:**
```bash
# Creates .git/hooks/pre-commit
sui-security-guard install-hook
```

### 3. Security Checklist

Validates:
- No hardcoded secrets
- .env in .gitignore
- No private keys in code
- No API keys in frontend
- Proper capability usage

## Configuration

`.sui-security.json`:
```json
{
  "enabled": true,
  "scan_on_commit": true,
  "exclude_patterns": [
    "node_modules/",
    ".git/",
    "*.test.ts"
  ]
}
```

## Common Mistakes

❌ **Committing .env files**
- **Problem:** API keys exposed in git history
- **Fix:** Add `.env*` to .gitignore, use .env.example for templates
- **Remediation:** Rotate all exposed keys, use git-filter-repo to purge history

❌ **Hardcoding private keys in code**
- **Problem:** Permanent exposure, cannot rotate
- **Fix:** Use environment variables, secure key management systems

❌ **Disabling pre-commit hook "just once"**
- **Problem:** Secrets slip through, end up in production
- **Fix:** Never skip hooks, fix the issue instead

❌ **Storing mnemonics in comments**
- **Problem:** Easy to miss in code review, exposed in repo
- **Fix:** Never store mnemonics anywhere in codebase, use secure vaults

❌ **Not scanning existing codebase**
- **Problem:** Legacy secrets remain in old commits
- **Fix:** Run full historical scan with tools like gitleaks

❌ **Testing with production API keys**
- **Problem:** Rate limits, billing issues, exposure risk
- **Fix:** Use separate test API keys with limited permissions

## Integration

- **Called by:** `sui-full-stack` (throughout development)
- **Hooks:** Git pre-commit

See [reference.md](references/reference.md) for scan patterns and [examples.md](references/examples.md) for remediation guides.
