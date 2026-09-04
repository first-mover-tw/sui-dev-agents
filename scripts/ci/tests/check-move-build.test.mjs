// Tests for the Move compile gate. Each test drives the real script over a throwaway fixture
// tree via --root, so the assertions cover the shipped code path.
//
// The gate's job is to be silent on documentation fragments and loud on code that claims to be
// a module and does not compile. Both halves are tested: a gate that fires on the reader's
// placeholders gets muted, and a muted gate protects nothing.
import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, chmodSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(__dirname, '..', 'move-build', 'check-move-build.mjs')
const INDEX = JSON.parse(readFileSync(join(__dirname, '..', 'move-symbols', 'index.json'), 'utf8'))

// Same cache location check-move-build.sh populates. When it is present the fixtures compile
// offline; when it is not, the Move CLI resolves the framework through its implicit git
// dependency, which is slower but produces identical verdicts.
const CACHE_ROOT = process.env.SUI_DEV_AGENTS_CACHE || join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'sui-dev-agents')
const FW = join(CACHE_ROOT, `framework-${INDEX.tag}`)
const FW_ARGS = existsSync(join(FW, '.complete')) ? ['--framework', FW] : []

const OK_MODULE = `module demo::counter;

public struct Counter has key { id: UID, value: u64 }

public fun create(ctx: &mut TxContext) {
    transfer::transfer(Counter { id: object::new(ctx), value: 0 }, ctx.sender());
}`

// Declares a module, so it IS compiled — and does not compile: \`value\` is a u64, not a struct.
const BROKEN_MODULE = `module demo::broken;

public fun oops(): u64 {
    let x: u64 = 1;
    x.no_such_method()
}`

// No module declaration: a documentation fragment, invisible to this gate by design.
const FRAGMENT = `let coin = coin::split(&mut payment, price, ctx);
transfer::public_transfer(coin, recipient);`

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'movebuild-'))
  mkdirSync(join(root, 'skills', 'sui-demo'), { recursive: true })
  mkdirSync(join(root, 'rules'), { recursive: true })
  writeFileSync(join(root, 'baseline.txt'), '')
  for (const [rel, blocks] of Object.entries(files)) {
    const md = Array.isArray(blocks)
      ? blocks.map((b) => '```move\n' + b + '\n```').join('\n\n')
      : blocks // raw markdown when a test needs control over the fences
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), `# Demo\n\n${md}\n`)
  }
  return root
}

function run(root, extra = []) {
  // `extra` goes first: arg() takes the first occurrence, so a test can override a default
  // rather than be shadowed by it.
  const args = [SCRIPT, ...extra, '--root', root, '--baseline', join(root, 'baseline.txt'), '--no-floors', ...FW_ARGS]
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' })
  return { code: r.status, out: r.stdout + r.stderr }
}

function baseline(root, text) {
  writeFileSync(join(root, 'baseline.txt'), text)
}

test('a compiling module block passes', () => {
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] }))
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /1 module blocks compiled/)
  assert.match(r.out, /1 pass, 0 known-failing/)
})

test('a module block that does not compile fails, with the error code and location', () => {
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [BROKEN_MODULE] }))
  assert.equal(r.code, 1)
  assert.match(r.out, /no longer compile/)
  assert.match(r.out, /skills\/sui-demo\/SKILL\.md demo::broken/)
  assert.match(r.out, /skills\/sui-demo\/SKILL\.md:\d+/) // navigable line, not just the id
})

test('a fragment without a module declaration is never compiled', () => {
  // Reverse assertion: this is most ```move blocks in the corpus. If the gate ever starts
  // compiling them it will be red on every doc that shows a PTB call in isolation, and the
  // first response to that is to switch the gate off.
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [FRAGMENT] }))
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /0 module blocks compiled of 1/)
})

// Weaker than it looks: the selection regex anchors `module` to a line start, so this passes
// even with de-noising removed. The block-comment and string-literal tests next to it are the
// ones that kill that mutant — do not delete them as duplicates of this one.
test('a commented-out module declaration does not promote a fragment', () => {
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [`// module demo::nope;\n${FRAGMENT}`] }))
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /0 module blocks compiled/)
})

