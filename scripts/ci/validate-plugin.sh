#!/usr/bin/env bash
set -euo pipefail

# Validate sui-dev-agents plugin structure
# Usage: ./scripts/ci/validate-plugin.sh

PLUGIN_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ERRORS=0

echo "=== Validating sui-dev-agents plugin ==="

# 1. Validate plugin.json is valid JSON
echo -n "Checking plugin.json... "
if python3 -m json.tool "$PLUGIN_ROOT/.claude-plugin/plugin.json" >/dev/null 2>&1; then
  echo "OK"
else
  echo "FAIL: Invalid JSON"
  ERRORS=$((ERRORS + 1))
fi

# 2. Validate hooks.json is valid JSON
echo -n "Checking hooks.json... "
if python3 -m json.tool "$PLUGIN_ROOT/hooks/hooks.json" >/dev/null 2>&1; then
  echo "OK"
else
  echo "FAIL: Invalid JSON"
  ERRORS=$((ERRORS + 1))
fi

# 3. Validate all agent files referenced in plugin.json exist
echo -n "Checking agent file references... "
MISSING_AGENTS=0
while IFS= read -r agent_path; do
  agent_path=$(echo "$agent_path" | tr -d '", ')
  if [[ -n "$agent_path" && "$agent_path" == ./* ]]; then
    if [[ ! -f "$PLUGIN_ROOT/.claude-plugin/$agent_path" && ! -f "$PLUGIN_ROOT/$agent_path" ]]; then
      # Try relative to plugin.json location
      resolved="$PLUGIN_ROOT/.claude-plugin/$agent_path"
      if [[ ! -f "$resolved" ]]; then
        resolved="$PLUGIN_ROOT/${agent_path#./}"
        if [[ ! -f "$resolved" ]]; then
          echo ""
          echo "  MISSING: $agent_path"
          MISSING_AGENTS=$((MISSING_AGENTS + 1))
        fi
      fi
    fi
  fi
done < <(python3 -c "
import json, sys
with open('$PLUGIN_ROOT/.claude-plugin/plugin.json') as f:
    data = json.load(f)
for a in data.get('agents', []):
    print(a)
" 2>/dev/null)
if [[ $MISSING_AGENTS -eq 0 ]]; then
  echo "OK"
else
  ERRORS=$((ERRORS + MISSING_AGENTS))
fi

# 4. Validate agent .md files have frontmatter
echo -n "Checking agent frontmatter... "
MISSING_FM=0
for md in "$PLUGIN_ROOT"/agents/*.md; do
  [[ "$(basename "$md")" =~ ^(README|EXAMPLES|USAGE|GLOBAL-SETUP)\.md$ ]] && continue
  if ! head -1 "$md" | grep -q '^---$'; then
    echo ""
    echo "  MISSING frontmatter: $(basename "$md")"
    MISSING_FM=$((MISSING_FM + 1))
  fi
done
if [[ $MISSING_FM -eq 0 ]]; then
  echo "OK"
else
  ERRORS=$((ERRORS + MISSING_FM))
fi

# 5. Validate all skills have SKILL.md
echo -n "Checking skill definitions... "
MISSING_SKILLS=0
for skill_dir in "$PLUGIN_ROOT"/skills/*/; do
  [[ -d "$skill_dir" ]] || continue
  if [[ ! -f "$skill_dir/SKILL.md" ]]; then
    echo ""
    echo "  MISSING SKILL.md: $(basename "$skill_dir")"
    MISSING_SKILLS=$((MISSING_SKILLS + 1))
  fi
done
if [[ $MISSING_SKILLS -eq 0 ]]; then
  echo "OK"
else
  ERRORS=$((ERRORS + MISSING_SKILLS))
fi

# 6. Validate hook scripts are executable
echo -n "Checking hook scripts... "
NON_EXEC=0
for script in "$PLUGIN_ROOT"/scripts/hooks/*.sh; do
  [[ -f "$script" ]] || continue
  if [[ ! -x "$script" ]]; then
    echo ""
    echo "  NOT executable: $(basename "$script")"
    NON_EXEC=$((NON_EXEC + 1))
  fi
done
if [[ $NON_EXEC -eq 0 ]]; then
  echo "OK"
else
  ERRORS=$((ERRORS + NON_EXEC))
fi

echo ""
if [[ $ERRORS -eq 0 ]]; then
  echo "All checks passed!"
  exit 0
else
  echo "FAILED: $ERRORS error(s) found"
  exit 1
fi
