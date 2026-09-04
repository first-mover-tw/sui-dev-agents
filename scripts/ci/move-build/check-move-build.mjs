#!/usr/bin/env node
// Compile every self-contained ```move block in skills/**/*.md and rules/**/*.md with the real
// Move compiler (`sui move build`), one throwaway package per block.
//
// This is the layer *below* the symbol gate (../move-symbols/check-move-symbols.mjs). That gate
// answers "does `sui::coin::split` exist?"; this one answers "does this block actually compile?"
// — arity, types, ability constraints, unused values without `drop`. The two are complementary
// and deliberately separate: the symbol gate covers all 142 blocks including fragments, this one
// only the 16 that declare a `module`, because a fragment has nothing for the compiler to chew.
//
// Selection: a block is compiled iff, after comments and string literals are blanked out, it
// declares `module <addr>::<name>` (either `;` or `{ … }` form). Everything else is a fragment
// by construction — `sui move build` on it fails for a reason that says nothing about the docs.
//
// One package per block, never one per file: `skills/sui-developer/references/reference.md` has
// two `module example::marketplace;` blocks that document different stages of the same example.
// Grouping them yields EC02001 (duplicate module) — an artefact of the harness, not a defect.
//
// Named addresses come from the block itself (`module example::admin` → `example = "0x0"`).
// A block referencing a *foreign* named address it never declares (nautilus's `enclave::`)
// cannot compile here and belongs in the baseline.
//
// Baseline: known-failures.txt holds `<md path> <addr>::<module>` block ids that already fail.
// The id is deliberately NOT `<path>:<line>`: every edit above a baselined block would shift its
// line and turn the entry into a simultaneous "new failure" and "stale entry" — a baseline that
// rots on unrelated edits is a baseline people rubber-stamp. A file declaring the same module
// twice (reference.md documents `example::marketplace` at two stages) disambiguates with `#2`.
//
// Only NEW failures break the build; entries that stopped failing (or whose block moved or
// vanished) are reported as stale. Do NOT append to it to silence a real defect — the whole
// value of this gate is that EC06001-class errors in shipped examples get caught.

import {
  readFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readdirSync, statSync, writeSync,
} from 'node:fs'
import { join, dirname, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { extractMoveBlocks } from '../move-symbols/lib/extract-blocks.mjs'
import { stripNoise } from '../move-symbols/lib/strip-noise.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

// stderr to a pipe (which is what a CI runner gives you) is asynchronous on POSIX, so
// `console.error(bigReport); process.exit(1)` can truncate the report mid-snippet — the one
// output a red run exists to produce. Every message on an exit path goes through here.
const err = (msg = '') => writeSync(2, msg + '\n')

// `--root` / `--baseline` / `--no-floors` exist so the self-tests can drive the real script over
// a throwaway fixture tree. Production runs pass none of them.
function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  if (i === -1) return fallback
  const v = process.argv[i + 1]
  if (v === undefined || v.startsWith('--')) {
    err(`check-move-build: ${name} needs a value`)
    process.exit(2)
  }
  return v
}

// A floor that parses to NaN compares false against everything — i.e. silently switches the
// guard off — and a value-less flag is exactly the shape of an ordinary typo. Validation runs
// even where the value is later ignored, so a typo is never silently accepted.
function numArg(name, fallback) {
  const raw = arg(name, null)
  if (raw === null) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) {
    err(`check-move-build: ${name} needs a non-negative integer, got ${JSON.stringify(raw)}`)
    process.exit(2)
  }
  return n
}

// A misspelt flag that is silently ignored is the quiet version of a guard being switched off:
// `--min-units=14` and `--minunits 3` both fall through to the default, and the run still says
// "floors enforced". Reject anything not in this list.
const KNOWN_FLAGS = new Set([
  '--root', '--baseline', '--sui', '--framework',
  '--min-units', '--max-baseline', '--no-floors', '--allow-version-drift', '--index',
])
{
  const takesValue = new Set(['--root', '--baseline', '--sui', '--framework', '--min-units', '--max-baseline', '--index'])
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    if (!KNOWN_FLAGS.has(a)) {
      err(`check-move-build: unknown flag ${JSON.stringify(a)}`)
      process.exit(2)
    }
    if (takesValue.has(a)) i++
  }
}

