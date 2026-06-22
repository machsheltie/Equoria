#!/usr/bin/env node
/**
 * Equoria-rkgq9 doctrine check: NO @radix-ui imports anywhere in frontend/src.
 *
 * The 8 @radix-ui primitives the codebase used (react-dialog, react-tabs,
 * react-tooltip, react-checkbox, react-collapsible, react-progress,
 * react-label, react-slot) were fully replaced by native in-house components
 * under `frontend/src/components/ui/*` (sub-issues rkgq9.1-.8). This gate, plus
 * the `no-restricted-imports` ESLint rule in the root eslint.config.js frontend
 * block, slams the door: a reintroduced `@radix-ui` import fails the pre-push +
 * CI doctrine suite, not just an IDE lint hint.
 *
 * Why a doctrine check in ADDITION to the ESLint rule: the ESLint rule only
 * fires when `npm run lint` is actually run with the rule active; this static
 * gate is independent of the frontend lint config loading correctly and runs in
 * the same place every other doctrine invariant does (run-all.sh → pre-push +
 * the CI doctrine-gate workflow).
 *
 * Scope: `frontend/src/**` for *.ts/*.tsx/*.js/*.jsx/*.mjs. Matches both
 *   `import ... from '@radix-ui/...'`  and  `from "@radix-ui..."`
 * Doc-comment mentions (e.g. "retire @radix-ui") are NOT imports and are not
 * matched — the pattern requires the `@radix-ui` to sit inside an import/from
 * source string.
 *
 * Run: `node scripts/doctrine-checks/check-no-radix-imports.mjs`
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
const SCAN_ROOT = path.join(REPO_ROOT, 'frontend', 'src');

const SCAN_FILE_RE = /\.(mjs|js|jsx|ts|tsx)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '__mocks__']);

// Match a `@radix-ui` package specifier inside a module-source string of an
// `import`/`export ... from` statement OR a dynamic `import('...')`/`require`.
// The `@radix-ui` must be the START of the quoted specifier so a doc comment
// like `// retire @radix-ui` (no surrounding quote) does not match.
const VIOLATION_RE = /(?:from|import|require)\s*\(?\s*['"]@radix-ui(?:\/[^'"]*)?['"]/g;

const BACKSLASH = String.fromCharCode(92);

function toRelKey(absPath) {
  return path.relative(REPO_ROOT, absPath).split(BACKSLASH).join('/');
}

/**
 * Pure detector: return [{ line }] for every @radix-ui import in `src`.
 * Exported for the sentinel-positive test.
 */
export function findRadixImports(src) {
  const violations = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    VIOLATION_RE.lastIndex = 0;
    if (VIOLATION_RE.test(lines[i])) {
      violations.push({ line: i + 1 });
    }
  }
  return violations;
}

function walk(dir, acc) {
  // Tolerate ONLY ENOENT loudly (an optional root that vanished mid-scan);
  // re-throw any other fault so a partially-read tree can never report a
  // green "0 violations" (mirrors the no-unversioned-api-backend sibling).
  const ents = readdirSyncTolerant(dir, { withFileTypes: true }, 'no-radix-imports');
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
  walk(SCAN_ROOT, files);

  const allViolations = [];
  for (const f of files) {
    const src = readScannedFileSyncTolerant(f, 'no-radix-imports');
    if (src === null) continue; // vanished mid-scan (ENOENT) — skip, noticed
    for (const v of findRadixImports(src)) {
      allViolations.push({ file: toRelKey(f), ...v });
    }
  }

  if (allViolations.length > 0) {
    console.error('[no-radix-imports] FAIL — Equoria-rkgq9 violations:');
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.line}  imports @radix-ui`);
    }
    console.error('');
    console.error('Radix is fully retired. Use the native in-house');
    console.error('components/ui/* primitives — do not reintroduce @radix-ui.');
    console.error('See: Equoria-rkgq9.');
    process.exit(1);
  }

  console.log(
    `[no-radix-imports] OK — scanned ${files.length} frontend/src files, 0 @radix-ui imports`
  );
}

// Main-module guard (CONTRIBUTING.md): only run when invoked directly, not on
// import (the sentinel test imports findRadixImports without running the scan).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
