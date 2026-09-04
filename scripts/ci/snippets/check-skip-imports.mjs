#!/usr/bin/env node
// check-skip-imports.mjs — import-resolution gate for `// @check:skip` blocks.
//
// WHY: skip blocks are excluded from the main `tsc --noEmit` pass, so a fabricated
// `@mysten/*` package, subpath, or named export hides there silently (e.g. the
// historical `@mysten/sui.js` (renamed to `@mysten/sui`) and `@mysten/zklogin`
// `ZkLoginProvider` class). This gate re-checks ONLY the `@mysten/*` import lines of
// every skip block: it strips the (intentionally undeclared) bodies and compiles just
// the imports, so the only errors that can surface are TS2307 (no such module) and
// TS2305/TS2724 (no such export).
//
// SCOPE is `@mysten/*` ON PURPOSE: those are the only SDKs installed in the snippet
// env, so they are the only specifiers we can resolve. Skip blocks legitimately import
// third-party packages that are NOT installed here (often the reason they are skipped),
// so gating non-@mysten imports would raise TS2307 on real-but-uninstalled packages.
// @mysten-only keeps the guarantee: zero false positives by construction — a legitimate
// fragment's real imports resolve; only fabricated @mysten ones fail.
//
// EXEMPTION: a deliberately-wrong import in a teaching/contrast block carries an inline
// marker comment (`// wrong: ...`, `// deprecated`, `❌`) in the TRAILING comment of the
// import statement. The marker is honored only in that trailing tail — never in the
// import code itself — so a `//wrong` substring inside a URL string literal or a stray
// `❌` cannot silently exempt a real fabrication. The marker must be inline because
// extract.mjs hoists imports and drops surrounding body comments — a preceding-line
// comment would not survive.
//
// Run AFTER extract.mjs (check-snippets.sh does this). Node 20+ stdlib only, no deps.

import { readdir, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP = join(__dirname, "tmp");
const PROBE = join(__dirname, "tmp-skip-imports");
const TSCONFIG = join(__dirname, "tsconfig.skip-imports.json");

// Deliberately-wrong contrast imports are annotated inline; exempt them.
// Markers must be DELIBERATE: incidental words like "old"/"legacy" in a benign
// comment (e.g. `// works with old nodes`) must NOT exempt a real fabrication.
export const WRONG_MARKER = /\/\/[^\n]*\b(wrong|deprecated|incorrect)\b|❌/i;
// Matches the resolvable part of an @mysten import — either the `from '@mysten/…'`
// clause of a named/default/type import, or a bare side-effect `import '@mysten/…'` —
// plus an optional trailing `;`. Everything AFTER this match is the comment/stray tail.
const IMPORT_END =
  /(?:from\s*['"]@mysten\/[^'"]+['"]|^\s*import\s*['"]@mysten\/[^'"]+['"])\s*;?/;
// Codes that mean "this import target does not exist" — the only thing we gate on.
const FATAL = /error TS(2307|2305|2724)\b/;

// Walk a snippet's text and return complete `import ...` statements (multi-line aware).
export function importStatements(text) {
  const lines = text.split("\n");
  const stmts = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*import\b/.test(lines[i])) continue;
    let stmt = lines[i];
    // A statement is complete once it has a `from '...'` clause or ends in `;`.
    while (
      !/\bfrom\s+['"][^'"]+['"]/.test(stmt) &&
      !/;\s*$/.test(stmt) &&
      i + 1 < lines.length
    ) {
      i++;
      stmt += "\n" + lines[i];
    }
    stmts.push(stmt);
  }
  return stmts;
}

// Split an @mysten import statement into its resolvable `code` (up to and including the
// specifier string + optional `;`) and the trailing `tail` (comments / stray code after
// it). Returns null for any statement without a resolvable @mysten specifier. Splitting
// here is what makes the marker check (tail-only) and the probe (code-only) immune to
// `//wrong`-in-a-string false negatives and trailing-code contamination.
export function splitImport(stmt) {
  const m = IMPORT_END.exec(stmt);
  if (!m) return null;
  const end = m.index + m[0].length;
  return { code: stmt.slice(0, end).trimEnd(), tail: stmt.slice(end) };
}

