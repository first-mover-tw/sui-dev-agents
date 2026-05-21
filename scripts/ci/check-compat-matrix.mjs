#!/usr/bin/env node
// Verifies banner ↔ matrix ↔ snippets/package.json consistency.
// See docs/superpowers/specs/2026-05-21-sui-compat-matrix-design.md
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argRoot = process.argv.indexOf('--root');
const ROOT = argRoot >= 0 ? process.argv[argRoot + 1] : join(__dirname, '..', '..');

// Strict line grammar:
//   Targets: `@mysten/<pkg>` <x.y.z> (<range>)[, ...]. Tested: YYYY-MM-DD.
// No trailing content allowed on the line.
const TARGETS_RE = /^Targets: (.+?)\. Tested: (\d{4}-\d{2}-\d{2})\.\s*$/;
const PKG_RE = /^`(@mysten\/[\w.-]+)` (\S+) \((\^?\d+(?:\.\d+){0,2}|~\d+(?:\.\d+){0,2})\)$/;
const EXACT_VER_RE = /^\d+\.\d+\.\d+$/;

export function parseBanner(md) {
  const lines = md.split('\n').slice(0, 30);
  let found = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('Targets:')) continue;
    const m = line.match(TARGETS_RE);
    if (!m) {
      if (/Tested: \d{4}-\d{2}-\d{2}\./.test(line)) {
        throw new Error(`bad Targets line at L${i + 1}: trailing content after period`);
      }
      throw new Error(`bad Targets line at L${i + 1}: missing or malformed "Tested: YYYY-MM-DD." suffix`);
    }
    if (found) throw new Error(`duplicate Targets line at L${i + 1}`);
    const targets = m[1].split(', ').map((seg) => {
      const pm = seg.match(PKG_RE);
      if (!pm) throw new Error(`bad package segment "${seg}" at L${i + 1}`);
      if (!EXACT_VER_RE.test(pm[2])) throw new Error(`invalid tested "${pm[2]}" at L${i + 1}`);
      return { pkg: pm[1], tested: pm[2], accepted: pm[3] };
    });
    found = { targets, testedDate: m[2], lineNumber: i + 1 };
  }
  return found;
}

async function main() {
  const scopeRaw = await readFile(join(ROOT, 'scripts/ci/compat-scope.txt'), 'utf8');
  const scope = scopeRaw.split('\n').map(s => s.trim()).filter(Boolean);
  // skeleton only — rules added in later tasks
  return 0;
}

// Only auto-run when invoked directly (not when imported by tests)
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then(code => process.exit(code)).catch(e => { console.error(e); process.exit(2); });
}
