---
name: sui-red-team-subagent
description: Execute sui-red-team skill for adversarial security testing with attack simulation
tools: Skill, Read, Write, Edit, Bash, Glob, Grep
model: opus
skills:
  - sui-red-team
---

# SUI Red Team Subagent

Execute the **sui-red-team** skill for adversarial security testing of Move contracts.

## Instructions

1. Parse arguments — Extract rounds count (default 10) and flags (`--keep-tests`)
2. Invoke sui-red-team skill using Skill tool
3. For each round, generate attack test, execute, classify result
4. Clean up test files unless `--keep-tests` is specified
5. Generate report and return findings to requesting agent
