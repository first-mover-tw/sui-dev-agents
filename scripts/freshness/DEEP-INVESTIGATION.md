# SUI Freshness — Deep Investigation Runbook (Layer 2)

Triggered when `tasks/.sui-freshness-pending` exists. Run this in-session (proactively, first turn). Web flow per `~/.claude/rules/general/workflow.md`: gemini → codex → integrate (built-in WebSearch/WebFetch stay disabled).

## Steps

1. Read `tasks/.sui-freshness-pending` for the `changed[]` list (id, old→new).
2. For EACH changed source, run:
   - `gemini --skip-trust -p "What changed in <source/repo> between <old> and <new>? Focus on developer-facing API/SDK/CLI/protocol changes."`
   - `codex exec "Verify and condense the following gemini output about <source>. Flag anything unverifiable. <paste gemini text>"`
   - If codex quota is blown → Agent tool `general-purpose` subagent (fresh context), gemini text + verify instruction attached.
3. **Toolchain check:** run `suiup show` (do NOT assume column format — read actual output). Compare installed sui/walrus/etc vs the new markers. List lagging tools + exact `suiup update` / `suiup install <tool>@<network>` commands. If `suiup` not installed, note it.
4. **Impact mapping:** for each verified change, grep the skills tree for affected `SKILL.md` / `references/*` / `skills/sui-compat-matrix/references/sdk-compat-matrix.md` rows / `scripts/ci/snippets/package.json` pins. List candidate edit points. DO NOT edit.
5. **Write report** `tasks/sui-freshness-YYYY-MM-DD.md`: per-source verified change, toolchain actions, candidate skill edits, and a "needs source-verbatim re-verification before integration" caveat (per lessons: docs lie, verify vs .d.mts/source).
6. **Summarize** to the user: N updates, affected skills, toolchain action. Then STOP — ask which items to integrate.
7. Integration is human-gated: Plan-track items → brainstorm→plan; trivial → fast-track. Always dual-review. ONLY after integration lands: advance cache markers (copy `new` values into `tasks/.sui-freshness-cache.json` `markers`) and `rm tasks/.sui-freshness-pending`.

## Safety (per tasks/lessons.md)
- README/docs lie → verify every symbol/signature vs installed `.d.mts`/source before it enters a skill.
- Reviewer/subagent claims are trust-but-verify; same wrong claim 2× → stop trusting it.
- Adding a skill with an `@mysten/*` pin → sync 4 registration points (banner / compat-scope.txt / matrix row / snippets package.json).
- A drift marker is NOT "handled" until the change is integrated (or explicitly dismissed). Don't advance markers just because you looked.
