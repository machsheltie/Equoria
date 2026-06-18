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

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Equoria-7avnu: route enumerated-file reads through the shared tolerant reader
// so a file that vanishes mid-scan (concurrent jest sentinel plant+delete, the
// q7lqz race) is skipped loudly (ENOENT-only) instead of crashing the check.
import {
  readScannedFileSyncTolerant,
  readdirSyncTolerant,
} from '../lib/doctrine-scan-patterns.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const SCAN_ROOT = path.join(REPO_ROOT, 'frontend', 'src');

const SCAN_FILE_RE = /\.(ts|tsx)$/;
const SKIP_NAME_RE = /\.(test|spec)\.(ts|tsx)$/;
// Equoria-9ysza: `test` joins the skip set. This check enforces "no unversioned
// /api in frontend SOURCE" (production code) — it already skips *.test/*.spec
// files + __tests__/__mocks__ dirs. frontend/src/test/ is test-support infra
// (the MSW mock handlers), NOT source; a stale unversioned mock there is a
// test-hygiene matter, not a production-code regression, so it is out of scope
// for this gate (tracked separately).
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  '__mocks__',
  '__tests__',
  'test',
]);

// Match any string-literal /api/<something>/ where <something> is NOT v1 and
// NOT internal. Single/double-quoted, backticks, AND `${VAR}/api/...` template
// literals — the leading class includes `}` so a base-URL interpolation is
// caught too (Equoria-9ysza / qv8n8: the original ['"`] class missed the common
// `${base}/api/...` form). Captures the violating path for the error message.
const VIOLATION_RE = /['"`}](\/api\/(?!v1\/)(?!internal\/)[^'"`]+)['"`]/g;

const BACKSLASH = String.fromCharCode(92);

function walk(dir, acc) {
  // Equoria-g48ng: tolerate ONLY ENOENT (an optional dir that doesn't exist /
  // vanished mid-scan) loudly; re-throw any other readdir fault (EPERM/EACCES/
  // ENOTDIR) so a partially-read tree can never report a green "0 violations".
  const ents = readdirSyncTolerant(dir, { withFileTypes: true }, 'no-unversioned-api');
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

export function findViolations(filePath, src) {
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
    const src = readScannedFileSyncTolerant(f, 'no-unversioned-api');
    if (src === null) continue; // vanished mid-scan (ENOENT) — skip, noticed
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

// Equoria-9ysza: main-module guard so a sentinel can import findViolations
// without triggering the filesystem walk + process.exit.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