const REPO_ROOT = arg('--root', join(HERE, '..', '..', '..'))
const SCAN_DIRS = ['skills', 'rules']
const SUI_BIN = arg('--sui', process.env.SUI_BIN || 'sui')
// Optional sparse checkout of the framework sources (check-move-build.sh creates it). With it the build
// is hermetic and offline; without it the CLI's implicit dependency clones MystenLabs/sui into
// ~/.move (~284 MB per rev), which is fine locally and wasteful in CI.
const FRAMEWORK = arg('--framework', process.env.MOVE_FRAMEWORK_DIR || '')

// Identity is device + inode, not a resolved path string: macOS ships a case-insensitive
// filesystem where realpathSync does NOT canonicalise case, so a differently-cased spelling of
// this repo's path scans the identical corpus while comparing unequal — floors off.
const SELF_ID = (() => {
  const st = statSync(resolve(join(HERE, '..', '..', '..')))
  return { dev: st.dev, ino: st.ino }
})()
let IS_SELF = false
try {
  const st = statSync(resolve(REPO_ROOT))
  IS_SELF = st.dev === SELF_ID.dev && st.ino === SELF_ID.ino
} catch {
  IS_SELF = false
}

// On this repo the baseline is the version-controlled one, so a run cannot be pointed at a
// permissive substitute. Silently ignoring a flag is its own trap, so say so.
const BASELINE_PATH = IS_SELF ? join(HERE, 'known-failures.txt') : arg('--baseline', join(HERE, 'known-failures.txt'))
if (IS_SELF && process.argv.includes('--baseline')) {
  err('note: --baseline is ignored on this repo; using the committed known-failures.txt')
}

// ---------------------------------------------------------------------------
// Toolchain guard: the compiler must be the version this repo documents, and the vendored
// symbol index must be stamped with it too. A gate that compiles against whatever `sui` happens
// to be on PATH reports on a framework surface nobody here ships — green because it stopped
// watching the thing it was built to watch.
// ---------------------------------------------------------------------------
// `--index` is a test affordance, locked to the committed file on this repo like --baseline:
// the tag drives both the compiler version and the framework sources, so a run against this
// corpus must not be able to point it somewhere permissive.
const INDEX_PATH = IS_SELF
  ? join(HERE, '..', 'move-symbols', 'index.json')
  : arg('--index', join(HERE, '..', 'move-symbols', 'index.json'))
if (IS_SELF && process.argv.includes('--index')) {
  err('note: --index is ignored on this repo; using the committed move-symbols/index.json')
}

function pinnedTag() {
  return JSON.parse(readFileSync(INDEX_PATH, 'utf8')).tag // e.g. mainnet-v1.78.1
}

function suiVersion() {
  const r = spawnSync(SUI_BIN, ['--version'], { encoding: 'utf8' })
  if (r.error || r.status !== 0) {
    err(`\n❌ Cannot run \`${SUI_BIN} --version\`: ${r.error?.message ?? `exit ${r.status}`}`)
    err('  Install the pinned toolchain (suiup install sui@mainnet) or pass --sui <path>.\n')
    process.exit(2)
  }
  const m = (r.stdout + r.stderr).match(/sui (\d+\.\d+\.\d+)/)
  if (!m) {
    err(`\n❌ Could not parse a version out of \`${SUI_BIN} --version\`:\n${r.stdout}${r.stderr}\n`)
    process.exit(2)
  }
  return m[1]
}

