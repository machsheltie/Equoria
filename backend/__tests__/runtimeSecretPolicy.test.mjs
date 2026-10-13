/**
 * runtimeSecretPolicy — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  DEPLOYABLE_ENVS,
  isDeployableEnvironment,
  getSecretValidationError,
  isCommittedTestSecret,
} from '../utils/runtimeSecretPolicy.mjs';

// ---------------------------------------------------------------------------
// DEPLOYABLE_ENVS constant
// ---------------------------------------------------------------------------
describe('DEPLOYABLE_ENVS', () => {
  it('is a Set', () => {
    expect(DEPLOYABLE_ENVS instanceof Set).toBe(true);
  });

  it('contains production', () => {
    expect(DEPLOYABLE_ENVS.has('production')).toBe(true);
  });

  it('contains beta', () => {
    expect(DEPLOYABLE_ENVS.has('beta')).toBe(true);
  });

  it('does not contain beta-readiness (local E2E harness, not a real deployment)', () => {
    expect(DEPLOYABLE_ENVS.has('beta-readiness')).toBe(false);
  });

  it('does not contain development', () => {
    expect(DEPLOYABLE_ENVS.has('development')).toBe(false);
  });

  it('does not contain test', () => {
    expect(DEPLOYABLE_ENVS.has('test')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDeployableEnvironment
// ---------------------------------------------------------------------------
describe('isDeployableEnvironment', () => {
  it('returns true for production', () => {
    expect(isDeployableEnvironment('production')).toBe(true);
  });

  it('returns true for beta', () => {
    expect(isDeployableEnvironment('beta')).toBe(true);
  });

  it('returns false for beta-readiness (local E2E harness, not a real deployment)', () => {
    expect(isDeployableEnvironment('beta-readiness')).toBe(false);
  });

  it('returns false for development', () => {
    expect(isDeployableEnvironment('development')).toBe(false);
  });

  it('returns false for test', () => {
    expect(isDeployableEnvironment('test')).toBe(false);
  });

  it('returns false for staging (not in list)', () => {
    expect(isDeployableEnvironment('staging')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isDeployableEnvironment('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSecretValidationError
// ---------------------------------------------------------------------------
describe('getSecretValidationError', () => {
  it('returns null when secretValue is falsy (undefined)', () => {
    expect(getSecretValidationError('JWT_SECRET', undefined, 'development')).toBeNull();
  });

  it('returns null when secretValue is empty string', () => {
    expect(getSecretValidationError('JWT_SECRET', '', 'development')).toBeNull();
  });

  it('returns error string for placeholder secret (your-super-secret)', () => {
    const result = getSecretValidationError('JWT_SECRET', 'your-super-secret-key', 'development');
    expect(typeof result).toBe('string');
    expect(result).toContain('JWT_SECRET');
  });

  it('returns error for "change-this" placeholder', () => {
    const result = getSecretValidationError('SESSION_SECRET', 'change-this-value', 'development');
    expect(typeof result).toBe('string');
  });

  it('returns error for "example" placeholder', () => {
    const result = getSecretValidationError('JWT_SECRET', 'example-secret', 'development');
    expect(typeof result).toBe('string');
  });

  it('returns error for "replace_with" placeholder', () => {
    const result = getSecretValidationError('JWT_SECRET', 'replace_with_real', 'development');
    expect(typeof result).toBe('string');
  });

  it('is case-insensitive for placeholder detection', () => {
    const result = getSecretValidationError('JWT_SECRET', 'YOUR-SUPER-SECRET-KEY', 'development');
    expect(typeof result).toBe('string');
  });

  it('returns null for a valid non-placeholder secret in development', () => {
    const result = getSecretValidationError('JWT_SECRET', 'gJ3k9mP2xQ8nL5rT7vA1sD4wF6yH0cE', 'development');
    expect(result).toBeNull();
  });

  it('returns error for test-only secret in production', () => {
    const result = getSecretValidationError('JWT_SECRET', 'test-jwt-secret-key-for-testing-only', 'production');
    expect(typeof result).toBe('string');
    expect(result).toContain('JWT_SECRET');
    expect(result).toContain('production');
  });

  it('returns error for test-only secret in beta', () => {
    const result = getSecretValidationError('JWT_SECRET', 'test-jwt-refresh-secret-for-testing-only', 'beta');
    expect(typeof result).toBe('string');
  });

  it('allows test-only secret in development (non-deployable)', () => {
    const result = getSecretValidationError('JWT_SECRET', 'test-jwt-secret-key-for-testing-only', 'development');
    expect(result).toBeNull();
  });

  it('allows test-only secret in test environment', () => {
    const result = getSecretValidationError('JWT_SECRET', 'test-jwt-secret-key-for-testing-only', 'test');
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Minimum-length enforcement in deployable environments (Equoria-ft6h)
  // SECURITY.md documents JWT_SECRET / SESSION_SECRET as "minimum 32 chars".
  // A too-short-but-non-placeholder secret previously slipped through.
  // -------------------------------------------------------------------------
  describe('minimum length in deployable environments (Equoria-ft6h)', () => {
    it('rejects a short (<32 char) non-placeholder secret in production', () => {
      const result = getSecretValidationError('JWT_SECRET', 'abc123short', 'production');
      expect(typeof result).toBe('string');
      expect(result).toContain('JWT_SECRET');
      expect(result).toMatch(/32|short|length/i);
    });

    it('rejects a short non-placeholder secret in beta', () => {
      const result = getSecretValidationError('SESSION_SECRET', 'tooShortSecret', 'beta');
      expect(typeof result).toBe('string');
    });

    it('accepts a 32+ char non-placeholder secret in production', () => {
      const longSecret = `${'g'.repeat(32)}J3k9mP2xQ8nL5rT7vA1sD4wF6yH0cE`;
      const result = getSecretValidationError('JWT_SECRET', longSecret, 'production');
      expect(result).toBeNull();
    });

    it('does NOT enforce length in development (non-deployable)', () => {
      const result = getSecretValidationError('JWT_SECRET', 'shortdev', 'development');
      expect(result).toBeNull();
    });

    it('does NOT enforce length in test environment', () => {
      const result = getSecretValidationError('JWT_SECRET', 'shorttest', 'test');
      expect(result).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// isCommittedTestSecret — the one list of committed test-only secret values.
// playwright.config.ts uses it to keep backend/.env.test's test secrets out of
// the NODE_ENV=beta backend it starts (security review of 870e07e2f), so the
// harness and the policy can never disagree about what counts as test-only.
// ---------------------------------------------------------------------------
describe('isCommittedTestSecret', () => {
  it.each([
    'test-jwt-secret-key-for-testing-only',
    'test-jwt-refresh-secret-for-testing-only',
    'test-session-secret-for-testing-only',
  ])('recognises the committed test secret %s, case-insensitively and inside a longer value', pattern => {
    expect(isCommittedTestSecret(pattern)).toBe(true);
    expect(isCommittedTestSecret(`prefix-${pattern.toUpperCase()}-suffix`)).toBe(true);
  });

  it('does not flag a real random secret, an empty value or a missing one', () => {
    expect(isCommittedTestSecret('Zq3vR8kL2pX9mN4tB7wY1cF6hJ0sD5gA')).toBe(false);
    expect(isCommittedTestSecret('')).toBe(false);
    expect(isCommittedTestSecret(undefined)).toBe(false);
  });

  it('agrees with getSecretValidationError: a value it flags is refused in beta', () => {
    const value = 'test-session-secret-for-testing-only-padding';
    expect(isCommittedTestSecret(value)).toBe(true);
    expect(getSecretValidationError('SESSION_SECRET', value, 'beta')).toMatch(/committed test-only secret/);
  });
});
