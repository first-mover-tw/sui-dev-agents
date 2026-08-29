---
name: upgrade
description: Package upgrade flow with compatibility checks
---

# Package Upgrade

When invoked, follow these steps:

1. **Verify upgrade capability**:
   - Ask for `UpgradeCap` object ID
   - Verify ownership: `sui client object <upgrade-cap-id>`
   - Confirm active address owns the cap
   - Cross-check the original package ID from the cap itself (P135+): `sui::package::original_package_id(&cap)` via dev-inspect — aborts if an upgrade ticket is still outstanding, so it doubles as an "upgrade in progress" check

2. **Compatibility analysis**:
   - Run `sui move build --skip-fetch-latest-git-deps`
   - Compare with deployed package:
     - New public functions: OK
     - Modified function signatures: BREAKING
     - Removed public functions: BREAKING
     - Changed struct fields: BREAKING (with exceptions)

3. **Check upgrade policy**:
   - Read current policy from UpgradeCap
   - Policies: `compatible`, `additive`, `dep_only`
   - Validate changes against policy

4. **Pre-upgrade checks**:
   - Run tests: `sui move test --skip-fetch-latest-git-deps`
   - Run security audit: `/sui-dev-agents:audit`
   - Build successful
   - No critical issues

5. **Review upgrade details**:
   ```
   Upgrade Summary:
   - Current Package: 0xabc...
   - UpgradeCap: 0xdef...
   - Policy: compatible
   - Changes:
     + Added: new_function()
     ~ Modified: existing_function() [compatible]
     - Removed: deprecated_function() [BREAKING]
   ```
   - Ask for confirmation

6. **Execute upgrade**:
   ```bash
   sui client upgrade \
     --upgrade-capability <upgrade-cap-id> \
     --gas-budget <amount> \
     --skip-fetch-latest-git-deps
   ```

7. **Parse upgrade result**:
   - New package ID
   - Updated UpgradeCap object
   - Transaction digest
   - Gas used

8. **Post-upgrade**:
   - Save upgrade record to `deployments/upgrades.json`:
     ```json
     {
       "timestamp": "...",
       "originalPackage": "0x...",
       "fromPackage": "0xabc...",
       "toPackage": "0xdef...",
       "upgradeCap": "0x...",
       "digest": "...",
       "changes": [...]
     }
     ```
   - Update documentation with new package ID
   - Generate migration guide if needed

9. **Output**:
   - Upgrade summary
   - Explorer links
   - Migration notes for users
   - Deprecated features list
