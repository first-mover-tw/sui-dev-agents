// scripts/freshness/tests/core.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareMarkers, isCacheFresh, renderStatus } from '../core.mjs'

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