const TAG = pinnedTag()
// Any release tag, not just `mainnet-v…`: the repo has documented testnet-only protocol work
// before, and a `testnet-v1.79.0` tag under the old `replace(/^mainnet-v/)` produced the literal
// string `testnet-v1.79.0` as the "version" — never equal to what `sui --version` prints, so the
// gate would be permanently red or permanently run with the guard waived.
const PINNED_VERSION = TAG.match(/v(\d+\.\d+\.\d+)/)?.[1]
if (!PINNED_VERSION) {
  err(`\n❌ index.json tag ${JSON.stringify(TAG)} carries no vX.Y.Z version to pin the compiler to.\n`)
  process.exit(2)
}
const ACTUAL_VERSION = suiVersion()
// The drift waiver is a local-run affordance, and like every other override it is inert on this
// repo — otherwise the one guard tying the gate to a known framework could be waived on the very
// corpus it protects.
const DRIFT_WAIVED = !IS_SELF && process.argv.includes('--allow-version-drift')
if (IS_SELF && process.argv.includes('--allow-version-drift')) {
  err('note: --allow-version-drift is ignored on this repo; the pinned toolchain is required')
}
if (ACTUAL_VERSION !== PINNED_VERSION && !DRIFT_WAIVED) {
  err(
    `\n❌ sui ${ACTUAL_VERSION} on PATH, but this repo is pinned to ${PINNED_VERSION} ` +
      `(index.json tag ${TAG}).\n` +
      '  Compiling against a different framework makes both a pass and a failure unreliable.\n' +
      `  Install the pinned one (\`suiup install sui@mainnet-v${PINNED_VERSION}\`), or pass\n` +
      '  --allow-version-drift if you accept the mismatch for a local run.\n',
  )
  process.exit(1)
}

// The compiler is version-checked above; the *sources it compiles against* need the same
// treatment, or a stale MOVE_FRAMEWORK_DIR in the environment silently moves the framework
// surface while the success line still names the pinned release.
if (FRAMEWORK) {
  const r = spawnSync('git', ['-C', FRAMEWORK, 'describe', '--tags', '--exact-match'], { encoding: 'utf8' })
  const described = (r.stdout || '').trim()
  if (described !== TAG) {
    err(
      `\n❌ Framework checkout at ${FRAMEWORK} is ${described || 'not a git checkout at a tag'}, ` +
        `but this repo is pinned to ${TAG}.\n` +
        '  Delete it and let scripts/ci/check-move-build.sh fetch the pinned sources again.\n',
    )
    process.exit(1)
  }
}

// A path under the scanned root reads better relative to it; anything else (a fixture tree's
// baseline, say) would come out as a pile of `../..`, so it is printed absolute.
function displayPath(p) {
  const r = relative(REPO_ROOT, p)
  return r.startsWith('..') ? p : r
}

// ---------------------------------------------------------------------------
// Corpus
// ---------------------------------------------------------------------------
function walkMd(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    let isDir = e.isDirectory()
    if (e.isSymbolicLink()) {
      try {
        isDir = statSync(p).isDirectory()
      } catch {
        continue
      }
    }
    if (isDir) walkMd(p, acc)
    else if (/\.md$/i.test(e.name)) acc.push(p)
  }
  return acc
}

