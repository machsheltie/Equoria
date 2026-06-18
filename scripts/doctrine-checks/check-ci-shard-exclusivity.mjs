#!/usr/bin/env node
/**
 * Doctrine check — CI backend-test shard testPathPatterns must be mutually
 * exclusive (Equoria-2ixd1).
 *
 * `jest --testPathPattern` is an UNANCHORED regex over each test file's path.
 * The pre-fix shard 2 (modules-then-__tests__) and shard 3 (bare __tests__/)
 * patterns BOTH matched every backend/modules/<x>/__tests__/ suite, so 469
 * module suites ran in shard 2 AND shard 3 at once. Consequences: wasted CI
 * minutes (shard 3 is already the largest volume), coverage double-counting in
 * the merge gate, and — worst — two parallel matrix jobs creating/deleting the
 * SAME suite's TestFixture rows against the SHARED real DB (the cross-job
 * FK/isolation flake class run-suite-sharded.mjs avoids by running serially).
 *
 * This check asserts no test file matches more than one shard pattern, over the
 * exact file set jest would run (testMatch minus testPathIgnorePatterns). It is
 * deliberately a doctrine check (not only a jest sentinel) so it runs in the
 * pre-push gate and the doctrine-gate CI workflow — independent of the very
 * sharding it validates (a sharding bug could otherwise exclude a jest-resident
 * sentinel from running at all).
 *
 * NOTE (scope): this check enforces MUTUAL EXCLUSIVITY only (no file in >1
 * shard). It does NOT assert EXHAUSTIVENESS (every file in >=1 shard); a small
 * set of pre-existing orphan test files match no shard today and are tracked
 * separately. Bundling that fix here would violate EDGE_CASE_FIX_DISCIPLINE §7.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Parse a single YAML scalar value (the RHS of `pattern:` / `shard:`).
 *
 * The shard patterns are single-quoted regex literals; `shard:` values are
 * bare integers. Single-quoted YAML only escapes an embedded quote as `''`
 * and otherwise preserves the bytes verbatim (crucially the regex backslashes
 * — `\.test\.mjs$`), so a substring extraction is faithful. Double-quoted and
 * bare forms are handled defensively even though the current file uses neither.
 */
