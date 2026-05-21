import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'check-compat-matrix.mjs');

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'compat-'));
  mkdirSync(join(root, 'scripts', 'ci', 'snippets'), { recursive: true });
  mkdirSync(join(root, 'skills', 'sui-foo'), { recursive: true });
  mkdirSync(join(root, 'skills', 'sui-compat-matrix', 'references'), { recursive: true });
  return root;
}

function run(root) {
  try {
    const stdout = execFileSync('node', [SCRIPT, '--root', root], { encoding: 'utf8' });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return { code: e.status, stdout: e.stdout?.toString() ?? '', stderr: e.stderr?.toString() ?? '' };
  }
}

test('exits 0 on empty scope', () => {
  const root = makeFixture();
  writeFileSync(join(root, 'scripts', 'ci', 'compat-scope.txt'), '');
  writeFileSync(join(root, 'scripts', 'ci', 'snippets', 'package.json'), '{"dependencies":{}}');
  writeFileSync(join(root, 'skills', 'sui-compat-matrix', 'references', 'sdk-compat-matrix.md'),
    '| Skill | Package | Kind | Tested | Accepted | Last verified | Notes-tag |\n|---|---|---|---|---|---|---|\n');
  const r = run(root);
  assert.equal(r.code, 0, r.stderr || r.stdout);
});

import { parseBanner } from '../check-compat-matrix.mjs';

test('parseBanner extracts single package', () => {
  const md = 'foo\n\nTargets: `@mysten/sui` 2.17.0 (^2.16). Tested: 2026-05-21.\n\nrest';
  const got = parseBanner(md);
  assert.deepEqual(got, {
    targets: [{ pkg: '@mysten/sui', tested: '2.17.0', accepted: '^2.16' }],
    testedDate: '2026-05-21',
    lineNumber: 3,
  });
});

test('parseBanner extracts multiple packages', () => {
  const md = 'Targets: `@mysten/sui` 2.17.0 (^2.16), `@mysten/kiosk` 1.2.6 (^1.2). Tested: 2026-05-21.\n';
  const got = parseBanner(md);
  assert.equal(got.targets.length, 2);
  assert.equal(got.targets[1].pkg, '@mysten/kiosk');
  assert.equal(got.targets[1].tested, '1.2.6');
});

test('parseBanner returns null when no Targets line', () => {
  assert.equal(parseBanner('no banner here\n'), null);
});

test('parseBanner returns error on trailing prose', () => {
  const md = 'Targets: `@mysten/sui` 2.17.0 (^2.16). Tested: 2026-05-21. extra prose\n';
  assert.throws(() => parseBanner(md), /trailing content/);
});

test('parseBanner only scans first 30 lines', () => {
  const md = '\n'.repeat(40) + 'Targets: `@mysten/sui` 2.17.0 (^2.16). Tested: 2026-05-21.\n';
  assert.equal(parseBanner(md), null);
});

test('parseBanner rejects invalid tested semver', () => {
  const md = 'Targets: `@mysten/sui` 2.17 (^2.16). Tested: 2026-05-21.\n';
  assert.throws(() => parseBanner(md), /invalid tested/);
});

test('parseBanner rejects duplicate Targets lines', () => {
  const md = 'Targets: `@mysten/sui` 2.17.0 (^2.16). Tested: 2026-05-21.\nTargets: `@mysten/x` 1.0.0 (^1.0). Tested: 2026-05-21.\n';
  assert.throws(() => parseBanner(md), /duplicate/);
});

test('parseBanner throws on malformed package segment', () => {
  // missing backtick on package name → fails PKG_RE, not EXACT_VER_RE
  const md = 'Targets: @mysten/sui 2.17.0 (^2.16). Tested: 2026-05-21.\n';
  assert.throws(() => parseBanner(md), /bad package segment/);
});

import { parseMatrix } from '../check-compat-matrix.mjs';

const MATRIX_HEAD = '| Skill | Package | Kind | Tested | Accepted | Last verified | Notes-tag |\n|---|---|---|---|---|---|---|\n';

test('parseMatrix extracts rows', () => {
  const md = MATRIX_HEAD +
    '| skills/sui-kiosk/SKILL.md | @mysten/kiosk | primary | 1.2.6 | ^1.2 | 2026-05-21 | no-grpc |\n' +
    '| skills/sui-kiosk/SKILL.md | @mysten/sui | primary | 2.17.0 | ^2.16 | 2026-05-21 | — |\n';
  const rows = parseMatrix(md);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    skill: 'skills/sui-kiosk/SKILL.md',
    pkg: '@mysten/kiosk',
    kind: 'primary',
    tested: '1.2.6',
    accepted: '^1.2',
    lastVerified: '2026-05-21',
    tag: 'no-grpc',
    rowNumber: 3,
  });
});

test('parseMatrix rejects bad kind enum', () => {
  const md = MATRIX_HEAD + '| skills/x/SKILL.md | @mysten/x | bogus | 1.0.0 | ^1.0 | 2026-05-21 | — |\n';
  assert.throws(() => parseMatrix(md), /bad Kind "bogus"/);
});

test('parseMatrix rejects bad tag charset', () => {
  const md = MATRIX_HEAD + '| skills/x/SKILL.md | @mysten/x | primary | 1.0.0 | ^1.0 | 2026-05-21 | Bad Tag! |\n';
  assert.throws(() => parseMatrix(md), /bad tag/);
});

test('parseMatrix accepts em-dash as empty tag', () => {
  const md = MATRIX_HEAD + '| skills/x/SKILL.md | @mysten/x | primary | 1.0.0 | ^1.0 | 2026-05-21 | — |\n';
  const rows = parseMatrix(md);
  assert.equal(rows[0].tag, '');
});

test('parseMatrix throws on missing header', () => {
  assert.throws(() => parseMatrix('no table\n'), /matrix header not found/);
});

test('parseMatrix rejects backticks in cells', () => {
  const md = MATRIX_HEAD + '| skills/x/SKILL.md | `@mysten/x` | primary | 1.0.0 | ^1.0 | 2026-05-21 | — |\n';
  assert.throws(() => parseMatrix(md), /backticks not allowed/);
});

test('parseMatrix rejects missing separator row', () => {
  const md = '| Skill | Package | Kind | Tested | Accepted | Last verified | Notes-tag |\n\n| skills/x/SKILL.md | @mysten/x | primary | 1.0.0 | ^1.0 | 2026-05-21 | — |\n';
  assert.throws(() => parseMatrix(md), /separator row missing or malformed/);
});
