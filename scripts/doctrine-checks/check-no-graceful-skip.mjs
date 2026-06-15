#!/usr/bin/env node
/**
 * Equoria-ftaqy doctrine check: no graceful-skip phrases in test console.log.
 *
 * CLAUDE.md Constitution §3 forbids "skip if missing infra" / "graceful skip"
 * patterns in tests — they pass green regardless of whether the feature
 * works, the exact "test that doesn't really test" failure mode the
 * doctrine exists to prevent.
 *
 * This check greps test files for the canonical anti-patterns:
 *   - `console.log('... not available — skipping ...')`
 *   - `console.log('... not readable — skipping ...')`
 *   - `console.log('Did not encounter ... in N iterations')`
 *   - `console.log('... — skipping ... test')`
 *
 * Any match fails the check. Tests that legitimately need conditional
 * behavior (e.g. infrastructure that is truly optional and the assertion
 * is shaped accordingly) must use `it.skip` or `describe.skip` with a
 * comment explaining the legitimate condition — which is itself forbidden
 * for beta-readiness paths under Constitution §2 (the `check-no-skips-in-
 * readiness.sh` doctrine catches that separately).
 *
 * Run: `node scripts/doctrine-checks/check-no-graceful-skip.mjs`
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
const TEST_GLOBS_DIRS = ['backend'];
const TEST_FILE_RE = /\.(test|spec)\.(m?js|tsx?|jsx?)$/;

// Patterns inside console.log arguments that indicate a graceful-skip.
// Each pattern is a regex; matching ANY of them in a console.log call
// flags the file as a violation.
const VIOLATION_PATTERNS = [
  /not\s+available\s*[—-]+\s*skipping/i,
  /not\s+readable\s*[—-]+\s*skipping/i,
  /Did\s+not\s+encounter\s+[\w\s]+\s+in\s+\d+\s+iterations/i,
  /[—-]+\s*skipping\s+(?:DB|test|generateStoreStats|integration)/i,
];

const BACKSLASH = String.fromCharCode(92);

function walk(dir, acc) {
  // Equoria-g48ng: tolerate ONLY ENOENT (an optional dir that doesn't exist /
  // vanished mid-scan) loudly; re-throw any other readdir fault (EPERM/EACCES/
  // ENOTDIR) so a partially-read tree can never report a green "0 violations".
  const ents = readdirSyncTolerant(dir, { withFileTypes: true }, 'no-graceful-skip');
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (
        e.name === 'node_modules' ||
        e.name === '.git' ||
        e.name === 'dist' ||
        e.name === 'coverage'
      ) {
        continue;
      }
      walk(full, acc);
    } else if (e.isFile() && TEST_FILE_RE.test(e.name)) {
      acc.push(full);
    }
  }
}

function findViolations(src, filePath) {
  const lines = src.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/console\.log\s*\(/.test(lines[i])) continue;
    // Join up to 3 lines so multi-line console.log calls are caught.
    const joined = (lines[i] + ' ' + (lines[i + 1] ?? '') + ' ' + (lines[i + 2] ?? '')).slice(
      0,
      800
    );
    for (const pat of VIOLATION_PATTERNS) {
      if (pat.test(joined)) {
        hits.push({ file: filePath, line: i + 1, snippet: lines[i].trim().slice(0, 120) });
        break;
      }
    }
  }
  return hits;
}

function toRelKey(absPath) {
  return path.relative(REPO_ROOT, absPath).split(BACKSLASH).join('/');
}

function main() {
  const files = [];
  for (const d of TEST_GLOBS_DIRS) walk(path.join(REPO_ROOT, d), files);

  const allHits = [];
  for (const f of files) {
    const src = readScannedFileSyncTolerant(f, 'no-graceful-skip');
    if (src === null) continue; // vanished mid-scan (ENOENT) — skip, noticed
    const hits = findViolations(src, toRelKey(f));
    allHits.push(...hits);
  }

  if (allHits.length > 0) {
    console.error('[no-graceful-skip] FAIL — Constitution §3 violations:');
    for (const h of allHits) {
      console.error(`  ${h.file}:${h.line}  ${h.snippet}`);
    }
    console.error('');
    console.error('Fix: remove the conditional-skip — let the test FAIL LOUDLY when');
    console.error('the precondition is not met. See CLAUDE.md Constitution §3.');
    process.exit(1);
  }

  console.log(`[no-graceful-skip] OK — scanned ${files.length} test files, 0 violations`);
}

main();
