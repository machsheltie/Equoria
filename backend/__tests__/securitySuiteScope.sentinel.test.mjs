/**
 * Equoria-ugxuc — the Security Gate's selection must stay a SCOPE, not the suite.
 *
 * jest.config.security.mjs used to carry a bare recursive __tests__ glob, which
 * selects every backend test file. The Security Gate step
 * (`npm run test:security` in .github/workflows/test.yml) therefore re-ran the
 * whole backend suite in ONE Jest process. Under NODE_ENV=test the rate limiter
 * has no Redis and keeps its counters in-process (backend/middleware/rateLimiting.mjs),
 * so the global apiLimiter accumulated across ~12.4k requests in two long-lived
 * workers and 429'd five cases in
 * modules/horses/__tests__/foalCreationMinimalPayload.test.mjs that assert 400/200.
 * The sharded Backend Tests matrix never saw it: each shard is a fresh process.
 *
 * Nothing in YAML or in Jest ties the security config's selection to the reason
 * it is narrow, so a future "let's just match everything" edit would reintroduce
 * the 429 cascade with no local signal. This sentinel is that signal.
 *
 * It does NOT freeze a file list — files may come and go. It pins two things:
 *   1. every testMatch pattern is rooted inside the security-control surface
 *      docs/SECURITY_TESTING.md names ("Middleware and controls | backend/middleware/,
 *      backend/modules/auth/, backend/config/"), i.e. backend/__tests__/ (middleware
 *      sentinels + cross-module integration, per .claude/rules/CONTRIBUTING.md) and
 *      backend/modules/auth/__tests__/;
 *   2. every file this suite's coverageThreshold block demands 100% of still has a
 *      test inside that scope — otherwise the narrowing would have quietly made the
 *      thresholds unreachable, which is the unsafe direction.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import securityConfig from '../jest.config.security.mjs';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ALLOWED_ROOTS = ['<rootDir>/__tests__/', '<rootDir>/modules/auth/__tests__/'];

/** The control source files whose tests must remain inside the scope. */
const THRESHOLDED_CONTROLS = Object.keys(securityConfig.coverageThreshold);

/**
 * The directories the config's own testMatch patterns are rooted at. Derived
 * from securityConfig.testMatch rather than hard-coded, so a re-broadened
 * pattern really does widen what the assertions below see.
 */
function scopeRoots() {
  const roots = new Set();
  for (const pattern of securityConfig.testMatch) {
    const withoutRootDir = pattern.replace('<rootDir>/', '');
    const glob = withoutRootDir.indexOf('*');
    const prefix = glob === -1 ? withoutRootDir : withoutRootDir.slice(0, glob);
    roots.add(prefix.replace(/\/+$/, ''));
  }
  return [...roots];
}

function scopedTestFiles() {
  const files = [];
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(test|spec)\.mjs$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  for (const root of scopeRoots()) {
    walk(path.join(BACKEND, root));
  }
  return [...new Set(files)];
}

describe('security suite scope sentinel (Equoria-ugxuc)', () => {
  test('every testMatch pattern is rooted in the security-control surface', () => {
    expect(Array.isArray(securityConfig.testMatch)).toBe(true);
    expect(securityConfig.testMatch.length).toBeGreaterThan(0);

    const strays = securityConfig.testMatch.filter(pattern => !ALLOWED_ROOTS.some(root => pattern.startsWith(root)));

    // A bare '**/__tests__/**' pattern lands here, which is the exact regression.
    expect(strays).toEqual([]);
  });

  test('the scope does not reach the domain suites that trip the in-process limiter', () => {
    const selected = scopedTestFiles().map(f => path.relative(BACKEND, f).split(path.sep).join('/'));

    expect(selected.length).toBeGreaterThan(0);
    expect(selected).not.toContain('modules/horses/__tests__/foalCreationMinimalPayload.test.mjs');
    expect(selected.some(f => f.startsWith('modules/') && !f.startsWith('modules/auth/'))).toBe(false);
  });

  test('every coverage-thresholded control still has a test inside the scope', () => {
    expect(THRESHOLDED_CONTROLS.length).toBeGreaterThan(0);

    const scopeSources = scopedTestFiles().map(file => readFileSync(file, 'utf8'));
    const missing = [];

    for (const control of THRESHOLDED_CONTROLS) {
      // './middleware/security.mjs' -> 'middleware/security'
      const needle = control.replace(/^\.\//, '').replace(/\.mjs$/, '');
      if (!scopeSources.some(source => source.includes(needle))) {
        missing.push(control);
      }
    }

    expect(missing).toEqual([]);
  });
});
