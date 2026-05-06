/**
 * 🔒 UNIT TESTS: validateEnvironment (real logger, real module)
 *
 * NO MOCKS. Rewritten 2026-04-30 (Equoria-p6fx, no-mocks doctrine epic)
 * from a jest.unstable_mockModule-of-logger to a real-module test.
 *
 * The original test mocked logger to capture log calls in an array,
 * then asserted only on `exitSpy.toHaveBeenCalled()` — never on the
 * captured logs. The mock was therefore dead infrastructure: replacing
 * the logger gained the test nothing the spy on `process.exit` didn't
 * already provide. Removing the mock makes the test exercise the real
 * logger output path AND keeps the same assertion surface.
 *
 * Why `process.exit` is still spied: validateEnvironment calls
 * `process.exit(1)` on failure, and we don't want the test runner to
 * exit. `jest.spyOn(process, 'exit')` intercepts a global builtin
 * function; it does NOT replace a module. Per the no-mocks doctrine,
 * the prohibition is on jest.mock / jest.unstable_mockModule of source
 * modules — not on intercepting Node globals where the real call would
 * tear down the test process.
 *
 * @module __tests__/unit/security/validate-environment
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { validateEnvironment } from '../../../utils/validateEnvironment.mjs';

const originalEnv = { ...process.env };
let exitSpy;

describe('validateEnvironment', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    // process.exit is a Node global builtin, not a userland module — spy
    // is required to prevent the test runner from terminating when
    // validateEnvironment intentionally fails. See file doc comment.
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    exitSpy.mockRestore();
  });

  it('exits when required envs are missing or invalid', () => {
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    process.env.NODE_ENV = 'invalid';
    process.env.PORT = 'abc';

    validateEnvironment();
    expect(exitSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when production has weak JWT secrets and HTTP origins', () => {
    process.env.DATABASE_URL = 'postgresql://user:password@localhost/db';
    process.env.JWT_SECRET = 'your-super-secret';
    process.env.JWT_REFRESH_SECRET = 'your-super-secret-refresh-value';
    process.env.NODE_ENV = 'production';
    process.env.PORT = '80';
    process.env.ALLOWED_ORIGINS = 'http://example.com';

    validateEnvironment();
    expect(exitSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('passes for valid configuration without exiting', () => {
    process.env.DATABASE_URL = 'postgresql://user:StrongP@ss@localhost:5432/dbname';
    process.env.JWT_SECRET = 'StrongSecretWithNumbers1234567890ABCDE';
    process.env.JWT_REFRESH_SECRET = 'RefreshSecretWithNumbers1234567890AB';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';

    expect(() => validateEnvironment()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits when DATABASE_URL is shorter than 20 chars', () => {
    process.env.DATABASE_URL = 'postgresql://x';
    process.env.JWT_SECRET = 'StrongSecretWithNumbers1234567890ABCDE';
    process.env.JWT_REFRESH_SECRET = 'RefreshSecretWithNumbers1234567890AB';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';

    validateEnvironment();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when JWT_SECRET is shorter than 32 chars', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'too-short';
    process.env.JWT_REFRESH_SECRET = 'RefreshSecretWithNumbers1234567890AB';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';

    validateEnvironment();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('accepts NODE_ENV=beta (per Story 21S-3)', () => {
    process.env.DATABASE_URL = 'postgresql://user:StrongP@ss@localhost:5432/dbname';
    process.env.JWT_SECRET = 'StrongSecretWithNumbers1234567890ABCDE';
    process.env.JWT_REFRESH_SECRET = 'RefreshSecretWithNumbers1234567890AB';
    process.env.NODE_ENV = 'beta';
    process.env.PORT = '3000';

    validateEnvironment();
    // beta is a valid NODE_ENV per the production allowed-values list,
    // so the env-var validator does not exit. (validateEnvironment may
    // still emit other warnings via the real logger; we only assert on
    // the exit-or-not behavior, which is the file's testable surface.)
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('accepts NODE_ENV=beta-readiness (per master 21R)', () => {
    process.env.DATABASE_URL = 'postgresql://user:StrongP@ss@localhost:5432/dbname';
    process.env.JWT_SECRET = 'StrongSecretWithNumbers1234567890ABCDE';
    process.env.JWT_REFRESH_SECRET = 'RefreshSecretWithNumbers1234567890AB';
    process.env.NODE_ENV = 'beta-readiness';
    process.env.PORT = '3000';

    validateEnvironment();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  describe('Deployable secret policy', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://user:strongpass123@localhost:5432/equoria';
      process.env.PORT = '3001';
    });

    it('should fail in beta when JWT_SECRET uses the committed test-only value', () => {
      process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-32chars';
      process.env.JWT_REFRESH_SECRET = 'StrongRefreshSecret1234567890ABCD';
      process.env.NODE_ENV = 'beta';

      validateEnvironment();

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail in beta-readiness when JWT_REFRESH_SECRET uses the committed test-only value', () => {
      process.env.JWT_SECRET = 'StrongSecret1234567890ABCDEFGHIJK';
      process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only-32chars';
      process.env.NODE_ENV = 'beta-readiness';

      validateEnvironment();

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should allow test-only secrets in NODE_ENV=test', () => {
      process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-32chars';
      process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only-32chars';
      process.env.NODE_ENV = 'test';

      validateEnvironment();

      expect(exitSpy).not.toHaveBeenCalled();
    });
  });
});
