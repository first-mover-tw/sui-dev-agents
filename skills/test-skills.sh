#!/bin/bash
# Validate every skill directory: SKILL.md exists and its `name:` frontmatter
# matches the directory name. Auto-discovers skills so new ones are covered.
echo "Testing skill resolution..."

cd "$(dirname "$0")" || exit 1

fail=0
count=0

for dir in */; do
  skill="${dir%/}"
  # Only treat dirs that actually contain a SKILL.md as skills.
  file="${skill}/SKILL.md"
  [ -f "$file" ] || continue
  count=$((count + 1))

  name=$(grep "^name:" "$file" | head -1 | cut -d: -f2 | tr -d ' ')
  if [ "$name" = "$skill" ]; then
    echo "✅ $skill - OK"
  else
    echo "❌ $skill - Name mismatch: expected '$skill', got '$name'"
    fail=$((fail + 1))
  fi
done

echo ""
echo "Checked $count skills, $fail problem(s)."
[ "$fail" -eq 0 ] || exit 1
echo "Test complete"
