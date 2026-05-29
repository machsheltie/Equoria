#!/usr/bin/env node
/**
 * Equoria-ej9k1 containment doctrine check.
 *
 * Problem: 221 instances across 62 service files match the
 * try/catch-log-rethrow antipattern:
 *   try { ... } catch (error) {
 *     logger.error(`[svc.fn] ...`);
 *     throw error;
 *   }
 *
 * This adds nothing the global error handler doesn't already do AND
 * produces double-logging when callers also log. Per OPTIMAL_FIX §3
 * the full codemod is too big for one PR. This check is the containment
 * gate: a per-file baseline counts the legacy occurrences; any PR that
 * adds NEW ones (or introduces them to a clean file) fails this check.
 *
 * Migration shrinks the counts in the JSON in lockstep with PRs that
 * replace the rethrow-after-log with either (a) just `throw` so the
 * global handler logs once, or (b) a typed ServiceError wrapper that
 * adds genuine context.
 *
 * Pattern matched (single-statement catch body):
 *   catch (...) { logger.(error|warn|info)(...); throw ...; }
 *
 * Catches with additional substantive work (extra cleanup, conditional
 * branches, error transformation beyond throw-the-same) are NOT matched.
 *
 * Auto-runs via scripts/doctrine-checks/run-all.sh by file-name pattern.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const BASELINE_PATH = path.join(SCRIPT_DIR, 'rethrow-after-log-baseline.json');

const SCAN_DIRS = ['backend'];
const FILE_RE = /\.mjs$/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '__tests__']);

// Matches: catch (...) { ...logger.error/warn/info(...); throw ...; }
// The [^{}]*? body forbids nested braces, so this only matches
// single-block catches that ONLY log-then-throw (no conditional branches,
// no nested error transformation, no extra cleanup work).
const PATTERN = /catch\s*\([^)]*\)\s*\{[^{}]*?logger\.(error|warn|info)\([^)]*\)\s*;\s*throw\s+\w+\s*;?\s*\}/gs;

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
    } else if (
      e.isFile() &&
      FILE_RE.test(e.name) &&
      !e.name.endsWith('.test.mjs') &&
      !e.name.endsWith('.spec.mjs')
    ) {
      acc.push(full);
    }
  }
}

function countMatches(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const matches = src.match(PATTERN);
  return matches ? matches.length : 0;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`[rethrow-after-log] baseline not found at ${BASELINE_PATH}`);
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
  for (const d of SCAN_DIRS) walk(path.join(REPO_ROOT, d), files);

  const violations = [];
  let observedTotal = 0;
  const seenInBaseline = new Set();

  for (const f of files) {
    const key = toRelKey(f);
    const observed = countMatches(f);
    observedTotal += observed;
    const baselineCount = baseline[key] ?? 0;
    if (baselineCount > 0) seenInBaseline.add(key);
    if (observed > baselineCount) {
      violations.push({
        file: key,
        baseline: baselineCount,
        observed,
        delta: observed - baselineCount,
      });
    }
  }

  if (violations.length > 0) {
    console.error('[rethrow-after-log] FAIL — count grew above baseline:');
    for (const v of violations) {
      console.error(`  ${v.file}: baseline=${v.baseline}, observed=${v.observed} (+${v.delta})`);
    }
    console.error('');
    console.error('Fix:');
    console.error('  - If the catch only logs and rethrows, REMOVE the try/catch entirely');
    console.error('    — the global errorHandler already logs once with full context.');
    console.error('  - If the context is genuinely useful, wrap with a typed error:');
    console.error('      throw new ServiceError("...", { cause: error })');
    console.error('  - If you are MIGRATING (count went DOWN), update the baseline JSON.');
    console.error('  - See Equoria-ej9k1 + OPTIMAL_FIX §3.');
    process.exit(1);
  }

  const baselineTotal = Object.values(baseline).reduce((s, n) => s + n, 0);
  console.log(
    `[rethrow-after-log] OK — observed total=${observedTotal} <= baseline total=${baselineTotal} ` +
      `(${Object.keys(baseline).length} legacy files; ${seenInBaseline.size} still present)`,
  );
}

main();
