/**
 * Equoria-bh7j8 — each Jest setup names its rate-limit profile.
 *
 * The Security Gate (jest.config.security.mjs -> __tests__/setup.mjs) used to
 * run every limiter at its production cap only because that setup lacked the
 * TEST_RATE_LIMIT_* block tests/setup.mjs carried. Both setups now call
 * applyTestRateLimitProfile from tests/config/testRateLimitProfile.mjs, which
 * owns the values and the reasons. This file pins:
 *   1. what each profile does to an environment;
 *   2. that each setup selects the profile it is documented to run, and sets
 *      no TEST_RATE_LIMIT_* value of its own (so the block cannot drift back).
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTestRateLimitProfile, relaxedTestRateLimit } from '../tests/config/testRateLimitProfile.mjs';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const setupProfiles = [
  { file: 'tests/setup.mjs', profile: 'relaxed' },
  { file: '__tests__/setup.mjs', profile: 'production' },
];

/**
 * Problems with a setup file's source, as strings. Empty means the file selects
 * exactly `profile` through the shared module and assigns no knob itself.
 */
function setupProfileProblems(source, profile) {
  const problems = [];
  if (!/import\s*\{[^}]*\bapplyTestRateLimitProfile\b[^}]*\}\s*from\s*'[^']*testRateLimitProfile\.mjs'/.test(source)) {
    problems.push('does not import applyTestRateLimitProfile from testRateLimitProfile.mjs');
  }
  const calls = [...source.matchAll(/applyTestRateLimitProfile\(\s*'([^']*)'/g)].map(m => m[1]);
  if (calls.length !== 1 || calls[0] !== profile) {
    problems.push(`selects ${JSON.stringify(calls)}, expected exactly ["${profile}"]`);
  }
  if (/process\.env\.TEST_RATE_LIMIT_\w+\s*=[^=]/.test(source)) {
    problems.push('assigns a TEST_RATE_LIMIT_* value itself');
  }
  return problems;
}

describe('applyTestRateLimitProfile', () => {
  it('relaxed sets 1000 requests per 15 minutes on an empty environment', () => {
    const env = {};
    applyTestRateLimitProfile('relaxed', env);
    expect(env).toEqual({
      TEST_RATE_LIMIT_MAX_REQUESTS: '1000',
      TEST_RATE_LIMIT_WINDOW_MS: '900000',
    });
    expect(relaxedTestRateLimit).toEqual({ maxRequests: '1000', windowMs: '900000' });
  });

  it('relaxed keeps values already present (per-file and per-run overrides win)', () => {
    const env = { TEST_RATE_LIMIT_MAX_REQUESTS: '2', TEST_RATE_LIMIT_WINDOW_MS: '10000' };
    applyTestRateLimitProfile('relaxed', env);
    expect(env).toEqual({ TEST_RATE_LIMIT_MAX_REQUESTS: '2', TEST_RATE_LIMIT_WINDOW_MS: '10000' });
  });

  it('production leaves the environment untouched, so limiters run at their production caps', () => {
    const empty = {};
    applyTestRateLimitProfile('production', empty);
    expect(empty).toEqual({});

    const overridden = { TEST_RATE_LIMIT_MAX_REQUESTS: '5' };
    applyTestRateLimitProfile('production', overridden);
    expect(overridden).toEqual({ TEST_RATE_LIMIT_MAX_REQUESTS: '5' });
  });

  it('rejects an unknown profile name instead of silently picking one', () => {
    expect(() => applyTestRateLimitProfile('relax', {})).toThrow(/Unknown test rate-limit profile "relax"/);
  });
});

describe('each Jest setup names its rate-limit profile', () => {
  it.each(setupProfiles)('$file selects the $profile profile through the shared module', ({ file, profile }) => {
    const source = readFileSync(path.join(backendRoot, file), 'utf8');
    expect(setupProfileProblems(source, profile)).toEqual([]);
  });

  it('the detector fires on planted violations', () => {
    const goodImport = "import { applyTestRateLimitProfile } from './config/testRateLimitProfile.mjs';\n";
    expect(setupProfileProblems(`${goodImport}applyTestRateLimitProfile('relaxed');`, 'relaxed')).toEqual([]);

    // The pre-bh7j8 shape of __tests__/setup.mjs: no profile at all.
    expect(setupProfileProblems("process.env.NODE_ENV = 'test';", 'production')).toHaveLength(2);
    // The pre-bh7j8 shape of tests/setup.mjs: an inline block.
    expect(
      setupProfileProblems(
        "if (!process.env.TEST_RATE_LIMIT_MAX_REQUESTS) {\n  process.env.TEST_RATE_LIMIT_MAX_REQUESTS = '1000';\n}",
        'relaxed',
      ),
    ).toHaveLength(3);
    // Wrong profile selected.
    expect(setupProfileProblems(`${goodImport}applyTestRateLimitProfile('relaxed');`, 'production')).toHaveLength(1);
    // Shared call plus a local knob alongside it.
    expect(
      setupProfileProblems(
        `${goodImport}applyTestRateLimitProfile('relaxed');\nprocess.env.TEST_RATE_LIMIT_WINDOW_MS = '1';`,
        'relaxed',
      ),
    ).toHaveLength(1);
  });
});
