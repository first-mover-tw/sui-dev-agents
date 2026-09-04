// scripts/freshness/tests/fetch-markers.test.mjs
// Covers the two marker kinds added 2026-09-04: `kind: 'endpoint'` (watch the
// deployment, not the repo) and `kind: 'page'` + `fingerprint` (watch content,
// not headers that rotate on every CDN rebuild).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchMarker } from '../fetch.mjs'
import { ERROR_MARKER, EXTRACT_FAILED } from '../core.mjs'

function fakeRunner(map) {
  return async (cmd, args) => {
    const key = [cmd, ...args].join(' ')
    for (const [needle, out] of Object.entries(map)) {
      if (key.includes(needle)) return { code: 0, stdout: out, stderr: '' }
    }
    return { code: 1, stdout: '', stderr: 'no match: ' + key }
  }
}

// ---- kind: 'endpoint' ----

test('endpoint source -> scalar at jsonPath', async () => {
  const run = fakeRunner({ '/health': '{"mode":"production","build":{"commit":"559531fe"}}' })
  const m = await fetchMarker({ id: 'r', kind: 'endpoint', url: 'https://x/health', jsonPath: 'build.commit' }, run)
  assert.equal(m, '559531fe')
})

test('endpoint source -> missing jsonPath is EXTRACT_FAILED, not a silent pass', async () => {
  const run = fakeRunner({ '/health': '{"mode":"production"}' })
  const m = await fetchMarker({ id: 'r', kind: 'endpoint', url: 'https://x/health', jsonPath: 'build.commit' }, run)
  assert.equal(m, `${EXTRACT_FAILED}:r`)
})

test('endpoint source -> non-JSON body is EXTRACT_FAILED', async () => {
  const run = fakeRunner({ '/health': '<html>maintenance</html>' })
  const m = await fetchMarker({ id: 'r', kind: 'endpoint', url: 'https://x/health', jsonPath: 'build.commit' }, run)
  assert.equal(m, `${EXTRACT_FAILED}:r`)
})

test('endpoint source -> a container at jsonPath is refused (never "[object Object]")', async () => {
  const run = fakeRunner({ '/health': '{"build":{"commit":{"sha":"abc"}}}' })
  const m = await fetchMarker({ id: 'r', kind: 'endpoint', url: 'https://x/health', jsonPath: 'build.commit' }, run)
  assert.equal(m, `${EXTRACT_FAILED}:r`)
})

test('endpoint source -> jsonPath does not walk the prototype chain', async () => {
  // `toString` exists on every object; reaching it would yield a marker that is
  // identical for every service and never changes again.
  const run = fakeRunner({ '/health': '{"build":{}}' })
  const m = await fetchMarker({ id: 'r', kind: 'endpoint', url: 'https://x/health', jsonPath: 'build.toString' }, run)
  assert.equal(m, `${EXTRACT_FAILED}:r`)
})

test('endpoint source -> unreachable service is ERROR_MARKER, NOT EXTRACT_FAILED', async () => {
  // The two must stay distinct: an error is retried quietly, an extract failure is
  // escalated as drift. Collapsing them either spams the banner or silences it.
  const run = async () => ({ code: 7, stdout: '', stderr: 'connection refused' })
  const m = await fetchMarker({ id: 'r', kind: 'endpoint', url: 'https://x/health', jsonPath: 'build.commit' }, run)
  assert.equal(m, ERROR_MARKER)
})

test('endpoint source -> remote value is sanitized before it can reach a banner', async () => {
  const evil = ['abc', 'def'].join('\n') + 'x'.repeat(400)
  const run = fakeRunner({ '/health': JSON.stringify({ build: { commit: evil } }) })
  const m = await fetchMarker({ id: 'r', kind: 'endpoint', url: 'https://x/health', jsonPath: 'build.commit' }, run)
  assert.ok(!m.includes('\n'), 'no newline may survive into the marker')
  assert.ok(m.length <= 201, `marker must be capped, got ${m.length}`)
  assert.match(m, /^abc defx+…$/) // the newline became a single space, then the tail was cut
})

// ---- kind: 'page' + fingerprint ----

const releaseHtml = (versions, protocols) =>
  versions.map(v => `<h2 class="anchor" id="${v}">Sui ${v}</h2>`).join('\n') +
  protocols.map(p => `<h3 id="protocol-version-in-this-release-${p}">Sui Protocol ${p}</h3>`).join('\n')

const FP = { id: 'docs', kind: 'page', fingerprint: 'sui-release-notes', url: 'https://x' }
const FIVE = ['v1790', 'v1781', 'v1773', 'v1772', 'v1761']

test('page fingerprint -> newest anchor, count, top protocol, digest', async () => {
  const m = await fetchMarker(FP, fakeRunner({ '-sL': releaseHtml(FIVE, [136, 135, 135]) }))
  assert.match(m, /^v1790\/5 p136 [0-9a-f]{12}$/)
})

