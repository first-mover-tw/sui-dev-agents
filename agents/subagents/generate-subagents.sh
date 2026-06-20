#!/bin/bash

# Generate all 18 subagent definitions

subagents=(
  "sui-full-stack:sui-full-stack:sui-core-agent"
  "sui-docs-query:sui-docs-query:sui-infrastructure-agent"
  "sui-security-guard:sui-security-guard:sui-infrastructure-agent"
  "sui-architect:sui-architect:sui-development-agent"
  "sui-developer:sui-developer:sui-development-agent"
  "sui-frontend:sui-frontend:sui-development-agent"
  "sui-tester:sui-tester:sui-development-agent"
  "sui-deployer:sui-deployer:sui-development-agent"
  "sui-kiosk:sui-kiosk:sui-ecosystem-agent"
  "sui-walrus:sui-walrus:sui-ecosystem-agent"
  "sui-zklogin:sui-zklogin:sui-ecosystem-agent"
  "sui-passkey:sui-passkey:sui-ecosystem-agent"
  "sui-oracle:sui-oracle:sui-ecosystem-agent"
  "sui-deepbook:sui-deepbook:sui-ecosystem-agent"
  "sui-nft-protocol:sui-nft-protocol:sui-ecosystem-agent"
  "sui-multisig:sui-multisig:sui-ecosystem-agent"
  "sui-move-ts-bridge:sui-move-ts-bridge:sui-ecosystem-agent"
)

for entry in "${subagents[@]}"; do
  IFS=':' read -r subagent_id skill parent_agent <<< "$entry"

  cat > "${subagent_id}-subagent.json" <<EOF
{
  "agent_id": "${subagent_id}-subagent",
  "name": "$(echo $subagent_id | awk -F- '{for(i=1;i<=NF;i++)$i=toupper(substr($i,1,1)) substr($i,2)}1' OFS=' ') Subagent",
  "version": "1.0.0",
  "description": "Executes the ${skill} skill.",
  "capabilities": [
    "skill_execution",
    "progress_reporting",
    "state_updates"
  ],
  "skill": "${skill}",
  "reports_to": [
    "${parent_agent}"
  ],
  "prompt_template": "Execute the ${skill} skill following its instructions exactly. Report progress to ${parent_agent}. Update state file after completion."
}
EOF

  echo "✅ Generated ${subagent_id}-subagent.json"
done

echo ""
echo "All 18 subagent definitions generated!"
