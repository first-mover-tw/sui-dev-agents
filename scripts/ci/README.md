# CI checks

Every push / PR to `main` runs `.github/workflows/validate.yml`, which has five jobs. All must pass before merge.

| Job | Script | What it enforces |
|-----|--------|------------------|
| `validate` | `validate-plugin.sh` + `check-skill-consistency.sh` | Plugin structure is well-formed; no banned/stale `@mysten/*` imports across skills |
| `type-check-snippets` | `check-snippets.sh` + `snippets/check-skip-imports.mjs` | Every fenced ` ```ts ` block in a skill type-checks against the pinned SDKs; `@check:skip` blocks can't hide hallucinated `@mysten/*` imports |
| `check-compat-matrix` | `check-compat-matrix.sh` | The SDK version banner ↔ compat matrix ↔ `snippets/package.json` stay in sync (3-way drift detection) |
| `check-move-symbols` | `check-move-symbols.sh` | Every fenced ` ```move ` block only names Move framework modules/members that exist in the pinned `sui`/`std`/`sui_system` release |
| `check-move-build` | `check-move-build.sh` | Every ` ```move ` block that declares a `module` compiles with the real Move compiler at the pinned `sui` version |

Run any of them locally before pushing:

```bash
bash scripts/ci/check-snippets.sh
node --test scripts/ci/tests/check-skip-imports.test.mjs
bash scripts/ci/check-compat-matrix.sh
bash scripts/ci/check-move-symbols.sh
node --test scripts/ci/tests/check-move-symbols.test.mjs
bash scripts/ci/check-move-build.sh          # needs the pinned `sui` on PATH
node --test scripts/ci/tests/check-move-build.test.mjs
```

## Snippet type-check

`snippets/extract.mjs` pulls every ` ```ts ` / ` ```typescript ` / ` ```tsx ` fence out of `skills/**/SKILL.md` and `skills/*/references/*.md`, writes each to a temp file, and runs `tsc --noEmit` against the SDK versions pinned in `snippets/package.json`. Bash fences are never checked; Move fences have their own gate (see below).

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

## Move symbol check

The TS gate has no counterpart for Move, so `sui::coin::mint_fake(...)` in a ` ```move ` fence
used to ship unchallenged. `check-move-symbols.sh` resolves every framework reference in every
` ```move ` block under `skills/` and `rules/` against `move-symbols/index.json` — a vendored
symbol table built from the `move-stdlib`, `sui-framework` and `sui-system` packages of a real
`sui` release.

**What it checks** (only what the environment can mechanically resolve):

1. `use std|sui|sui_system::<module>` — the module exists.
2. Members named in a `use` — `use sui::coin::{Self, Coin, TreasuryCap};` — exist.
3. `<alias>::<member>`, where `<alias>` comes from the block's own `use` lines, from Sui's
   implicit aliases (`object`, `transfer`, `tx_context`, `option`, `vector`), or from an
   unambiguous bare framework module name.
4. Fully qualified `std|sui|sui_system::<module>::<member>`.

**What it does not check**, because each would be a false-positive source: anything under an
address the index doesn't carry (`marketplace::`, `nft::`, and `deepbook::` — which in these
skills means the DeepBook **v3** app package, not the framework's DeepBook v2 at `0xdee9`);
visibility, since `public(package)` members legitimately appear in teaching fragments; types,
arities or borrow semantics, which need a compiler rather than an index; and **Move 2024 method
syntax** (`payment.value()`, `pool.reserve.join(b)`), which needs type inference to resolve a
receiver. That last one is the largest unchecked surface — roughly 70 call sites in the current
corpus — and because method syntax is the dominant idiom in these skills, a green run says much
less about a block written that way than about one calling `module::function(...)`.

Fences are tracked as a stack, so a ` ```move ` block **nested inside** a ` ````markdown `
wrapper — the architect skill shows what a generated architecture document looks like — is still
real Move and is still checked. An earlier version skipped nested blocks as "example text"; that
put 10 blocks out of reach — worth fixing on principle rather than for volume, since between them
they carry only 3 framework references (`coin::value`, `option::is_some`, `option::borrow`), all
of which resolve elsewhere too, so distinct resolved symbols are 77 either way. The stronger
reason is the second one: blocks lost to a *misparse* were reported under the same "deliberately
skipped" label, so a real hole was indistinguishable from a documented exclusion. Deliberately-wrong snippets use
` // @check:skip `, which is what that marker is for. Inside a fence, only a ` ```move ` opener
starts a nested block — a bare ` ``` ` that is not a valid closer is literal content, per
CommonMark.

An unclosed fence of **any** language is a structural error, not just an unclosed ` ```move `
one: a dangling ` ```text ` swallows every Move block after it.

Scope is `skills/` and `rules/` — the shipped plugin content. `docs/` is excluded deliberately,
not for lack of Move: three historical plan documents under `docs/superpowers/plans/` carry 17
` ```move ` fences between them, but they record what was done at the time rather than content
the plugin serves. (The TS gate's reach differs again — it reads `skills/**` only, not `rules/`.)

Rules 1, 2 and 4 name an address explicitly and cannot misfire. Rule 3's bare-name fallback is
the one judgement call: a fragment calling a *user* module named after a framework module
(`vec_map::my_helper`) with no in-block `use` gets reported, wrongly. `UNBOUND_DENY` holds the
names where that looked likely enough to matter — `sui`, `std` and `sui_system` because they are
addresses as well as module names (`use sui::coin;` otherwise reads as "member `coin` of
`sui::sui`" — that fired nine false findings on the real corpus before `use` spans were excluded
from the bare-name scan, and the entries still cover any `sui::x` outside a `use`), and `token`/`config`/`internal`/
`math`/`types`/`package` as plausible app module names, `token` because skills write
`use token::deep;` for DeepBook's DEEP package. For any other collision the remedy is to add the
real `use` line to the block, or `// @check:skip`. Names that exist under two addresses
(`std::bcs` / `sui::bcs`) need no entry: duplicates are dropped structurally.

Two corpus floors keep the gate from passing by checking nothing: at least 70 distinct framework
symbols must resolve, and each scan directory must yield a minimum number of blocks (`skills` 95,
`rules` 30). The symbol floor alone is not enough — dropping `rules/` entirely still leaves 72
symbols. **On this repo the floors are constants**: `--no-floors`, `--min-resolved` and the
`--min-blocks-*` flags are affordances for the self-tests' fixture trees and are ignored when the
scanned root resolves to this repository (symlinks included), because a guard its own CI can be
told to switch off is not a guard. Every run prints whether floors were enforced. A malformed block (unterminated string or block comment, unclosed fence) is reported
rather than silently skipped, since either one blanks the rest of the block from the scanner.

`// @check:skip` works as it does in the TS gate — with the same caveat: the **body** is
exempt, but `use` paths are still resolved, so a fabricated framework API cannot hide behind
the marker.

### Regenerating the index

The index is stamped with the release it was built from, and the gate fails when that stamp
stops matching the `mainnet vX.Y.Z` version declared in the repo `README.md`. That is what keeps
it from becoming a watcher that is green because it stopped watching — a version bump forces a
regen.

```bash
git clone --filter=blob:none --no-checkout --depth 1 \
  --branch mainnet-v1.78.1 https://github.com/MystenLabs/sui.git /tmp/sui-fw
cd /tmp/sui-fw && git sparse-checkout set --cone crates/sui-framework/packages && git checkout
node scripts/ci/move-symbols/build-index.mjs --src /tmp/sui-fw
```

`known-failures.txt` holds `<md path> <symbol>` pairs that already fail; only new pairs break
the build. It is empty — the corpus was clean at `mainnet-v1.78.1` — and padding it to silence
a real fabrication defeats the gate.

## Move build check

The symbol gate answers "does `sui::coin::split` exist?". It cannot answer "does this block
compile?" — arities, types, ability constraints and unconsumed values all need a compiler.
`check-move-build.sh` runs one: every ` ```move ` block under `skills/` and `rules/` that
declares a `module` is written into a throwaway package and built with `sui move build`.

**Selection.** A block is compiled iff, after comments and string literals are blanked out, it
declares `module <addr>::<name>` (`;` or `{ … }` form). The other ~126 blocks in the corpus are
fragments — a PTB call, a struct definition, a function body — and a compiler failure on those
says nothing about the docs. Named addresses come from the block itself (`module example::admin`
→ `example = "0x0"`), so a block may use any address name it likes.

**One package per block, never per file.** `skills/sui-developer/references/reference.md`
declares `example::marketplace` twice, documenting two stages of the same example; grouping them
produces EC02001 (duplicate module), an artefact of the harness rather than a defect.

**Toolchain.** The compiler version is not configured here: it is read from
`move-symbols/index.json`, so this gate and the symbol gate cannot drift onto different framework
revisions. A `sui` on `PATH` at any other version is refused rather than silently trusted (pass
`--allow-version-drift` for a local run where you accept the mismatch), and the framework checkout
must be at the same tag — the compiler and the sources it compiles against are both pinned, or
neither is. The sources are a sparse checkout cached under `~/.cache/sui-dev-agents` (~9 MB);
without it the Move CLI's implicit dependency clones all of MystenLabs/sui into `~/.move`,
~284 MB per revision. Build mode is per block: one carrying `#[test]` / `#[test_only]` builds with `--test` (without
it the compiler excludes the module wholesale and the block passes while checking nothing), and
every other block builds without it (with `--test` the test-only framework surface —
`sui::test_scenario`, `sui::test_utils`, `std::unit_test` — resolves in a production example that
would not compile for the reader).

**Baseline.** `move-build/known-failures.txt` holds `<md path> <addr>::<module>` ids for blocks
that cannot compile standalone, each with the reason it is structural: a continuation of an
earlier block, a placeholder type the reader supplies, or a dependency on a package that is not
the framework (Nautilus's `enclave`, the reader's own package under test). The id is deliberately
not `path:line` — any edit above a baselined block would shift the line and make the entry read as
a new failure *and* a stale line at once. Only new failures break the build; a stale entry (its
block now compiles, or moved, or was deleted) **fails the run on this repo**, because a stale line
printed under a ✅ is a note nobody acts on, and the id it abandons is free for a later block to
inherit.

Two floors keep the gate from being green for the wrong reason: all 16 compile units must be
found (a selection regex that stops matching would otherwise check nothing), and at most 6 may be
baselined. Neither has headroom: slack is exactly what lets a block or two disappear unnoticed. The cap is on exemptions rather than an absolute count of passes on purpose — an
absolute floor holds only while the corpus size is frozen, so adding new passing blocks would buy
room to baseline existing ones. On this repo the floors, the baseline path and the index path are
constants — `--no-floors` and friends work only against a foreign `--root`, and the run says so
when it ignores them.

Unlike the TS and symbol gates, this one has no `// @check:skip`: a Move block either declares a
module (and must compile) or it does not (and is never compiled), so the marker would only be a
way to keep a broken module example. A deliberately-wrong *module* example — if one is ever
needed — goes in the baseline with its reason, and the exemption cap is deliberately tight.

When this gate goes red the fix is in the `.md`, not the baseline. It has already found five real
defects in shipped examples: `use std::string::String` followed by a `string::utf8(...)` call
(the `Self` import missing), the same shape for `sui::clock`, a `package::claim` with no
`use sui::package`, a `String::append` used as if it returned a value, and a `Coin<SUI>` taken by
value and never consumed — plus one block that had been passing without being compiled at all.

## compat-matrix

See `skills/sui-compat-matrix/` for the SOP. `check-compat-matrix.sh` enforces that the per-skill `Targets: @mysten/X x.y.z` banner, the matrix rows in `references/sdk-compat-matrix.md`, and the installed versions in `snippets/package.json` agree. `compat-scope.txt` is the skill allowlist.

All scripts are pure Node 20 stdlib / bash — no `npm install` for the checks themselves (only `snippets/` installs the SDKs being type-checked against).
