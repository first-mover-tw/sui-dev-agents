// Shared markdown fence parser for the two Move gates (symbol existence + real compile).
//
// This lives in its own module on purpose: the parser below is the part of the symbol gate
// that took the most review rounds to get right (unclosed fences swallowing later blocks,
// `~~~` fences, indented and blockquoted fences, fence-length comparison, nested ```move
// inside a ````markdown wrapper). A second gate re-implementing it would drift from this one
// silently, and the drift would show up as blocks nobody checks.

// Every fence is tracked, not just Move ones, and at any indent. Three reasons, each a way a
// naive scanner goes quietly blind:
//   - A ```` ```move ```` nested inside an outer ````` ````markdown ````` wrapper is example
//     text, not code to check — only possible to tell by knowing a fence is already open.
//   - A fence closes on the same character repeated at least as many times as it opened, so
//     ```` ``` ```` inside a ```` ```` ```` block is body text, not a terminator.
//   - Indented (list item) and `~~~` fences are real Move blocks; skipping them silently is the
//     worst failure mode a gate has. An unclosed fence is reported for the same reason.
// A fence may sit inside a blockquote (`> ```move`), which the docs use for callouts. The
// quote prefix is stripped before matching, and the same prefix depth is required to close, so
// a quoted fence cannot be closed by an unquoted one.
const QUOTE_RE = /^(\s*(?:>\s?)*)(.*)$/
function splitQuote(line) {
  const m = line.match(QUOTE_RE)
  return { depth: (m[1].match(/>/g) ?? []).length, rest: m[2] }
}

// Fences are tracked as a stack, so a ```move block nested inside a ````markdown wrapper (the
// architect skill shows what a generated document looks like) is still real Move and still
// checked. An earlier version skipped nested blocks as "example text", putting 10 blocks out of
// reach; the volume was negligible (3 framework references between them, all resolved elsewhere
// anyway), but blocks swallowed by a *misparse* were reported under that same "deliberately
// skipped" label — a real hole wearing a documented exclusion's name.
// Deliberately-wrong snippets use `// @check:skip`, which is what that marker is for.
//
// A fence closes only on the same character, repeated at least as many times, at the same quote
// depth. Anything left open at EOF is a structural error: a dangling ```text swallows every
// Move block after it.
export function extractMoveBlocks(text) {
  const lines = text.split('\n')
  const blocks = []
  const problems = []
  const stack = []
  const OPEN_RE = /^\s*(`{3,}|~{3,})\s*(\S*)/
  const CLOSE_RE = /^\s*(`{3,}|~{3,})\s*$/

  // Every line inside a move fence is body text of that fence, including the fence lines of
  // blocks nested within it.
  const feed = (rest) => {
    for (const f of stack) if (f.isMove) f.buf.push(rest)
  }

  for (let i = 0; i < lines.length; i++) {
    const { depth, rest } = splitQuote(lines[i])
    const top = stack[stack.length - 1]
    const c = rest.match(CLOSE_RE)
    if (top && c && depth === top.depth && c[1][0] === top.char && c[1].length >= top.len) {
      stack.pop()
      if (top.isMove) blocks.push({ body: top.buf.join('\n'), startLine: top.startLine })
      // The closer belongs to whatever still encloses it: without this an outer move block
      // loses a line and every finding after a nested block reports one line early.
      feed(rest)
      continue
    }
    const o = rest.match(OPEN_RE)
    // Inside a fence, only a ```move opener starts a nested block. A bare ``` that is not a
    // valid closer is literal content per CommonMark — treating it as a new fence would end the
    // enclosing block early and leave everything after it unchecked.
    const opensHere = o && (stack.length === 0 || /^move\b/i.test(o[2]))
    if (opensHere) {
      feed(rest)
      stack.push({
        char: o[1][0],
        len: o[1].length,
        depth,
        isMove: /^move\b/i.test(o[2]),
        startLine: i + 2, // first body line, 1-indexed
        fenceLine: i + 1,
        buf: [],
      })
      continue
    }
    feed(rest)
  }

  for (const f of stack) {
    problems.push({
      line: f.fenceLine,
      reason: f.isMove
        ? 'unclosed ```move fence — block not checked'
        : 'unclosed non-move fence — any ```move block inside it is swallowed unchecked',
    })
  }
  return { blocks, problems }
}
