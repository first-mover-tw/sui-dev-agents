#!/usr/bin/env node
// Gate every ```move fenced block in skills/**/*.md and rules/**/*.md against the
// vendored Move framework symbol index (index.json, built by build-index.mjs).
//
// What is checked — deliberately only the layer the environment can mechanically resolve:
//
//   1. `use std|sui|sui_system::<module>` — the module must exist.
//   2. Members named in a `use` (`use sui::coin::{Self, Coin, TreasuryCap};`) must exist.
//   3. `<alias>::<member>` references, where <alias> resolves — through the block's own
//      `use` statements, Sui's implicit aliases, or an unambiguous bare framework module
//      name (see UNBOUND_DENY) — to a framework module.
//   4. Fully qualified `std|sui|sui_system::<module>::<member>` references.
//
// Rules 1, 2 and 4 name an address explicitly, so they cannot misfire. Rule 3's bare-name
// fallback is the one judgement call: a fragment that calls a user module named after a
// framework module (`vec_map::my_helper`, `display::render`) without an in-block `use` is
// reported, wrongly. UNBOUND_DENY holds the names where that was judged likely enough to
// matter; for the rest the remedy is to add the real `use` line to the block, or `@check:skip`.
//
// What is NOT checked (each would be a false-positive source):
//   - Anything under an address the index does not carry. Doc blocks are full of
//     `marketplace::`, `nft::`, `my_module::` — and `deepbook::`, which in these skills
//     means the DeepBook *v3* app package, not the framework's DeepBook v2 at 0xdee9.
//   - Visibility. `public(package)` members show up legitimately in teaching fragments.
//   - Types, arities, generics, borrow semantics — that needs a compiler, not an index.
//   - `sui :: coin :: mint(...)` — legal Move, essentially never written, and not matched.
//   - **Move 2024 method syntax** (`payment.value()`, `pool.reserve.join(b)`) — ~70 call sites
//     in the current corpus, none of them checked. Resolving a receiver to its type needs type
//     inference; an index cannot do it. This is the largest unchecked surface here, and since
//     method syntax is the dominant idiom in these skills, a green run says much less about a
//     block written in that style than about one using `module::function(...)` calls.
//
// Scope is `skills/` and `rules/` (SCAN_DIRS) — the shipped plugin content. `docs/` is out of
// scope deliberately, not for lack of Move: three historical plan documents under
// `docs/superpowers/plans/` carry 17 ```move fences between them. They record what was done at
// the time and are not content the plugin serves, so drift there is expected rather than a
// defect. Nothing would notice a Move fence appearing in `agents/` or `README.md`.
//
// Per-block opt-out: `// @check:skip` as the first non-blank line, matching the TS gate.
// Skipped blocks still get their `use` paths checked (rule 1 and 2): the body may be
// pseudo-code, but a fabricated framework API must never be able to hide behind the marker.
//
// Baseline: known-failures.txt holds `<md path> <symbol>` pairs that already fail. Only
// NEW pairs break the build; entries that stopped failing are reported as stale.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// `--root <dir>` / `--baseline <file>` exist so the self-tests can drive the gate over a
// throwaway fixture tree instead of the real corpus. Production runs pass neither.
function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  if (i === -1) return fallback
  const v = process.argv[i + 1]
  if (v === undefined || v.startsWith('--')) {
    console.error(`check-move-symbols: ${name} needs a value`)
    process.exit(2)
  }
  return v
}

// A floor that parses to NaN compares false against everything, i.e. silently switches the
// guard off — and a value-less flag (`--min-blocks-skills --min-resolved 70`) is exactly the
// shape of an ordinary typo. Reject anything that is not a non-negative integer. Validation runs
// even where the value is then ignored, so a typo is never silently accepted.
function numArg(name, fallback) {
  const raw = arg(name, null)
  if (raw === null) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) {
    console.error(`check-move-symbols: ${name} needs a non-negative integer, got ${JSON.stringify(raw)}`)
    process.exit(2)
  }
  return n
}

