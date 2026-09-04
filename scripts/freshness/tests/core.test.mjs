// scripts/freshness/tests/core.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareMarkers, isCacheFresh, renderStatus, mergeMarkers, sanitizeMarker, isExtractFailure, ERROR_MARKER, EXTRACT_FAILED, MARKER_MAX_LEN } from '../core.mjs'

test('compareMarkers: no change -> empty changed', () => {
  const old = { sui: 'v1.73.0', walrus: '1.1.7' }
  const fresh = { sui: 'v1.73.0', walrus: '1.1.7' }
  const r = compareMarkers(old, fresh)
  assert.equal(r.drift, false)
  assert.deepEqual(r.changed, [])
})

test('compareMarkers: detects changed + new sources', () => {
  const old = { sui: 'v1.73.0', walrus: '1.1.7' }
  const fresh = { sui: 'v1.74.0', walrus: '1.1.7', seal: '1.1.4' }
  const r = compareMarkers(old, fresh)
  assert.equal(r.drift, true)
  assert.deepEqual(r.changed.map(c => c.id).sort(), ['seal', 'sui'])
  const sui = r.changed.find(c => c.id === 'sui')
  assert.deepEqual(sui, { id: 'sui', old: 'v1.73.0', new: 'v1.74.0' })
  const seal = r.changed.find(c => c.id === 'seal')
  assert.deepEqual(seal, { id: 'seal', old: null, new: '1.1.4' })
})

test('compareMarkers: error markers are ignored, never count as drift', () => {
  const old = { sui: 'v1.73.0' }
  const fresh = { sui: '__ERROR__' }
  const r = compareMarkers(old, fresh)
  assert.equal(r.drift, false)
  assert.deepEqual(r.changed, [])
})

test('isCacheFresh: within ttl true, past ttl false', () => {
  const now = 1_000_000_000
  const ttl = 24 * 3600 * 1000
  assert.equal(isCacheFresh(now - 1000, now, ttl), true)
  assert.equal(isCacheFresh(now - ttl - 1, now, ttl), false)
  assert.equal(isCacheFresh(null, now, ttl), false)
})

test('renderStatus: all-green line', () => {
  const s = renderStatus({ drift: false, lastFullCheckISO: '2026-06-08', markers: { sui: 'v1.73.0' } })
  assert.match(s, /✅ SUI all-green/)
  assert.match(s, /sui v1\.73\.0/)
})

test('renderStatus: drift line lists changed ids', () => {
  const s = renderStatus({ drift: true, changed: [{ id: 'sui', old: 'v1.73.0', new: 'v1.74.0' }] })
  assert.match(s, /🔔 SUI drift/)
  assert.match(s, /sui/)
})

test('compareMarkers: an EXTRACT_FAILED marker DOES count as drift', () => {
  // The opposite of ERROR_MARKER on purpose. A broken extractor must be loud;
  // treating it like a fetch error would leave the source silently green forever.
  const r = compareMarkers({ docs: 'v1790/16 p136 abc' }, { docs: EXTRACT_FAILED + ':docs' })
  assert.equal(r.drift, true)
  assert.equal(r.changed[0].id, 'docs')
})

test('isExtractFailure: only the sentinel prefix, not arbitrary markers', () => {
  assert.equal(isExtractFailure(EXTRACT_FAILED + ':docs'), true)
  assert.equal(isExtractFailure('v1790/16 p136 abc'), false)
  assert.equal(isExtractFailure(ERROR_MARKER), false)
  assert.equal(isExtractFailure(undefined), false)
})

test('mergeMarkers: advances good values, keeps last good on error', () => {
  const merged = mergeMarkers({ sui: 'v1.78.1', walrus: 'v1.55.2' }, { sui: 'v1.79.0', walrus: ERROR_MARKER })
  assert.deepEqual(merged, { sui: 'v1.79.0', walrus: 'v1.55.2' })
})

test('mergeMarkers: NEVER stores an extract failure as the new baseline', () => {
  // Storing it would make the broken extractor its own baseline: next round the
  // value matches, drift disappears, and the source is dead but green.
  const merged = mergeMarkers({ docs: 'v1790/16 p136 abc' }, { docs: EXTRACT_FAILED + ':docs' })
  assert.deepEqual(merged, { docs: 'v1790/16 p136 abc' })
})

test('mergeMarkers: adds sources absent from the cache', () => {
  const merged = mergeMarkers({ sui: 'v1.78.1' }, { sui: 'v1.78.1', 'memwal-relayer': '559531fe' })
  assert.equal(merged['memwal-relayer'], '559531fe')
})

test('sanitizeMarker: whitespace control characters collapse to single spaces', () => {
  assert.equal(sanitizeMarker('a\nb\r\nc\td'), 'a b c d')
  assert.equal(sanitizeMarker('  padded  '), 'padded')
})

test('sanitizeMarker: NON-whitespace control characters are stripped too', () => {
  // \s+ alone would leave these in place. An ESC sequence reaching the banner is
  // remote content writing terminal escapes into a session transcript; NUL and
  // DEL are how a value smuggles bytes past a naive whitespace collapse.
  assert.equal(sanitizeMarker('a\u001b[31mred\u0000b\u007fc'), 'a [31mred b c')
  assert.ok(!sanitizeMarker('x\u001by').includes('\u001b'))
})

test('sanitizeMarker: caps length so a remote value cannot flood the banner', () => {
  const out = sanitizeMarker('x'.repeat(MARKER_MAX_LEN + 50))
  assert.equal(out.length, MARKER_MAX_LEN + 1) // capped body + the ellipsis
  assert.ok(out.endsWith('\u2026'))
})

test('sanitizeMarker: a value at the cap is left intact', () => {
  const exact = 'x'.repeat(MARKER_MAX_LEN)
  assert.equal(sanitizeMarker(exact), exact)
})

test('sanitizeMarker: non-strings are coerced, not passed through', () => {
  assert.equal(sanitizeMarker(136), '136')
})
