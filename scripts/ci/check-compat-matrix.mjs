#!/usr/bin/env node
// Verifies banner ↔ matrix ↔ snippets/package.json consistency.
// See docs/superpowers/specs/2026-05-21-sui-compat-matrix-design.md
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argRoot = process.argv.indexOf('--root');
const ROOT = argRoot >= 0 ? process.argv[argRoot + 1] : join(__dirname, '..', '..');

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
