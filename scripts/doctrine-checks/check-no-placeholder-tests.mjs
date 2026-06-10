#!/usr/bin/env node
/**
 * Equoria-fefh2.10 doctrine check: no placeholder-only tests in backend suites.
 *
 * CLAUDE.md Constitution §3 — "Tests exist to detect real failures." A test
 * whose ONLY substance is `expect(true).toBe(true)` is a placebo: it passes
 * green regardless of whether the feature works, manufacturing false
 * confidence (the exact "test that doesn't really test" failure mode).
 *
 * WHAT IS FLAGGED — the PLACEHOLDER-ONLY shape:
 *
 *   it('should handle X', async () => {
 *     // some justification prose
 *     expect(true).toBe(true); // Placeholder
 *   });
 *
 * i.e. an `expect(true).toBe(true)` whose enclosing it/test body contains
 * NOTHING but comments between the test opener and the vacuous assertion
 * (single-line `it('x', () => { expect(true).toBe(true); })` included).
 *
 * WHAT IS NOT FLAGGED (deliberate — these are different shapes with real
 * work/assertions around them, owned by other doctrine concerns):
 *   - did-not-throw coverage tests that do real work first
 *     (e.g. showSchedulerRunCycle.test.mjs)
 *   - conditional-fallback assertions inside if/else branches whose sibling
 *     branch asserts for real (e.g. marketplaces.test.mjs,
 *     traitCompetitionImpact.test.mjs) — the graceful-skip concern is
 *     check-no-graceful-skip.mjs territory.
 *
 * SCOPED EXEMPTION — a line comment containing
 *   doctrine-allow: placeholder-test
 * on the same line or the line immediately above the expect suppresses the
 * violation (needed by this check's own sentinel fixtures and any future
 * legitimate meta-test of the assertion framework itself).
 *
 * SKIPPED FILES — any file whose NAME contains `PLANTED` or `DO_NOT_COMMIT`
 * (case-sensitive, the canonical UPPERCASE sentinel-plant markers used by the
 * other doctrine sentinels) is a sentinel plant artifact from a concurrent
 * jest run, not real tree state. This check's own sentinel therefore plants
 * with a lowercase `planted` marker so the plant is still scanned.
 *
 * ENOENT TOLERANCE (Equoria-q7lqz) — concurrent jest sentinel suites plant
 * and delete temp test files mid-scan; a file collected by the walk may have
 * vanished by read time. That is tolerated with a logged notice (narrowly:
 * ENOENT only — any other read error still crashes the check loudly).
 *
 * Run: `node scripts/doctrine-checks/check-no-placeholder-tests.mjs`
 * Auto-runs via `scripts/doctrine-checks/run-all.sh`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { walkFiles, readScannedFileSyncTolerant } from '../lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');

const EXEMPTION_MARKER = 'doctrine-allow: placeholder-test';

// Whitespace-tolerant literal: expect ( true ) . toBe ( true )
const PLACEHOLDER_ASSERT_RE = /expect\s*\(\s*true\s*\)\s*\.\s*toBe\s*\(\s*true\s*\)/;

// A jest test opener on a line: it(/test(/it.each(/test.only( etc.
// (describe( is NOT an opener — a vacuous expect directly under describe is
// not an it-body and jest would reject it anyway.)
const TEST_OPENER_RE = /\b(?:it|test)\s*(?:\.\s*\w+\s*)?\(/;

// Per-check scope predicates (Equoria-ml7jj mechanism share):
//   - skip node_modules/.git/dist/coverage directories
//   - include only *.test.mjs / *.spec.mjs
//   - skip sentinel-plant artifacts by name (PLANTED / DO_NOT_COMMIT,
//     case-sensitive — see header)
const skipDir = (name) =>
  name === 'node_modules' || name === '.git' || name === 'dist' || name === 'coverage';

const includeFile = (name) =>
  /\.(test|spec)\.mjs$/.test(name) && !name.includes('PLANTED') && !name.includes('DO_NOT_COMMIT');

function isCommentOrBlank(line) {
  const t = line.trim();
  return t === '' || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t === '*/';
}

/**
 * Find placeholder-only violations in one file's source.
 * A hit = a PLACEHOLDER_ASSERT_RE line whose nearest preceding
 * non-comment/non-blank line is the it/test opener (or the opener is on the
 * same line), and which carries no exemption marker on the same/previous line.
 */
function findViolations(src, relPath) {
  const lines = src.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!PLACEHOLDER_ASSERT_RE.test(line)) continue;
    if (line.includes(EXEMPTION_MARKER)) continue;
    if (i > 0 && lines[i - 1].includes(EXEMPTION_MARKER)) continue;

    // One-liner form: opener and vacuous assert on the same line.
    if (TEST_OPENER_RE.test(line)) {
      hits.push({ file: relPath, line: i + 1, snippet: line.trim().slice(0, 120) });
      continue;
    }

    // Walk upward past comments/blanks; if the first substantive line above
    // is the test opener, the body is placeholder-only.
    let j = i - 1;
    while (j >= 0 && isCommentOrBlank(lines[j])) j--;
    if (j >= 0 && TEST_OPENER_RE.test(lines[j])) {
      hits.push({ file: relPath, line: i + 1, snippet: lines[i].trim().slice(0, 120) });
    }
  }
  return hits;
}

function toRelKey(absPath) {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join('/');
}

function main() {
  if (!fs.existsSync(BACKEND_ROOT)) {
    process.exit(0);
  }

  const files = walkFiles([BACKEND_ROOT], { skipDir, includeFile });
  const allHits = [];
  let scanned = 0;

  for (const f of files) {
    // Equoria-q7lqz/7avnu: a concurrent jest sentinel suite can plant and delete
    // a temp test file between the walk and this read. The shared tolerant reader
    // returns null ONLY on ENOENT (with a one-line notice) and rethrows anything
    // else — never a silent catch. (Replaces the previous inline ENOENT try/catch
    // so every doctrine check shares one tolerant-read implementation.)
    const src = readScannedFileSyncTolerant(f, 'no-placeholder-tests');
    if (src === null) continue;
    scanned++;
    allHits.push(...findViolations(src, toRelKey(f)));
  }

  if (allHits.length > 0) {
    console.error('[no-placeholder-tests] FAIL — Constitution §3 placeholder-only tests:');
    for (const h of allHits) {
      console.error(`  ${h.file}:${h.line}  ${h.snippet}`);
    }
    console.error('');
    console.error('Fix: delete the placeholder test (cover the behavior with a REAL test in');
    console.error('an integration suite) — do not leave a green assertion that asserts');
    console.error('nothing. See CLAUDE.md Constitution §3.');
    process.exit(1);
  }

  console.log(`[no-placeholder-tests] OK — scanned ${scanned} test files, 0 violations`);
}

main();
