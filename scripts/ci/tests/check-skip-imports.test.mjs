// Tests for the pure decision logic of check-skip-imports.mjs (no tsc spawned).
// Run: node --test scripts/ci/tests/check-skip-imports.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  importStatements,
  gatedMystenImports,
  splitImport,
  WRONG_MARKER,
} from "../snippets/check-skip-imports.mjs";

test("single-line @mysten import is kept", () => {
  const { keep, exempt } = gatedMystenImports(
    `import { Transaction } from '@mysten/sui/transactions';`,
  );
  assert.equal(keep.length, 1);
  assert.equal(exempt.length, 0);
});

test("multi-line @mysten import is parsed as one statement and kept", () => {
  const src = `import {\n  Transaction,\n  Commands,\n} from '@mysten/sui/transactions';`;
  assert.equal(importStatements(src).length, 1);
  const { keep } = gatedMystenImports(src);
  assert.equal(keep.length, 1);
});

test("side-effect @mysten import (no `from`) is kept", () => {
  const { keep } = gatedMystenImports(`import '@mysten/sui/transactions';`);
  assert.equal(keep.length, 1);
});

test("relative import is ignored", () => {
  const { keep, exempt } = gatedMystenImports(`import { x } from './types';`);
  assert.equal(keep.length + exempt.length, 0);
});

test("third-party (non-@mysten) import is ignored", () => {
  const { keep, exempt } = gatedMystenImports(`import { toast } from 'sonner';`);
  assert.equal(keep.length + exempt.length, 0);
});

test("inline `// wrong:` marker exempts the import", () => {
  const { keep, exempt } = gatedMystenImports(
    `import { TransactionBlock } from '@mysten/sui.js'; // wrong: old package name`,
  );
  assert.equal(keep.length, 0);
  assert.equal(exempt.length, 1);
});

test("`// deprecated` and ❌ markers also exempt", () => {
  assert.equal(
    gatedMystenImports(`import { X } from '@mysten/fake'; // deprecated`).exempt.length,
    1,
  );
  assert.equal(
    gatedMystenImports(`import { X } from '@mysten/fake'; // ❌ do not use`).exempt.length,
    1,
  );
});

test("kept import has its trailing comment stripped", () => {
  const { keep } = gatedMystenImports(
    `import { Transaction } from '@mysten/sui/transactions'; // note: fine`,
  );
  assert.ok(!keep[0].includes("//"));
  assert.ok(keep[0].endsWith("'@mysten/sui/transactions';"));
});

test("mixed block: only the unmarked @mysten import is kept", () => {
  const src = [
    `import { Transaction } from '@mysten/sui/transactions';`,
    `import { Foo } from './local';`,
    `import { Old } from '@mysten/sui.js'; // wrong: deprecated`,
    `import { toast } from 'sonner';`,
  ].join("\n");
  const { keep, exempt } = gatedMystenImports(src);
  assert.equal(keep.length, 1);
  assert.equal(exempt.length, 1);
  assert.ok(keep[0].includes("@mysten/sui/transactions"));
});

test("WRONG_MARKER does not match a benign comment without a wrong-word", () => {
  assert.equal(WRONG_MARKER.test(`import { X } from '@mysten/sui'; // see docs`), false);
});

test("incidental words (old/legacy/do-not-use) do NOT exempt a real fabrication", () => {
  // A benign comment must never exempt a fabricated import — markers must be deliberate.
  for (const c of ["// works with old nodes", "// legacy stack", "// do not use in prod"]) {
    const { keep, exempt } = gatedMystenImports(`import { Fake } from '@mysten/totally-fake'; ${c}`);
    assert.equal(exempt.length, 0, c);
    assert.equal(keep.length, 1, c);
  }
});

test("`//wrong` inside a string literal does NOT exempt a real fabrication (H2)", () => {
  // The marker lives in the trailing comment only — a //wrong substring in a URL string
  // must not silently let a fabricated @mysten import escape the gate.
  const { keep, exempt } = gatedMystenImports(
    `import { Fake } from '@mysten/totally-fake'; const u = 'http://x.com//wrong';`,
  );
  assert.equal(exempt.length, 0);
  assert.equal(keep.length, 1);
});

test("a stray ❌ inside a string literal does NOT exempt a real fabrication (H2)", () => {
  const { keep, exempt } = gatedMystenImports(
    `import { Fake } from '@mysten/totally-fake'; const e = '❌ banned';`,
  );
  assert.equal(exempt.length, 0);
  assert.equal(keep.length, 1);
});

test("trailing code after the import `;` is dropped from the kept probe code (H1)", () => {
  const { keep } = gatedMystenImports(
    `import { Transaction } from '@mysten/sui/transactions'; const s = 'wrong';`,
  );
  assert.equal(keep.length, 1);
  assert.ok(keep[0].endsWith("'@mysten/sui/transactions';"), keep[0]);
  assert.ok(!keep[0].includes("const s"), keep[0]);
});

test("two @mysten imports on one physical line are both gated (M1)", () => {
  const { keep } = gatedMystenImports(
    `import { A } from '@mysten/sui'; import { Fake } from '@mysten/zklogin-fake';`,
  );
  assert.equal(keep.length, 2);
  assert.ok(keep.some((k) => k.includes("@mysten/sui")));
  assert.ok(keep.some((k) => k.includes("@mysten/zklogin-fake")));
});

test("a marked first import + unmarked fabricated second: only the first is exempt", () => {
  const { keep, exempt } = gatedMystenImports(
    `import { Old } from '@mysten/sui.js'; // wrong: renamed\nimport { Fake } from '@mysten/nope';`,
  );
  assert.equal(exempt.length, 1);
  assert.equal(keep.length, 1);
  assert.ok(keep[0].includes("@mysten/nope"));
});

test("splitImport separates code from the trailing comment tail", () => {
  const { code, tail } = splitImport(
    `import { X } from '@mysten/sui'; // wrong: nope`,
  );
  assert.equal(code, `import { X } from '@mysten/sui';`);
  assert.ok(WRONG_MARKER.test(tail));
});
