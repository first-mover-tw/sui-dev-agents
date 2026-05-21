#!/usr/bin/env node
// Extracts ```ts / ```typescript / ```tsx fenced code blocks from skills/*/SKILL.md
// into scripts/ci/snippets/tmp/<skill>__<idx>.<ext> for tsc --noEmit checking.
//
// Per-block opt-out: if the first non-blank line of a block is `// @check:skip`,
// the block is written to tmp but renamed with a .skip extension so tsc ignores it.
// Useful for intentional fragments (partial examples, pseudo-code).
//
// Each emitted file is wrapped in `async function _snippet() { ... }` so top-level
// `await` works and undeclared identifiers from earlier blocks don't bleed across files.

import { readdir, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const TMP_DIR = join(__dirname, "tmp");

const FENCE_RE = /^```(ts|typescript|tsx)\s*$/i;

async function extractFromFile(skillName, mdPath) {
  const content = await readFile(mdPath, "utf8");
  const lines = content.split("\n");
  const blocks = [];
  let inBlock = false;
  let buf = [];
  let lang = null;
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock) {
      const m = line.match(FENCE_RE);
      if (m) {
        inBlock = true;
        lang = m[1].toLowerCase();
        buf = [];
        startLine = i + 1;
      }
    } else {
      if (line.trim() === "```") {
        blocks.push({ lang, body: buf.join("\n"), startLine });
        inBlock = false;
      } else {
        buf.push(line);
      }
    }
  }
  return blocks;
}

async function main() {
  if (existsSync(TMP_DIR)) await rm(TMP_DIR, { recursive: true });
  await mkdir(TMP_DIR, { recursive: true });

  const skills = (await readdir(SKILLS_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let total = 0,
    skipped = 0,
    emitted = 0;

  // Collect (skill, label, path) for SKILL.md + any references/*.md.
  const targets = [];
  for (const skill of skills) {
    const mainMd = join(SKILLS_DIR, skill, "SKILL.md");
    if (existsSync(mainMd)) targets.push({ skill, label: "SKILL", path: mainMd });
    const refDir = join(SKILLS_DIR, skill, "references");
    if (existsSync(refDir)) {
      const entries = await readdir(refDir);
      for (const e of entries) {
        if (e.endsWith(".md")) {
          targets.push({
            skill,
            label: "ref-" + e.replace(/\.md$/, "").replace(/[^a-zA-Z0-9]/g, "_"),
            path: join(refDir, e),
          });
        }
      }
    }
  }

  for (const { skill, label, path: mdPath } of targets) {
    const blocks = await extractFromFile(skill, mdPath);
    const relMd = mdPath.slice(REPO_ROOT.length + 1);
    for (let i = 0; i < blocks.length; i++) {
      total++;
      const { lang, body, startLine } = blocks[i];
      const firstNonBlank =
        body.split("\n").find((l) => l.trim().length > 0) ?? "";
      const skip = /^\/\/\s*@check:skip\b/.test(firstNonBlank.trim());
      // Promote ts→tsx when the body clearly contains JSX. Skill authors
      // sometimes mislabel fences; this keeps the harness from drowning in
      // parse errors caused by `</div>` etc.
      const looksJsx =
        lang !== "tsx" &&
        (/<[A-Z][A-Za-z0-9]*[\s/>]/.test(body) || /<\/[a-z][A-Za-z0-9]*>/.test(body));
      const ext = lang === "tsx" || looksJsx ? "tsx" : "ts";
      const base = `${skill}__${label}__${String(i).padStart(2, "0")}__L${startLine}`;
      const outName = skip ? `${base}.${ext}.skip` : `${base}.${ext}`;
      // Split top-level import/export lines from the rest so `await` can be
      // hoisted into an async wrapper without violating TS1232 (imports must
      // live at module top level).
      // Walk the body; for any line starting an `import` (or top-level
      // re-export), keep consuming until the statement closes — multi-line
      // brace imports must travel together to the module top.
      const bodyLines = body.split("\n");
      const importLines = [];
      const restLines = [];
      const STARTS_IMPORT = /^\s*(import\b|export\s+(type\s+)?(\{|\*))/;
      let j = 0;
      while (j < bodyLines.length) {
        const ln = bodyLines[j];
        if (STARTS_IMPORT.test(ln)) {
          let stmt = ln;
          // Statement ends on a line that contains `;` or that has `from '...'`
          // with no open `{` left unclosed.
          let openBraces = (ln.match(/\{/g) || []).length - (ln.match(/\}/g) || []).length;
          let closed = openBraces <= 0 && /;|from\s+['"]/.test(ln);
          while (!closed && j + 1 < bodyLines.length) {
            j++;
            const next = bodyLines[j];
            stmt += "\n" + next;
            openBraces += (next.match(/\{/g) || []).length - (next.match(/\}/g) || []).length;
            if (openBraces <= 0 && /;|from\s+['"]/.test(next)) closed = true;
          }
          importLines.push(stmt);
        } else {
          restLines.push(ln);
        }
        j++;
      }
      const header =
        `// source: ${relMd}:${startLine}\n` +
        `export {};\n` +
        importLines.join("\n") +
        (importLines.length ? "\n" : "");
      const wrapped =
        ext === "tsx"
          ? header + restLines.join("\n") + "\n"
          : header +
            `async function _snippet() {\n${restLines.join("\n")}\n}\n` +
            `void _snippet;\n`;
      await writeFile(join(TMP_DIR, outName), wrapped);
      if (skip) skipped++;
      else emitted++;
    }
  }

  console.log(
    `Extracted ${total} blocks (${emitted} checked, ${skipped} skipped) → ${TMP_DIR}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