const REPO_ROOT = arg('--root', join(HERE, '..', '..', '..'))
const INDEX_PATH = join(HERE, 'index.json')
const BASELINE_PATH_RAW = arg('--baseline', join(HERE, 'known-failures.txt'))
const SCAN_DIRS = ['skills', 'rules']

// On this repo the floors are constants: `--no-floors`, `--min-resolved 0` and friends are
// test-only affordances for fixture trees, and a guard whose own CI can be told to switch it
// off is not a guard.
//
// Identity is device + inode, not a resolved path string: macOS ships a case-insensitive
// filesystem where `realpathSync` does NOT canonicalise case, so a differently-cased spelling
// of this repo's path scans the identical corpus while comparing unequal — floors off.
// The comparison is against *this script's own* tree, which is what CI runs; a copy of this
// directory placed elsewhere and pointed here with --root is a foreign root by construction.
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

// Same principle as the floors: on this repo the baseline is the version-controlled one, so a
// run cannot be pointed at a permissive substitute. Silently ignoring a flag is its own trap, so
// say so — a flag that appears to work but does nothing is worse than one that is rejected.
const BASELINE_PATH = IS_SELF ? join(HERE, 'known-failures.txt') : BASELINE_PATH_RAW
if (IS_SELF && process.argv.includes('--baseline')) {
  console.error('note: --baseline is ignored on this repo; using the committed known-failures.txt')
}

const ADDRESSES = new Set(['std', 'sui', 'sui_system'])

// Sui's implicit module aliases — usable without a `use`. Anything else must be imported.
const IMPLICIT = {
  vector: 'std::vector',
  option: 'std::option',
  object: 'sui::object',
  transfer: 'sui::transfer',
  tx_context: 'sui::tx_context',
}

// Doc fragments routinely call `test_scenario::next_tx(...)` or `coin::mint_for_testing(...)`
// with the `use` line cropped out of the excerpt. Resolving those bare names covers ~100 more
// references — but only where the name cannot plausibly mean something else. A bare name is
// NOT resolved when:
//   - it is ambiguous across addresses (`std::bcs` vs `sui::bcs`), or
//   - it is a common noun an app module would also claim. `token` is the live example: skills
//     write `use token::deep;` for DeepBook's DEEP package, and resolving a bare `token::deep`
//     against `sui::token` would report a fabrication that is not one.
// A name here is not unchecked everywhere — an explicit `use sui::token;` still binds it.
// Names that exist under more than one address (`std::bcs` / `sui::bcs`) need no entry here:
// BARE below maps them to null structurally. These are the ones that need a decision:
const UNBOUND_DENY = new Set([
  // Also an *address*. `sui::coin::mint` is address-qualified, but `sui` is likewise the name
  // of the SUI coin module (`sui::sui`), so a bare `sui::x` is undisambiguable: `use sui::coin;`
  // reads as "member `coin` of `sui::sui`". Removing these three used to fire nine false
  // findings on the real corpus; today the `use` spans are blanked before rule 3 runs, so that
  // particular nine is 0 and the entries stand as defence for any `sui::x` outside a `use`.
  // `sui_system::sui_system` is the same shape. (`std` names no module, but is listed so the
  // rule reads as "the three addresses", not two-plus-a-coincidence.)
  'sui', 'std', 'sui_system',
  // Plausible app module names. `token` is the live case: skills write `use token::deep;` for
  // DeepBook's DEEP package, and a bare `token::deep` resolved against `sui::token` would
  // report a fabrication that is not one.
  'token', 'config', 'internal', 'math', 'types', 'package',
])

const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'))
const MODULES = index.modules

// Bare framework module name -> full key, for names that survive UNBOUND_DENY.
const BARE = new Map()
for (const key of Object.keys(index.modules)) {
  const name = key.split('::')[1]
  if (UNBOUND_DENY.has(name)) continue
  if (BARE.has(name)) BARE.set(name, null) // ambiguous at runtime too: never resolve
  else BARE.set(name, key)
}

