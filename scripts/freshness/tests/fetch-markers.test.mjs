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
