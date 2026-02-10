---
name: deploy
description: Interactive deployment with pre-deploy checks and network selection
---

# Deploy Move Package

When invoked, follow these steps:

1. **Network selection**:
   - Ask: devnet / testnet / mainnet
   - Confirm active address: `sui client active-address`
   - Check balance: `sui client gas`
   - Warn if mainnet and balance < threshold

2. **Pre-deploy checks**:
   - Run `sui move build --skip-fetch-latest-git-deps`
   - Run `sui move test --skip-fetch-latest-git-deps`
   - Run basic security scan (call `/sui-dev-agents:audit` internally)
   - Verify no critical issues found

3. **Review deployment details**:
   - Package name and version
   - Modules to be published
   - Estimated gas cost
   - Network and sender address
   - Ask for confirmation

4. **Execute deployment**:
   ```bash
   sui client publish --gas-budget <amount> --skip-fetch-latest-git-deps
   ```

5. **Parse deployment result**:
   - Package ID
   - Published modules
   - Created objects (UpgradeCap, Publisher, etc.)
   - Transaction digest
   - Gas used vs budgeted

6. **Save deployment info**:
   - Create `deployments/<network>-<timestamp>.json`:
     ```json
     {
       "network": "devnet",
       "packageId": "0x...",
       "modules": [...],
       "upgradeCap": "0x...",
       "publisher": "0x...",
       "digest": "...",
       "timestamp": "...",
       "deployer": "0x..."
     }
     ```

7. **Post-deployment**:
   - Generate explorer links (Suiscan/Suivision)
   - Suggest verification steps
   - Remind to save UpgradeCap object ID
   - Update documentation with package ID

8. **Output**:
   - Deployment summary
   - Important object IDs
   - Next steps (verify on explorer, test interactions)