test('a module declaration inside a block comment does not promote a fragment', () => {
  // The line-start regex alone does not catch this: inside /* */ the declaration sits in
  // column 0, so only de-noising the source keeps the block out of the compile set. Without
  // it the gate compiles a fragment and reports a failure the docs cannot fix.
  const commented = `/*\nmodule demo::hidden;\n*/\n${FRAGMENT}`
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [commented] }))
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /0 module blocks compiled/)
})

test('a module named inside a string literal does not promote a fragment', () => {
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [`let s = b"module demo::nope;";`] }))
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /0 module blocks compiled/)
})

test('the braced module form is compiled too', () => {
  const braced = `module demo::wrapped {\n    public fun f(): u64 { 1 }\n}`
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [braced] }))
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /1 module blocks compiled/)
})

test('the named address comes from the block, so any address name compiles', () => {
  // Mutation guard: hardcoding `example` as the address would pass the corpus and fail here.
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE.replace('demo::', 'wildly_other_name::')] }))
  assert.equal(r.code, 0, r.out)
})

test('baseline suppresses a known failure', () => {
  const root = fixture({ 'skills/sui-demo/SKILL.md': [BROKEN_MODULE] })
  baseline(root, 'skills/sui-demo/SKILL.md demo::broken\n')
  const r = run(root)
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /1 known-failing/)
})

test('a baseline entry whose block now compiles is reported stale', () => {
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] })
  baseline(root, 'skills/sui-demo/SKILL.md demo::counter\n')
  const r = run(root)
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /stale entries/)
  assert.match(r.out, /demo::counter \(now compiles\)/)
})

test('a baseline entry whose block no longer exists is reported stale, not silently kept', () => {
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] })
  baseline(root, 'skills/sui-demo/SKILL.md demo::deleted\n')
  const r = run(root)
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /demo::deleted \(no such block — moved or deleted\)/)
})

test('two blocks declaring the same module get distinct ids and separate packages', () => {
  // Both halves matter: per-file packaging would report EC02001 (duplicate module) for the
  // pair, and a shared id would let one baseline line exempt both.
  const second = OK_MODULE.replace('public fun create', 'public fun create_second')
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE, second] })
  const r = run(root)
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /2 module blocks compiled/)
  assert.doesNotMatch(r.out, /EC02001/)
})

test('a `#2` id survives baseline comment stripping', () => {
  // Regression: stripping from the first `#` anywhere truncated `demo::broken#2` to
  // `demo::broken`, so the entry matched nothing and the run was red AND reported stale.
  const ok = OK_MODULE
  const brokenTwice = BROKEN_MODULE
  const root = fixture({ 'skills/sui-demo/SKILL.md': [ok, brokenTwice, brokenTwice] })
  baseline(root, 'skills/sui-demo/SKILL.md demo::broken\nskills/sui-demo/SKILL.md demo::broken#2\n')
  const r = run(root)
  assert.equal(r.code, 0, r.out)
  assert.doesNotMatch(r.out, /stale entries/)
})

test('baseline comments and trailing comments are ignored', () => {
  const root = fixture({ 'skills/sui-demo/SKILL.md': [BROKEN_MODULE] })
  baseline(root, '# a comment line\n\nskills/sui-demo/SKILL.md demo::broken  # why it cannot compile\n')
  const r = run(root)
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /1 known-failing/)
})

test('an unclosed fence is a structural failure, not a silently skipped block', () => {
  const raw = '```move\n' + OK_MODULE + '\n\nno closing fence here\n'
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': raw }))
  assert.equal(r.code, 1)
  assert.match(r.out, /Malformed fences/)
})

test('blocks in rules/ are compiled too', () => {
  const r = run(fixture({ 'rules/sui-move/demo.md': [BROKEN_MODULE] }))
  assert.equal(r.code, 1)
  assert.match(r.out, /rules\/sui-move\/demo\.md demo::broken/)
})