// ---------------------------------------------------------------------------
// Staleness guard: the vendored index must match the sui version README declares.
// Without this the gate would keep passing against a framework surface nobody ships
// any more — a watcher that is green because it stopped watching.
// ---------------------------------------------------------------------------
function checkIndexStamp() {
  const readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8')
  // Every occurrence must agree: taking the first match alone would let a stray older version
  // earlier in the file silently re-point the staleness guard at a release nobody ships.
  const all = [...readme.matchAll(/mainnet v(\d+\.\d+\.\d+)/g)].map((x) => x[1])
  const distinct = [...new Set(all)]
  if (distinct.length > 1) {
    return `README.md declares more than one mainnet version (${distinct.join(', ')}); cannot tell which one the Move symbol index should track.`
  }
  const m = all.length ? [null, all[0]] : null
  if (!m) {
    return [
      'README.md no longer declares a "mainnet vX.Y.Z" version, so the Move symbol index',
      'cannot be checked for staleness. Restore the declaration or update this gate.',
    ].join('\n')
  }
  const expected = `mainnet-v${m[1]}`
  if (index.tag !== expected) {
    return [
      `Move symbol index is stamped ${index.tag} but README.md declares ${expected}.`,
      'Regenerate it against the declared release:',
      '',
      '  git clone --filter=blob:none --no-checkout --depth 1 \\',
      `    --branch ${expected} https://github.com/MystenLabs/sui.git /tmp/sui-fw`,
      '  cd /tmp/sui-fw && git sparse-checkout set --cone crates/sui-framework/packages && git checkout',
      '  node scripts/ci/move-symbols/build-index.mjs --src /tmp/sui-fw',
    ].join('\n')
  }
  return null
}

// ---------------------------------------------------------------------------
// Markdown -> ```move blocks
// ---------------------------------------------------------------------------
function walkMd(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const p = join(dir, e.name)
    // statSync, not the dirent: a symlinked subtree reports as neither a directory nor a .md
    // file, so a dirent-only walk would skip it silently.
    let isDir = e.isDirectory()
    if (e.isSymbolicLink()) {
      try {
        isDir = statSync(p).isDirectory()
      } catch {
        continue // broken link
      }
    }
    if (isDir) walkMd(p, acc)
    else if (/\.md$/i.test(e.name)) acc.push(p)
  }
  return acc
}

// Every fence is tracked, not just Move ones, and at any indent. Three reasons, each a way a
// naive scanner goes quietly blind:
//   - A ```` ```move ```` nested inside an outer ````` ````markdown ````` wrapper is example
//     text, not code to check — only possible to tell by knowing a fence is already open.
//   - A fence closes on the same character repeated at least as many times as it opened, so
//     ```` ``` ```` inside a ```` ```` ```` block is body text, not a terminator.
//   - Indented (list item) and `~~~` fences are real Move blocks; skipping them silently is the
//     worst failure mode a gate has. An unclosed fence is reported for the same reason.
// A fence may sit inside a blockquote (`> ```move`), which the docs use for callouts. The
// quote prefix is stripped before matching, and the same prefix depth is required to close, so
// a quoted fence cannot be closed by an unquoted one.
const QUOTE_RE = /^(\s*(?:>\s?)*)(.*)$/
function splitQuote(line) {
  const m = line.match(QUOTE_RE)
  return { depth: (m[1].match(/>/g) ?? []).length, rest: m[2] }
}