// Pure decision logic (no I/O): classify a snippet's @mysten imports into the ones
// to type-check (`keep`) vs. the deliberately-wrong ones to exempt (`exempt`).
// Relative and third-party imports are ignored entirely.
export function gatedMystenImports(text) {
  const keep = [];
  const exempt = [];
  for (const stmt of importStatements(text)) {
    // A physical line may carry more than one @mysten import (`import …; import …;`).
    // Loop the tail so a second fabricated import can't silently slip through unchecked.
    let rest = stmt;
    while (rest != null) {
      const parts = splitImport(rest);
      if (!parts) break; // no (more) resolvable @mysten import in this statement
      // This import's trailing region ends where the NEXT `import` begins (if any), so a
      // following import's text is not mistaken for this one's comment.
      const nextIdx = parts.tail.search(/\bimport\b/);
      const ownTail = nextIdx === -1 ? parts.tail : parts.tail.slice(0, nextIdx);
      // The marker is only honored when ownTail IS a trailing comment (starts with `//`,
      // `/*`, or a bare ❌). Trailing CODE — e.g. `const u = 'http://x.com//wrong'` — is
      // never a marker, so a `//wrong` or ❌ inside a string literal can't exempt a real
      // fabrication. Such trailing code is dropped from the probe regardless (code-only).
      const t = ownTail.trimStart();
      const isComment = t.startsWith("//") || t.startsWith("/*") || t.startsWith("❌");
      if (isComment && WRONG_MARKER.test(ownTail)) exempt.push(parts.code);
      else keep.push(parts.code); // probe gets the import code only, no comment/stray tail
      rest = nextIdx === -1 ? null : parts.tail.slice(nextIdx);
    }
  }
  return { keep, exempt };
}

async function main() {
  if (!existsSync(TMP)) {
    console.error("tmp/ not found — run `node extract.mjs` first.");
    process.exit(1);
  }
  if (existsSync(PROBE)) await rm(PROBE, { recursive: true });
  await mkdir(PROBE, { recursive: true });

  const skipFiles = (await readdir(TMP)).filter((f) => f.endsWith(".skip"));
  let probeCount = 0;
  let exemptCount = 0;
  let importCount = 0;

  for (const f of skipFiles) {
    const text = await readFile(join(TMP, f), "utf8");
    const { keep, exempt } = gatedMystenImports(text);
    importCount += keep.length + exempt.length;
    exemptCount += exempt.length;
    if (!keep.length) continue;
    const ext = /\.tsx\.skip$/.test(f) ? "tsx" : "ts";
    const base = f.replace(/\.(ts|tsx)\.skip$/, "");
    // `// source:` first line of the .skip is preserved so failures point back to the md.
    const srcLine = text.split("\n").find((l) => l.startsWith("// source:")) ?? "";
    await writeFile(
      join(PROBE, `${base}.${ext}`),
      `${srcLine}\nexport {};\n${keep.join("\n")}\n`,
    );
    probeCount++;
  }

  if (probeCount === 0) {
    console.log("✅ Skip-import gate: no @mysten imports to check.");
    return;
  }

  let out = "";
  try {
    execFileSync("npx", ["--no-install", "tsc", "--noEmit", "-p", TSCONFIG], {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }

  // Any tsc error that ISN'T a resolution failure means the probe is malformed (e.g. a
  // parse the splitter mishandled) — we'd otherwise green-pass without actually checking
  // resolution. Surface it loudly without failing the gate on unrelated noise.
  const unexpected = out
    .split("\n")
    .filter((l) => /error TS\d+/.test(l) && !FATAL.test(l));
  if (unexpected.length) {
    console.error("⚠ Skip-import gate: unexpected non-resolution tsc errors (probe may be malformed):");
    for (const line of unexpected) console.error("  " + line.replace(/^tmp-skip-imports\//, ""));
    console.error("");
  }

  const fatal = out.split("\n").filter((l) => FATAL.test(l));
  if (fatal.length) {
    console.error("");
    console.error("❌ Fabricated @mysten import(s) in `@check:skip` block(s):");
    console.error("");
    for (const line of fatal) console.error("  " + line.replace(/^tmp-skip-imports\//, ""));
    console.error("");
    console.error("These imports do not resolve against the pinned @mysten/* SDKs.");
    console.error("Fix the package/subpath/export in the skill's .md block, OR — if it is a");
    console.error("deliberately-wrong teaching example — add an inline `// wrong: ...` comment");
    console.error("on the same import line so the gate treats it as an intentional contrast.");
    process.exit(1);
  }

  console.log(
    `✅ Skip-import gate: ${probeCount} block(s) / ${importCount} @mysten import(s) ` +
      `checked (${exemptCount} exempted as deliberate contrast), all resolve.`,
  );
}

// Only run the gate when invoked directly (`node check-skip-imports.mjs`),
// so the test file can import the pure helpers without spawning tsc.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
