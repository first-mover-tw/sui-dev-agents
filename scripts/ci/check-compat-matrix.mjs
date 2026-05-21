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

const KIND_ENUM = new Set(['primary', 'peer', 'sub-export', 'deprecated']);
const TAG_RE = /^[a-z0-9:-]{1,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXPECTED_HEADER = '| Skill | Package | Kind | Tested | Accepted | Last verified | Notes-tag |';

export function parseMatrix(md) {
  const lines = md.split('\n');
  const headerIdx = lines.findIndex(l => l.trim() === EXPECTED_HEADER);
  if (headerIdx < 0) throw new Error('matrix header not found');
  const sepLine = lines[headerIdx + 1] ?? '';
  if (!/^\|[-:| ]+\|$/.test(sepLine.trim())) {
    throw new Error(`matrix separator row missing or malformed at L${headerIdx + 2}`);
  }
  const rows = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map(s => s.trim());
    for (const c of cells) {
      if (c.includes('`')) throw new Error(`bad row at L${i + 1}: backticks not allowed in matrix cells (got "${c}")`);
    }
    if (cells.length !== 7) throw new Error(`bad row at L${i + 1}: expected 7 cells, got ${cells.length}`);
    const [skill, pkg, kind, tested, accepted, lastVerified, tagRaw] = cells;
    if (!KIND_ENUM.has(kind)) throw new Error(`bad Kind "${kind}" at L${i + 1}`);
    if (!EXACT_VER_RE.test(tested)) throw new Error(`bad Tested "${tested}" at L${i + 1}`);
    if (!DATE_RE.test(lastVerified)) throw new Error(`bad Last verified "${lastVerified}" at L${i + 1}`);
    const tag = tagRaw === '—' ? '' : tagRaw;
    if (tag && !TAG_RE.test(tag)) throw new Error(`bad tag "${tag}" at L${i + 1}`);
    rows.push({ skill, pkg, kind, tested, accepted, lastVerified, tag, rowNumber: i + 1 });
  }
  return rows;
}

async function readRequired(path, label) {
  try {
    return await readFile(path, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error(`${label} not found: ${path}`);
    throw e;
  }
}

async function loadInputs(root) {
  const scopeRaw = await readRequired(join(root, 'scripts/ci/compat-scope.txt'), 'compat-scope.txt');
  const scope = scopeRaw.split('\n').map(s => s.trim()).filter(Boolean);

  const banners = {}; // skillPath → { targets, testedDate, lineNumber } | { error }
  for (const skillDir of scope) {
    const path = join(root, skillDir, 'SKILL.md');
    const skillPath = `${skillDir}/SKILL.md`;
    try {
      const md = await readFile(path, 'utf8');
      try {
        banners[skillPath] = parseBanner(md);
      } catch (e) {
        banners[skillPath] = { error: e.message };
      }
    } catch {
      banners[skillPath] = { error: 'SKILL.md not found' };
    }
  }

  const matrixPath = join(root, 'skills/sui-compat-matrix/references/sdk-compat-matrix.md');
  const matrixMd = await readRequired(matrixPath, 'matrix file');
  const matrix = parseMatrix(matrixMd);

  const pkgJsonRaw = await readRequired(join(root, 'scripts/ci/snippets/package.json'), 'snippets/package.json');
  const installed = JSON.parse(pkgJsonRaw).dependencies || {};

  return { scope, banners, matrix, installed };
}

function checkRules({ scope, banners, matrix, installed }) {
  const failures = [];
  const scopeSet = new Set(scope);

  // R1: every in-scope skill has exactly one Targets line
  for (const skillDir of scope) {
    const skillPath = `${skillDir}/SKILL.md`;
    const b = banners[skillPath];
    if (b?.error) {
      // Preserve specific error text; only relabel "missing"/"duplicate" stays implicit via the message itself
      failures.push(`[R1] ${skillPath}: ${b.error}`);
    } else if (!b) {
      failures.push(`[R1] ${skillPath}: missing Targets line`);
    }
  }

  // R2 implicit (parseBanner threw)

  // Index matrix by (skill, pkg)
  const matrixByKey = new Map();
  for (const row of matrix) matrixByKey.set(`${row.skill}\0${row.pkg}`, row);

  // R3: banner triples ⊆ matrix
  for (const [skillPath, b] of Object.entries(banners)) {
    if (!b || b.error) continue;
    for (const t of b.targets) {
      if (!matrixByKey.has(`${skillPath}\0${t.pkg}`)) {
        failures.push(`[R3] ${skillPath} ${t.pkg}: missing matrix row`);
      }
    }
  }

  // R4: matrix rows ⊆ scope
  for (const row of matrix) {
    const dir = row.skill.replace(/\/SKILL\.md$/, '');
    if (!scopeSet.has(dir)) {
      failures.push(`[R4] matrix row ${row.skill} ${row.pkg}: skill not in scope`);
    }
  }

  // R5 + R6/R7
  for (const row of matrix) {
    const b = banners[row.skill];
    if (b && !b.error) {
      const t = b.targets.find(x => x.pkg === row.pkg);
      if (t) {
        if (t.tested !== row.tested) {
          failures.push(`[R5] ${row.skill} ${row.pkg}: matrix=${row.tested} banner=${t.tested}`);
        }
        if (t.accepted !== row.accepted) {
          failures.push(`[R5] ${row.skill} ${row.pkg}: matrix accepted=${row.accepted} banner accepted=${t.accepted}`);
        }
      }
    }
    const inst = installed[row.pkg];
    if (row.kind === 'primary') {
      if (!inst) {
        failures.push(`[R6] ${row.skill} ${row.pkg}: installed=<missing> tested=${row.tested}`);
      } else if (inst !== row.tested) {
        failures.push(`[R6] ${row.skill} ${row.pkg}: installed=${inst} tested=${row.tested}`);
      }
    } else {
      if (inst && inst !== row.tested) {
        failures.push(`[R7] ${row.skill} ${row.pkg}: installed=${inst} tested=${row.tested}`);
      }
    }
  }

  return failures;
}

function printSummary({ banners, matrix, installed }) {
  console.log('\nSummary:');
  const seen = new Set();
  const rows = [];
  for (const row of matrix) {
    const key = `${row.skill}\0${row.pkg}`;
    seen.add(key);
    const b = banners[row.skill];
    const banner = b && !b.error ? b.targets.find(t => t.pkg === row.pkg)?.tested ?? '-' : '-';
    rows.push([row.skill, row.pkg, `banner=${banner}`, `matrix=${row.tested}`, `installed=${installed[row.pkg] ?? '<missing>'}`]);
  }
  for (const [skillPath, b] of Object.entries(banners)) {
    if (!b || b.error) continue;
    for (const t of b.targets) {
      const key = `${skillPath}\0${t.pkg}`;
      if (seen.has(key)) continue;
      rows.push([skillPath, t.pkg, `banner=${t.tested}`, 'matrix=<missing>', `installed=${installed[t.pkg] ?? '<missing>'}`]);
    }
  }
  for (const r of rows) console.log('  ' + r.join('  '));
}

async function main() {
  const inputs = await loadInputs(ROOT);
  const failures = checkRules(inputs);
  for (const f of failures) console.log(f);
  if (failures.length > 0) printSummary(inputs);
  return failures.length === 0 ? 0 : 1;
}

// Only auto-run when invoked directly (not when imported by tests)
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then(code => process.exit(code)).catch(e => { console.error(e); process.exit(2); });
}
