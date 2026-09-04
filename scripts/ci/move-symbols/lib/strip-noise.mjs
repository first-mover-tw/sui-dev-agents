// Shared Move lexing helper for the two Move gates (symbol existence + real compile).
// Kept beside extract-blocks.mjs and for the same reason: a second copy would drift.

// Strip comments and string/byte-string literals so commented-out or quoted code never
// produces a finding. Offsets are preserved 1:1 (every consumed character is replaced by a
// space or its own newline) so a finding's offset still maps to the right source line.
//
// Returns `unterminated` when a literal or block comment runs to EOF. That case matters: the
// scanner would otherwise blank the entire rest of the block, and a fabricated symbol after a
// stray `"` would pass unseen. The caller turns it into a finding instead.
export function stripNoise(src) {
  let out = ''
  let i = 0
  const n = src.length
  let unterminated = null
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k++) out += src[k] === '\n' ? '\n' : ' '
  }
  while (i < n) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      const start = i
      while (i < n && src[i] !== '\n') i++
      blank(start, i)
    } else if (c === '/' && src[i + 1] === '*') {
      const start = i
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      if (i >= n) unterminated ??= 'block comment'
      i = Math.min(i + 2, n)
      blank(start, i)
    } else if (c === '"') {
      const start = i
      i++
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\') i++
        i++
      }
      if (i >= n) unterminated ??= 'string literal'
      i = Math.min(i + 1, n)
      blank(start, i)
    } else {
      out += c
      i++
    }
  }
  return { out, unterminated }
}
