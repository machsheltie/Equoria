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
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Extract the ordered [{ shard, pattern }] list from a parsed test.yml's
 * backend-tests matrix.
 */
export function extractShardPatterns(workflowDocument) {
  const include = workflowDocument?.jobs?.['backend-tests']?.strategy?.matrix?.include;
  if (!Array.isArray(include)) {
    throw new Error(
      'check-ci-shard-exclusivity: jobs.backend-tests.strategy.matrix.include not found in test.yml'
    );
  }
  const patterns = include
    .filter((entry) => entry && entry.pattern !== undefined)
    .map((entry) => ({ shard: entry.shard, pattern: String(entry.pattern) }));
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
  const workflowDocument = yaml.load(
    readFileSync(path.join(ROOT, '.github/workflows/test.yml'), 'utf8')
  );
  const patterns = extractShardPatterns(workflowDocument);
  const { default: jestConfig } = await import(
    pathToFileURL(path.join(ROOT, 'backend/jest.config.mjs')).href
  );
  const testFiles = enumerateJestTestFiles(jestConfig);
  const violations = validateShardExclusivity({ patterns, testFiles });

  if (violations.length > 0) {
    console.error(
      `[ci-shard-exclusivity] FAIL — ${violations.length} test file(s) match >1 shard pattern (Equoria-2ixd1):`
    );
    for (const v of violations.slice(0, 20)) {
      console.error(`  - ${v}`);
    }
    if (violations.length > 20) {
      console.error(`  … and ${violations.length - 20} more`);
    }
    process.exit(1);
  }
  console.log(
    `[ci-shard-exclusivity] OK — ${testFiles.length} jest test files, 0 match >1 shard pattern (${patterns.length} shards)`
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
