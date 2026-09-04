// scripts/freshness/fetch.mjs
import { spawn } from 'node:child_process'
import { ERROR_MARKER, EXTRACT_FAILED, sanitizeMarker } from './core.mjs'

// default real runner — bounded by a hard timeout so a hung `gh`/`curl`
// can never block session start (the SessionStart hook must never hang).
const RUN_TIMEOUT_MS = 20000

export function realRunner(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: RUN_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    })
    let stdout = '', stderr = ''
    p.stdout.on('data', d => (stdout += d))
    p.stderr.on('data', d => (stderr += d))
    // On timeout, Node kills the child and 'close' fires with a non-null signal
    // and code === null -> treated as failure (-> ERROR_MARKER) downstream.
    p.on('close', (code, signal) => resolve({ code: code == null ? 1 : code, stdout, stderr, signal }))
    p.on('error', err => resolve({ code: 1, stdout: '', stderr: String(err) }))
  })
}

function parseLastModified(headers) {
  const m = headers.match(/^last-modified:\s*(.+?)\r?$/im)
  return m ? m[1].trim() : null
}

// Cap on any body we pull. A watcher must not be turned into a memory hog by a
// source that starts serving something enormous.
const MAX_BODY_BYTES = '5000000'

async function sha256Short(text) {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(text).digest('hex').slice(0, 12)
}

// Content fingerprints for `kind: 'page'` sources whose Last-Modified is worthless.
// docs.sui.io serves `max-age=0, must-revalidate` and rotates BOTH Last-Modified and
// ETag on every CDN rebuild, so a header-based marker for these pages is a drift
// signal that fires on rebuilds and says nothing about content (2026-09-03 and
// 2026-09-04 were both pure rebuilds). Each extractor pulls the few facts the repo
// actually tracks and returns null — never a partial marker — when it recognises
// too little, which is reported as EXTRACT_FAILED rather than silently ignored.
export const PAGE_FINGERPRINTS = {
  // Newest release anchor + how many releases are listed + the highest protocol
  // version + a digest over the full ordered list, so an insertion anywhere
  // (not just at the top) still drifts.
  'sui-release-notes': async (html) => {
    const ids = [...html.matchAll(/<h2\b[^>]*\bid="(v\d{3,6})"/g)].map(m => m[1])
    const protocols = [...html.matchAll(/protocol-version-in-this-release-(\d{1,4})/g)].map(m => Number(m[1]))
    // Floors: the page has carried dozens of releases for years. Seeing almost
    // none means the markup moved, not that Sui deleted its release history.
    if (ids.length < 5 || protocols.length === 0) return null
    const uniqueProtocols = [...new Set(protocols)].sort((a, b) => a - b)
    const digest = await sha256Short(`${ids.join(',')}|${uniqueProtocols.join(',')}`)
    return `${ids[0]}/${ids.length} p${uniqueProtocols[uniqueProtocols.length - 1]} ${digest}`
  },
}

// Walk a dotted path with own-property checks only, and refuse to return a
// container: a marker must be a scalar, and `{}` stringifies to a constant that
// would look stable forever.
function readJsonPath(root, path) {
  let cur = root
  for (const key of path.split('.')) {
    if (cur == null || typeof cur !== 'object' || !Object.hasOwn(cur, key)) return undefined
    cur = cur[key]
  }
  return cur == null || typeof cur === 'object' ? undefined : cur
}

// Resolve default-branch HEAD sha. If branch is null, look up the repo's default_branch first.
async function commitMarker(repo, branch, run) {
  let b = branch
  if (!b) {
    const d = await run('gh', ['api', `repos/${repo}`, '--jq', '.default_branch'])
    if (d.code === 0 && d.stdout.trim()) b = d.stdout.trim()
  }
  if (b) {
    const r = await run('gh', ['api', `repos/${repo}/commits/${b}`, '--jq', '.sha'])
    if (r.code === 0 && r.stdout.trim()) return r.stdout.trim()
  }
  // fallback: repo's actual default branch if the declared one 404'd
  const d = await run('gh', ['api', `repos/${repo}`, '--jq', '.default_branch'])
  if (d.code === 0 && d.stdout.trim() && d.stdout.trim() !== b) {
    const r = await run('gh', ['api', `repos/${repo}/commits/${d.stdout.trim()}`, '--jq', '.sha'])
    if (r.code === 0 && r.stdout.trim()) return r.stdout.trim()
  }
  return ERROR_MARKER
}

