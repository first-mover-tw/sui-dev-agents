// Tests for the Move framework symbol gate. Each test drives the real script over a
// throwaway fixture tree via --root, so the assertions cover the shipped code path.
//
// Half of these are reverse assertions: the gate is only useful if it stays SILENT on
// user-defined modules, aliases and pseudo-code. A gate that fires on those gets muted,
// and a muted gate protects nothing.
import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(__dirname, '..', 'move-symbols', 'check-move-symbols.mjs')
const INDEX = JSON.parse(readFileSync(join(__dirname, '..', 'move-symbols', 'index.json'), 'utf8'))

// README must carry the version the vendored index is stamped with, or the staleness
// guard fires before any block is looked at.
const README_VERSION = INDEX.tag.replace(/^mainnet-v/, '')

function fixture(blocks, { readmeVersion = README_VERSION } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'movesym-'))
  mkdirSync(join(root, 'skills', 'sui-demo'), { recursive: true })
  mkdirSync(join(root, 'rules'), { recursive: true })
  writeFileSync(
    join(root, 'README.md'),
    `# Demo\n\nAligned with SUI CLI (Protocol 135, mainnet v${readmeVersion}).\n`,
  )
  const md = blocks.map((b) => '```move\n' + b + '\n```').join('\n\n')
  writeFileSync(join(root, 'skills', 'sui-demo', 'SKILL.md'), `# Demo\n\n${md}\n`)
  writeFileSync(join(root, 'baseline.txt'), '')
  return root
}

function run(root, extra = []) {
  // `extra` goes first: arg() takes the first occurrence, so this lets a test override
  // a default rather than be shadowed by it.
  const args = [SCRIPT, ...extra, '--root', root, '--baseline', join(root, 'baseline.txt'), '--no-floors']
  // stdio must be fully piped: several tests deliberately drive the gate to a failure, and
  // execFileSync forwards a child's stderr to the parent by default — which makes CI logs
  // scroll expected error text that reads like a real failing job.
  const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  try {
    return { code: 0, out: execFileSync('node', args, opts), err: '' }
  } catch (e) {
    return { code: e.status, out: e.stdout?.toString() ?? '', err: e.stderr?.toString() ?? '' }
  }
}

// Same as run(), but with the corpus floors left ON.
function execFileSyncSafe(root, extra = []) {
  const args = [SCRIPT, ...extra, '--root', root, '--baseline', join(root, 'baseline.txt')]
  const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  try {
    return { code: 0, out: execFileSync('node', args, opts), err: '' }
  } catch (e) {
    return { code: e.status, out: e.stdout?.toString() ?? '', err: e.stderr?.toString() ?? '' }
  }
}

// --- the gate must fire -----------------------------------------------------

test('fabricated framework function fails', () => {
  const r = run(fixture(['let c = sui::coin::mint_fake(&mut cap, 100, ctx);']))
  assert.equal(r.code, 1)
  assert.match(r.err, /has no member `mint_fake`/)
})

test('fabricated framework module fails', () => {
  const r = run(fixture(['use sui::nonexistent_module;']))
  assert.equal(r.code, 1)
  assert.match(r.err, /no module `sui::nonexistent_module`/)
})

test('fabricated member named in a use statement fails', () => {
  const r = run(fixture(['use sui::coin::{Self, Coin, NotAThing};']))
  assert.equal(r.code, 1)
  assert.match(r.err, /has no member `NotAThing`/)
})

test('fabrication reached through an alias fails', () => {
  const r = run(fixture(['use sui::dynamic_field as df;\ndf::add_everything(&mut id, k, v);']))
  assert.equal(r.code, 1)
  assert.match(r.err, /sui::dynamic_field has no member `add_everything`|has no member `add_everything`/)
})

test('fabrication on an implicit alias fails without any use statement', () => {
  const r = run(fixture(['transfer::public_share_object_maybe(obj);']))
  assert.equal(r.code, 1)
  assert.match(r.err, /has no member `public_share_object_maybe`/)
})

