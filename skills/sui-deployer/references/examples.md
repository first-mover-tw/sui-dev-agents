# SUI Deployer Examples

## Full Deployment Script

```bash
#!/bin/bash
set -e

NETWORK=${1:-devnet}
echo "Deploying to $NETWORK..."

# Switch network
sui client switch --env "$NETWORK"

# Run tests
echo "Running tests..."
sui move test

# Dry-run
echo "Dry-running publish..."
sui client publish --dry-run --gas-budget 200000000

# Publish
echo "Publishing..."
RESULT=$(sui client publish --gas-budget 200000000 --json)

# Extract IDs
PACKAGE_ID=$(echo "$RESULT" | jq -r '.objectChanges[] | select(.type=="published") | .packageId')
UPGRADE_CAP=$(echo "$RESULT" | jq -r '.objectChanges[] | select(.objectType | contains("UpgradeCap")) | .objectId')

echo "Package ID: $PACKAGE_ID"
echo "UpgradeCap: $UPGRADE_CAP"

# Save artifacts
echo "{\"network\": \"$NETWORK\", \"packageId\": \"$PACKAGE_ID\", \"upgradeCap\": \"$UPGRADE_CAP\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > deployment-$NETWORK.json

echo "Deployed to $NETWORK"
```

## Upgrade Script

```bash
#!/bin/bash
set -e

UPGRADE_CAP=$1
[ -z "$UPGRADE_CAP" ] && echo "Usage: upgrade.sh <UPGRADE_CAP_ID>" && exit 1

sui move test
sui client upgrade --upgrade-capability "$UPGRADE_CAP" --gas-budget 200000000 --json
echo "Upgrade complete"
```
