/**
 * 🔒 UNIT TESTS: validateEnvironment (checkEnvironment pure function)
 *
 * NO MOCKS. No spies. Tests the pure checkEnvironment(env) function which
 * returns { errors, warnings } — no process.exit, no logger side effects
 * to intercept. No jest.spyOn of any kind.
 *
 * @module __tests__/unit/security/validate-environment
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { checkEnvironment } from '../../../utils/validateEnvironment.mjs';

const originalEnv = { ...process.env };

describe('validateEnvironment', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('exits when required envs are missing or invalid', () => {
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    process.env.NODE_ENV = 'invalid';
    process.env.PORT = 'abc';

    const { errors } = checkEnvironment(process.env);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('exits when production has weak JWT secrets and HTTP origins', () => {
    process.env.DATABASE_URL = 'postgresql://user:password@localhost/db';
    process.env.JWT_SECRET = 'your-super-secret';
    process.env.JWT_REFRESH_SECRET = 'your-super-secret-refresh-value';
    process.env.NODE_ENV = 'production';
    process.env.PORT = '80';
    process.env.ALLOWED_ORIGINS = 'http://example.com';

    const { errors } = checkEnvironment(process.env);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes for valid configuration without exiting', () => {
    process.env.DATABASE_URL = 'postgresql://user:StrongP@ss@localhost:5432/dbname';
    process.env.JWT_SECRET = 'StrongSecretWithNumbers1234567890ABCDE';
    process.env.JWT_REFRESH_SECRET = 'RefreshSecretWithNumbers1234567890AB';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';

    const { errors } = checkEnvironment(process.env);
    expect(errors).toHaveLength(0);
  });

  it('exits when DATABASE_URL is shorter than 20 chars', () => {
    process.env.DATABASE_URL = 'postgresql://x';
    process.env.JWT_SECRET = 'StrongSecretWithNumbers1234567890ABCDE';
    process.env.JWT_REFRESH_SECRET = 'RefreshSecretWithNumbers1234567890AB';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';

    const { errors } = checkEnvironment(process.env);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('exits when JWT_SECRET is shorter than 32 chars', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'too-short';
    process.env.JWT_REFRESH_SECRET = 'RefreshSecretWithNumbers1234567890AB';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';

    const { errors } = checkEnvironment(process.env);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts NODE_ENV=beta (per Story 21S-3)', () => {
    process.env.DATABASE_URL = 'postgresql://user:StrongP@ss@localhost:5432/dbname';
    process.env.JWT_SECRET = 'StrongSecretWithNumbers1234567890ABCDE';
    process.env.JWT_REFRESH_SECRET = 'RefreshSecretWithNumbers1234567890AB';
    process.env.NODE_ENV = 'beta';
    process.env.PORT = '3000';

    const { errors } = checkEnvironment(process.env);
    expect(errors).toHaveLength(0);
  });

  it('accepts NODE_ENV=beta-readiness (per master 21R)', () => {
    process.env.DATABASE_URL = 'postgresql://user:StrongP@ss@localhost:5432/dbname';
    process.env.JWT_SECRET = 'StrongSecretWithNumbers1234567890ABCDE';
    process.env.JWT_REFRESH_SECRET = 'RefreshSecretWithNumbers1234567890AB';
    process.env.NODE_ENV = 'beta-readiness';
    process.env.PORT = '3000';

    const { errors } = checkEnvironment(process.env);
    expect(errors).toHaveLength(0);
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

      const { errors } = checkEnvironment(process.env);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should allow test-only secrets in NODE_ENV=beta-readiness (local E2E harness, not a real deployment)', () => {
      process.env.JWT_SECRET = 'StrongSecret1234567890ABCDEFGHIJK';
      process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only-32chars';
      process.env.NODE_ENV = 'beta-readiness';

      const { errors } = checkEnvironment(process.env);
      // beta-readiness is the local E2E harness — like test mode, not a deployable target
      expect(errors).toHaveLength(0);
    });

    it('should allow test-only secrets in NODE_ENV=test', () => {
      process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-32chars';
      process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only-32chars';
      process.env.NODE_ENV = 'test';

      const { errors } = checkEnvironment(process.env);
      expect(errors).toHaveLength(0);
    });
  });
});
