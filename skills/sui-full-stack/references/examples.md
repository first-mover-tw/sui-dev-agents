# Usage Examples

## Example 1: Complete New Project

```
User: "I want to build an NFT marketplace"

sui-full-stack:
  → Phase 0: Initialize project with Git + GitHub
  → Phase 1: Call sui-architect
       - Guide through architecture planning
       - Recommend: Kiosk, Walrus, zkLogin
       - Generate spec
       - Git commit
  → Phase 2: Call sui-developer
       - Generate Move contracts
       - Develop marketplace logic
       - Git commit
  → Phase 3: Call sui-frontend
       - Setup React + TypeScript
       - Wallet integration
       - Git commit
  → Phase 4: Call sui-fullstack-integration
       - Generate types
       - Create API wrappers
  → Phase 5: Call sui-tester
       - Run all tests
       - Auto-fix if failures (max 5 times)
       - Git commit
  → Phase 6: Call sui-deployer
       - Deploy to devnet (auto)
       - Git commit deployment
  → Phase 7: Generate docs

✅ Complete NFT marketplace ready!
```

---

## Example 2: Existing Project - Add Feature

```
User: "Add zkLogin to existing project"

sui-full-stack:
  → Load project state
  → Call sui-architect (update spec)
  → Call sui-zklogin (integration guide)
  → Call sui-developer (modify contracts)
  → Call sui-frontend (add auth UI)
  → Call sui-tester (regression tests + new tests)
  → Call sui-deployer (upgrade deployment)
```

---

## Example 3: DeFi AMM Project

```
User: "Build a DeFi AMM with DeepBook integration"

sui-full-stack:
  → Phase 0: Initialize with Git
  → Phase 1: sui-architect
       - Recommend: DeepBook, Nautilus
       - Generate AMM spec with trading pairs
  → Phase 2: sui-developer
       - Implement liquidity pool contracts
       - Swap logic with fee calculation
  → Phase 3: sui-frontend
       - Trading interface
       - Liquidity provider dashboard
  → Phase 4-7: Integration, Testing, Deployment

✅ Complete DeFi AMM ready!
```

---

## Example 4: GameFi Project

```
User: "Build an on-chain game with NFT characters"

sui-full-stack:
  → Phase 0: Initialize
  → Phase 1: sui-architect
       - Recommend: Kiosk (NFT trading), Walrus (assets)
       - Game mechanics spec
  → Phase 2: sui-developer
       - Character NFT contracts
       - Battle/quest logic
       - Reward system
  → Phase 3: sui-frontend
       - Game UI with React
       - NFT gallery
  → Phase 4-7: Complete workflow

✅ Complete GameFi dApp ready!
```

---

## Example 5: Contracts Only (No Frontend)

```
User: "Build a staking contract, no frontend needed"

sui-full-stack:
  → Phase 0: Initialize
  → Phase 1: sui-architect (staking spec)
  → Phase 2: sui-developer (staking contracts)
  → Phase 3: SKIP (user selected "No frontend")
  → Phase 4: SKIP
  → Phase 5: sui-tester (Move tests only)
  → Phase 6: sui-deployer

✅ Staking contracts deployed!
```
