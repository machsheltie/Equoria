#!/usr/bin/env node
/**
 * Equoria-4bs3s doctrine check: no unversioned `/api/...` paths in
 * frontend code.
 *
 * The dual `/api` + `/api/v1` mount was removed in backend/app.mjs.
 * Frontend code must use the canonical `/api/v1/...` prefix. A regression
 * that re-introduces an unversioned `/api/<something>` literal in any
 * non-test frontend source file fails this check.
 *
 * Allowed exceptions (none today, but pattern is reserved):
 *   - Lines containing `// eslint-disable-line` or `// 4bs3s-allow` markers
 *
 * Scan: frontend/src/**\/*.{ts,tsx} excluding *.test.* / *.spec.*.
 * Pattern: `/api/<not-v1>...` — case-sensitive (Express paths are).
 *
 * Allows `/api/v1/...` (the canonical) and `/api/internal/...` (the
 * pre-existing 4bs3s-sibling ghost endpoint tracked separately).
 *
 * Run: `node scripts/doctrine-checks/check-no-unversioned-api.mjs`
 * Auto-runs via `scripts/doctrine-checks/run-all.sh`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const SCAN_ROOT = path.join(REPO_ROOT, 'frontend', 'src');

const SCAN_FILE_RE = /\.(ts|tsx)$/;
const SKIP_NAME_RE = /\.(test|spec)\.(ts|tsx)$/;
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '__mocks__', '__tests__']);

// Match any string-literal /api/<something>/ where <something> is NOT v1
// and NOT internal. Both single- and double-quoted; backticks too.
// Captures the violating path so the error message can show it.
const VIOLATION_RE = /['"`](\/api\/(?!v1\/)(?!internal\/)[^'"`]+)['"`]/g;

const BACKSLASH = String.fromCharCode(92);

function walk(dir, acc) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, acc);
    } else if (e.isFile() && SCAN_FILE_RE.test(e.name) && !SKIP_NAME_RE.test(e.name)) {
      acc.push(full);
    }
  }
}

function toRelKey(absPath) {
  return path.relative(REPO_ROOT, absPath).split(BACKSLASH).join('/');
}

function findViolations(filePath, src) {
  const violations = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// 4bs3s-allow')) continue;
    if (lines[i].includes('// eslint-disable-line')) continue;
    let m;
    VIOLATION_RE.lastIndex = 0;
    while ((m = VIOLATION_RE.exec(lines[i])) !== null) {
      violations.push({
        file: toRelKey(filePath),
        line: i + 1,
        path: m[1],
      });
    }
  }
  return violations;
}

function main() {
  const files = [];
  walk(SCAN_ROOT, files);

  const allViolations = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const v = findViolations(f, src);
    allViolations.push(...v);
  }

  if (allViolations.length > 0) {
    console.error('[no-unversioned-api] FAIL — Equoria-4bs3s violations:');
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.line}  ${v.path}`);
    }
    console.error('');
    console.error('Fix: replace `/api/<X>` with `/api/v1/<X>`.');
    console.error('See: backend/app.mjs (only /api/v1/* is mounted) and Equoria-4bs3s.');
    process.exit(1);
  }

  console.log(`[no-unversioned-api] OK — scanned ${files.length} frontend files, 0 violations`);
}

main();
