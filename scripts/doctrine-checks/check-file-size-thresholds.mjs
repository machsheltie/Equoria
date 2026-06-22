#!/usr/bin/env node
/**
 * Equoria-urqic.7 file-size-threshold doctrine check.
 *
 * Problem: Equoria-urqic.1-.6 split a set of god files (oversized controllers,
 * services, and test harnesses) into owned modules. Without a guardrail those
 * files — and any new ones — will regrow past a maintainable size over time.
 * This check is the prevention capstone for the urqic epic: a shrink-only
 * ratchet that stops the just-split files from regrowing and stops new
 * over-threshold files from landing.
 *
 * Policy (user-approved, 2026-06-22):
 *   - SOURCE files (.mjs under backend/, .ts/.tsx under frontend/src/, EXCLUDING
 *     test files) must be <= 600 lines.
 *   - TEST files (*.test.*, *.spec.*, anything under a __tests__/ directory)
 *     must be <= 800 lines.
 *
 * Mechanism: a DOCTRINE ratchet, NOT an ESLint max-lines warn. The project's
 * lint runs with --max-warnings 0, so a warn-level rule would break `npm run
 * lint`; an error-level whole-tree rule would be a flag-day mass failure. This
 * shrink-only baseline mirrors the sibling rethrow-after-log gate
 * (check-no-new-rethrow-after-log.mjs + rethrow-after-log-baseline.json):
 *
 *   - file-size-baseline.json is a per-file allow-list of the files CURRENTLY
 *     over their threshold, recording each file's exact line count at baseline
 *     time. These are the genuinely-cohesive / not-yet-split exceptions.
 *   - The check FAILS if (a) a NEW file exceeds its threshold but is not in the
 *     baseline, or (b) a baselined file GREW above its recorded line count.
 *   - The baseline may ONLY shrink. To shrink: reduce the file below threshold
 *     (or below its recorded count) and decrement/delete its entry in the SAME
 *     commit. A baseline entry whose file no longer exists on disk, OR whose
 *     file is no longer over threshold, is STALE and fails this check until the
 *     entry is pruned — stale entries are unusable headroom a future regression
 *     could hide under.
 *
 * Line counting: a file's "line count" is the number of newline-terminated
 * lines plus a trailing partial line if the file does not end in a newline.
 * This matches `wc -l` + 1-for-no-trailing-newline and is the raw, total line
 * count (NOT effective/non-blank — the threshold is about file heft, and a
 * blank-line-padded file is still a file a maintainer has to scroll). The
 * pure detector is exported for the sentinel test.
 *
 * Scope exclusions: node_modules, dist, build, coverage, .git, .claude,
 * generated Prisma client output. Sentinel plant artifacts (basename contains
 * the UPPERCASE DO_NOT_COMMIT / PLANTED markers) are excluded at the walker
 * level so concurrent jest sentinel suites can't trip the production run.
 *
 * Optional argv[2]: alternate baseline JSON path (sentinel-test hook) —
 * production callers (run-all.sh, CI) pass no argument.
 * Auto-runs via scripts/doctrine-checks/run-all.sh by file-name pattern.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isPlantArtifactBasename,
  readScannedFileSyncTolerant,
} from '../lib/doctrine-scan-patterns.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

// argv[2] optionally overrides the baseline path so the sentinel can prove
// detection FIRES against a planted baseline without editing the canonical one.
// Production callers pass no argument.
const BASELINE_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(SCRIPT_DIR, 'file-size-baseline.json');

const BACKSLASH = String.fromCharCode(92);

// User-approved thresholds (2026-06-22).
export const SOURCE_THRESHOLD = 600;
export const TEST_THRESHOLD = 800;

// Directories never scanned, anywhere in the tree.
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.claude',
  '.next',
  '.turbo',
]);

// Source-file extensions per scan root.
const BACKEND_SRC_RE = /\.mjs$/;
const FRONTEND_SRC_RE = /\.(ts|tsx)$/;

// Scan roots (repo-relative) and their per-root file matcher.
const SCAN_ROOTS = [
  { dir: 'backend', match: (name) => BACKEND_SRC_RE.test(name) },
  { dir: path.join('frontend', 'src'), match: (name) => FRONTEND_SRC_RE.test(name) },
];

/**
 * Is this file a TEST file (800-line threshold) rather than a SOURCE file
 * (600-line threshold)? True when the basename is *.test.* / *.spec.* OR the
 * file lives anywhere under a `__tests__/` directory.
 */
export function isTestFile(relPath) {
  const normalized = relPath.split(BACKSLASH).join('/');
  const base = normalized.split('/').pop() ?? '';
  if (/\.(test|spec)\.[^./]+$/.test(base)) return true;
  if (normalized.split('/').includes('__tests__')) return true;
  return false;
}

/** The threshold (in lines) that applies to a given repo-relative path. */
export function thresholdFor(relPath) {
  return isTestFile(relPath) ? TEST_THRESHOLD : SOURCE_THRESHOLD;
}

/**
 * Count lines in a source string. A "line" is a newline-terminated line; a
 * trailing partial line (no final newline) counts as one more. An empty string
 * is zero lines. Pure — exported for the sentinel and unit reuse.
 */
export function countLines(src) {
  if (src.length === 0) return 0;
  let lines = 0;
  for (let i = 0; i < src.length; i += 1) {
    if (src[i] === '\n') lines += 1;
  }
  // Trailing content with no final newline is still a line.
  if (src[src.length - 1] !== '\n') lines += 1;
  return lines;
}