test('--min-units floor fires when the corpus stops producing compile units', () => {
  const root = fixture({ 'skills/sui-demo/SKILL.md': [FRAGMENT] })
  const r = run(root, ['--min-units', '1'])
  // --no-floors is in run()'s args but comes after --min-units; the floor must still be
  // enforced only when floors are on, so this asserts the pair works together.
  assert.equal(r.code, 0, r.out)
  const enforced = spawnSync(
    process.execPath,
    [SCRIPT, '--min-units', '1', '--root', root, '--baseline', join(root, 'baseline.txt'), ...FW_ARGS],
    { encoding: 'utf8' },
  )
  assert.equal(enforced.status, 1)
  assert.match(enforced.stdout + enforced.stderr, /Only 0 module-declaring/)
})

test('a floor flag with no value is rejected, not read as NaN', () => {
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] })
  const r = spawnSync(process.execPath, [SCRIPT, '--min-units', '--root', root, ...FW_ARGS], { encoding: 'utf8' })
  assert.equal(r.status, 2)
  assert.match(r.stdout + r.stderr, /--min-units needs a value/)
})

test('a non-integer floor is rejected', () => {
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] })
  const r = spawnSync(process.execPath, [SCRIPT, '--min-units', 'seven', '--root', root, ...FW_ARGS], { encoding: 'utf8' })
  assert.equal(r.status, 2)
  assert.match(r.stdout + r.stderr, /non-negative integer/)
})

test('--root with no value is rejected instead of throwing', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--root'], { encoding: 'utf8' })
  assert.equal(r.status, 2)
  assert.match(r.stdout + r.stderr, /--root needs a value/)
})

test('a sui binary at the wrong version is refused', () => {
  // The pinned version is what the vendored symbol index was built from. Compiling against a
  // different framework makes both a pass and a failure unreliable, so the gate must not run.
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] })
  const fake = join(root, 'fake-sui')
  writeFileSync(fake, '#!/bin/sh\necho "sui 0.0.1-deadbeef"\n')
  chmodSync(fake, 0o755)
  const r = run(root, ['--sui', fake])
  assert.equal(r.code, 1)
  assert.match(r.out, /pinned to/)
  assert.match(r.out, new RegExp(INDEX.tag.replace(/[.]/g, '\\.')))
})

test('a testnet-tagged index pins the same version a mainnet one would', () => {
  // `TAG.replace(/^mainnet-v/, '')` left a testnet tag as the literal string `testnet-v1.79.0`,
  // which can never equal what `sui --version` prints — the gate would be permanently red, or
  // permanently run with the version guard waived, which is the guard switched off.
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] })
  const idx = join(root, 'index.json')
  writeFileSync(idx, JSON.stringify({ ...INDEX, tag: `testnet-v${INDEX.tag.match(/v(\d+\.\d+\.\d+)/)[1]}` }))
  // The framework check would fire first on a tag the checkout does not carry, so run without it.
  const r = spawnSync(
    process.execPath,
    [SCRIPT, '--index', idx, '--root', root, '--baseline', join(root, 'baseline.txt'), '--no-floors'],
    { encoding: 'utf8' },
  )
  const out = r.stdout + r.stderr
  assert.doesNotMatch(out, /pinned to testnet/)
  assert.equal(r.status, 0, out)
})

test('an index tag carrying no version is rejected', () => {
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] })
  const idx = join(root, 'index.json')
  writeFileSync(idx, JSON.stringify({ ...INDEX, tag: 'framework-snapshot' }))
  const r = spawnSync(process.execPath, [SCRIPT, '--index', idx, '--root', root], { encoding: 'utf8' })
  assert.equal(r.status, 2)
  assert.match(r.stdout + r.stderr, /carries no vX\.Y\.Z version/)
})

test('--allow-version-drift lets a local run proceed against another toolchain', () => {
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] })
  const fake = join(root, 'fake-sui')
  // Reports a wrong version but builds nothing; the run must get past the guard and then fail
  // on the build, which is what proves the guard was the only thing in the way.
  writeFileSync(fake, '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "sui 0.0.1"; exit 0; fi\nexit 3\n')
  chmodSync(fake, 0o755)
  const r = run(root, ['--sui', fake, '--allow-version-drift'])
  assert.equal(r.code, 1)
  assert.doesNotMatch(r.out, /pinned to/)
  assert.match(r.out, /no longer compile/)
})