// Fences are tracked as a stack, so a ```move block nested inside a ````markdown wrapper (the
// architect skill shows what a generated document looks like) is still real Move and still
// checked. An earlier version skipped nested blocks as "example text", putting 10 blocks out of
// reach; the volume was negligible (3 framework references between them, all resolved elsewhere
// anyway), but blocks swallowed by a *misparse* were reported under that same "deliberately
// skipped" label — a real hole wearing a documented exclusion's name.
// Deliberately-wrong snippets use `// @check:skip`, which is what that marker is for.
//
// A fence closes only on the same character, repeated at least as many times, at the same quote
// depth. Anything left open at EOF is a structural error: a dangling ```text swallows every
// Move block after it.
function extractMoveBlocks(text) {
  const lines = text.split('\n')
  const blocks = []
  const problems = []
  const stack = []
  const OPEN_RE = /^\s*(`{3,}|~{3,})\s*(\S*)/
  const CLOSE_RE = /^\s*(`{3,}|~{3,})\s*$/

  // Every line inside a move fence is body text of that fence, including the fence lines of
  // blocks nested within it.
  const feed = (rest) => {
    for (const f of stack) if (f.isMove) f.buf.push(rest)
  }

  for (let i = 0; i < lines.length; i++) {
    const { depth, rest } = splitQuote(lines[i])
    const top = stack[stack.length - 1]
    const c = rest.match(CLOSE_RE)
    if (top && c && depth === top.depth && c[1][0] === top.char && c[1].length >= top.len) {
      stack.pop()
      if (top.isMove) blocks.push({ body: top.buf.join('\n'), startLine: top.startLine })
      // The closer belongs to whatever still encloses it: without this an outer move block
      // loses a line and every finding after a nested block reports one line early.
      feed(rest)
      continue
    }
    const o = rest.match(OPEN_RE)
    // Inside a fence, only a ```move opener starts a nested block. A bare ``` that is not a
    // valid closer is literal content per CommonMark — treating it as a new fence would end the
    // enclosing block early and leave everything after it unchecked.
    const opensHere = o && (stack.length === 0 || /^move\b/i.test(o[2]))
    if (opensHere) {
      feed(rest)
      stack.push({
        char: o[1][0],
        len: o[1].length,
        depth,
        isMove: /^move\b/i.test(o[2]),
        startLine: i + 2, // first body line, 1-indexed
        fenceLine: i + 1,
        buf: [],
      })
      continue
    }
    feed(rest)
  }

  for (const f of stack) {
    problems.push({
      line: f.fenceLine,
      reason: f.isMove
        ? 'unclosed ```move fence — block not checked'
        : 'unclosed non-move fence — any ```move block inside it is swallowed unchecked',
    })
  }
  return { blocks, problems }
}

// Strip comments and string/byte-string literals so commented-out or quoted code never
// produces a finding. Offsets are preserved 1:1 (every consumed character is replaced by a
// space or its own newline) so a finding's offset still maps to the right source line.
//
// Returns `unterminated` when a literal or block comment runs to EOF. That case matters: the
// scanner would otherwise blank the entire rest of the block, and a fabricated symbol after a
// stray `"` would pass unseen. The caller turns it into a finding instead.
function stripNoise(src) {
  let out = ''
  let i = 0
  const n = src.length
  let unterminated = null
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k++) out += src[k] === '\n' ? '\n' : ' '
  }
  while (i < n) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      const start = i
      while (i < n && src[i] !== '\n') i++
      blank(start, i)
    } else if (c === '/' && src[i + 1] === '*') {
      const start = i
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      if (i >= n) unterminated ??= 'block comment'
      i = Math.min(i + 2, n)
      blank(start, i)
    } else if (c === '"') {
      const start = i
      i++
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\') i++
        i++
      }
      if (i >= n) unterminated ??= 'string literal'
      i = Math.min(i + 1, n)
      blank(start, i)
    } else {
      out += c
      i++
    }
  }
  return { out, unterminated }
}

// ---------------------------------------------------------------------------
// `use` parsing
// ---------------------------------------------------------------------------

// Split on commas that sit at brace depth 0.
function splitTop(s) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '{') depth++
    else if (ch === '}') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map((p) => p.trim()).filter(Boolean)
}