test('page fingerprint -> ignores Last-Modified entirely', async () => {
  // The whole reason this source moved off headers: they rotate on CDN rebuilds.
  const run = fakeRunner({
    '-sIL': 'HTTP/2 200\r\nlast-modified: Fri, 04 Sep 2026 05:42:47 GMT\r\n',
    '-sL': releaseHtml(FIVE, [136]),
  })
  const m = await fetchMarker(FP, run)
  assert.ok(!m.includes('Sep'), 'fingerprint must not fall back to the header marker')
  assert.match(m, /^v1790\/5 /)
})

test('page fingerprint -> a MIDDLE entry changing still drifts at a constant count', async () => {
  // Same newest anchor, same release count, same top protocol — only a middle
  // entry differs. A digest taken over just ids[0] would call these identical,
  // and a back-dated release would land in the corpus unnoticed.
  const a = await fetchMarker(FP, fakeRunner({ '-sL': releaseHtml(['v1790', 'v1781', 'v1773', 'v1772', 'v1761'], [136]) }))
  const b = await fetchMarker(FP, fakeRunner({ '-sL': releaseHtml(['v1790', 'v1781', 'v1774', 'v1772', 'v1761'], [136]) }))
  assert.match(a, /^v1790\/5 p136 /)
  assert.match(b, /^v1790\/5 p136 /)
  assert.notEqual(a, b, 'only the digest can distinguish these two')
})

test('page fingerprint -> a new protocol version alone still drifts', async () => {
  const a = await fetchMarker(FP, fakeRunner({ '-sL': releaseHtml(FIVE, [135]) }))
  const b = await fetchMarker(FP, fakeRunner({ '-sL': releaseHtml(FIVE, [135, 136]) }))
  assert.notEqual(a, b)
})

test('page fingerprint -> the protocol SET is in the digest, not just its maximum', async () => {
  // Same top protocol, different set below it. Without the set in the digest a
  // dropped or back-filled protocol version would be invisible.
  const a = await fetchMarker(FP, fakeRunner({ '-sL': releaseHtml(FIVE, [134, 136]) }))
  const b = await fetchMarker(FP, fakeRunner({ '-sL': releaseHtml(FIVE, [135, 136]) }))
  assert.match(a, /^v1790\/5 p136 /)
  assert.match(b, /^v1790\/5 p136 /)
  assert.notEqual(a, b)
})

test('page fingerprint -> identical content yields an identical marker', async () => {
  const html = releaseHtml(FIVE, [136, 135])
  const a = await fetchMarker(FP, fakeRunner({ '-sL': html }))
  const b = await fetchMarker(FP, fakeRunner({ '-sL': html }))
  assert.equal(a, b)
})

test('page fingerprint -> repeated protocol ids do not change the marker', async () => {
  // The same protocol id appears many times per release section in the real page.
  const a = await fetchMarker(FP, fakeRunner({ '-sL': releaseHtml(FIVE, [136, 135]) }))
  const b = await fetchMarker(FP, fakeRunner({ '-sL': releaseHtml(FIVE, [136, 136, 135, 135, 135]) }))
  assert.equal(a, b)
})

test('page fingerprint -> too few releases is EXTRACT_FAILED (markup moved, not history deleted)', async () => {
  const m = await fetchMarker(FP, fakeRunner({ '-sL': releaseHtml(['v1790', 'v1781'], [136]) }))
  assert.equal(m, `${EXTRACT_FAILED}:docs`)
})

test('page fingerprint -> no protocol ids is EXTRACT_FAILED', async () => {
  const m = await fetchMarker(FP, fakeRunner({ '-sL': releaseHtml(FIVE, []) }))
  assert.equal(m, `${EXTRACT_FAILED}:docs`)
})

test('page fingerprint -> unknown fingerprint name never degrades to the header marker', async () => {
  const run = fakeRunner({ '-sIL': 'HTTP/2 200\r\nlast-modified: Fri, 04 Sep 2026 05:42:47 GMT\r\n' })
  const m = await fetchMarker({ id: 'docs', kind: 'page', fingerprint: 'typo-name', url: 'https://x' }, run)
  assert.equal(m, `${EXTRACT_FAILED}:docs`)
})

test('page fingerprint -> unreachable page is ERROR_MARKER, not EXTRACT_FAILED', async () => {
  const run = async () => ({ code: 6, stdout: '', stderr: 'could not resolve host' })
  const m = await fetchMarker(FP, run)
  assert.equal(m, ERROR_MARKER)
})

test('page WITHOUT a fingerprint still uses Last-Modified', async () => {
  const run = fakeRunner({ '-sIL': 'HTTP/2 200\r\nlast-modified: Wed, 08 Jun 2026 10:00:00 GMT\r\n' })
  const m = await fetchMarker({ id: 'other', kind: 'page', url: 'https://x' }, run)
  assert.equal(m, 'Wed, 08 Jun 2026 10:00:00 GMT')
})

// ---- kind: 'files' (2026-09-04: replaced a `dev` HEAD marker whose S/N was bad) ----