test('a missing sui binary exits 2 with an install hint, not a stack trace', () => {
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] })
  const r = run(root, ['--sui', join(root, 'does-not-exist')])
  assert.equal(r.code, 2)
  assert.match(r.out, /Cannot run/)
  assert.match(r.out, /suiup install/)
})

test('a numeric-address module is compiled, not read as a fragment', () => {
  // `module 0x0::demo;` is the form the Sui docs themselves use. An earlier selection regex
  // required a named address, so a block like this was classified as a fragment: never
  // compiled, no error, and the unit count unchanged — nothing to notice.
  const broken = 'module 0x0::demo;\n\npublic fun oops(): u64 {\n    let x: u64 = 1;\n    x.no_such_method()\n}'
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [broken] }))
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /0x0::demo/)
})

test('a numeric address is not written into [addresses]', () => {
  // `0x0 = "0x0"` is a Move.toml parse error, so the reverse of the test above: the block must
  // actually build, not fail on a manifest this gate generated.
  const ok = 'module 0x0::demo;\n\npublic fun f(): u64 { 1 }'
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [ok] }))
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /1 module blocks compiled/)
})

test('an attribute-prefixed module declaration is compiled, and in test mode', () => {
  // Two things at once: the selection regex must see past `#[test_only]`, and the build must run
  // with `--test`. Without `--test` the compiler excludes the module wholesale, so a block like
  // this passes while checking nothing — the corpus had exactly one, importing a package that
  // does not exist, counted as a pass for months of nobody noticing.
  const broken =
    '#[test_only]\nmodule demo::helpers;\n\npublic fun oops(): u64 {\n    let x: u64 = 1;\n    x.no_such_method()\n}'
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [broken] }))
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /demo::helpers/)
})

test('a production block cannot reach the test-only framework surface', () => {
  // `--test` resolves `sui::test_scenario` / `sui::test_utils` / `std::unit_test` for ordinary
  // code too. Building every block in test mode would therefore pass an example that fails for
  // the reader running plain `sui move build` — the gate's verdict must match theirs.
  const block = 'module demo::leak;\n\nuse sui::test_utils;\n\npublic struct T has drop {}\n\npublic fun f() { test_utils::destroy(T {}) }'
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [block] }))
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /demo::leak/)
})

test('a test-annotated block still reaches it', () => {
  // The other half: without `--test` for these, the compiler drops the module and the block
  // passes without a line being compiled.
  const block = '#[test_only]\nmodule demo::helper;\n\nuse sui::test_utils;\n\npublic struct T has drop {}\n\npublic fun f() { test_utils::destroy(T {}) }'
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [block] }))
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /1 pass/)
})

test('an unterminated literal falls back to the raw body instead of hiding the module', () => {
  // De-noising blanks everything after an unterminated string, which would take a `module` line
  // with it and drop the block from this gate silently. The fallback compiles it instead, and a
  // block with a stray quote fails loudly — which is the point.
  const block = 'let s = b"oops;\nmodule demo::hidden;\n\npublic fun f(): u64 { 1 }'
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [block] }))
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /demo::hidden/)
})

test('a stale baseline entry fails a fixture run under MOVE_BUILD_STRICT_STALE', () => {
  // The strict path is normally reachable only through IS_SELF. The env override tightens, never
  // loosens — a fixture can turn it on, nothing can turn it off for this repo.
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] })
  baseline(root, 'skills/sui-demo/SKILL.md demo::ghost\n')
  const r = spawnSync(
    process.execPath,
    [SCRIPT, '--root', root, '--baseline', join(root, 'baseline.txt'), '--no-floors', ...FW_ARGS],
    { encoding: 'utf8', env: { ...process.env, MOVE_BUILD_STRICT_STALE: '1' } },
  )
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, out)
  assert.match(out, /demo::ghost \(no such block/)
  assert.doesNotMatch(out, /✅/)
})

test('the failure report points at the markdown line, not the temp package', () => {
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [BROKEN_MODULE] }))
  assert.equal(r.code, 1)
  assert.doesNotMatch(r.out, /sources\/block\.move/)
  assert.match(r.out, /skills\/sui-demo\/SKILL\.md:\d+/)
})

