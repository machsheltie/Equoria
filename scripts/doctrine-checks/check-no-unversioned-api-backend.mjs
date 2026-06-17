#!/usr/bin/env node
/**
 * Equoria-x8y6i doctrine check: no unversioned `/api/...` paths in backend
 * operational scripts + k6 load harnesses.
 *
 * Sibling of check-no-unversioned-api.mjs (Equoria-4bs3s), which scans only
 * frontend/src. That frontend-only gate would NOT have caught the unversioned
 * `/api/breeds` literal that drifted into a BACKEND k6 harness
 * (backend/tests/load/concurrent-feed-breed-foal.test.js) — it was found by a
 * failing CI load job, not the doctrine gate. The backend surfaces this check
 * covers are exactly the ones that run OUTSIDE jest's real-app signal:
 *   - backend/scripts/**     — operational scripts (perf harnesses, migrations)
 *   - backend/tests/load/**  — k6 harnesses (jest.config ignores /tests/load/)
 * A wrong `/api/<x>` path in either only surfaces at runtime / in a dedicated
 * CI job, never as a normal test failure — so it needs a static gate.
 *
 * The dual `/api` + `/api/v1` mount was removed in backend/app.mjs; only
 * `/api/v1/...` (or a future `/api/v<n>/...`) is mounted. Any string literal
 * `/api/<not-v\d>...` in scope is drift that 404s at runtime.
 *
 * Escape hatch (per the 4bs3s sibling): a line containing `// 4bs3s-allow` or
 * `// eslint-disable-line` is skipped. Genuinely root-mounted infra routes
 * (`/ping`, `/health`) are NOT under `/api/` and never match this pattern.
 *
 * Run: `node scripts/doctrine-checks/check-no-unversioned-api-backend.mjs`
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
const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'backend', 'scripts'),
  path.join(REPO_ROOT, 'backend', 'tests', 'load'),
];

const SCAN_FILE_RE = /\.(mjs|js)$/;
// NOTE: unlike the frontend sibling, *.test.js is NOT skipped — the k6 load
// harnesses are named *.test.js and are precisely what this check must scan.
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '__mocks__']);

// Match a quoted /api/<something> where <something> is NOT a version segment
// (v1, v2, …). Single/double quotes and backticks. Captures the violating path.
const VIOLATION_RE = /['"`](\/api\/(?!v\d)[^'"`]+)['"`]/g;

const BACKSLASH = String.fromCharCode(92);

function toRelKey(absPath) {
  return path.relative(REPO_ROOT, absPath).split(BACKSLASH).join('/');
}

/**
 * Pure detector: return [{ line, path }] for every unversioned /api literal in
 * `src`. Lines carrying an allow marker are skipped. Exported for the sentinel.
 */
export function findUnversionedApiLiterals(src) {
  const violations = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// 4bs3s-allow')) continue;
    if (lines[i].includes('// eslint-disable-line')) continue;
    let m;
    VIOLATION_RE.lastIndex = 0;
    while ((m = VIOLATION_RE.exec(lines[i])) !== null) {
      violations.push({ line: i + 1, path: m[1] });
    }
  }
  return violations;
}

function walk(dir, acc) {
  // Tolerate ONLY ENOENT (an optional root that doesn't exist / vanished
  // mid-scan) loudly; re-throw any other fault so a partially-read tree can
  // never report a green "0 violations" (mirrors the 4bs3s sibling).
  const ents = readdirSyncTolerant(dir, { withFileTypes: true }, 'no-unversioned-api-backend');
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

function main() {
  const files = [];
  for (const root of SCAN_ROOTS) {
    walk(root, files);
  }

  const allViolations = [];
  for (const f of files) {
    const src = readScannedFileSyncTolerant(f, 'no-unversioned-api-backend');
    if (src === null) continue; // vanished mid-scan (ENOENT) — skip, noticed
    for (const v of findUnversionedApiLiterals(src)) {
      allViolations.push({ file: toRelKey(f), ...v });
    }
  }

  if (allViolations.length > 0) {
    console.error('[no-unversioned-api-backend] FAIL — Equoria-x8y6i violations:');
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.line}  ${v.path}`);
    }
    console.error('');
    console.error('Fix: replace `/api/<X>` with `/api/v1/<X>` (only /api/v1/* is mounted).');
    console.error('See: backend/app.mjs, Equoria-4bs3s, Equoria-x8y6i.');
    process.exit(1);
  }

  console.log(
    `[no-unversioned-api-backend] OK — scanned ${files.length} backend script/load files, 0 violations`
  );
}

// Equoria-x8y6i: main-module guard (CONTRIBUTING.md). main() walks the tree and
// exits; bare import (the sentinel test) gets findUnversionedApiLiterals with no
// side effects.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
