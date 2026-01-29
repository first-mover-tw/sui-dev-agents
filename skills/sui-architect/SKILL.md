---
name: sui-architect
description: Use when planning SUI Move architecture, generating technical specifications, or designing system structure. Triggers on new project setup, architecture design tasks, or spec document creation needs.
---

# SUI Architect

**Transform ideas into complete SUI Move project architectures and specifications.**

## Overview

This skill guides you from a rough idea to a complete, well-documented architecture through:
- Guided questioning (one question at a time)
- Project type templates (DeFi, NFT, GameFi, DAO, etc.)
- Best practice references from similar projects
- SUI ecosystem tool integration suggestions
- Comprehensive specification document generation

## Quick Start

```bash
# Start architecture planning
sui-architect

# Or called by main orchestrator
sui-full-stack  # → Phase 1: Architecture
```

## Core Workflow

### Phase 1: Project Type Identification

Ask user about their project type:
```
What type of project are you building?
  A) DeFi (AMM, Lending, Staking, Derivatives)
  B) NFT (Marketplace, Gaming, Collectibles)
  C) GameFi (On-chain game logic, Asset management)
  D) DAO (Governance, Treasury, Voting)
  E) Infrastructure (Oracle, Bridge, Identity)
  F) Custom (Mixed or innovative type)
```

Then narrow down to specific sub-type based on selection.

### Phase 2: Template Selection

Based on project type, load starter template with:
- Module structure
- Common objects/capabilities
- Recommended SUI tools

Available templates: `nft-marketplace`, `defi-amm`, `gamefi`, `dao`, `infrastructure`

See [templates/](templates/) for all available templates.

### Phase 3: Requirements Exploration

Ask questions one at a time to refine architecture:
- User roles and permissions
- Core features needed
- NFT/token standards (if applicable)
- Payment methods
- Storage strategy (on-chain, Walrus, IPFS)
- Upgradeability requirements
- Emergency controls

**Important:** Ask ONE question at a time, wait for answer, then proceed.

### Phase 4: Ecosystem Tool Integration

Suggest relevant SUI tools based on requirements:
- Storage needed → `sui-walrus`
- Authentication → `sui-zklogin` or `sui-passkey`
- NFT trading → `sui-kiosk`
- DEX integration → `sui-deepbook`
- Name service → `sui-suins`
- Cross-chain → `sui-nautilus`

Query latest integration patterns:
```typescript
const info = await sui_docs_query({
  type: "docs",
  target: "kiosk",
  query: "Transfer policy implementation"
});
```

### Phase 5: Best Practice References

Query similar projects for patterns:
```typescript
const references = await sui_docs_query({
  type: "github",
  target: "sui-core",
  query: "NFT marketplace example Kiosk",
  options: {
    include_examples: true
  }
});
```

### Phase 6: Architecture Design Presentation

Present design in small sections (200-300 words each):
1. System Overview
2. Module Architecture
3. Data Structures
4. Core Functions
5. Permission System (Capabilities)
6. Event System
7. Error Handling
8. Security Considerations
9. Tool Integration Plan
10. Testing Strategy
11. Deployment Plan
12. Gas Optimization

**After each section, ask:** "Does this look good?"

Wait for confirmation before proceeding to next section.

### Phase 7: Specification Document Generation

Generate comprehensive spec at:
```
docs/specs/YYYY-MM-DD-[project-name]-spec.md
docs/architecture/module-dependency.mmd
docs/architecture/data-flow.mmd
docs/security/threat-model.md
README.md
```

See [examples.md](references/examples.md) for complete specification template.

## Output Files

**Main spec:** `docs/specs/YYYY-MM-DD-project-spec.md`

Contains:
- Executive Summary
- Architecture Overview (with diagrams)
- Module Design
- Data Models
- API Specification
- Security Considerations
- Integration Guide (SUI tools)
- Testing Strategy
- Deployment Plan
- Appendix (references, versions)

**Additional files:**
- `docs/architecture/overview.md` - High-level architecture
- `docs/architecture/module-dependency.mmd` - Mermaid dependency diagram
- `docs/architecture/data-flow.mmd` - Data flow diagram
- `docs/security/threat-model.md` - Threat analysis
- `README.md` - Project overview

## Configuration

`.sui-architect.json`:
```json
{
  "output_dir": "docs/specs",
  "templates": {
    "use_builtin": true,
    "custom_path": null
  },
  "validation": {
    "check_similar_projects": true,
    "query_latest_docs": true,
    "max_questions": 20
  },
  "docs": {
    "generate_mermaid": true,
    "generate_api_docs": true,
    "include_security_analysis": true
  }
}
```

**Configuration options:**
- `output_dir` - Where to save spec documents
- `use_builtin` - Use built-in templates (true) or custom
- `check_similar_projects` - Query GitHub for similar implementations
- `query_latest_docs` - Get latest SUI tool documentation
- `max_questions` - Maximum questions to ask (prevents over-questioning)
- `generate_mermaid` - Generate Mermaid diagrams
- `include_security_analysis` - Include security threat model

## Integration

### Called By
- `sui-full-stack` (Phase 1: Architecture planning)

### Calls
- `sui-docs-query` - Query latest SUI tool documentation and GitHub examples

### Next Step
After architecture complete, suggest:
```typescript
console.log("✅ Architecture and specification complete!")
console.log("Next: Ready to start development with sui-developer?")
```

## Best Practices

### Question Design

**Good questions:**
- "What types of listings do you want?" (specific, actionable)
- "How should royalties work?" (clear options)

**Avoid:**
- "Tell me everything about your project" (too broad)
- "Do you want features?" (vague)

### Progressive Disclosure

1. Start broad (project type)
2. Narrow down (specific features)
3. Deep dive (implementation details)

### Validation Points

After each section, check understanding:
- "Does this match your vision?"
- "Need to adjust anything?"

Don't proceed until user confirms.

## Common Mistakes

❌ **Asking too many questions at once**
- **Problem:** User overwhelmed, provides vague answers
- **Fix:** Ask ONE question at a time, wait for answer before proceeding

❌ **Not validating each section before proceeding**
- **Problem:** Architecture doesn't match user's vision, wasted rework
- **Fix:** After each section (Overview, Modules, etc.), ask "Does this look good?"

❌ **Skipping ecosystem tool integration suggestions**
- **Problem:** User reinvents features already available (Walrus, Kiosk, zkLogin)
- **Fix:** Always query and suggest relevant SUI tools during Phase 4

❌ **Generic template without customization**
- **Problem:** Spec doesn't reflect project's unique requirements
- **Fix:** Use template as starting point, customize based on Q&A responses

❌ **Missing security considerations section**
- **Problem:** Security vulnerabilities discovered late in development
- **Fix:** Always include threat model and security analysis in spec

❌ **Not checking similar projects on GitHub**
- **Problem:** Missed proven patterns, reinventing the wheel
- **Fix:** Query GitHub for similar implementations, reference best practices

❌ **Proceeding without clear project type**
- **Problem:** Wrong template selected, misaligned architecture
- **Fix:** Phase 1 must complete successfully before Phase 2 template selection

## See Also

- [reference.md](references/reference.md) - Template library, security considerations, advanced configuration
- [examples.md](references/examples.md) - Complete Q&A walkthrough, full specification example
- [templates/](templates/) - All project templates (NFT, DeFi, GameFi, DAO)

---

**Transform fuzzy ideas into crystal-clear, implementable architectures!**
