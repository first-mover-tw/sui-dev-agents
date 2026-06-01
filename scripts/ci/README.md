# CI checks

Every push / PR to `main` runs `.github/workflows/validate.yml`, which has three jobs. All must pass before merge.

| Job | Script | What it enforces |
|-----|--------|------------------|
| `validate` | `validate-plugin.sh` + `check-skill-consistency.sh` | Plugin structure is well-formed; no banned/stale `@mysten/*` imports across skills |
| `type-check-snippets` | `check-snippets.sh` + `snippets/check-skip-imports.mjs` | Every fenced ` ```ts ` block in a skill type-checks against the pinned SDKs; `@check:skip` blocks can't hide hallucinated `@mysten/*` imports |
| `check-compat-matrix` | `check-compat-matrix.sh` | The SDK version banner ↔ compat matrix ↔ `snippets/package.json` stay in sync (3-way drift detection) |

Run any of them locally before pushing:

```bash
bash scripts/ci/check-snippets.sh
node --test scripts/ci/tests/check-skip-imports.test.mjs
bash scripts/ci/check-compat-matrix.sh
```

## Snippet type-check

`snippets/extract.mjs` pulls every ` ```ts ` / ` ```typescript ` / ` ```tsx ` fence out of `skills/**/SKILL.md` (and other docs), writes each to a temp file, and runs `tsc --noEmit` against the SDK versions pinned in `snippets/package.json`. Move and bash fences are never type-checked.

`check-snippets.sh` diffs actual failures against `snippets/known-failures.txt` (a frozen baseline of fragment-continuation blocks like tutorial steps that reference `client` declared in an earlier block). It **fails only on new failures**, warns on stale baseline entries. Don't pad the baseline to silence a *real* error.

### `@check:skip`

If the **first non-blank line** of a fenced block is `// @check:skip`, the block is renamed `.skip` and `tsc` ignores it. Reserve it for genuinely intentional-wrong code:

- contrast / "don't do this" examples
- API-surface overviews with `...` placeholders
- fragments that import legit but **uninstalled** third-party packages

After adding `// @check:skip`, re-run `check-snippets.sh` — inserting a line shifts `L<n>` for every downstream block in the same file, which can re-surface a line-shifted regression.

### skip-import gate (`check-skip-imports.mjs`)

`@check:skip` would otherwise be a blind spot: a fabricated `@mysten/*` import (wrong package, wrong subpath, non-existent named export) hides there silently. This gate re-checks **only the `@mysten/*` import lines** of every skip block and fails on TS2307 / TS2305 / TS2724.

Scope is `@mysten/*` **on purpose** — those are the only SDKs installed in the snippet env, so they're the only imports that can be resolution-checked with zero false positives. Broadening to all bare specifiers would raise TS2307 on real-but-uninstalled packages.

**Exemption for deliberately-wrong imports:** put a marker in the import statement's **trailing comment** — `// wrong: ...`, `// deprecated`, `// incorrect`, or `❌`:

```ts
// @check:skip
import { Foo } from '@mysten/sui.js'; // wrong: renamed to @mysten/sui
```

The marker is honored only in the trailing comment tail — never in the import code itself — so a `//wrong` substring inside a URL string literal or a stray `❌` can't silently exempt a real fabrication. Markers are deliberate words only; incidental `old`/`legacy` in a benign comment won't exempt anything.

## compat-matrix

See `skills/sui-compat-matrix/` for the SOP. `check-compat-matrix.sh` enforces that the per-skill `Targets: @mysten/X x.y.z` banner, the matrix rows in `references/sdk-compat-matrix.md`, and the installed versions in `snippets/package.json` agree. `compat-scope.txt` is the skill allowlist.

All scripts are pure Node 20 stdlib / bash — no `npm install` for the checks themselves (only `snippets/` installs the SDKs being type-checked against).