// `sui::{coin::{Self, Coin}, balance}` -> ['sui::coin::Self', 'sui::coin::Coin', 'sui::balance']
// Returns null when the tree does not parse, so callers can ignore it rather than guess.
function expandUseTree(tree) {
  const t = tree.trim()
  const open = t.indexOf('{')
  if (open === -1) return [t]
  if (!t.endsWith('}')) return null
  const prefix = t.slice(0, open).replace(/::$/, '')
  const inner = t.slice(open + 1, -1)
  const out = []
  for (const part of splitTop(inner)) {
    const sub = expandUseTree(part)
    if (sub === null) return null
    for (const s of sub) out.push(prefix ? `${prefix}::${s}` : s)
  }
  return out
}

// One `use` path -> what it binds. Unparseable shapes return null (ignored).
function classifyUsePath(path) {
  const asMatch = path.match(/^(.*?)\s+as\s+([A-Za-z_][A-Za-z_0-9]*)$/)
  const alias = asMatch ? asMatch[2] : null
  const raw = (asMatch ? asMatch[1] : path).trim()
  const segs = raw.split('::').map((s) => s.trim())
  if (segs.some((s) => !/^[A-Za-z_][A-Za-z_0-9]*$/.test(s))) return null

  if (segs.length === 2) {
    // use a::b [as c]  -> module binding
    return { addr: segs[0], module: segs[1], member: null, bind: alias ?? segs[1] }
  }
  if (segs.length === 3) {
    if (segs[2] === 'Self') {
      // use a::b::{Self} -> module binding under its own name (or `Self as c`)
      return { addr: segs[0], module: segs[1], member: null, bind: alias ?? segs[1] }
    }
    // use a::b::X [as Y] -> member binding; X must exist, but binds no module alias
    return { addr: segs[0], module: segs[1], member: segs[2], bind: null }
  }
  return null
}

