// scripts/freshness/fetch.mjs
import { spawn } from 'node:child_process'
import { ERROR_MARKER } from './core.mjs'

// default real runner
export function realRunner(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    p.stdout.on('data', d => (stdout += d))
    p.stderr.on('data', d => (stderr += d))
    p.on('close', code => resolve({ code, stdout, stderr }))
    p.on('error', err => resolve({ code: 1, stdout: '', stderr: String(err) }))
  })
}

function parseLastModified(headers) {
  const m = headers.match(/^last-modified:\s*(.+?)\r?$/im)
  return m ? m[1].trim() : null
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
    if (source.kind === 'page') {
      const r = await run('curl', ['-sIL', '--max-time', '15', source.url])
      if (r.code !== 0) return ERROR_MARKER
      const lm = parseLastModified(r.stdout)
      if (lm) return lm
      // no Last-Modified -> hash the body
      const b = await run('curl', ['-sL', '--max-time', '15', source.url])
      if (b.code !== 0 || !b.stdout) return ERROR_MARKER
      const { createHash } = await import('node:crypto')
      return createHash('sha256').update(b.stdout).digest('hex').slice(0, 16)
    }
    return ERROR_MARKER
  } catch {
    return ERROR_MARKER
  }
}