/** Count lines in a file on disk; tolerant of a vanished file (returns 0). */
function countFileLines(filePath) {
  const src = readScannedFileSyncTolerant(filePath, 'file-size-thresholds');
  if (src === null) return 0;
  return countLines(src);
}

function walk(dir, match, acc) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    // A directory can vanish mid-scan when a concurrent jest sentinel suite
    // deletes its temp scaffolding. Tolerate ONLY ENOENT, loudly; any other
    // error (EACCES, …) is a real fault and must crash.
    if (err && err.code === 'ENOENT') {
      console.error(`[file-size-thresholds] notice: skipped vanished directory ${dir}`);
      return;
    }
    throw err;
  }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, match, acc);
    } else if (
      e.isFile() &&
      match(e.name) &&
      // Sentinel plant artifacts (basename contains the UPPERCASE
      // DO_NOT_COMMIT / PLANTED markers) are planted+deleted by concurrent
      // jest sentinels — exclude them at the walker level.
      !isPlantArtifactBasename(e.name)
    ) {
      acc.push(full);
    }
  }
}

function toRelKey(absPath) {
  return path.relative(REPO_ROOT, absPath).split(BACKSLASH).join('/');
}

/**
 * Scan the tree and return a map of repo-relative-path -> line count for every
 * file CURRENTLY over its threshold. Pure detector (no process exit) — the
 * sentinel imports this to assert behaviour directly, and main() consumes it.
 */
export function scanOverThreshold() {
  const overThreshold = {};
  for (const { dir, match } of SCAN_ROOTS) {
    const absRoot = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(absRoot)) continue;
    const files = [];
    walk(absRoot, match, files);
    for (const f of files) {
      const key = toRelKey(f);
      const lines = countFileLines(f);
      if (lines > thresholdFor(key)) {
        overThreshold[key] = lines;
      }
    }
  }
  return overThreshold;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`[file-size-thresholds] baseline not found at ${BASELINE_PATH}`);
    process.exit(2);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (err) {
    console.error(`[file-size-thresholds] baseline is not valid JSON: ${err.message}`);
    process.exit(2);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error('[file-size-thresholds] baseline must be a JSON object of { "path": lineCount }');
    process.exit(2);
  }
  return parsed;
}

/**
 * Ratchet enforcement: every baseline key must (a) exist on disk AND (b) still
 * be over its threshold. A stale entry (deleted file, or a file that has since
 * been shrunk below threshold) is unusable grandfathered headroom — the
 * baseline may only SHRINK, so stale entries must be pruned.
 */
function assertNoStaleBaselineEntries(baseline, observed) {
  const stale = [];
  for (const key of Object.keys(baseline)) {
    const onDisk = fs.existsSync(path.join(REPO_ROOT, ...key.split('/')));
    if (!onDisk) {
      stale.push({ key, reason: 'file no longer exists on disk' });
    } else if (!(key in observed)) {
      stale.push({ key, reason: 'file is no longer over its threshold' });
    }
  }
  if (stale.length > 0) {
    console.error(
      '[file-size-thresholds] FAIL — stale baseline entries (baseline may only SHRINK):'
    );
    for (const s of stale) {
      console.error(`  ${s.key}: ${s.reason}`);
    }
    console.error('');
    console.error('Remove the stale path(s) from');
    console.error(`  ${BASELINE_PATH}`);
    console.error('(Equoria-urqic.7 — a shrunk/deleted file must be pruned from the allow-list).');
    process.exit(1);
  }
}

function main() {
  const baseline = loadBaseline();
  const observed = scanOverThreshold();

  assertNoStaleBaselineEntries(baseline, observed);

  const violations = [];
  for (const [key, lines] of Object.entries(observed)) {
    const baselineCount = baseline[key];
    if (baselineCount === undefined) {
      violations.push({
        file: key,
        threshold: thresholdFor(key),
        baseline: null,
        observed: lines,
      });
    } else if (lines > baselineCount) {
      violations.push({
        file: key,
        threshold: thresholdFor(key),
        baseline: baselineCount,
        observed: lines,
      });
    }
  }

  if (violations.length > 0) {
    console.error(
      '[file-size-thresholds] FAIL — file(s) over threshold and not allow-listed (or grew):'
    );
    for (const v of violations) {
      if (v.baseline === null) {
        console.error(
          `  ${v.file}: ${v.observed} lines > ${v.threshold} threshold (NEW — not on the allow-list)`
        );
      } else {
        console.error(
          `  ${v.file}: grew to ${v.observed} lines (baseline allowed ${v.baseline}, threshold ${v.threshold})`
        );
      }
    }
    console.error('');
    console.error(
      'Fix (preferred): split the file into owned modules so it falls below threshold.'
    );
    console.error(
      `  Source files must be <= ${SOURCE_THRESHOLD} lines; test files <= ${TEST_THRESHOLD} lines.`
    );
    console.error('If the file is a genuinely-cohesive exception, add it to the allow-list');
    console.error(`  ${BASELINE_PATH}`);
    console.error('at its CURRENT line count — but the allow-list may only SHRINK over time.');
    console.error('See Equoria-urqic.7 + .claude/rules/CONTRIBUTING.md "File-size thresholds".');
    process.exit(1);
  }

  const overCount = Object.keys(observed).length;
  const baselineCount = Object.keys(baseline).length;
  console.log(
    `[file-size-thresholds] OK — ${overCount} over-threshold file(s), all <= their baselined count ` +
      `(${baselineCount} allow-listed; src cap ${SOURCE_THRESHOLD}, test cap ${TEST_THRESHOLD})`
  );
}

// ESM main-module guard: this file is import-safe (the sentinel imports the
// pure detectors above without triggering the scan/exit). main() runs only
// when the file is the direct entrypoint.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
