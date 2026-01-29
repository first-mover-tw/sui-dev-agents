#!/bin/bash
echo "Testing skill resolution..."

skills=(
  "sui-full-stack"
  "sui-security-guard"
  "sui-docs-query"
  "sui-architect"
  "sui-developer"
  "sui-frontend"
  "sui-fullstack-integration"
  "sui-tester"
  "sui-deployer"
  "sui-walrus"
  "sui-zklogin"
  "sui-tools-guide"
)

for skill in "${skills[@]}"; do
  # Find skill.md file
  found=$(find . -name "skill.md" -path "*/${skill}/*" 2>/dev/null)
  if [ -n "$found" ]; then
    # Check name field in frontmatter
    name=$(grep "^name:" "$found" | cut -d: -f2 | tr -d ' ')
    if [ "$name" = "$skill" ]; then
      echo "✅ $skill - OK"
    else
      echo "❌ $skill - Name mismatch: expected '$skill', got '$name'"
    fi
  else
    echo "❌ $skill - File not found"
  fi
done

echo ""
echo "Test complete"