test('@check:skip does not hide a fabricated use path', () => {
  const r = run(fixture(['// @check:skip\nuse sui::totally_made_up;\n... pseudo code ...']))
  assert.equal(r.code, 1)
  assert.match(r.err, /no module `sui::totally_made_up`/)
})

test('index stamped at a different release than README fails', () => {
  const r = run(fixture(['use sui::coin;'], { readmeVersion: '9.9.9' }))
  assert.equal(r.code, 1)
  assert.match(r.err, /index is stale/)
})

test('resolving fewer symbols than the floor fails', () => {
  // Floors ON (run() disables them for the fixtures), with the symbol floor raised so the
  // fixture cannot clear it. The per-directory floor would also fire here, so assert on the
  // symbol-floor message specifically.
  const root = fixture(['use sui::coin;'])
  const r = execFileSyncSafe(root, ['--min-resolved', '999', '--min-blocks-skills', '0', '--min-blocks-rules', '0'])
  assert.equal(r.code, 1)
  assert.match(r.err, /framework symbols resolved/)
})

test('losing a whole scan directory fails even when the symbol floor is met', () => {
  // The resolved-symbol floor alone does not catch this: dropping rules/ from the real corpus
  // leaves 72 symbols against a floor of 70, i.e. green while a quarter goes unchecked.
  const root = fixture(['use sui::coin::{Self, Coin};'])
  const withFloors = execFileSyncSafe(root)
  assert.equal(withFloors.code, 1, withFloors.out)
  assert.match(withFloors.err, /blocks found under (skills|rules)\//)
  assert.equal(run(root).code, 0, 'the --no-floors path the other fixtures rely on still passes')
})

test('an unterminated string literal is reported, not silently swallowed', () => {
  // stripNoise would otherwise blank the rest of the block and pass.
  const r = run(fixture(['let s = b"oops;\nsui::coin::mint_fake(cap, ctx);']))
  assert.equal(r.code, 1)
  assert.match(r.err, /unterminated string literal/)
})

test('an unterminated block comment is reported', () => {
  const r = run(fixture(['/* oops\nsui::coin::mint_fake(cap, ctx);']))
  assert.equal(r.code, 1)
  assert.match(r.err, /unterminated block comment/)
})

test('a fabrication on a DENY-listed module is still caught when fully qualified', () => {
  // Bare `package::` is never resolved, so rule 4 is the only thing covering these.
  const r = run(fixture(['let p = sui::package::claim_and_fake(w, ctx);']))
  assert.equal(r.code, 1)
  assert.match(r.err, /`sui::package` has no member `claim_and_fake`/)
})

test('a self-declared module does not suppress a fully qualified framework reference', () => {
  const r = run(fixture(['module app::coin;\nsui::coin::mint_fake(c, ctx);']))
  assert.equal(r.code, 1)
  assert.match(r.err, /`sui::coin` has no member `mint_fake`/)
})

test('an indented fence inside a list item is checked, not skipped', () => {
  const root = mkdtempSync(join(tmpdir(), 'movesym-'))
  mkdirSync(join(root, 'skills', 'sui-demo'), { recursive: true })
  mkdirSync(join(root, 'rules'), { recursive: true })
  writeFileSync(join(root, 'README.md'), `mainnet v${README_VERSION}\n`)
  writeFileSync(join(root, 'baseline.txt'), '')
  writeFileSync(
    join(root, 'skills', 'sui-demo', 'SKILL.md'),
    '- step one\n\n  ```move\n  sui::coin::mint_fake(c, ctx);\n  ```\n',
  )
  const r = run(root)
  assert.equal(r.code, 1)
  assert.match(r.err, /has no member `mint_fake`/)
})

test('an unclosed fence is reported rather than dropped', () => {
  const root = mkdtempSync(join(tmpdir(), 'movesym-'))
  mkdirSync(join(root, 'skills', 'sui-demo'), { recursive: true })
  mkdirSync(join(root, 'rules'), { recursive: true })
  writeFileSync(join(root, 'README.md'), `mainnet v${README_VERSION}\n`)
  writeFileSync(join(root, 'baseline.txt'), '')
  writeFileSync(join(root, 'skills', 'sui-demo', 'SKILL.md'), '```move\nsui::coin::value(&c);\n')
  const r = run(root)
  assert.equal(r.code, 1)
  assert.match(r.err, /unclosed ```move fence/)
})

test('a use statement inside a single-line module body is parsed', () => {
  const r = run(fixture(['module app::m { use sui::not_real; }']))
  assert.equal(r.code, 1)
  assert.match(r.err, /no module `sui::not_real`/)
})

test('findings point at the offending line, not the top of the block', () => {
  const r = run(fixture(['let a = 1;\nlet b = 2;\nsui::coin::mint_fake(c, ctx);']))
  assert.equal(r.code, 1)
  // fixture puts the fence at line 3, so the body starts at 4 and the call is line 6.
  assert.match(r.err, /SKILL\.md:6\s+`sui::coin` has no member `mint_fake`/)
})

test('fabrication on a bare framework module name fails without a use statement', () => {
  const r = run(fixture(['test_scenario::next_tx_v2(&mut sc, alice);']))
  assert.equal(r.code, 1)
  assert.match(r.err, /`sui::test_scenario` has no member `next_tx_v2`/)
})

test('a self-declared module does not suppress an address-qualified use statement', () => {
  // `use sui::coin::{...}` names the framework even inside `module app::coin;` — a wrapper
  // module named after the one it wraps is ordinary teaching material.
  const r = run(fixture(['module app::coin;\nuse sui::coin::{Self, NotAThing};']))
  assert.equal(r.code, 1)
  assert.match(r.err, /`sui::coin` has no member `NotAThing`/)
})

test('line numbers survive comments and string literals ahead of the finding', () => {
  // Pins stripNoise's offset preservation. Without blanking 1:1 the reported line drifts;
  // a fixture of plain statements would pass even if stripNoise were the identity function.
  const r = run(
    fixture(['// lead comment\n/* two\n   line\n   comment */\nlet s = b"a string";\nsui::coin::mint_fake(c, ctx);']),
  )
  assert.equal(r.code, 1)
  // fence at line 3 → body starts line 4 → the call is the 6th body line → line 9.
  assert.match(r.err, /SKILL\.md:9\s+`sui::coin` has no member `mint_fake`/)
})

test('no flag can lower or disable the floors on this repo', () => {
  // The escape hatch exists for fixture trees only — a guard whose own CI can be told to switch
  // it off is not a guard. Each of these would pass trivially if the flag were honoured here.
  const root = fixture(['use sui::coin;'])
  assert.equal(run(root).code, 0, 'the fixture escape hatch still works for a foreign root')

  const selfRoot = join(__dirname, '..', '..', '..')
  const linkDir = mkdtempSync(join(tmpdir(), 'movesym-link-'))
  symlinkSync(selfRoot, join(linkDir, 'repo'))
  const attempts = [
    ['--min-blocks-skills', '99999'], // floor raised: ignored, so the run still passes
    ['--min-resolved', '99999'],
    ['--no-floors', '--min-blocks-skills', '99999'],
    ['--root', selfRoot, '--no-floors', '--min-blocks-skills', '99999'],
    ['--root', join(linkDir, 'repo'), '--no-floors', '--min-resolved', '99999'],
  ]
  for (const extra of attempts) {
    const res = spawnSync('node', [SCRIPT, ...extra], { encoding: 'utf8' })
    const code = res.status
    const out = res.stdout
    const err = res.stderr
    assert.equal(code, 0, `flag set changed the outcome on this repo: ${extra.join(' ')}`)
    // An ignored flag must say so: one that appears to work but does nothing is worse than one
    // that is rejected outright.
    assert.match(err, /ignored on this repo/, `no notice that these were ignored: ${extra.join(' ')}`)
    // Exit 0 alone cannot tell "floors enforced and met" from "floors skipped", so assert the
    // state the run reports. Without this the whole test passes when the lock is removed.
    assert.match(out, /floors enforced/, `floors were disabled by: ${extra.join(' ')}`)
  }
})

test('a ~~~move fence is checked like a backtick fence', () => {
  const root = mkdtempSync(join(tmpdir(), 'movesym-'))
  mkdirSync(join(root, 'skills', 'sui-demo'), { recursive: true })
  mkdirSync(join(root, 'rules'), { recursive: true })
  writeFileSync(join(root, 'README.md'), `mainnet v${README_VERSION}\n`)
  writeFileSync(join(root, 'baseline.txt'), '')
  writeFileSync(
    join(root, 'skills', 'sui-demo', 'SKILL.md'),
    '~~~move\nsui::coin::mint_fake(c, ctx);\n~~~\n',
  )
  const r = run(root)
  assert.equal(r.code, 1)
  assert.match(r.err, /has no member `mint_fake`/)
})

test('an unparseable block cannot be silenced with a known-failures entry', () => {
  const root = mkdtempSync(join(tmpdir(), 'movesym-'))
  mkdirSync(join(root, 'skills', 'sui-demo'), { recursive: true })
  mkdirSync(join(root, 'rules'), { recursive: true })
  writeFileSync(join(root, 'README.md'), `mainnet v${README_VERSION}\n`)
  writeFileSync(join(root, 'skills', 'sui-demo', 'SKILL.md'), '```move\nsui::coin::value(&c);\n')
  writeFileSync(
    join(root, 'baseline.txt'),
    'skills/sui-demo/SKILL.md <malformed fence>\nskills/sui-demo/SKILL.md unclosed\n',
  )
  const r = run(root)
  assert.equal(r.code, 1)
  assert.match(r.err, /NOT baselineable/)
})

// Writes one .md verbatim, for fence shapes fixture() cannot express.
function rawFixture(md) {
  const root = mkdtempSync(join(tmpdir(), 'movesym-'))
  mkdirSync(join(root, 'skills', 'sui-demo'), { recursive: true })
  mkdirSync(join(root, 'rules'), { recursive: true })
  writeFileSync(join(root, 'README.md'), `mainnet v${README_VERSION}\n`)
  writeFileSync(join(root, 'baseline.txt'), '')
  writeFileSync(join(root, 'skills', 'sui-demo', 'SKILL.md'), md)
  return root
}

test('an unclosed NON-move fence is reported', () => {
  // The dangling fence swallows every later ```move block; reporting only unclosed *move*
  // fences left those losses invisible.
  const r = run(rawFixture('```text\nnever closed\n\n```move\nsui::coin::mint_fake(c, ctx);\n'))
  assert.equal(r.code, 1)
  assert.match(r.err, /unclosed non-move fence/)
})

test('a move block nested inside another fence is checked, not skipped', () => {
  // The architect skill wraps generated-document templates in ````markdown; the Move inside is
  // real Move. Skipping those blocks also made a misparse indistinguishable from a deliberate
  // exclusion, which was the real cost — the volume was 10 blocks and 3 framework references.
  const r = run(rawFixture('````markdown\n# doc\n\n```move\nsui::coin::mint_fake(c, ctx);\n```\n````\n'))
  assert.equal(r.code, 1)
  assert.match(r.err, /has no member `mint_fake`/)
})

test('a bare ``` inside a fence is content, not a new nested fence', () => {
  // CommonMark: only a valid closer ends the block. Treating any fence-shaped line as an opener
  // would end the enclosing block early and leave the rest unchecked.
  const r = run(rawFixture('````move\nlet a = 1;\n```\nsui::coin::mint_fake(c, ctx);\n````\n'))
  assert.equal(r.code, 1)
  assert.match(r.err, /SKILL\.md:4\s+`sui::coin` has no member `mint_fake`/)
})

test('a quoted fence is not closed by an unquoted one of the same shape', () => {
  // Pins the `depth === top.depth` half of blockquote support, as opposed to merely stripping
  // the prefix: without it the unquoted ``` would close the quoted block early.
  const r = run(rawFixture('> ```move\n> let a = 1;\n```\n> sui::coin::mint_fake(c, ctx);\n> ```\n'))
  assert.equal(r.code, 1)
  assert.match(r.err, /has no member `mint_fake`/)
})

test('a longer closing fence closes a shorter opening one', () => {
  // `c.length >= top.len`, not `===`.
  const r = run(rawFixture('```move\nsui::coin::mint_fake(c, ctx);\n`````\n'))
  assert.equal(r.code, 1)
  assert.match(r.err, /has no member `mint_fake`/)
  assert.doesNotMatch(r.err, /unclosed/)
})

test('a fence opened with ~~~ is not closed by ```', () => {
  const r = run(rawFixture('~~~move\nlet a = 1;\n```\nsui::coin::mint_fake(c, ctx);\n~~~\n'))
  assert.equal(r.code, 1)
  assert.match(r.err, /SKILL\.md:4\s+`sui::coin` has no member `mint_fake`/)
})

test('a blockquoted move fence is checked', () => {
  // The docs use `> ```lang` for callouts, so a quoted fence is a live idiom in this repo.
  const r = run(rawFixture('> ```move\n> sui::coin::mint_fake(c, ctx);\n> ```\n'))
  assert.equal(r.code, 1)
  assert.match(r.err, /has no member `mint_fake`/)
})

test('README declaring two different mainnet versions is refused', () => {
  const root = rawFixture('```move\nuse sui::coin;\n```\n')
  writeFileSync(join(root, 'README.md'), 'mainnet v1.0.0 and also mainnet v2.0.0\n')
  const r = run(root)
  assert.equal(r.code, 1)
  assert.match(r.err, /declares more than one mainnet version/)
})

test('a malformed floor flag is refused rather than silently disabling the guard', () => {
  const root = fixture(['use sui::coin;'])

  // `--min-blocks-skills --min-blocks-rules 30` swallows the next flag as its value. Left
  // alone, Number() gives NaN and every `x < NaN` is false — the floor switches itself off.
  const valueless = run(root, ['--min-blocks-skills', '--min-blocks-rules'])
  assert.equal(valueless.code, 2)
  assert.match(valueless.err, /--min-blocks-skills needs a value/)

  // A present-but-nonsense value has the same NaN effect.
  const nonNumeric = run(root, ['--min-blocks-skills', 'lots'])
  assert.equal(nonNumeric.code, 2)
  assert.match(nonNumeric.err, /needs a non-negative integer/)

  // ...and a negative one would compare true against every count.
  const negative = run(root, ['--min-resolved', '-1'])
  assert.equal(negative.code, 2)
  assert.match(negative.err, /needs a non-negative integer/)
})

test('the floors label can actually read "off", so asserting "enforced" means something', () => {
  // The floors-lock test asserts /floors enforced/. That assertion is only as strong as the
  // label's ability to say otherwise — hardcoding the string would leave it green.
  const root = fixture(['use sui::coin;'])
  const r = run(root) // foreign root + --no-floors
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /floors off/)
})

test('a move block nested inside another move block is checked at both levels', () => {
  // Pins feeding body lines to every move frame on the stack, not just the innermost: the outer
  // block must still see its own text (and its line offsets) around the inner one.
  const r = run(
    rawFixture(
      '````move\nlet a = 1;\n```move\nsui::coin::inner_fake(c);\n```\nsui::coin::outer_fake(c);\n````\n',
    ),
  )
  assert.equal(r.code, 1)
  assert.match(r.err, /SKILL\.md:4\s+`sui::coin` has no member `inner_fake`/)
  assert.match(r.err, /SKILL\.md:6\s+`sui::coin` has no member `outer_fake`/)
  // and reported once, not once per enclosing frame
  assert.equal((r.err.match(/inner_fake/g) ?? []).length, 1)
})

test('a symlinked subtree under skills/ is walked, not silently skipped', () => {
  const root = rawFixture('```move\nuse sui::coin;\n```\n')
  const outside = mkdtempSync(join(tmpdir(), 'movesym-ext-'))
  writeFileSync(join(outside, 'LINKED.md'), '```move\nsui::coin::mint_fake(c, ctx);\n```\n')
  symlinkSync(outside, join(root, 'skills', 'linked'))
  const r = run(root)
  assert.equal(r.code, 1)
  assert.match(r.err, /has no member `mint_fake`/)
})

test('an info string after the language is still a move fence', () => {
  // ```move title=foo — the \b in /^move\b/ is deliberate, in both the isMove test (top level)
  // and the nested-opener test (inside a wrapper), which are separate code paths.
  const top = run(rawFixture('```move title=example\nsui::coin::mint_fake(c, ctx);\n```\n'))
  assert.equal(top.code, 1)
  assert.match(top.err, /has no member `mint_fake`/)

  // `move,ignore` is the shape that distinguishes /^move\b/ from /^move$/: the info string is
  // captured as one non-space token, so `move title=x` alone cannot tell them apart.
  const nested = run(
    rawFixture('````markdown\n# doc\n\n```move,ignore\nsui::coin::nested_fake(c);\n```\n````\n'),
  )
  assert.equal(nested.code, 1)
  assert.match(nested.err, /has no member `nested_fake`/)
})

test('a structural problem reports the fence line, not an offset from it', () => {
  const r = run(rawFixture('# heading\n\nprose\n\n```move\nsui::coin::value(&c);\n'))
  assert.equal(r.code, 1)
  assert.match(r.err, /SKILL\.md:5\s+unclosed ```move fence/)
})

test('two different fabrications on one line are both reported', () => {
  // Pins the `symbol` component of the dedup key. Without it the two collapse to one, and since
  // the baseline matches on `file symbol`, a new fabrication sharing a line with a baselined one
  // would go unreported — a false negative introduced by the de-duplication itself.
  const r = run(fixture(['let x = sui::coin::fake_a(sui::coin::fake_b(y));']))
  assert.equal(r.code, 1)
  assert.match(r.err, /has no member `fake_a`/)
  assert.match(r.err, /has no member `fake_b`/)
})

test('the same fabrication in two separate blocks is reported at each block', () => {
  // Pins the `line` component of the dedup key. Within one block a repeated symbol is reported
  // once, at its first occurrence — deliberate, so one mistake does not print twenty times.
  const r = run(fixture(['sui::coin::mint_fake(a);', 'let z = 1;\nsui::coin::mint_fake(b);']))
  assert.equal(r.code, 1)
  assert.match(r.err, /SKILL\.md:4\s+`sui::coin` has no member `mint_fake`/)
  assert.match(r.err, /SKILL\.md:9\s+`sui::coin` has no member `mint_fake`/)
})

test('a module whose name equals its address is not read as a member of itself', () => {
  // `use sui_system::sui_system;` is the canonical staking import. Rules 3 and 4 must not
  // re-scan the use line that created the alias, or it reports `sui_system` as a member of
  // `sui_system::sui_system` — a false positive on correct code.
  const ok = run(fixture(['use sui_system::sui_system;\nsui_system::request_add_stake(w, s, c, v, ctx);']))
  assert.equal(ok.code, 0, ok.err)

  const ok2 = run(fixture(['use sui::sui;\nlet t: sui::SUI = x;']))
  assert.equal(ok2.code, 0, ok2.err)

  // ...while a real fabrication reached through that same alias still fires.
  const bad = run(fixture(['use sui::sui;\nlet t = sui::mint_fake();']))
  assert.equal(bad.code, 1)
  assert.match(bad.err, /`sui::sui` has no member `mint_fake`/)
})

test('--baseline is ignored on this repo and says so', () => {
  // The baseline is version-controlled; a run must not be pointable at a permissive substitute.
  const tmp = mkdtempSync(join(tmpdir(), 'movesym-bl-'))
  // A substituted baseline carrying an entry that does not match any live failure would be
  // reported as stale. Silence proves the committed (empty) baseline was the one consulted.
  const substitute = join(tmp, 'anything.txt')
  writeFileSync(substitute, 'skills/nowhere/SKILL.md sui::coin::not_a_real_entry\n')
  const res = spawnSync('node', [SCRIPT, '--baseline', substitute], { encoding: 'utf8' })
  assert.equal(res.status, 0, res.stderr)
  assert.match(res.stdout, /floors enforced/)
  assert.match(res.stderr, /--baseline is ignored on this repo/)
  assert.doesNotMatch(res.stdout, /stale entries/)
  assert.doesNotMatch(res.stdout, /not_a_real_entry/)
})

test('a block declaring a module named after an implicit alias shadows it', () => {
  // `transfer`/`object`/`tx_context` are implicit aliases, not BARE names, so this exercises
  // the selfDeclared guard on the IMPLICIT map rather than the one in the bare-name loop.
  const r = run(fixture(['module app::transfer;\n\npublic fun send(o: Obj) { transfer::my_local_send(o) }']))
  assert.equal(r.code, 0, r.err)
})

test('a `use fun` method alias still has its path resolved', () => {
  // Rules 1/2 cannot classify a method alias, so its span must stay visible to rule 4.
  const r = run(fixture(['use fun sui::coin::fabricated_fn as Coin.f;']))
  assert.equal(r.code, 1)
  assert.match(r.err, /`sui::coin` has no member `fabricated_fn`/)
})

test('a cropped `use` does not swallow the code after it', () => {
  // Without a semicolon the use-regex runs to the *next* one, so the span covers real code.
  // Blanking a span nothing classified would hide whatever it ate.
  const r = run(fixture(['use sui::coin\nlet c = sui::coin::fabricated_two(x);']))
  assert.equal(r.code, 1)
  assert.match(r.err, /`sui::coin` has no member `fabricated_two`/)
})

test('blanking a use span preserves line numbers for later findings', () => {
  // The blanking replaces each character with a space, never deleting: dropping the characters
  // instead would shift every subsequent finding one line early.
  const r = run(fixture(['use sui::coin;\nlet a = 1;\ncoin::mint_fake(c);']))
  assert.equal(r.code, 1)
  assert.match(r.err, /SKILL\.md:6\s+`sui::coin` has no member `mint_fake`/)
})

test('a fabrication named in a use statement reports that use line', () => {
  const r = run(fixture(['let a = 1;\nlet b = 2;\nuse sui::coin::{Self, NotAThing};']))
  assert.equal(r.code, 1)
  assert.match(r.err, /SKILL\.md:6\s+`sui::coin` has no member `NotAThing`/)
})

test('an alias followed by a second :: is left to the fully qualified rule', () => {
  // `df::foo::bar` must not be read as "member `foo` of sui::dynamic_field".
  const r = run(fixture(['use sui::dynamic_field as df;\ndf::sub::helper(x);']))
  assert.equal(r.code, 0, r.err)
})

// --- the gate must stay silent (reverse assertions) -------------------------

test('bare framework module names resolve when the excerpt cropped the use line', () => {
  const r = run(
    fixture([
      'let mut sc = test_scenario::begin(alice);\n' +
        'let c = coin::mint_for_testing<SUI>(1000, test_scenario::ctx(&mut sc));\n' +
        'event::emit(Minted { amount: 1000 });\n' +
        'test_scenario::end(sc);',
    ]),
  )
  assert.equal(r.code, 0, r.err)
})

test('`token::deep` is not resolved against the framework `sui::token`', () => {
  // Skills use `token` as DeepBook's DEEP package address. A bare-name fallback that
  // resolved this would report a fabrication that is not one.
  const r = run(fixture(['token::deep::mint_for_me(ctx);', 'use token::deep;\ndeep::whatever(ctx);']))
  assert.equal(r.code, 0, r.err)
})

test('`sui` as an address prefix is not read as the `sui::sui` coin module', () => {
  const r = run(fixture(['use sui::dynamic_field as df;\nuse sui::coin;\nuse sui::event;']))
  assert.equal(r.code, 0, r.err)
})

test('bare names that exist under two addresses are left alone', () => {
  // `bcs` and `hash` live under both std:: and sui::, so the bare form cannot be resolved.
  // This is structural (BARE maps duplicates to null), not an UNBOUND_DENY entry.
  const r = run(fixture(['let b = bcs::to_bytes_but_not_really(&x);\nhash::sha9_9(&y);']))
  assert.equal(r.code, 0, r.err)
  // ...but the fully qualified form still resolves, so the address disambiguates it.
  const r2 = run(fixture(['let b = std::bcs::to_bytes_but_not_really(&x);']))
  assert.equal(r2.code, 1)
  assert.match(r2.err, /`std::bcs` has no member `to_bytes_but_not_really`/)
})


test('real framework symbols pass', () => {
  const r = run(
    fixture([
      'use sui::coin::{Self, Coin, TreasuryCap};\nuse sui::dynamic_field as df;\n' +
        'let v = coin::value(&c);\ndf::add(&mut id, b"k", 1);\n' +
        'transfer::public_share_object(obj);\nlet id = object::new(ctx);\n' +
        'let who = tx_context::sender(ctx);',
    ]),
  )
  assert.equal(r.code, 0, r.err)
})

test('user-defined modules are ignored', () => {
  const r = run(
    fixture([
      'use marketplace::listing;\nuse my_app::nft;\n' +
        'listing::buy_from_listing(l, ctx);\nnft::mint_with_amount(1000, ctx);',
    ]),
  )
  assert.equal(r.code, 0, r.err)
})

test('deepbook is treated as the app package, not the framework module', () => {
  // The framework carries a `deepbook` package (v2, 0xdee9) that the index deliberately
  // omits; skills mean DeepBook v3. Resolving these against the framework would be wrong.
  const r = run(fixture(['use deepbook::pool;\npool::place_limit_order(p, 1, 2, ctx);']))
  assert.equal(r.code, 0, r.err)
})

test('a block defining its own module shadows the framework name', () => {
  const r = run(fixture(['module my_app::coin;\n\npublic fun brew(): u64 { coin::locally_defined() }']))
  assert.equal(r.code, 0, r.err)
})

test('a use statement shadows an implicit alias', () => {
  const r = run(fixture(['use my_app::transfer;\ntransfer::do_my_thing(obj);']))
  assert.equal(r.code, 0, r.err)
})

test('fabrications inside comments and strings are ignored', () => {
  const r = run(
    fixture([
      '// sui::coin::mint_fake(cap, ctx);\n/* sui::coin::also_fake() */\nlet s = b"sui::coin::string_fake";',
    ]),
  )
  assert.equal(r.code, 0, r.err)
})

test('@check:skip exempts the body but the block still parses', () => {
  const r = run(fixture(['// @check:skip\nsui::coin::whatever_pseudo(...)\n<fill in your logic>']))
  assert.equal(r.code, 0, r.err)
})

test('baseline suppresses a known failure and reports it when it goes away', () => {
  const root = fixture(['use sui::coin::{Self, NotAThing};'])
  writeFileSync(join(root, 'baseline.txt'), 'skills/sui-demo/SKILL.md sui::coin::NotAThing\n')
  const r = run(root)
  assert.equal(r.code, 0, r.err)

  writeFileSync(
    join(root, 'baseline.txt'),
    'skills/sui-demo/SKILL.md sui::coin::NotAThing\nskills/sui-demo/SKILL.md sui::coin::Gone\n',
  )
  const r2 = run(root)
  assert.equal(r2.code, 0, r2.err)
  assert.match(r2.out, /stale entries/)
  assert.match(r2.out, /sui::coin::Gone/)
})
