#!/usr/bin/env node
/**
 * Equoria-75odq containment doctrine check.
 *
 * Problem: 788 test files contain `.catch(() => {})` (or similar empty-arm
 * variants) that swallow cleanup failures. Per CONTRIBUTING.md "Test Fixtures"
 * § "Cleanup discipline (CLAUDE.md §2)", a silent cleanup catch is the exact
 * landmine that leaks NULL-phenotype rows and trips sentinel Equoria-a429.
 *
 * Full codemod across all 788 sites is too large for one PR. The migration
 * is tracked separately. This check IS the containment gate: a per-file
 * baseline counts the legacy silent-catches; any PR that adds NEW ones (or
 * introduces them to a clean file) fails this check.
 *
 * Migration shrinks the counts in the JSON in lockstep with PRs that
 * replace silent catches with scoped error handlers.
 *
 * Pattern matched: .catch(arrow-fn-with-empty-body) — covers the variants
 * actually present in the codebase:
 *   .catch(() => {})
 *   .catch(()=>{})
 *   .catch(_ => {})
 *   .catch(err => {})       (one arg, ignored, empty body)
 *   .catch(() => undefined)
 *   .catch(() => null)
 *   .catch(() => void 0)
 *
 * Real catch arms with bodies (logging, fail-fast, re-throw) are NOT matched.
 *
 * Run: `node scripts/doctrine-checks/check-no-new-silent-cleanup-catch.mjs`
 * Integrated into `scripts/doctrine-checks/run-all.sh` by file-name pattern.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const BASELINE_PATH = path.join(SCRIPT_DIR, 'silent-cleanup-catch-baseline.json');

const TEST_GLOBS_DIRS = ['backend'];
const TEST_FILE_RE = /\.(test|spec)\.(m?js|tsx?|jsx?)$/;
const SILENT_CATCH_RE = /\.catch\(\s*\(?\s*\w*\s*\)?\s*=>\s*(\{\s*\}|undefined|null|void\s+0)\s*\)/g;

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

function countSilentCatches(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const matches = src.match(SILENT_CATCH_RE);
  return matches ? matches.length : 0;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`[silent-cleanup-catch] baseline not found at ${BASELINE_PATH}`);
    console.error('[silent-cleanup-catch] run the bootstrap step in the bd notes to regenerate.');
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

function toRelKey(absPath) {
  return path.relative(REPO_ROOT, absPath).split(BACKSLASH).join('/');
}

function main() {
  const baseline = loadBaseline();
  const files = [];
  for (const d of TEST_GLOBS_DIRS) walk(path.join(REPO_ROOT, d), files);

  const violations = [];
  let observedTotal = 0;
  const seenInBaseline = new Set();

  for (const f of files) {
    const key = toRelKey(f);
    const observed = countSilentCatches(f);
    observedTotal += observed;
    const baselineCount = baseline[key] ?? 0;
    if (baselineCount > 0) {
      seenInBaseline.add(key);
    }
    if (observed > baselineCount) {
      violations.push({
        file: key,
        baseline: baselineCount,
        observed,
        delta: observed - baselineCount,
      });
    }
  }

  // A file LISTED in the baseline that no longer exists is fine (likely
  // renamed or deleted). We do NOT fail on that case — migration shrinks
  // the baseline. We DO fail when an existing file's count grew, or a new
  // file appeared with silent catches.

  if (violations.length > 0) {
    console.error('[silent-cleanup-catch] FAIL — silent cleanup-catch count grew above baseline:');
    for (const v of violations) {
      console.error(
        `  ${v.file}: baseline=${v.baseline}, observed=${v.observed} (+${v.delta})`,
      );
    }
    console.error('');
    console.error('Fix:');
    console.error(
      '  - Replace `.catch(() => {})` with `.catch(err => console.warn(\`[cleanup] \${err.message}\`))`',
    );
    console.error('    or, better, let the cleanup throw (afterAll will fail loudly).');
    console.error('  - See CONTRIBUTING.md § "Test Fixtures — Cleanup discipline" and Equoria-75odq.');
    console.error('  - If you are MIGRATING (count went DOWN), update the baseline JSON to match.');
    process.exit(1);
  }

  const baselineTotal = Object.values(baseline).reduce((s, n) => s + n, 0);
  console.log(
    `[silent-cleanup-catch] OK — observed total=${observedTotal} <= baseline total=${baselineTotal} ` +
      `(${Object.keys(baseline).length} legacy files; ${seenInBaseline.size} still present)`,
  );
}

main();
