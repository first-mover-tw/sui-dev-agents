# SUI Deployer Reference

## Upgrade Compatibility Rules

When upgrading a published package, SUI enforces compatibility based on the UpgradeCap's policy:

| Policy | Value | Allows |
|--------|-------|--------|
| `compatible` | 0 | Add new functions/modules, add new struct abilities. Cannot remove/change existing public signatures. |
| `additive` | 128 | Only add new modules. Cannot change existing modules at all. |
| `dep_only` | 192 | Only change dependencies. Cannot change any module code. |
| `immutable` | — | No upgrades possible (UpgradeCap destroyed). |

```bash
# Check current policy
sui client object <UPGRADE_CAP_ID> --json | jq '.content.fields.policy'

# Make package immutable (irreversible!)
sui client call --package 0x2 --module package --function make_immutable \
  --args <UPGRADE_CAP_ID> --gas-budget 10000000
```

## Gas Budget Guidelines

| Operation | Typical Gas Budget |
|-----------|-------------------|
| Simple module publish | 100,000,000 |
| Multi-module package | 200,000,000 |
| Complex package (10+ modules) | 500,000,000 |
| Upgrade | 200,000,000 |

Always dry-run first: `sui client publish --dry-run --gas-budget <BUDGET>`

## Multisig UpgradeCap Transfer

```bash
# Transfer UpgradeCap to multisig address
sui client transfer --to <MULTISIG_ADDRESS> --object-id <UPGRADE_CAP_ID> --gas-budget 10000000
```