// ---------------------------------------------------------------------------
// Per-block analysis
// ---------------------------------------------------------------------------
function analyzeBlock(body, skipBody) {
  const { out: src, unterminated } = stripNoise(body)
  const findings = []
  const resolved = new Set()

  // Modules the block defines itself shadow same-named framework modules.
  if (unterminated) {
    findings.push({
      symbol: `<unterminated ${unterminated}>`,
      reason: `unterminated ${unterminated} — everything after it in this block is unchecked`,
      offset: 0,
    })
  }

  const selfDeclared = new Set()
  for (const m of src.matchAll(/\bmodule\s+[A-Za-z_][A-Za-z_0-9]*::([a-z_][a-z_0-9]*)/g)) {
    selfDeclared.add(m[1])
  }

  // Names the block binds to a non-framework address; they must never fall back to a
  // framework module of the same name.
  const shadowed = new Set()

  // alias -> "addr::module", starting from Sui's implicit aliases.
  const aliases = new Map()
  for (const [k, v] of Object.entries(IMPLICIT)) {
    if (!selfDeclared.has(k)) aliases.set(k, v)
  }

  // A symbol repeated within one block is reported once, at its first occurrence, so a single
  // mistake in a long example does not print twenty times. Across blocks it reports per block.
  const seen = new Set()
  // `offset` is an index into the (offset-preserving) stripped source, so the caller can turn
  // it into the real line inside the block instead of reporting the block's first line.
  const report = (symbol, reason, offset = 0) => {
    const key = `${symbol}|${reason}`
    if (seen.has(key)) return
    seen.add(key)
    findings.push({ symbol, reason, offset })
  }

  const checkModule = (addr, mod, offset = 0) => {
    const key = `${addr}::${mod}`
    if (MODULES[key]) {
      resolved.add(key)
      return true
    }
    report(key, `no module \`${key}\` in ${index.tag}`, offset)
    return false
  }
  const checkMember = (addr, mod, member, offset = 0) => {
    const key = `${addr}::${mod}`
    if (!MODULES[key]) return checkModule(addr, mod, offset)
    if (MODULES[key].includes(member)) {
      resolved.add(`${key}::${member}`)
      return true
    }
    report(`${key}::${member}`, `\`${key}\` has no member \`${member}\` in ${index.tag}`, offset)
    return false
  }

  // ---- 1 & 2: `use` statements (checked even for @check:skip blocks) ----
  // Not anchored to line start: `module app::m { use sui::x; }` on one line is legal Move.
  const useSpans = []
  for (const stmt of src.matchAll(/\buse\s+([^;{}]*(?:\{[^}]*\})?[^;]*);/g)) {
    const tree = stmt[1].trim()
    // No special case for `use fun sui::coin::f as Coin.f;` — a method alias cannot classify as
    // a module path (segment 0 parses as "fun sui", which fails the identifier test), so it
    // leaves `classified` at 0, its span is never blanked, and rule 4 still resolves the path
    // inside it. The same holds for a cropped `use sui::coin` with no semicolon, whose span runs
    // to the next semicolon and swallows real code: blanking a span nobody checked would be a
    // strict loss of coverage.
    const paths = expandUseTree(tree)
    if (paths === null) continue
    // Blank the span only once something inside it actually classified as a use-path. A cropped
    // `use sui::coin` with no semicolon runs the match to the *next* semicolon and swallows real
    // code; blanking a span nobody checked would hide whatever it ate.
    let classified = 0
    for (const p of paths) {
      const c = classifyUsePath(p)
      if (!c) continue
      classified++
      // No `selfDeclared` escape, for the same reason rule 4 has none: `use sui::coin::{...}`
      // names the framework even inside `module app::coin;` — that is what the address is for,
      // and a wrapper module named after the one it wraps is ordinary teaching material.
      // `selfDeclared` gates only the bare-name fallback below, where the name is all we have.
      const isFramework = ADDRESSES.has(c.addr)
      if (isFramework) {
        if (c.member === null) checkModule(c.addr, c.module, stmt.index)
        else checkMember(c.addr, c.module, c.member, stmt.index)
      }
      // Bindings are recorded regardless of address: a `use my_app::coin;` must be able
      // to shadow the framework name so `coin::foo(...)` is not resolved against `sui::coin`.
      if (c.bind) {
        if (isFramework) {
          aliases.set(c.bind, `${c.addr}::${c.module}`)
        } else {
          aliases.delete(c.bind)
          shadowed.add(c.bind)
        }
      }
    }
    if (classified > 0) useSpans.push([stmt.index, stmt.index + stmt[0].length])
  }

  if (skipBody) return { findings, resolved }

  // Rules 3 and 4 scan the body only. A `use` line already had its paths checked above, and
  // re-scanning it double-reports; worse, `use sui_system::sui_system;` (the canonical staking
  // import) binds alias `sui_system`, and the alias regex then reads that same text as
  // "member `sui_system` of `sui_system::sui_system`" — a false positive on correct code, which
  // is how a gate gets muted. Blanked offset-preserving so line numbers still hold.
  let scanSrc = src
  for (const [from, to] of useSpans) {
    scanSrc =
      scanSrc.slice(0, from) +
      scanSrc.slice(from, to).replace(/[^\n]/g, ' ') +
      scanSrc.slice(to)
  }

  // Bare framework module names the block never imported and never shadowed.
  for (const [name, key] of BARE) {
    if (key === null) continue
    if (aliases.has(name) || shadowed.has(name) || selfDeclared.has(name)) continue
    if (!new RegExp(`\\b${name}::`).test(scanSrc)) continue
    aliases.set(name, key)
  }

  // ---- 3: alias-qualified references ----
  for (const [alias, target] of aliases) {
    const [addr, mod] = target.split('::')
    const re = new RegExp(`\\b${alias}::([A-Za-z_][A-Za-z_0-9]*)`, 'g')
    for (const m of scanSrc.matchAll(re)) {
      const member = m[1]
      // `alias::mod::member` is a fully qualified path handled by rule 4, not an
      // alias reference — skip when another `::` follows.
      if (scanSrc.slice(m.index + m[0].length).startsWith('::')) continue
      checkMember(addr, mod, member, m.index)
    }
  }

  // ---- 4: fully qualified paths ----
  // No `selfDeclared` escape here, unlike rule 3: `sui::coin::x` names the framework whatever
  // the block calls its own modules, and `module app::coin;` alongside a real `sui::coin::`
  // call is ordinary teaching material. This is also the only rule that reaches modules in
  // UNBOUND_DENY (`sui::package::`, `sui::token::`, ...), which bare names never resolve.
  const fqRe = /\b(std|sui|sui_system)::([a-z_][a-z_0-9]*)::([A-Za-z_][A-Za-z_0-9]*)/g
  for (const m of scanSrc.matchAll(fqRe)) {
    const [, addr, mod, member] = m
    checkMember(addr, mod, member, m.index)
  }

  return { findings, resolved }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const stampError = checkIndexStamp()
