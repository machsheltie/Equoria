/**
 * Environment Validation Tests
 * Tests for startup environment variable validation
 *
 * SECURITY: CWE-798 (Hardcoded Credentials), CWE-321 (Weak Secrets)
 *
 * NO MOCKS. No spies. Tests the pure checkEnvironment(env) function
 * which returns { errors, warnings } arrays — no process.exit or logger
 * to intercept.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { checkEnvironment } from '../../../utils/validateEnvironment.mjs';

describe('validateEnvironment()', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Required variables validation', () => {
    it('should pass with all required variables present', () => {
      process.env.DATABASE_URL = 'postgresql://user:strongpassword123@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors).toHaveLength(0);
    });

    it('should fail when DATABASE_URL is missing', () => {
      delete process.env.DATABASE_URL;
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('Missing required environment variable: DATABASE_URL');
    });

    it('should fail when JWT_SECRET is missing', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('Missing required environment variable: JWT_SECRET');
    });

    it('should fail when NODE_ENV is missing', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      delete process.env.NODE_ENV;
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('Missing required environment variable: NODE_ENV');
    });

    it('should fail when PORT is missing', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      delete process.env.PORT;

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('Missing required environment variable: PORT');
    });
  });

  describe('Minimum length validation', () => {
    it('should fail when DATABASE_URL is too short (<20 chars)', () => {
      process.env.DATABASE_URL = 'postgresql://a:b@c'; // 19 chars
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('DATABASE_URL must be at least 20 characters');
    });

    it('should fail when JWT_SECRET is too short (<32 chars)', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(31); // 31 chars
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('JWT_SECRET must be at least 32 characters');
    });

    it('should pass when JWT_SECRET is exactly 32 characters', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Allowed values validation', () => {
    it('should pass when NODE_ENV is "development"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors).toHaveLength(0);
    });

    it('should pass when NODE_ENV is "production"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors).toHaveLength(0);
    });

    it('should pass when NODE_ENV is "test"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria_test';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors).toHaveLength(0);
    });

    it('should pass when NODE_ENV is "beta-readiness"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria_test';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'beta-readiness';
      process.env.PORT = '3001';

      const { errors } = checkEnvironment(process.env);
      expect(errors).toHaveLength(0);
    });

    it('should fail when NODE_ENV is invalid', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'staging'; // Not in allowed list
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain(
        'NODE_ENV must be one of: development, production, test, beta, beta-readiness',
      );
    });
  });

  describe('Type validation', () => {
    it('should pass when PORT is a valid number', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors).toHaveLength(0);
    });

    it('should fail when PORT is not a number', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = 'not-a-number';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('PORT must be a number');
    });
  });

  describe('JWT_SECRET strength validation', () => {
    it('should reject placeholder "your-super-secret"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'your-super-secret-key-that-is-32-characters-long';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('JWT_SECRET appears to be a placeholder value');
    });

    it('should reject placeholder "change-this"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'change-this-secret-to-something-secure-32-chars';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('JWT_SECRET appears to be a placeholder value');
    });

    it('should reject placeholder "REPLACE_WITH"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'REPLACE_WITH_YOUR_SECRET_KEY_32_CHARACTERS';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('JWT_SECRET appears to be a placeholder value');
    });

    it('should reject placeholder "example"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'example-jwt-secret-key-32-characters-long';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('JWT_SECRET appears to be a placeholder value');
    });

    it('should warn when JWT_SECRET lacks character variety (line 72)', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      // 32+ characters but all special characters (no letters or numbers)
      process.env.JWT_SECRET = '!@#$%^&*()_+-=[]{}|;:,.<>?/~!@#$%^&*()_+-=[]{}|;:,.<>?/~';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors, warnings } = checkEnvironment(process.env);
      expect(warnings.join(' ')).toContain('JWT_SECRET should contain a mix of characters');
      expect(errors).toHaveLength(0);
    });
  });

  describe('DATABASE_URL format validation', () => {
    it('should pass with postgresql:// prefix', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors).toHaveLength(0);
    });

    it('should pass with postgres:// prefix', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors).toHaveLength(0);
    });

    it('should fail without postgresql prefix', () => {
      process.env.DATABASE_URL = 'mysql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('DATABASE_URL must start with postgresql:// or postgres://');
    });

    it('should reject weak password "password"', () => {
      process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('DATABASE_URL contains a weak password');
    });

    it('should reject weak password "admin"', () => {
      process.env.DATABASE_URL = 'postgresql://user:admin@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('DATABASE_URL contains a weak password');
    });

    it('should reject weak password "123456"', () => {
      process.env.DATABASE_URL = 'postgresql://user:123456@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('DATABASE_URL contains a weak password');
    });

    it('should reject weak password "postgres"', () => {
      process.env.DATABASE_URL = 'postgresql://user:postgres@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { errors } = checkEnvironment(process.env);
      expect(errors.join(' ')).toContain('DATABASE_URL contains a weak password');
    });
  });

  describe('Production HTTPS warnings', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://user:strongpass123@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
    });

    it('should warn about HTTP origins in production', () => {
      process.env.ALLOWED_ORIGINS = 'http://example.com,https://secure.com';

      const { errors, warnings } = checkEnvironment(process.env);
      expect(warnings.join(' ')).toContain('ALLOWED_ORIGINS contains HTTP URLs in production');
      expect(errors).toHaveLength(0);
    });

    it('should NOT warn about HTTPS origins in production', () => {
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://secure.com';

      const { warnings } = checkEnvironment(process.env);
      const httpsWarning = warnings.find(w => w.includes('ALLOWED_ORIGINS contains HTTP URLs'));
      expect(httpsWarning).toBeUndefined();
    });

    it('should warn about PORT 80 in production', () => {
      process.env.PORT = '80';

      const { errors, warnings } = checkEnvironment(process.env);
      expect(warnings.join(' ')).toContain('PORT is set to 80 (HTTP) in production');
      expect(errors).toHaveLength(0);
    });

    it('should NOT warn about PORT 443 in production', () => {
      process.env.PORT = '443';

      const { warnings } = checkEnvironment(process.env);
      const portWarning = warnings.find(w => w.includes('PORT is set to 80'));
      expect(portWarning).toBeUndefined();
    });

    it('should skip origin checks when ALLOWED_ORIGINS is unset in production', () => {
      delete process.env.ALLOWED_ORIGINS;

      const { errors, warnings } = checkEnvironment(process.env);
      const originWarning = warnings.find(w => w.includes('ALLOWED_ORIGINS contains HTTP URLs'));
      expect(originWarning).toBeUndefined();
      expect(errors).toHaveLength(0);
    });
  });

  describe('Multiple errors', () => {
    it('should report all validation errors at once', () => {
      process.env.DATABASE_URL = 'short'; // Too short
      process.env.JWT_SECRET = 'tooshort'; // Too short
      process.env.JWT_REFRESH_SECRET = 'alsotooshort';
      process.env.NODE_ENV = 'invalid'; // Invalid value
      process.env.PORT = 'notanumber'; // Invalid type

      const { errors } = checkEnvironment(process.env);
      const allErrors = errors.join(' ');

      expect(errors.length).toBeGreaterThan(0);
      expect(allErrors).toContain('DATABASE_URL must be at least 20 characters');
      expect(allErrors).toContain('JWT_SECRET must be at least 32 characters');
      expect(allErrors).toContain('JWT_REFRESH_SECRET must be at least 32 characters');
      expect(allErrors).toContain('NODE_ENV must be one of');
      expect(allErrors).toContain('PORT must be a number');
    });
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
      expect(errors.join(' ')).toContain('JWT_SECRET uses a committed test-only secret');
    });

    it('should allow test-only secrets in beta-readiness (local E2E harness, not a real deployment)', () => {
      process.env.JWT_SECRET = 'StrongSecret1234567890ABCDEFGHIJK';
      process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only-32chars';
      process.env.NODE_ENV = 'beta-readiness';

      const { errors } = checkEnvironment(process.env);
      // beta-readiness is not in DEPLOYABLE_ENVS (per runtimeSecretPolicy.mjs), so test-only secrets are allowed
      expect(errors.filter(e => e.includes('committed test-only secret'))).toHaveLength(0);
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