export async function fetchMarker(source, run) {
  try {
    if (source.kind === 'release') {
      const r = await run('gh', ['api', `repos/${source.repo}/releases/latest`, '--jq', '.tag_name'])
      if (r.code === 0 && r.stdout.trim()) return r.stdout.trim()
      // fallback 1: newest tag
      const t = await run('gh', ['api', `repos/${source.repo}/tags?per_page=1`, '--jq', '.[0].name'])
      if (t.code === 0 && t.stdout.trim() && t.stdout.trim() !== 'null') return t.stdout.trim()
      // fallback 2: default-branch commit SHA (repos with neither releases nor tags)
      return commitMarker(source.repo, null, run)
    }
    if (source.kind === 'commit') {
      return commitMarker(source.repo, source.branch, run)
    }
    if (source.kind === 'npm') {
      // marker = "pkg@latest" list; any single failure -> ERROR_MARKER (never a partial marker,
      // which would false-drift once the flaky package comes back)
      const results = await Promise.all(
        source.pkgs.map(pkg => run('npm', ['view', pkg, 'version']))
      )
      const parts = []
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.code !== 0 || !r.stdout.trim()) return ERROR_MARKER
        parts.push(`${source.pkgs[i]}@${r.stdout.trim()}`)
      }
      return parts.join(' ')
    }
    if (source.kind === 'endpoint') {
      // A live service's own version pointer. Watching a repository is not
      // watching a deployment: MemWal's `dev` ran 75 commits ahead of what the
      // production relayer served, and reading a branch diff as live behaviour
      // would have replaced a correct paragraph in our docs with a wrong one.
      // `jsonPath` names one stable scalar deliberately — hashing the whole body
      // would drift on every uptime counter or timestamp the service adds.
      const r = await run('curl', ['-sL', '--max-time', '15', '--max-filesize', MAX_BODY_BYTES, source.url])
      if (r.code !== 0 || !r.stdout.trim()) return ERROR_MARKER
      let data
      try { data = JSON.parse(r.stdout) } catch { return `${EXTRACT_FAILED}:${source.id}` }
      const value = readJsonPath(data, source.jsonPath)
      if (value === undefined) return `${EXTRACT_FAILED}:${source.id}`
      return sanitizeMarker(value)
    }
    if (source.kind === 'page') {
      if (source.fingerprint) {
        const extract = PAGE_FINGERPRINTS[source.fingerprint]
        // An unknown fingerprint name is a config bug, not a remote failure —
        // it must not degrade quietly to the header marker it was chosen over.
        if (!extract) return `${EXTRACT_FAILED}:${source.id}`
        const b = await run('curl', ['-sL', '--max-time', '15', '--max-filesize', MAX_BODY_BYTES, source.url])
        if (b.code !== 0 || !b.stdout) return ERROR_MARKER
        const fp = await extract(b.stdout)
        return fp == null ? `${EXTRACT_FAILED}:${source.id}` : sanitizeMarker(fp)
      }
      const r = await run('curl', ['-sIL', '--max-time', '15', source.url])
      if (r.code !== 0) return ERROR_MARKER
      const lm = parseLastModified(r.stdout)
      if (lm) return sanitizeMarker(lm)
      // no Last-Modified -> hash the body
      const b = await run('curl', ['-sL', '--max-time', '15', '--max-filesize', MAX_BODY_BYTES, source.url])
      if (b.code !== 0 || !b.stdout) return ERROR_MARKER
      const { createHash } = await import('node:crypto')
      return createHash('sha256').update(b.stdout).digest('hex').slice(0, 16)
    }
    return ERROR_MARKER
  } catch {
    return ERROR_MARKER
  }
}
