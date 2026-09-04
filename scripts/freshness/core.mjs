// scripts/freshness/core.mjs
export const ERROR_MARKER = '__ERROR__'

// A marker whose source was reachable but whose extractor recognised nothing.
// Deliberately NOT ERROR_MARKER: an error marker is ignored and retried, which is
// right for a flaky network and wrong for a broken extractor — it would leave the
// source permanently, silently green, which is the failure mode every other guard
// in this repo is built to prevent. This value differs from whatever is cached, so
// it surfaces as drift and keeps nagging until a human looks. Callers append
// ':<id>' so the pending file names the extractor that broke.
export const EXTRACT_FAILED = '__EXTRACT_FAILED__'

// Markers derived from remote content are written to the cache and printed into
// the SessionStart banner — i.e. into an agent's context. A remote page does not
// get to decide how many lines that banner has, or how long it is.
export const MARKER_MAX_LEN = 200
export function sanitizeMarker(value) {
  const flat = String(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return flat.length > MARKER_MAX_LEN ? flat.slice(0, MARKER_MAX_LEN) + '…' : flat
}

// fresh: { [id]: marker | '__ERROR__' }. old: same shape (may be missing keys).
export function compareMarkers(old, fresh) {
  const changed = []
  for (const [id, val] of Object.entries(fresh)) {
    if (val === ERROR_MARKER) continue        // fetch failed this round -> ignore, retry next time
    const prev = id in old ? old[id] : null
    if (prev !== val) changed.push({ id, old: prev, new: val })
  }
  return { drift: changed.length > 0, changed }
}

export const isExtractFailure = v => typeof v === 'string' && v.startsWith(EXTRACT_FAILED)

// Advance markers on an all-green round. Two kinds of value are refused: a fetch
// error (keep the last good marker and retry), and an extract failure — storing
// that would make the broken extractor's own output the new baseline and the
// source would go quiet for good, which is the silent-green outcome the sentinel
// exists to prevent.
export function mergeMarkers(oldMarkers, fresh) {
  const merged = { ...oldMarkers }
  for (const [id, v] of Object.entries(fresh)) {
    if (v !== ERROR_MARKER && !isExtractFailure(v)) merged[id] = v
  }
  return merged
}

export function isCacheFresh(lastFullCheck, now, ttlMs) {
  if (lastFullCheck == null) return false
  return (now - lastFullCheck) < ttlMs
}

export function renderStatus(state) {
  if (state.drift) {
    const ids = state.changed.map(c => c.id).join(', ')
    return `🔔 SUI drift: ${ids} changed → deep check queued (parallel subagent investigation)`
  }
  const sui = state.markers?.sui ? `, sui ${state.markers.sui}` : ''
  return `✅ SUI all-green (last deep check ${state.lastFullCheckISO}${sui})`
}