function parseYamlScalar(raw) {
  const value = raw.trim();
  if (value.startsWith("'")) {
    // Single-quoted: closes at the next lone quote; '' is a literal quote.
    const end = value.indexOf("'", 1);
    return value.slice(1, end === -1 ? undefined : end).replace(/''/g, "'");
  }
  if (value.startsWith('"')) {
    const end = value.indexOf('"', 1);
    return value
      .slice(1, end === -1 ? undefined : end)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  // Bare scalar: drop a trailing ` # comment` (YAML requires whitespace before #).
  return value.replace(/\s+#.*$/, '').trim();
}

/**
 * Extract the ordered [{ shard, pattern }] list from the RAW test.yml text by
 * a targeted parse of `jobs.backend-tests.strategy.matrix.include`.
 *
 * Why a targeted parser and not js-yaml (Equoria-jgql9): this module is a ROOT
 * `scripts/` file, but it is imported by a jest sentinel
 * (backend/__tests__/ciShardExclusivity.sentinel.test.mjs) that runs in the
 * backend-shard + security-gate CI jobs — and those jobs `npm ci` only in
 * ./backend + ./packages/database, NOT at root. A top-level `import yaml from
 * 'js-yaml'` therefore failed to resolve there ("Cannot find module js-yaml"),
 * turning the sentinel into a suite-level FAILURE and reddening the Quality
 * Gate (master). Depending on zero extra packages makes this script resolve in
 * every job regardless of which node_modules a job installs.
 *
 * @param {string} workflowText - raw contents of .github/workflows/test.yml
 * @returns {Array<{ shard: number|string, pattern: string }>}
 */
export function extractShardPatterns(workflowText) {
  if (typeof workflowText !== 'string') {
    throw new Error(
      'check-ci-shard-exclusivity: extractShardPatterns expects the raw test.yml text'
    );
  }
  const lines = workflowText.split(/\r?\n/);

  // Locate the backend-tests job (top-level job key at 2-space indent) and the
  // end of its block (next sibling at <= 2-space indent that is not a comment).
  const jobIdx = lines.findIndex((l) => /^ {2}backend-tests:\s*$/.test(l));
  if (jobIdx === -1) {
    throw new Error('check-ci-shard-exclusivity: jobs.backend-tests not found in test.yml');
  }
  let blockEnd = lines.length;
  for (let i = jobIdx + 1; i < lines.length; i++) {
    if (/^ {0,2}\S/.test(lines[i]) && !/^ {0,2}#/.test(lines[i])) {
      blockEnd = i;
      break;
    }
  }

  // Find matrix.include inside the job block, then collect its more-indented
  // list items (stop at the first line that dedents to <= include's indent).
  let includeIdx = -1;
  let includeIndent = -1;
  for (let i = jobIdx + 1; i < blockEnd; i++) {
    const m = lines[i].match(/^( +)include:\s*$/);
    if (m) {
      includeIdx = i;
      includeIndent = m[1].length;
      break;
    }
  }
  if (includeIdx === -1) {
    throw new Error(
      'check-ci-shard-exclusivity: backend-tests matrix.include not found in test.yml'
    );
  }

  const patterns = [];
  let current = null;
  for (let i = includeIdx + 1; i < blockEnd; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue; // blank / comment line — does not end the block
    }
    const indent = line.length - line.replace(/^ +/, '').length;
    if (indent <= includeIndent) {
      break; // dedented out of the include list
    }
    const shardMatch = line.match(/^\s*-\s*shard:\s*(.+)$/);
    if (shardMatch) {
      if (current && current.pattern !== undefined) {
        patterns.push(current);
      }
      const shardRaw = parseYamlScalar(shardMatch[1]);
      const shardNum = Number(shardRaw);
      current = { shard: Number.isNaN(shardNum) ? shardRaw : shardNum };
      continue;
    }
    const patternMatch = line.match(/^\s*pattern:\s*(.+)$/);
    if (patternMatch && current) {
      current.pattern = parseYamlScalar(patternMatch[1]);
    }
  }
  if (current && current.pattern !== undefined) {
    patterns.push(current);
  }

  if (patterns.length === 0) {
    throw new Error('check-ci-shard-exclusivity: no shard patterns found in matrix.include');
  }
  return patterns;
}

/**
 * Return one violation string per test file that matches MORE THAN ONE shard
 * pattern. Empty array = the shards are mutually exclusive over `testFiles`.
 *
 * jest tests `--testPathPattern` as `new RegExp(pattern).test(absolutePath)`;
 * the shard patterns here are prefix-agnostic (substring matches, plus shard 3's
 * `^...` lookahead that spans any prefix via `.*`), so matching against
 * forward-slash repo-relative paths is faithful.
 */
export function validateShardExclusivity({ patterns, testFiles }) {
  const compiled = patterns.map((p) => ({
    shard: p.shard,
    pattern: p.pattern,
    re: new RegExp(p.pattern),
  }));
  const violations = [];
  for (const file of testFiles) {
    const hits = compiled.filter((c) => c.re.test(file));
    if (hits.length > 1) {
      violations.push(
        `${file} matches ${hits.length} shards: ${hits
          .map((h) => `shard ${h.shard} (/${h.pattern}/)`)
          .join(', ')}`
      );
    }
  }
  return violations;
}

/**
 * Return one violation string per test file that matches NO shard pattern
 * (Equoria-axvnd). Empty array = every file is covered by at least one shard.
 *
 * Exclusivity (no file in >1 shard) without exhaustiveness (every file in >=1
 * shard) still lets a file silently never run in CI — exactly the axvnd defect
 * where backend/scripts/*.test.mjs + backend/eslint-plugins/*.test.mjs matched
 * no shard. Together, the two checks assert each jest-visible file maps to
 * EXACTLY ONE shard.
 */
export function validateShardExhaustiveness({ patterns, testFiles }) {
  const compiled = patterns.map((p) => new RegExp(p.pattern));
  const uncovered = [];
  for (const file of testFiles) {
    if (!compiled.some((re) => re.test(file))) {
      uncovered.push(`${file} matches NO shard pattern (would never run in CI)`);
    }
  }
  return uncovered;
}

/**
 * Enumerate the test files jest would actually run: git-tracked *.test.mjs /
 * *.test.js under backend/, minus jest's testPathIgnorePatterns. Returns
 * forward-slash repo-relative paths.
 */
export function enumerateJestTestFiles(jestConfig, { cwd = ROOT } = {}) {
  const out = execSync('git ls-files backend', { cwd, encoding: 'utf8' });
  const ignore = (jestConfig.testPathIgnorePatterns || []).map((p) => new RegExp(p));
  return (
    out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((f) => /\.test\.(mjs|js)$/.test(f))
      // jest matches testPathIgnorePatterns against the absolute path; emulate the
      // leading separator so anchors like `/tests/load/` behave the same.
      .filter((f) => !ignore.some((re) => re.test(`/${f}`)))
  );
}

async function main() {
  const workflowText = readFileSync(path.join(ROOT, '.github/workflows/test.yml'), 'utf8');
  const patterns = extractShardPatterns(workflowText);
  const { default: jestConfig } = await import(
    pathToFileURL(path.join(ROOT, 'backend/jest.config.mjs')).href
  );
  const testFiles = enumerateJestTestFiles(jestConfig);
  const overlaps = validateShardExclusivity({ patterns, testFiles });
  const uncovered = validateShardExhaustiveness({ patterns, testFiles });

  if (overlaps.length > 0 || uncovered.length > 0) {
    if (overlaps.length > 0) {
      console.error(
        `[ci-shard-exclusivity] FAIL — ${overlaps.length} test file(s) match >1 shard pattern (Equoria-2ixd1):`
      );
      for (const v of overlaps.slice(0, 20)) {
        console.error(`  - ${v}`);
      }
      if (overlaps.length > 20) {
        console.error(`  … and ${overlaps.length - 20} more`);
      }
    }
    if (uncovered.length > 0) {
      console.error(
        `[ci-shard-exclusivity] FAIL — ${uncovered.length} test file(s) match NO shard pattern (Equoria-axvnd):`
      );
      for (const v of uncovered.slice(0, 20)) {
        console.error(`  - ${v}`);
      }
      if (uncovered.length > 20) {
        console.error(`  … and ${uncovered.length - 20} more`);
      }
    }
    process.exit(1);
  }
  console.log(
    `[ci-shard-exclusivity] OK — ${testFiles.length} jest test files map to exactly one of ${patterns.length} shards (0 overlaps, 0 uncovered)`
  );
}

// Equoria-2ixd1: main-module guard (CONTRIBUTING.md). The check enumerates +
// validates only when run as the direct entrypoint; bare import (the sentinel
// test) gets the pure exported functions with no side effects.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('[ci-shard-exclusivity] Fatal:', err);
    process.exit(1);
  });
}
