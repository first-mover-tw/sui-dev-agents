#!/usr/bin/env node
// Build the vendored Move framework symbol index consumed by check-move-symbols.mjs.
//
// Usage:
//   node build-index.mjs --src <path-to-sui-repo-checkout> [--out index.json]
//
// <path-to-sui-repo-checkout> must be a git checkout of MystenLabs/sui at the tag
// this repo declares in README.md (see check-move-symbols.mjs, which fails when the
// index stamp and the README no longer agree). A sparse checkout is enough:
//
//   git clone --filter=blob:none --no-checkout --depth 1 --branch mainnet-vX.Y.Z \
//     https://github.com/MystenLabs/sui.git sui-fw
//   cd sui-fw && git sparse-checkout set --cone crates/sui-framework/packages && git checkout
//
// `#[test_only]` members are indexed alongside the rest: skills teach `sui::test_scenario` and
// `coin::mint_for_testing`, which only exist under that attribute, so excluding them would make
// the gate report the entire Move testing surface as fabricated.
//
// Only the three packages published at the well-known named addresses `std`, `sui`
// and `sui_system` are indexed. `deepbook` (DeepBook v2, 0xdee9) and `bridge` are
// deliberately excluded: skills use `deepbook::` for the DeepBook *v3* app package,
// so indexing the framework's deepbook would resolve those to the wrong surface.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))

const PACKAGES = [
  ['move-stdlib', 'std'],
  ['sui-framework', 'sui'],
  ['sui-system', 'sui_system'],
]

function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  return i === -1 ? fallback : process.argv[i + 1]
}

const src = arg('--src')
const out = arg('--out', join(HERE, 'index.json'))
if (!src) {
  console.error('build-index.mjs: --src <path-to-sui-repo-checkout> is required')
  process.exit(2)
}

// Strip line comments, block comments and string literals before scanning for
// declarations, so commented-out or quoted code never lands in the index.
// An unterminated literal or block comment is fatal here rather than silently swallowing the
// rest of the file: a truncated index is worse than no index, because the gate would then
// report real framework symbols as fabrications.
function stripNoise(src, file) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++
    } else if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      if (i >= n) {
        console.error(`build-index.mjs: unterminated block comment in ${file}`)
        process.exit(2)
      }
      i += 2
    } else if (c === '"') {
      out += ' '
      i++
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\') i++
        i++
      }
      if (i >= n) {
        console.error(`build-index.mjs: unterminated string literal in ${file}`)
        process.exit(2)
      }
      i++
    } else {
      out += c
      i++
    }
  }
  return out
}

const MODULE_RE = /\bmodule\s+([a-z_][a-z_0-9]*)::([a-z_][a-z_0-9]*)\s*[;{]/g
// Functions: `fun`, `entry fun`, `public fun`, `public(package) fun`, `public macro fun`, ...
const FUN_RE = /\b(?:public\s*(?:\([a-z_]+\)\s*)?)?(?:entry\s+)?(?:macro\s+)?fun\s+([a-z_][A-Za-z_0-9]*)/g
const TYPE_RE = /\b(?:public\s+)?(?:struct|enum)\s+([A-Z][A-Za-z_0-9]*)/g
const CONST_RE = /\bconst\s+([A-Za-z_][A-Za-z_0-9]*)\s*:/g
// `public use fun sui::pay::split_vec as Coin.split_vec;` re-exports a *method*, not a
// module-qualified path, so it must NOT add a member to the declaring module.
const USE_FUN_RE = /\buse\s+fun\b/

function collectMoveFiles(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) collectMoveFiles(p, acc)
    else if (e.name.endsWith('.move')) acc.push(p)
  }
  return acc
}

const modules = {} // "sui::coin" -> Set(members)

for (const [pkgDir, addr] of PACKAGES) {
  const sources = join(src, 'crates/sui-framework/packages', pkgDir, 'sources')
  if (!existsSync(sources)) {
    console.error(`build-index.mjs: missing ${sources}`)
    process.exit(2)
  }
  for (const file of collectMoveFiles(sources)) {
    const text = stripNoise(readFileSync(file, 'utf8'), file)

    // Split the file into module regions. Label form (`module a::b;`) runs to the next
    // module declaration or EOF; block form (`module a::b { ... }`) does too here, which
    // is safe because a .move file never nests two block modules.
    const decls = [...text.matchAll(MODULE_RE)]
    for (let i = 0; i < decls.length; i++) {
      const d = decls[i]
      const [, declAddr, name] = d
      if (declAddr !== addr) continue // e.g. a test module declared under another address
      const start = d.index + d[0].length
      const end = i + 1 < decls.length ? decls[i + 1].index : text.length
      const body = text.slice(start, end)
      const key = `${addr}::${name}`
      const set = (modules[key] ??= new Set())

      for (const line of body.split('\n')) {
        if (USE_FUN_RE.test(line)) continue
        for (const m of line.matchAll(FUN_RE)) set.add(m[1])
        for (const m of line.matchAll(TYPE_RE)) set.add(m[1])
        for (const m of line.matchAll(CONST_RE)) set.add(m[1])
      }
    }
  }
}

function git(...args) {
  return execFileSync('git', ['-C', src, ...args], { encoding: 'utf8' }).trim()
}

const commit = git('rev-parse', 'HEAD')
let tag = ''
try {
  tag = git('describe', '--tags', '--exact-match')
} catch {
  console.error('build-index.mjs: checkout is not at an exact tag; refusing to stamp an ambiguous index')
  process.exit(2)
}

const index = {
  _comment: 'GENERATED by build-index.mjs. Do not hand-edit. See scripts/ci/README.md.',
  tag,
  commit,
  generated: new Date().toISOString().slice(0, 10),
  packages: PACKAGES.map(([, addr]) => addr),
  modules: Object.fromEntries(
    Object.entries(modules)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, [...v].sort()]),
  ),
}

writeFileSync(out, JSON.stringify(index, null, 2) + '\n')

const modCount = Object.keys(index.modules).length
const memCount = Object.values(index.modules).reduce((n, m) => n + m.length, 0)
console.log(`✅ wrote ${out}`)
console.log(`   tag ${tag} (${commit.slice(0, 12)}) — ${modCount} modules, ${memCount} members`)