if (stampError) {
  console.error('\n❌ Move symbol index is stale:\n')
  console.error(stampError.replace(/^/gm, '  '))
  console.error('')
  process.exit(1)
}

const actual = [] // { file, line, symbol, reason }
const resolvedRefs = new Set()
const perDirBlocks = {}
const structural = []
const seenFindings = new Set()
let blockCount = 0
let skipCount = 0

for (const dir of SCAN_DIRS) {
  perDirBlocks[dir] = 0
  for (const file of walkMd(join(REPO_ROOT, dir)).sort()) {
    const rel = relative(REPO_ROOT, file)
    const { blocks, problems } = extractMoveBlocks(readFileSync(file, 'utf8'))
    // Structural problems bypass `actual` on purpose: a block the parser could not read is not
    // a known-failing symbol, and must not be silenceable with a known-failures.txt entry.
    for (const p of problems) structural.push({ file: rel, line: p.line, reason: p.reason })
    for (const { body, startLine } of blocks) {
      blockCount++
      perDirBlocks[dir]++
      const firstNonBlank = body.split('\n').find((l) => l.trim().length > 0) ?? ''
      const skipBody = /^\/\/\s*@check:skip\b/.test(firstNonBlank.trim())
      if (skipBody) skipCount++
      const { findings, resolved } = analyzeBlock(body, skipBody)
      for (const r of resolved) resolvedRefs.add(r)
      for (const f of findings) {
        // stripNoise preserves offsets, so the offset maps straight onto the raw body.
        const line = startLine + (body.slice(0, f.offset ?? 0).match(/\n/g)?.length ?? 0)
        // A nested block's text is also part of its enclosing block, so the same finding can
        // surface once per frame. Report each file/line/symbol once.
        const key = `${rel}|${line}|${f.symbol}`
        if (seenFindings.has(key)) continue
        seenFindings.add(key)
        actual.push({ file: rel, line, symbol: f.symbol, reason: f.reason })
      }
    }
  }
}

if (structural.length) {
  console.error('\n❌ Unparseable ```move blocks (these are NOT baselineable):\n')
  for (const p of structural) console.error(`  ${p.file}:${p.line}  ${p.reason}`)
  console.error('')
  process.exit(1)
}

