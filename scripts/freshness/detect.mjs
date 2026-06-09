// scripts/freshness/detect.mjs
// Layer 1 entry. Called by the SessionStart hook. ALWAYS exits 0 — must never block session start.
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { SOURCES } from './sources.mjs'
import { realRunner, fetchMarker } from './fetch.mjs'
import { compareMarkers, isCacheFresh, renderStatus, ERROR_MARKER } from './core.mjs'

const TTL = 24 * 3600 * 1000
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CACHE = join(ROOT, 'tasks', '.sui-freshness-cache.json')
const PENDING = join(ROOT, 'tasks', '.sui-freshness-pending')

async function readJSON(p, fallback) {
  try { return JSON.parse(await readFile(p, 'utf8')) } catch { return fallback }
}

async function main() {
  const now = Date.now()
  const cache = await readJSON(CACHE, { markers: {}, lastFullCheck: null, lastFullCheckISO: 'never' })

  // 24h cache gate: print cached status, no network.
  if (isCacheFresh(cache.lastFullCheck, now, TTL)) {
    if (existsSync(PENDING)) {
      const pend = await readJSON(PENDING, { changed: [] })
      process.stdout.write(renderStatus({ drift: true, changed: pend.changed }) + ' (pending, not yet integrated)\n')
    } else {
      process.stdout.write(renderStatus({ drift: false, lastFullCheckISO: cache.lastFullCheckISO, markers: cache.markers }) + '\n')
    }
    return
  }

  // live fetch all sources
  const entries = await Promise.all(SOURCES.map(async s => [s.id, await fetchMarker(s, realRunner)]))
  const fresh = Object.fromEntries(entries)
  const { drift, changed } = compareMarkers(cache.markers, fresh)
  const nowISO = new Date(now).toISOString().slice(0, 10)

  if (drift) {
    // record pending; DO NOT advance markers (they advance only after integration).
    await writeFile(PENDING, JSON.stringify({ detectedAt: nowISO, changed }, null, 2))
    // refresh lastFullCheck so we don't re-hammer the network every session, but keep old markers.
    await writeFile(CACHE, JSON.stringify({ ...cache, lastFullCheck: now, lastFullCheckISO: nowISO }, null, 2))
    process.stdout.write(renderStatus({ drift: true, changed }) + '\n')
    process.stdout.write('ACTION: a drift report has NOT been generated yet. Read scripts/freshness/DEEP-INVESTIGATION.md and run the gemini→codex investigation for the changed sources, then summarize.\n')
  } else {
    // all-green: safe to advance markers (drops ERROR_MARKER values — keep last good)
    const merged = { ...cache.markers }
    for (const [id, v] of Object.entries(fresh)) if (v !== ERROR_MARKER) merged[id] = v
    await writeFile(CACHE, JSON.stringify({ markers: merged, lastFullCheck: now, lastFullCheckISO: nowISO }, null, 2))
    process.stdout.write(renderStatus({ drift: false, lastFullCheckISO: nowISO, markers: merged }) + '\n')
  }
}

main().catch(e => { process.stdout.write('⚠️ SUI freshness check error: ' + e.message + '\n') }).finally(() => process.exit(0))