const SHA_A = 'a'.repeat(40), SHA_B = 'b'.repeat(40), SHA_C = 'c'.repeat(40)
const FILES = {
  id: 'mw', kind: 'files', repo: 'O/R', ref: 'dev',
  paths: ['SKILL.md', 'docs/llms.txt'],
}
// Keyed on the path so each file can answer differently — the whole point of the
// kind is telling WHICH tracked file moved.
function filesRunner(byPath) {
  return async (cmd, args) => {
    const key = args.join(' ')
    for (const [path, res] of Object.entries(byPath)) {
      if (key.includes(`contents/${path}`)) return { code: 0, stdout: '', stderr: '', ...res }
    }
    return { code: 1, stdout: '', stderr: 'unexpected: ' + key }
  }
}

test('files source -> marker names each path with its blob sha', async () => {
  const m = await fetchMarker(FILES, filesRunner({
    'SKILL.md': { stdout: SHA_A + '\n' }, 'docs/llms.txt': { stdout: SHA_B + '\n' },
  }))
  assert.equal(m, `SKILL.md@${'a'.repeat(8)} docs/llms.txt@${'b'.repeat(8)}`)
})

test('files source -> requests the configured ref, not the default branch', async () => {
  const seen = []
  await fetchMarker(FILES, async (cmd, args) => {
    seen.push(args[1])
    return { code: 0, stdout: SHA_A, stderr: '' }
  })
  assert.deepEqual(seen, ['repos/O/R/contents/SKILL.md?ref=dev', 'repos/O/R/contents/docs/llms.txt?ref=dev'])
})

test('files source -> ONE tracked file changing drifts the marker', async () => {
  // The reason this source exists: a branch-HEAD marker drifts on every push,
  // this one only when the quoted material actually moves.
  const a = await fetchMarker(FILES, filesRunner({ 'SKILL.md': { stdout: SHA_A }, 'docs/llms.txt': { stdout: SHA_B } }))
  const b = await fetchMarker(FILES, filesRunner({ 'SKILL.md': { stdout: SHA_A }, 'docs/llms.txt': { stdout: SHA_C } }))
  assert.notEqual(a, b)
  assert.equal(a.split(' ')[0], b.split(' ')[0], 'the untouched file must keep its marker segment')
})

test('files source -> unchanged blobs yield a byte-identical marker', async () => {
  const run = filesRunner({ 'SKILL.md': { stdout: SHA_A }, 'docs/llms.txt': { stdout: SHA_B } })
  assert.equal(await fetchMarker(FILES, run), await fetchMarker(FILES, run))
})

test('files source -> a 404 on a tracked path is EXTRACT_FAILED, not ERROR', async () => {
  // Renamed/deleted upstream: retrying quietly would leave the source green
  // forever while it watches nothing.
  const m = await fetchMarker(FILES, filesRunner({
    'SKILL.md': { stdout: SHA_A },
    'docs/llms.txt': { code: 1, stdout: '{"message":"Not Found","status":"404"}', stderr: 'gh: Not Found (HTTP 404)' },
  }))
  assert.equal(m, `${EXTRACT_FAILED}:mw`)
})

test('files source -> a 404 reported only on stdout is still EXTRACT_FAILED', async () => {
  const m = await fetchMarker(FILES, filesRunner({
    'SKILL.md': { stdout: SHA_A },
    'docs/llms.txt': { code: 1, stdout: '{"message":"Not Found","status":"404"}', stderr: '' },
  }))
  assert.equal(m, `${EXTRACT_FAILED}:mw`)
})

test('files source -> a network failure on ANY path is ERROR_MARKER, never a partial marker', async () => {
  // A partial marker would drift once now and once more when the flaky path
  // comes back, for zero upstream change.
  const m = await fetchMarker(FILES, filesRunner({
    'SKILL.md': { stdout: SHA_A },
    'docs/llms.txt': { code: 1, stderr: 'error connecting to api.github.com' },
  }))
  assert.equal(m, ERROR_MARKER)
})

test('files source -> a path pointing at a directory is EXTRACT_FAILED', async () => {
  // The contents API answers with an array; the jq guard yields "" at exit 0, so
  // this must land as a config bug and not as a retryable network error.
  const m = await fetchMarker(FILES, filesRunner({
    'SKILL.md': { stdout: SHA_A }, 'docs/llms.txt': { code: 0, stdout: '\n' },
  }))
  assert.equal(m, `${EXTRACT_FAILED}:mw`)
})

test('files source -> a non-sha answer is EXTRACT_FAILED, not a marker', async () => {
  const m = await fetchMarker(FILES, filesRunner({
    'SKILL.md': { stdout: SHA_A }, 'docs/llms.txt': { stdout: 'Not Found' },
  }))
  assert.equal(m, `${EXTRACT_FAILED}:mw`)
})

test('files source -> an empty or missing paths list is EXTRACT_FAILED, not a constant marker', async () => {
  // An empty join is '' — stable forever, i.e. a watcher that can never fire.
  const run = filesRunner({ 'SKILL.md': { stdout: SHA_A } })
  assert.equal(await fetchMarker({ ...FILES, paths: [] }, run), `${EXTRACT_FAILED}:mw`)
  assert.equal(await fetchMarker({ ...FILES, paths: undefined }, run), `${EXTRACT_FAILED}:mw`)
})
