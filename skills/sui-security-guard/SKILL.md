---
name: sui-security-guard
description: Use when setting up security scanning, detecting leaked secrets/API keys, implementing pre-commit hooks, or running security checklists on SUI projects. Triggers on "security scan", "detect secrets", "pre-commit hook", "security audit setup", "API key leaked", or any defensive security setup task. For offensive/adversarial testing (attack vectors, exploit discovery), use sui-red-team instead.
---

# SUI Security Guard

**Secret detection and pre-commit hooks for SUI projects.**

## Secret Detection

Scan the project for leaked secrets using grep patterns:

```bash
# SUI private keys
grep -rn 'suiprivkey1[a-zA-Z0-9]\{44\}' --include='*.ts' --include='*.move' --include='*.json' .

# Mnemonics (12+ word phrases that look like BIP39)
grep -rn '\b\(abandon\|ability\|able\|about\|above\)' --include='*.ts' --include='*.env' .

# API keys
grep -rn 'sk-[a-zA-Z0-9]\{20,\}\|sk-ant-[a-zA-Z0-9-]\{20,\}' .

# AWS credentials
grep -rn 'AKIA[A-Z0-9]\{16\}' .

# .env files that shouldn't be committed
git ls-files '*.env' '.env*'
```

If any matches are found: **rotate the key immediately**, then use `git-filter-repo` or `BFG Repo-Cleaner` to purge from git history.

## Pre-commit Hook Setup

Create `.git/hooks/pre-commit` to block secrets before they enter git:

```bash
#!/bin/sh
# Scan staged files for secrets before committing

STAGED=$(git diff --cached --name-only --diff-filter=ACM)

# Check for SUI private keys
if echo "$STAGED" | xargs grep -l 'suiprivkey1' 2>/dev/null; then
  echo "❌ SUI private key detected in staged files. Commit blocked."
  exit 1
fi

# Check for .env files
if echo "$STAGED" | grep -q '\.env$\|\.env\.'; then
  echo "❌ .env file staged for commit. Add to .gitignore."
  exit 1
fi

# Check for common API key patterns
if echo "$STAGED" | xargs grep -l 'sk-[a-zA-Z0-9]\{20,\}' 2>/dev/null; then
  echo "❌ API key pattern detected. Commit blocked."
  exit 1
fi

echo "✅ Security scan passed."
```

```bash
# Install the hook
chmod +x .git/hooks/pre-commit
```

For team-wide enforcement, use a shared hooks directory:
```bash
git config core.hooksPath .githooks/
# Then commit .githooks/pre-commit to the repo
```

## .gitignore Essentials

Ensure these are in `.gitignore`:
```
.env
.env.*
!.env.example
*.pem
*.key
```

## Security Checklist

Before deployment, verify:
- [ ] No hardcoded private keys or mnemonics in source
- [ ] `.env` files in `.gitignore`
- [ ] No API keys in frontend code (browser-accessible)
- [ ] AdminCap / UpgradeCap properly guarded (not public transfer)
- [ ] Pre-commit hook installed and active

## Integration

- **Called by:** `sui-full-stack` (throughout development)
- For Move contract security analysis, use `sui-red-team`
- For code quality / Move best practices, use `move-code-quality`
