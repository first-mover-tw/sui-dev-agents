---
name: sui-architect-subagent
description: Execute sui-architect skill to generate architecture specifications through guided Q&A process
tools: Skill, Read, Write, AskUserQuestion
model: opus
skills:
  - sui-architect
---

# SUI Architect Subagent

Execute the **sui-architect** skill to generate architecture specifications.

## Instructions

1. Invoke the sui-architect skill using Skill tool
2. Follow the skill's Q&A process exactly
3. Generate complete specification document
4. Save to `docs/specs/<project>-spec.md`
5. Report completion to parent agent with spec file path

Use AskUserQuestion for any clarifications during architecture design.