test('a same-line attribute prefix is handled too', () => {
  // Two-line `#[test_only]\nmodule …` matches through the newline anchor alone; only this form
  // exercises the attribute prefix in the selection regex.
  const block = '#[test_only] module demo::inline;\n\npublic fun f(): u64 {\n    let x: u64 = 1;\n    x.no_such_method()\n}'
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [block] }))
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /demo::inline/)
})

test('the baseline cap fires when exemptions grow', () => {
  const root = fixture({ 'skills/sui-demo/SKILL.md': [BROKEN_MODULE, BROKEN_MODULE] })
  baseline(root, 'skills/sui-demo/SKILL.md demo::broken\nskills/sui-demo/SKILL.md demo::broken#2\n')
  // Under the old absolute passing floor this was green: exemptions could grow as long as new
  // passing blocks arrived alongside them.
  const r = spawnSync(
    process.execPath,
    [SCRIPT, '--max-baseline', '1', '--min-units', '0', '--root', root, '--baseline', join(root, 'baseline.txt'), ...FW_ARGS],
    { encoding: 'utf8' },
  )
  assert.equal(r.status, 1)
  assert.match(r.stdout + r.stderr, /2 of 2 blocks are exempted/)
})

test('an unknown or misspelt flag is rejected instead of silently ignored', () => {
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] })
  for (const bad of ['--min-units=14', '--minunits', '--frameworks']) {
    const r = spawnSync(process.execPath, [SCRIPT, bad, '3', '--root', root], { encoding: 'utf8' })
    assert.equal(r.status, 2, bad)
    assert.match(r.stdout + r.stderr, /unknown flag/)
  }
})

test('a framework checkout at the wrong tag is refused', () => {
  // The version guard covers the compiler; without this one a stale MOVE_FRAMEWORK_DIR moves the
  // framework surface while the success line still names the pinned release.
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] })
  const fake = join(root, 'not-a-checkout')
  mkdirSync(fake, { recursive: true })
  const r = run(root, ['--framework', fake])
  assert.equal(r.code, 1)
  assert.match(r.out, /Framework checkout/)
  assert.match(r.out, /pinned to/)
})

test('the failure report carries the compiler snippet, not just the error code', () => {
  const r = run(fixture({ 'skills/sui-demo/SKILL.md': [BROKEN_MODULE] }))
  assert.equal(r.code, 1)
  assert.match(r.out, /no_such_method/) // the offending source line, from the snippet
})

test('a build that hangs is reported as a timeout, not left to hold the job', () => {
  // The runner's default is six hours. A `sui` that never returns must be bounded by the gate.
  const root = fixture({ 'skills/sui-demo/SKILL.md': [OK_MODULE] })
  const fake = join(root, 'hanging-sui')
  writeFileSync(fake, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "sui ${INDEX.tag.match(/v(\d+\.\d+\.\d+)/)[1]}"; exit 0; fi\nsleep 600\n`)
  chmodSync(fake, 0o755)
  const r = spawnSync(
    process.execPath,
    [SCRIPT, '--sui', fake, '--root', root, '--baseline', join(root, 'baseline.txt'), '--no-floors'],
    { encoding: 'utf8', timeout: 30_000, env: { ...process.env, MOVE_BUILD_TIMEOUT_MS: '2000' } },
  )
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, out)
  assert.match(out, /timeout/)
})

test('floors and --baseline cannot be switched off for this repo', () => {
  // The guard exists to protect this corpus; pointing --root back at it with --no-floors must
  // not wave it through. Runs the real corpus, so it is the slowest test here.
  const repoRoot = join(__dirname, '..', '..', '..')
  const r = spawnSync(
    process.execPath,
    [SCRIPT, '--root', repoRoot, '--no-floors', '--baseline', '/dev/null', ...FW_ARGS],
    { encoding: 'utf8' },
  )
  const out = r.stdout + r.stderr
  assert.match(out, /--no-floors ignored on this repo/)
  assert.match(out, /--baseline is ignored on this repo/)
  assert.match(out, /floors enforced/)
  assert.equal(r.status, 0, out)
})
