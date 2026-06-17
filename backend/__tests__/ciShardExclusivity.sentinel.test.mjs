/**
 * Sentinel — CI backend-test shard testPathPatterns are mutually exclusive
 * (Equoria-2ixd1).
 *
 * Pre-fix, shard 2 (modules-then-__tests__) and shard 3 (bare __tests__/)
 * both matched every backend/modules/<x>/__tests__/ suite, double-running 469
 * suites across two parallel matrix jobs against the shared real DB. The fix
 * narrows shard 3 with an anchored negative-lookahead that excludes
 * modules/<x>/__tests__ paths. This sentinel
 * exercises the doctrine validator against the REAL workflow patterns (must be
 * conflict-free) and proves the validator FIRES on the exact pre-fix overlap —
 * i.e. it is not a vacuous always-green check.
 *
 * The authoritative gate is the doctrine check
 * (scripts/doctrine-checks/check-ci-shard-exclusivity.mjs), which runs in the
 * pre-push + doctrine-gate workflow independent of jest sharding. This sentinel
 * mirrors it for local jest runs and carries the planted-violation proof.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jestConfig from '../jest.config.mjs';
import {
  extractShardPatterns,
  validateShardExclusivity,
  enumerateJestTestFiles,
} from '../../scripts/doctrine-checks/check-ci-shard-exclusivity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Equoria-jgql9: read the workflow as RAW TEXT and let the doctrine script's
// own parser extract the shard patterns. The previous `yaml.load` here pulled
// in js-yaml, which is unresolved in the backend-shard + security-gate CI jobs
// (they npm ci only ./backend + ./packages/database, not root) — turning this
// sentinel into a suite-level FAILURE and reddening the Quality Gate. Using the
// script's js-yaml-free parser keeps this suite loadable in every job.
const workflowText = readFileSync(path.join(ROOT, '.github/workflows/test.yml'), 'utf8');

describe('CI shard testPathPatterns are mutually exclusive (Equoria-2ixd1)', () => {
  it('no jest-visible backend test file matches more than one shard pattern', () => {
    const patterns = extractShardPatterns(workflowText);
    const testFiles = enumerateJestTestFiles(jestConfig);
    // Sanity: the enumeration actually found the backend suite (guards against a
    // silently-empty file list making the exclusivity check vacuously pass).
    expect(testFiles.length).toBeGreaterThan(500);
    expect(validateShardExclusivity({ patterns, testFiles })).toEqual([]);
  });

  it('SENTINEL-POSITIVE: fires on the exact pre-fix overlap (shard2 modules + bare __tests__/)', () => {
    const planted = [
      { shard: 2, pattern: 'modules/.*/__tests__' },
      { shard: 3, pattern: '__tests__/' },
    ];
    const testFiles = enumerateJestTestFiles(jestConfig);
    const violations = validateShardExclusivity({ patterns: planted, testFiles });
    // Every backend/modules/<x>/__tests__/ suite matches BOTH planted patterns.
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toMatch(/matches 2 shards/);
  });

  it('extractShardPatterns reads exactly the three matrix shards from test.yml', () => {
    const patterns = extractShardPatterns(workflowText);
    expect(patterns).toHaveLength(3);
    expect(patterns.map(p => p.shard).sort()).toEqual([1, 2, 3]);
  });
});