// `module app::weather {` and `module example::admin;` both count, and so do the two forms an
// earlier version missed entirely — a numeric address (`module 0x0::demo;`, the idiom the Sui
// docs use) and an attribute prefix (`#[test_only] module demo::helpers;`). A block using either
// was silently classified as a fragment and never compiled, which is the failure mode this gate
// exists to prevent: no error, no count change, nothing to notice.
//
// The source is de-noised first so a `module` inside a comment or a string never promotes a
// fragment to a compile unit.
const MODULE_RE =
  /(?:^|\n)[ \t]*(?:#\[[^\]]*\][ \t\r\n]*)*module[ \t]+([A-Za-z_]\w*|0x[0-9a-fA-F]+)::([A-Za-z_]\w*)[ \t]*[;{]/g

const files = []
for (const dir of SCAN_DIRS) {
  const abs = join(REPO_ROOT, dir)
  if (existsSync(abs)) files.push(...walkMd(abs))
}

const units = []
const moduleSeen = new Map()
const structural = []
let blockCount = 0

for (const file of files.sort()) {
  // Baseline ids are built from this path, so they must be spelled the same on every platform.
  const rel = relative(REPO_ROOT, file).split(sep).join('/')
  const text = readFileSync(file, 'utf8')
  const { blocks, problems } = extractMoveBlocks(text)
  for (const p of problems) structural.push({ file: rel, line: p.line, reason: p.reason })
  for (const b of blocks) {
    blockCount++
    const { out: denoised, unterminated } = stripNoise(b.body)
    // An unterminated literal or block comment blanks the rest of the block, which could hide a
    // `module` declaration and quietly drop the block from this gate. The symbol gate reports
    // the same condition as a finding; here it is enough to fall back to the raw body, since a
    // false positive costs a compile, not a wrong verdict.
    const scanned = unterminated ? b.body : denoised
    MODULE_RE.lastIndex = 0
    const addrs = new Set()
    let m
    // A numeric address is already a value; declaring `0x0 = "0x0"` in [addresses] is a parse
    // error, so only named addresses become entries.
    while ((m = MODULE_RE.exec(scanned)) !== null) if (!/^0x/i.test(m[1])) addrs.add(m[1])
    // The id names the first module the block declares; a second block declaring the same
    // module in the same file gets `#2`, `#3`, … in document order.
    MODULE_RE.lastIndex = 0
    const first = MODULE_RE.exec(scanned)
    if (first === null) continue // no module declaration: a fragment, not a compile unit
    const name = `${first[1]}::${first[2]}`
    const seen = (moduleSeen.get(rel + ' ' + name) ?? 0) + 1
    moduleSeen.set(rel + ' ' + name, seen)
    const id = `${rel} ${name}${seen > 1 ? `#${seen}` : ''}`
    // `#[test]` / `#[test_only]` anywhere in the de-noised body puts the block in test mode.
    const testMode = /#\[\s*test(_only)?\s*[\],\]]/.test(scanned)
    units.push({ id, file: rel, line: b.startLine, body: b.body, addrs: [...addrs], testMode })
  }
}

if (structural.length) {
  err('\n❌ Malformed fences — blocks cannot be extracted reliably:\n')
  for (const s of structural) err(`  ${s.file}:${s.line}  ${s.reason}`)
  err('')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Compile
// ---------------------------------------------------------------------------
const workdir = mkdtempSync(join(tmpdir(), 'move-build-'))
const pkg = join(workdir, 'block')
mkdirSync(join(pkg, 'sources'), { recursive: true })

function moveToml(addrs) {
  const deps = FRAMEWORK
    ? `[dependencies]\nSui = { local = ${JSON.stringify(join(FRAMEWORK, 'crates', 'sui-framework', 'packages', 'sui-framework'))} }\n\n`
    : ''
  const named = addrs.map((a) => `${a} = "0x0"`).join('\n')
  return `[package]\nname = "block"\nedition = "2024"\n\n${deps}[addresses]\n${named}\n`
}

const failures = new Map() // block id (`<path> <addr>::<module>`) -> { codes, out, where, line }
try {
for (const u of units) {
  for (const old of readdirSync(join(pkg, 'sources'))) rmSync(join(pkg, 'sources', old))
  writeFileSync(join(pkg, 'Move.toml'), moveToml(u.addrs))
  writeFileSync(join(pkg, 'sources', 'block.move'), u.body + '\n')
  // Without a timeout a single hung build holds the job until the runner's 6-hour default. The
  // implicit-dependency path shells out to git, which is exactly where a hang would come from.
  // Build mode is per block, and both halves matter:
  //   - A block carrying `#[test]` / `#[test_only]` MUST build with `--test`, or the compiler
  //     excludes it wholesale and it "passes" without a line being compiled. The corpus had
  //     exactly one such block — importing a package that does not exist — counted as a pass.
  //   - Every other block must build WITHOUT `--test`, or the test-only framework surface
  //     (`sui::test_scenario`, `sui::test_utils`, `std::unit_test`) resolves in a production
  //     example that would not compile for the reader running plain `sui move build`.
  const buildArgs = u.testMode
    ? ['move', 'build', '--test', '--path', pkg]
    : ['move', 'build', '--path', pkg]
  const r = spawnSync(SUI_BIN, buildArgs, {
    encoding: 'utf8',
    // Overridable only so the self-tests can prove the timeout path without a 3-minute wait.
    timeout: Number(process.env.MOVE_BUILD_TIMEOUT_MS) || 180_000,
    killSignal: 'SIGKILL',
  })
  if (r.status === 0) continue
  if (r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGKILL') {
    failures.set(u.id, {
      codes: ['timeout'],
      out: `error[timeout]: \`sui move build\` did not finish within ${Number(process.env.MOVE_BUILD_TIMEOUT_MS) || 180_000}ms`,
      where: `${u.file}:${u.line}`,
      line: u.line,
    })
    continue
  }
  const out = (r.stdout + r.stderr).replace(/\x1b\[[0-9;]*m/g, '')
  const codes = [...new Set([...out.matchAll(/error\[(\w+)\]/g)].map((x) => x[1]))].sort()
  failures.set(u.id, { codes, out, where: `${u.file}:${u.line}`, line: u.line })
}
} finally {
  // The loop shells out and writes files; anything thrown inside it would otherwise leave a
  // package tree behind in tmpdir on every run.
  rmSync(workdir, { recursive: true, force: true })
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------
const baseline = existsSync(BASELINE_PATH)
  ? readFileSync(BASELINE_PATH, 'utf8')
      .split('\n')
      // A trailing comment needs whitespace before the `#`: ids themselves end in `#2` for a
      // repeated module name, and stripping from the first `#` anywhere would silently truncate
      // those to a token that matches nothing — the entry then reads as both a new failure and a
      // stale line, which is how a baseline stops meaning anything.
      .map((l) => (/^\s*#/.test(l) ? '' : l.replace(/\s+#.*$/, '').trim()))
      .filter(Boolean)
  : []

const known = new Set(baseline)
const regressions = [...failures.keys()].filter((id) => !known.has(id)).sort()
// A baseline entry is stale both when its block now compiles AND when the block it names no
// longer exists — a moved block silently keeps its exemption otherwise, and the id it points at
// is free to be reused by an unrelated block later.
const ids = new Set(units.map((u) => u.id))
const stale = baseline.filter((id) => !failures.has(id)).sort()

if (regressions.length) {
  err('\n❌ Move blocks that no longer compile:\n')
  for (const id of regressions) {
    const f = failures.get(id)
    err(`  --- ${id} --- ${f.where} (${f.codes.join(', ') || 'no error code'})`)
    // The compiler's snippet (the three lines under each `error[...]`) is what makes the report
    // actionable: `error[EC03004]: unbound type` alone names neither the type nor the line.
    // sources/block.move is the block body verbatim, so the compiler's line N maps back to the
    // markdown 1:1. Rewriting it makes a finding click-through instead of pointing at a temporary
    // file the reader never sees.
    const lines = f.out.split('\n')
    const remap = (l) =>
      l.replace(/\.?\/?sources\/block\.move:(\d+)/g, (_, n) => `${f.where.split(':')[0]}:${f.line + Number(n) - 1}`)
    for (let i = 0; i < lines.length; i++) {
      if (!/error\[/.test(lines[i])) continue
      for (const l of lines.slice(i, i + 4)) err(`    ${remap(l.replace(/\s+$/, '')).slice(0, 200)}`)
    }
  }
  err('')
  err('  Fix the block in the .md file. A block that is a deliberate fragment should')
  err('  not declare a `module` at all — drop the wrapper and it stops being compiled.')
  err('  Do NOT append to known-failures.txt to silence a real defect.')
  err('')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Floors — a gate that compiles nothing is green for the wrong reason
// ---------------------------------------------------------------------------
// No headroom, for the same reason the baseline cap has none: two module blocks silently
// dropping out of selection is precisely what this floor exists to catch, and a floor with slack
// cannot see them go.
const MIN_UNITS_ARG = numArg('--min-units', 16)
const MIN_UNITS = IS_SELF ? 16 : MIN_UNITS_ARG

// The passing floor is expressed as a cap on the BASELINE, not an absolute count of passes. An
// absolute floor only holds while the corpus size is frozen: add five new passing blocks and
// five existing ones can be baselined with the gate still green. Capping exemptions closes that.
const MAX_BASELINE_ARG = numArg('--max-baseline', 6)
const MAX_BASELINE = IS_SELF ? 6 : MAX_BASELINE_ARG

if (IS_SELF) {
  const ignored = ['--no-floors', '--min-units', '--max-baseline'].filter((f) => process.argv.includes(f))
  if (ignored.length) {
    err(
      `note: ${ignored.join(', ')} ignored on this repo; floors are fixed at ` +
        `${MIN_UNITS} compile units / at most ${MAX_BASELINE} baselined`,
    )
  }
}

// Honoured only for a --root that is NOT this repo: a flag that disables the guard must not be
// usable on the thing the guard exists to protect.
const FLOORS_ON = IS_SELF || !process.argv.includes('--no-floors')
const passing = units.length - failures.size

if (FLOORS_ON && units.length < MIN_UNITS) {
  err(
    `\n❌ Only ${units.length} module-declaring \`\`\`move blocks found (expected >= ${MIN_UNITS}).\n` +
      '  Either the corpus shrank or block selection stopped matching, and this gate is now\n' +
      "  compiling almost nothing. Fix the cause; only lower the floor when the corpus really\n" +
      '  shrank, and say so in the commit message.\n',
  )
  process.exit(1)
}

if (FLOORS_ON && failures.size > MAX_BASELINE) {
  err(
    `\n❌ ${failures.size} of ${units.length} blocks are exempted by known-failures.txt ` +
      `(at most ${MAX_BASELINE} allowed).\n` +
      '  Failures are migrating into the baseline instead of being fixed, and the run stays\n' +
      '  green while the documented examples rot. Fix the blocks; only raise the cap with a\n' +
      '  reason in the commit message.\n',
  )
  process.exit(1)
}

// A stale entry printed after the ✅ line at exit 0 is a note nobody acts on — and it is the
// realistic route to a permanent exemption: the block an entry names gets renamed, the line goes
// unnoticed, and a later block that takes the same id inherits the exemption. On this repo a
// stale entry is therefore an error, decided before anything claims success; against a foreign
// --root it stays informational, because a fixture tree legitimately carries entries for blocks
// it does not have.
// Tightening-only override: a test may switch the strict path ON for a fixture tree, never off
// for this repo. Making it loosenable would hand every future run the same escape.
const STRICT_STALE = IS_SELF || process.env.MOVE_BUILD_STRICT_STALE === '1'
if (stale.length && STRICT_STALE) {
  err('\n❌ known-failures.txt has stale entries:')
  for (const id of stale) {
    err(`  ${id}${ids.has(id) ? ' (now compiles)' : ' (no such block — moved or deleted)'}`)
  }
  err(`  Remove them from ${displayPath(BASELINE_PATH)}.\n`)
  process.exit(1)
}

console.log(
  `✅ Move build check passed (${units.length} module blocks compiled of ${blockCount} \`\`\`move blocks, ` +
    `${passing} pass, ${failures.size} known-failing, sui ${ACTUAL_VERSION}, ` +
    `framework ${FRAMEWORK ? 'local checkout' : 'implicit git dep'}, floors ${FLOORS_ON ? 'enforced' : 'off'}).`,
)

if (stale.length) {
  console.log('ℹ️  known-failures.txt has stale entries:')
  for (const id of stale) {
    console.log(`  ${id}${ids.has(id) ? ' (now compiles)' : ' (no such block — moved or deleted)'}`)
  }
  console.log(`  Remove them from ${displayPath(BASELINE_PATH)}.`)
}
