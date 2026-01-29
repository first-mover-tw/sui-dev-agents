#!/bin/bash
echo "🔒 Running security checks..."

# Check for .env files
if git diff --cached --name-only | grep -qE "^\.env$"; then
  echo "❌ ERROR: .env file in commit!"
  exit 1
fi

# Check for private keys
if git diff --cached | grep -qE "suiprivkey1|BEGIN PRIVATE KEY"; then
  echo "❌ ERROR: Private key detected!"
  exit 1
fi

echo "✅ Security checks passed"