const baseline = existsSync(BASELINE_PATH)
  ? readFileSync(BASELINE_PATH, 'utf8')
      .split('\n')
      .map((l) => l.replace(/#.*$/, '').trim())
      .filter(Boolean)
  : []
const baselineSet = new Set(baseline)
const actualPairs = new Set(actual.map((a) => `${a.file} ${a.symbol}`))

const regressions = actual.filter((a) => !baselineSet.has(`${a.file} ${a.symbol}`))
const stale = baseline.filter((b) => !actualPairs.has(b))

if (regressions.length) {
  console.error('\n❌ Unknown Move framework symbols in fenced ```move blocks:\n')
  let lastFile = null
  for (const r of regressions.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
    if (r.file !== lastFile) {
      console.error(`  --- ${r.file} ---`)
      lastFile = r.file
    }
    console.error(`  ${r.file}:${r.line}  ${r.reason}`)
  }
  console.error('')
  console.error('  Fix the symbol in the .md block. If the block is intentional pseudo-code,')
  console.error("  add '// @check:skip' as its first line — note that `use` paths are still")
  console.error('  checked in skipped blocks, so a fabricated framework API cannot hide there.')
  console.error('  Do NOT append to known-failures.txt to silence a real fabrication.')
  console.error('')
  process.exit(1)
}

// A gate that resolves nothing is green for the wrong reason. Guard the guard: if the
// corpus stops producing framework references, the parser (or the corpus) broke.
const MIN_RESOLVED_ARG = numArg('--min-resolved', 70)
const MIN_RESOLVED = IS_SELF ? 70 : MIN_RESOLVED_ARG

// Per-directory block floors. The resolved-symbol floor alone does not catch losing a whole
// scan directory: dropping `rules/` (38 of 142 blocks) still leaves 72 resolved, over the
// floor of 70, and the run stays green while a quarter of the corpus goes unchecked.
const MIN_BLOCKS_ARG = {
  skills: numArg('--min-blocks-skills', 95),
  rules: numArg('--min-blocks-rules', 30),
}
const MIN_BLOCKS = {
  skills: IS_SELF ? 95 : MIN_BLOCKS_ARG.skills,
  rules: IS_SELF ? 30 : MIN_BLOCKS_ARG.rules,
}

// Same rule as --baseline: a flag that appears to work but does nothing is worse than one that
// is rejected, so name every override this repo is ignoring.
if (IS_SELF) {
  const ignored = ['--no-floors', '--min-resolved', '--min-blocks-skills', '--min-blocks-rules']
    .filter((f) => process.argv.includes(f))
  if (ignored.length) {
    console.error(
      `note: ${ignored.join(', ')} ignored on this repo; floors are fixed at ` +
        `${MIN_RESOLVED} symbols / skills ${MIN_BLOCKS.skills} / rules ${MIN_BLOCKS.rules}`,
    )
  }
}

// `--no-floors` exists for the self-tests, whose fixtures are a handful of blocks by design.
// It is honoured only for a `--root` that is NOT this repo, so pointing it back at the real
// corpus cannot wave that corpus through. A flag that disables the guard must not be usable
// on the thing the guard exists to protect.
const FLOORS_ON = IS_SELF || !process.argv.includes('--no-floors')

if (FLOORS_ON) {
  for (const [dir, min] of Object.entries(MIN_BLOCKS)) {
    const got = perDirBlocks[dir] ?? 0
    if (got < min) {
      console.error(
        `\n❌ Only ${got} \`\`\`move blocks found under ${dir}/ (expected >= ${min}).\n` +
          '  A scan directory went missing or stopped matching, so part of the corpus is\n' +
          "  silently unchecked. Fix the cause; only lower the floor when the corpus really\n" +
          '  shrank, and say so in the commit message.\n',
      )
      process.exit(1)
    }
  }
}

if (FLOORS_ON && resolvedRefs.size < MIN_RESOLVED) {
  console.error(
    `\n❌ Only ${resolvedRefs.size} distinct framework symbols resolved across ` +
      `${blockCount} blocks (expected >= ${MIN_RESOLVED}).\n` +
      '  Either the ```move corpus shrank drastically or the reference parser stopped\n' +
      "  matching. A gate that checks nothing passes everything — fix it, don't lower the floor\n" +
      '  without saying why in the commit message.\n',
  )
  process.exit(1)
}

console.log(
  `✅ Move symbol check passed (${blockCount} blocks, ${skipCount} @check:skip, ` +
    `${resolvedRefs.size} framework symbols resolved, ${actual.length} known-failing refs, ` +
    `index ${index.tag}, floors ${FLOORS_ON ? 'enforced' : 'off'}).`,
)

if (stale.length) {
  console.log('ℹ️  known-failures.txt has stale entries (these now resolve):')
  for (const s of stale) console.log(`  ${s}`)
  console.log('  Remove them from scripts/ci/move-symbols/known-failures.txt.')
}
