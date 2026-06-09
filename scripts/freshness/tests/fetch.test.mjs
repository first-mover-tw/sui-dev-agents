// scripts/freshness/tests/fetch.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchMarker } from '../fetch.mjs'
import { ERROR_MARKER } from '../core.mjs'

// fake runner: returns canned stdout per matched command substring
function fakeRunner(map) {
  return async (cmd, args) => {
    const key = [cmd, ...args].join(' ')
    for (const [needle, out] of Object.entries(map)) {
      if (key.includes(needle)) return { code: 0, stdout: out, stderr: '' }
    }
    return { code: 1, stdout: '', stderr: 'no match: ' + key }
  }
}

test('release source -> tag via gh', async () => {
  const run = fakeRunner({ 'releases/latest': 'v1.74.0\n' })
  const m = await fetchMarker({ id: 'sui', repo: 'MystenLabs/sui', kind: 'release' }, run)
  assert.equal(m, 'v1.74.0')
})

test('commit source -> sha via gh on declared branch', async () => {
  const run = fakeRunner({ 'commits/dev': 'abc123\n' })
  const m = await fetchMarker({ id: 'memwal', repo: 'MystenLabs/MemWal', kind: 'commit', branch: 'dev' }, run)
  assert.equal(m, 'abc123')
})

test('page source -> last-modified via curl', async () => {
  const run = fakeRunner({ '-sIL': 'HTTP/2 200\r\nlast-modified: Wed, 08 Jun 2026 10:00:00 GMT\r\n' })
  const m = await fetchMarker({ id: 'docs', kind: 'page', url: 'https://x' }, run)
  assert.equal(m, 'Wed, 08 Jun 2026 10:00:00 GMT')
})

test('runner failure -> ERROR_MARKER, never throws', async () => {
  const run = async () => ({ code: 1, stdout: '', stderr: 'boom' })
  const m = await fetchMarker({ id: 'sui', repo: 'MystenLabs/sui', kind: 'release' }, run)
  assert.equal(m, ERROR_MARKER)
})
