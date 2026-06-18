#!/usr/bin/env node
/**
 * Equoria-sqrpa doctrine check: no unversioned `/api/...` paths in the
 * Playwright E2E specs/helpers (`tests/e2e/**`).
 *
 * WHY THIS EXISTS (the gap that shipped the bug):
 *   The sibling `check-no-unversioned-api.mjs` scans ONLY `frontend/src` and
 *   explicitly SKIPS `*.spec.ts` / `*.test.ts`. The E2E specs live in
 *   `tests/e2e/*.spec.ts` — outside that scan root AND skipped by name — so
 *   when 21R-AUTH-7 removed the unversioned `/api` backward-compat mount from
 *   backend/app.mjs, the E2E setup helpers kept calling `/api/horses` and
 *   `/api/breeds` and silently 404'd (Equoria-sqrpa). Unlike frontend SOURCE,
 *   E2E specs make REAL requests against the live stack, so an unversioned
 *   path is a hard defect, not test-support noise — hence this check does NOT
 *   skip spec files (that omission is the whole point).
 *
 * Scan: tests/e2e/**\/*.ts (specs + helpers), excluding node_modules.
 * Pattern: a quote/backtick/`}` immediately before `/api/<not-v1, not-internal>`
 *   — matches bare-quoted, backtick, and `${base}/api/...` template forms.
 *   Unquoted prose in comments (e.g. `// GET /api/horses asserts ...`) is NOT
 *   matched, so doc comments referencing the old path don't trip the gate.
 *
 * Escape hatch (none today): a line containing `// sqrpa-allow`.
 *
 * Run: `node scripts/doctrine-checks/check-no-unversioned-api-e2e.mjs`
 * Auto-runs via `scripts/doctrine-checks/run-all.sh`.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  readScannedFileSyncTolerant,
  readdirSyncTolerant,
} from '../lib/doctrine-scan-patterns.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const SCAN_ROOT = path.join(REPO_ROOT, 'tests', 'e2e');

const SCAN_FILE_RE = /\.ts$/;
const SKIP_DIRS = new Set(['node_modules', '__screenshots__']);

// Same detector as check-no-unversioned-api.mjs: a quote/backtick/`}` then
// `/api/` where the next segment is NOT `v1/` and NOT `internal/`.
const VIOLATION_RE = /['"`}](\/api\/(?!v1\/)(?!internal\/)[^'"`]+)['"`]/g;

const BACKSLASH = String.fromCharCode(92);

function walk(dir, acc) {
  // Tolerate ONLY ENOENT (optional/vanished dir) loudly; re-throw any other
  // readdir fault so a partially-read tree can't report a green "0 violations".
  const ents = readdirSyncTolerant(dir, { withFileTypes: true }, 'no-unversioned-api-e2e');
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, acc);
    } else if (e.isFile() && SCAN_FILE_RE.test(e.name)) {
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
    if (lines[i].includes('// sqrpa-allow')) continue;
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
    const src = readScannedFileSyncTolerant(f, 'no-unversioned-api-e2e');
    if (src === null) continue; // vanished mid-scan (ENOENT) — skip, noticed
    allViolations.push(...findViolations(f, src));
  }

  if (allViolations.length > 0) {
    console.error('[no-unversioned-api-e2e] FAIL — Equoria-sqrpa violations:');
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.line}  ${v.path}`);
    }
    console.error('');
    console.error(
      'Fix: replace `/api/<X>` with `/api/v1/<X>` — backend/app.mjs mounts ONLY /api/v1/*.'
    );
    console.error('See: Equoria-sqrpa (21R-AUTH-7 removed the unversioned backward-compat mount).');
    process.exit(1);
  }

  console.log(`[no-unversioned-api-e2e] OK — scanned ${files.length} E2E files, 0 violations`);
}

// Main-module guard so the sentinel test can import findViolations without
// triggering the filesystem walk + process.exit.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
