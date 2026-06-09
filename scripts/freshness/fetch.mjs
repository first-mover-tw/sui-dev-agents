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

export async function fetchMarker(source, run) {
  try {
    if (source.kind === 'release') {
      const r = await run('gh', ['api', `repos/${source.repo}/releases/latest`, '--jq', '.tag_name'])
      if (r.code !== 0 || !r.stdout.trim()) {
        // fallback: newest tag
        const t = await run('gh', ['api', `repos/${source.repo}/tags?per_page=1`, '--jq', '.[0].name'])
        if (t.code === 0 && t.stdout.trim()) return t.stdout.trim()
        return ERROR_MARKER
      }
      return r.stdout.trim()
    }
    if (source.kind === 'commit') {
      let r = await run('gh', ['api', `repos/${source.repo}/commits/${source.branch}`, '--jq', '.sha'])
      if (r.code !== 0 || !r.stdout.trim()) {
        // fallback: repo's actual default branch
        const d = await run('gh', ['api', `repos/${source.repo}`, '--jq', '.default_branch'])
        if (d.code === 0 && d.stdout.trim()) {
          r = await run('gh', ['api', `repos/${source.repo}/commits/${d.stdout.trim()}`, '--jq', '.sha'])
        }
      }
      return (r.code === 0 && r.stdout.trim()) ? r.stdout.trim() : ERROR_MARKER
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
