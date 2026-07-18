---
name: sui-compat-matrix
description: Use when bumping any @mysten/* SDK version, adding a new SDK-using skill, or diagnosing version-drift errors across the plugin. Defines the canonical compat matrix, banner spec, and SDK-bump audit SOP. Triggers on "@mysten upgrade", "SDK bump", "version drift", "banner format", "compat matrix".
---

# SUI Compat Matrix

This skill defines the single source-of-truth for `@mysten/*` SDK versions across the plugin and the SOP for upgrading them safely.

## Quick map

- `references/sdk-compat-matrix.md` — canonical table (one row per skill × package)
- `scripts/ci/compat-scope.txt` — allowlist of skills that must carry a banner
- `scripts/ci/check-compat-matrix.mjs` — CI verifier (banner ↔ matrix ↔ snippets/package.json)
- `scripts/ci/snippets/package.json` — the actually-installed versions used by `check-snippets.sh`

## Banner spec

Every in-scope skill must have, in the first 30 lines of `SKILL.md`, a single line of the form:

` ``Targets: `@mysten/<pkg>` <X.Y.Z> (<range>)[, ...]. Tested: YYYY-MM-DD.`` `

Rules:
- `<X.Y.Z>` = exact semver; must equal the version in `scripts/ci/snippets/package.json` for `primary` kind
- `<range>` = `^X[.Y[.Z]]` or `~X[.Y[.Z]]`
- No trailing prose on the line. Anything else CI rejects.

Immediately below, an optional `**Compatibility notes:**` paragraph holds peer / sub-export / deprecation / known-incompat prose. CI does not parse this section, so it can hold any warning the agent needs.

## Matrix columns

| Skill | Package | Kind | Tested | Accepted | Last verified | Notes-tag |

- `Skill` = canonical path `skills/<dir>/SKILL.md`
- `Kind ∈ {primary, peer, sub-export, deprecated}` — only `primary` must appear in `snippets/package.json`
- `Notes-tag` = `[a-z0-9:-]{1,20}`, em-dash `—` for none (no pipes, backticks, links — long notes go in the skill's Compatibility notes prose)

## SOP: upgrade `@mysten/X` from A.B.C → A.B.D

1. **Latest version**: `npm view @mysten/X version --json` (skip prereleases unless explicit)
2. **Diff `.d.mts`**:
   ```bash
   cd /tmp && rm -rf old new && mkdir old new
   npm pack @mysten/X@A.B.C @mysten/X@A.B.D
   tar -xzf mysten-X-A.B.C.tgz -C old/
   tar -xzf mysten-X-A.B.D.tgz -C new/
   diff -r old/package/dist new/package/dist | grep -E '\.d\.mts'
   ```
   Look for: (a) added/removed exports, (b) signature changes, (c) type-union changes (the kiosk-grpc gap was caught this way).
3. **Find affected skills** (in-scope only):
   ```bash
   for d in $(cat scripts/ci/compat-scope.txt); do
     grep -l "@mysten/X" "$d/SKILL.md" 2>/dev/null
   done
   ```
4. **Bump installed version**:
   ```bash
   cd scripts/ci/snippets
   npm install @mysten/X@A.B.D
   npm ls @mysten/sui          # verify no dual install
   git diff package-lock.json  # verify nothing else moved
   ```
5. **Re-run snippet type-check**: `bash scripts/ci/check-snippets.sh` — if new failures, fix the skill's code/prose first, do NOT bump the banner to hide them.
6. **Update banner**: `Tested:` version + date in each affected skill. If breaking changes exist, update the `Compatibility notes:` prose.
7. **Update matrix**: edit the corresponding rows in `references/sdk-compat-matrix.md` (Tested + Last verified).
8. **Update README header**: the alignment line at the top of `README.md` states CLI version / protocol / `@mysten/sui` minor — keep it in sync when those move (not CI-checked; this is the step that gets forgotten).
9. **Verify**: `node scripts/ci/check-compat-matrix.mjs` — must exit 0.
10. Commit.

## Adding a new SDK-using skill

1. Add `skills/<new-name>` to `scripts/ci/compat-scope.txt`
2. Add the SDK to `scripts/ci/snippets/package.json` and `npm install`
3. Add row(s) to `references/sdk-compat-matrix.md`
4. Write the `Targets:` line in the new skill's `SKILL.md`
5. Run `node scripts/ci/check-compat-matrix.mjs` until green
