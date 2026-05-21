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
