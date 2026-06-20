# Phase Details

## Table of Contents

- [Phase 0: Project Initialization](#phase-0-project-initialization)
- [Phase 1: Architecture Planning](#phase-1-architecture-planning)
- [Phase 2: Smart Contract Development](#phase-2-smart-contract-development)
- [Phase 3: Frontend Development (Optional)](#phase-3-frontend-development-optional)
- [Phase 4: Integration](#phase-4-integration)
- [Phase 5: Testing](#phase-5-testing)
- [Phase 6: Deployment](#phase-6-deployment)
- [Phase 7: Documentation (Optional)](#phase-7-documentation-optional)
- [Stage Management](#stage-management)
- [Quality Gates](#quality-gates)
- [Automation Behaviors](#automation-behaviors)

---


Detailed workflow for each development phase.

## Phase 0: Project Initialization

```
🚀 Welcome to SUI Full-Stack Development!

Let's set up your project.

1. Project Information
   - Project name?
   - Project description?

2. Git Version Control
   "Do you want to use Git version control?"
   A) Yes, and sync to GitHub (Recommended)
   B) Yes, local Git only
   C) No

3. [If A or B] Initialize Git
   - Create .gitignore (via sui-security-guard)
   - Install pre-commit hooks
   - Create .env.example

4. [If A] GitHub Setup
   "How do you want to set up GitHub?"
   A) Use existing repo (provide URL)
   B) Create new repo (using gh CLI)

5. Security Setup
   ✅ .gitignore created
   ✅ .env in ignore list
   ✅ Pre-commit hooks installed
   ✅ README.md generated
```

**Implementation:**

```typescript
// @check:skip
async function initializeProject() {
  // Get project info
  const projectName = await askUser("Project name?");
  const projectDesc = await askUser("Project description?");

  // Git setup
  const gitChoice = await askUser(
    "Use Git version control?",
    ["Yes, with GitHub", "Yes, local only", "No"]
  );

  if (gitChoice !== "No") {
    // Initialize Git
    await Bash({ command: "git init" });

    // Generate .gitignore via sui-security-guard
    await sui_security_guard.generateGitignore();

    // Install hooks
    await sui_security_guard.installGitHooks();

    // Create .env.example
    await sui_security_guard.createEnvExample();
  }

  if (gitChoice === "Yes, with GitHub") {
    // GitHub setup
    const repoChoice = await askUser(
      "GitHub repo setup?",
      ["Use existing repo", "Create new repo"]
    );

    if (repoChoice === "Create new repo") {
      await Bash({
        command: `gh repo create ${projectName} --public --source=. --remote=origin`
      });
    } else {
      const repoUrl = await askUser("GitHub repo URL?");
      await Bash({ command: `git remote add origin ${repoUrl}` });
    }

    // Initial commit
    await Bash({ command: "git add ." });
    await Bash({ command: `git commit -m "chore: Initial project setup"` });
    await Bash({ command: "git push -u origin main" });
  }

  // Save project state
  saveProjectState({
    name: projectName,
    description: projectDesc,
    currentStage: "initialized",
    gitEnabled: gitChoice !== "No",
    githubEnabled: gitChoice === "Yes, with GitHub"
  });

  console.log("✅ Project initialized!");
}
```

---

## Phase 1: Architecture Planning

```
"Do you want to plan the architecture now?"
  A) Yes, start planning
  B) Skip (I have existing code)

[If Yes] → Call sui-architect

sui-architect will:
  1. Ask project type (NFT, DeFi, GameFi, etc.)
  2. Provide template
  3. Ask detailed questions
  4. Suggest SUI tools integration
  5. Generate specification document

Output:
  - docs/specs/YYYY-MM-DD-{project}-spec.md
  - docs/architecture/*.mmd
  - docs/security/threat-model.md
```

**Git Checkpoint:**

```
✅ Architecture Planning Complete!

Changes:
  + docs/specs/2024-01-28-nft-marketplace-spec.md
  + docs/architecture/module-dependency.mmd
  + README.md

"Commit these changes to Git?"
  A) Yes - Commit and push to GitHub
  B) Commit locally only
  C) Skip

[If A or B] → Run sui-security-guard scan
[If passed] → Create commit with message:
  "feat: Add project architecture and specification

  - Generated project spec for {project}
  - Defined module structure
  - Integrated {tools}
  - Created architecture diagrams"

[If A] → Push to GitHub
```

---

## Phase 2: Smart Contract Development

```
"Ready to start Move development?"

→ Call sui-developer

sui-developer will:
  1. Generate code from spec
  2. Provide development environment
  3. Real-time quality checks (Fast mode during dev)
  4. Auto-generate TypeScript types
```

**Development Loop:**

```
While developing:
  1. Write Move code
  2. Auto-check (Fast mode) on save
  3. Developer can manually run:
     - sui-developer check --mode standard
     - sui-developer check --mode strict

When feature complete:
  → Run Standard mode checks
  → Fix any issues
```

**Git Checkpoint:**

```
✅ Smart Contract Development Complete!

Changes:
  + sources/*.move
  + tests/*.move
  + Move.toml

"Commit Move contracts to Git?"
  A) Yes - Commit and push
  B) Commit locally
  C) Skip

[If A or B] → Run sui-security-guard scan
[If passed] → Commit with message:
  "feat: Implement Move contracts

  - Add {modules}
  - Implement {features}
  - Add comprehensive tests"
```

---

## Phase 3: Frontend Development (Optional)

```
"Do you need a frontend?"
  A) Yes, build frontend
  B) No, contracts only

[If Yes] → Call sui-frontend

sui-frontend will:
  1. Set up React/Next.js/Vue project
  2. Install @mysten/dapp-kit-react @mysten/dapp-kit-core @mysten/sui @tanstack/react-query
     (legacy @mysten/dapp-kit is deprecated; hooks/providers come from
     @mysten/dapp-kit-react, UI components like ConnectButton from
     @mysten/dapp-kit-react/ui)
  3. Generate config files
  4. Create wallet integration
  5. Set up API wrappers
```

**Git Checkpoint:**

```
✅ Frontend Development Complete!

Changes:
  + frontend/
  + frontend/.env.example
  ~ .gitignore (updated)

"Commit frontend to Git?"
```

---

## Phase 4: Integration

```
"Ready to integrate frontend and contracts?"

→ Call sui-move-ts-bridge

This will:
  1. Generate TypeScript types from Move ABI
  2. Create type-safe API wrappers
  3. Set up event listeners
  4. Configure dev environment (local node + hot reload)
```

---

## Phase 5: Testing

```
"Ready to run comprehensive tests?"

→ Call sui-tester

Test execution:
  1. Move unit tests
  2. Move integration tests
  3. Frontend unit tests
  4. Frontend integration tests
  5. E2E tests
  6. Gas benchmarks

If tests fail:
  → Analyze errors
  → Fix issues (call sui-developer or sui-frontend)
  → Re-run tests
  → Repeat up to 5 times (auto_verify from CLAUDE.md)

All tests passed ✅
```

**Git Checkpoint:**

```
✅ Testing Complete!

Changes:
  + tests/
  + e2e/
  + gas_report.md

"Commit tests to Git?"
```

---

## Phase 6: Deployment

```
"Ready to deploy?"

"Deploy to which network?"
  A) Devnet (automated)
  B) Testnet (confirmation required)
  C) Mainnet (strict checks)

→ Call sui-deployer with selected network

Deployment process varies by network:
  - Devnet: Fully automated
  - Testnet: Security check → Ask confirmation → Deploy
  - Mainnet: Full checklist → Confirmation code → Deploy

After deployment:
  1. Package ID recorded
  2. Frontend .env updated
  3. Deployment documented
```

**Git Checkpoint:**

```
✅ Deployment to {network} Complete!

Package ID: 0x...

Changes:
  + deployments/{network}/timestamp.json
  ~ frontend/.env.example

"Commit deployment record?"
  A) Yes - Commit and push
  B) Commit locally
  C) Skip

[If Mainnet + A] → Also create Git tag:
  git tag v1.0.0-mainnet
  git push origin v1.0.0-mainnet
```

---

## Phase 7: Documentation (Optional)

```
"Generate complete project documentation?"
  A) Yes, generate all docs
  B) Skip

[If Yes] Generate:
  - Technical docs (API reference from Move)
  - Architecture docs (system design)
  - Developer guide (how to use/integrate)
  - Security docs (audit report)
  - README.md (project overview)

All docs reference latest APIs via sui-docs-query
```

---

## Stage Management

**Project State File:**

```json
// .sui-skills/project-state.json
{
  "project_name": "nft-marketplace",
  "current_stage": "testing",
  "completed_stages": ["architect", "develop", "frontend", "integration"],
  "spec_file": "docs/specs/2024-01-28-nft-marketplace-spec.md",
  "git_enabled": true,
  "github_repo": "https://github.com/user/nft-marketplace",
  "deployed_networks": {
    "devnet": "0x...",
    "testnet": "0x..."
  },
  "last_updated": "2024-01-28T10:30:00Z"
}
```

**Resume from Saved State:**

```
"Continue previous project?"

→ Load project-state.json
→ Show progress:
  ✅ Architecture
  ✅ Development
  ✅ Frontend
  ⏳ Testing (in progress)
  ⏸️  Deployment
  ⏸️  Documentation

"Resume from Testing stage?"
```

---

## Quality Gates

**Automatic checks before stage transition:**

```typescript
const QUALITY_GATES = {
  'architect → develop': [
    'Specification file exists',
    'User confirmed architecture'
  ],
  'develop → frontend': [
    'Code compiles',
    'No critical security issues (Standard mode)'
  ],
  'frontend → testing': [
    'Frontend builds successfully',
    'No TypeScript errors'
  ],
  'testing → deploy': [
    'All tests passing',
    'Gas within acceptable range',
    'Strict mode quality checks passed'
  ]
};
```

---

## Automation Behaviors

**auto_verify:**
```
After code modification → Auto run tests
If failed → Auto fix and retest (max 5 times)
```

**auto_quality_suggest:**
```
After major changes:
  "Want to run code review?" (don't auto-execute)
  "Want to take screenshot?" (for UI changes)
```

**error_recovery:**
```
API error → Auto retry max 5 times with exponential backoff
```

**context_limit:**
```
When approaching token limit:
  "Want to summarize progress and continue?"
```
