// scripts/freshness/core.mjs
export const ERROR_MARKER = '__ERROR__'

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

export function isCacheFresh(lastFullCheck, now, ttlMs) {
  if (lastFullCheck == null) return false
  return (now - lastFullCheck) < ttlMs
}

export function renderStatus(state) {
  if (state.drift) {
    const ids = state.changed.map(c => c.id).join(', ')
    return `🔔 SUI drift: ${ids} changed → deep check queued (run will investigate via gemini→codex)`
  }
  const sui = state.markers?.sui ? `, sui ${state.markers.sui}` : ''
  return `✅ SUI all-green (last deep check ${state.lastFullCheckISO}${sui})`
}
