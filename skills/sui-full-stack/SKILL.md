---
name: sui-full-stack
description: Use when starting full-stack SUI projects requiring end-to-end orchestration from architecture to deployment. Triggers on new project initialization, complete workflow guidance needs, or multi-phase development tasks.
---

# SUI Full-Stack Development

**Complete end-to-end SUI Move project development workflow.**

## Overview

This is the main orchestrator skill that guides you through the entire SUI development lifecycle:

1. **Phase 0**: Project Initialization & Git Setup
2. **Phase 1**: Architecture Planning (`sui-architect`)
3. **Phase 2**: Smart Contract Development (`sui-developer`)
4. **Phase 3**: Frontend Development (`sui-frontend`) - Optional
5. **Phase 4**: Integration (`sui-fullstack-integration`)
6. **Phase 5**: Testing (`sui-tester`)
7. **Phase 6**: Deployment (`sui-deployer`)
8. **Phase 7**: Documentation Generation - Optional

## Quick Start

```bash
# Start new project
sui-full-stack

# Resume existing project
sui-full-stack --resume

# Skip to specific stage
sui-full-stack --stage testing
```

## Workflow Summary

### Phase 0: Project Initialization

- Collect project name and description
- Set up Git version control (optional GitHub sync)
- Create `.gitignore`, pre-commit hooks via `sui-security-guard`

### Phase 1: Architecture Planning

- Call `sui-architect` for guided Q&A
- Generate specification document and architecture diagrams
- Git checkpoint with architecture commit

### Phase 2: Smart Contract Development

- Call `sui-developer` to generate Move code from spec
- Real-time quality checks (fast/standard/strict modes)
- Auto-generate TypeScript types
- Git checkpoint with contracts commit

### Phase 3: Frontend Development (Optional)

- Call `sui-frontend` to set up React/Next.js/Vue
- Install `@mysten/sui.js`, `@mysten/dapp-kit`
- Wallet integration and API wrappers
- Git checkpoint with frontend commit

### Phase 4: Integration

- Call `sui-fullstack-integration`
- Generate TypeScript types from Move ABI
- Set up event listeners and dev environment

### Phase 5: Testing

- Call `sui-tester` for comprehensive testing
- Move unit/integration tests, frontend tests, E2E tests
- Gas benchmarks
- Auto-fix failing tests (max 5 retries)

### Phase 6: Deployment

- Call `sui-deployer` with network selection
- Devnet (automated), Testnet (confirmation), Mainnet (strict checks)
- Record Package ID, update frontend `.env`
- Git tag for mainnet releases

### Phase 7: Documentation (Optional)

- Generate technical docs, architecture docs, developer guide
- Query latest APIs via `sui-docs-query`

## Git Checkpoints

Each phase includes a Git checkpoint:
1. Run `sui-security-guard` scan
2. Create commit with conventional message
3. Optionally push to GitHub

## References

- **[Phase Details](references/phases.md)** - Complete workflow for each phase
- **[Configuration](references/config.md)** - `.sui-full-stack.json` options and CLI usage
- **[Examples](references/examples.md)** - Complete project walkthroughs

## Integrated Skills

This skill orchestrates:

| Skill | Phase | Purpose |
|-------|-------|---------|
| `sui-security-guard` | All | Security at every checkpoint |
| `sui-docs-query` | All | Latest documentation |
| `sui-architect` | 1 | Architecture planning |
| `sui-developer` | 2 | Move development |
| `sui-frontend` | 3 | Frontend setup |
| `sui-fullstack-integration` | 4 | Type generation |
| `sui-tester` | 5 | Comprehensive testing |
| `sui-deployer` | 6 | Multi-network deployment |
| `sui-tools-guide` | All | Tool selection |

## Common Mistakes

❌ **Skipping phases**
- **Problem:** Missing architecture docs, untested contracts, poor integration
- **Fix:** Follow phases sequentially, each builds on the previous

❌ **Not using Git checkpoints**
- **Problem:** Cannot rollback to working state, lost progress
- **Fix:** Commit after each phase with descriptive messages

❌ **Deploying without comprehensive testing**
- **Problem:** Bugs discovered in production, user funds at risk
- **Fix:** Complete Phase 5 (all test types) before Phase 6 deployment

❌ **Ignoring security-guard warnings**
- **Problem:** Secrets committed to Git, API keys exposed
- **Fix:** Fix all security warnings before committing

❌ **Manual frontend package ID updates**
- **Problem:** Frontend calls wrong package after redeployment
- **Fix:** Automate .env updates in deployment scripts

❌ **Skipping frontend phase for backend-only projects**
- **Problem:** No way to interact with contracts for testing
- **Fix:** Build minimal frontend or admin panel for contract interaction

❌ **Not documenting custom workflows**
- **Problem:** Team members cannot reproduce setup
- **Fix:** Generate docs in Phase 7, include setup instructions

---

**From idea to production-ready SUI dApp - guided every step of the way!**
