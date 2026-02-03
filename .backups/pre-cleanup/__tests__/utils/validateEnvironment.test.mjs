/**
 * Environment Validation Tests
 * Tests for startup environment variable validation
 *
 * SECURITY: CWE-798 (Hardcoded Credentials), CWE-321 (Weak Secrets)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import logger from '../../utils/logger.mjs';
import { validateEnvironment } from '../../utils/validateEnvironment.mjs';

describe('validateEnvironment()', () => {
  let originalEnv;
  let processExitSpy;
  let loggerErrorSpy;
  let loggerWarnSpy;
  let loggerInfoSpy;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Mock process.exit and logger methods
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();
    loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Restore all mocks
    processExitSpy.mockRestore();
    loggerErrorSpy.mockRestore();
    loggerWarnSpy.mockRestore();
    loggerInfoSpy.mockRestore();
  });

  describe('Required variables validation', () => {
    it('should pass with all required variables present', () => {
      process.env.DATABASE_URL = 'postgresql://user:strongpassword123@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32); // 32 character secret
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should fail when DATABASE_URL is missing', () => {
      delete process.env.DATABASE_URL;
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      // Check if any logger.error call contains the expected message
      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('Missing required environment variable: DATABASE_URL');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when JWT_SECRET is missing', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('Missing required environment variable: JWT_SECRET');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when NODE_ENV is missing', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      delete process.env.NODE_ENV;
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('Missing required environment variable: NODE_ENV');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when PORT is missing', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      delete process.env.PORT;

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('Missing required environment variable: PORT');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Minimum length validation', () => {
    it('should fail when DATABASE_URL is too short (<20 chars)', () => {
      process.env.DATABASE_URL = 'postgresql://a:b@c'; // 19 chars
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('DATABASE_URL must be at least 20 characters');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when JWT_SECRET is too short (<32 chars)', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(31); // 31 chars
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('JWT_SECRET must be at least 32 characters');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should pass when JWT_SECRET is exactly 32 characters', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });

  describe('Allowed values validation', () => {
    it('should pass when NODE_ENV is "development"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should pass when NODE_ENV is "production"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should pass when NODE_ENV is "test"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria_test';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should fail when NODE_ENV is invalid', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'staging'; // Not in allowed list
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('NODE_ENV must be one of: development, production, test');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Type validation', () => {
    it('should pass when PORT is a valid number', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should fail when PORT is not a number', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = 'not-a-number';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('PORT must be a number');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('JWT_SECRET strength validation', () => {
    it('should reject placeholder "your-super-secret"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'your-super-secret-key-that-is-32-characters-long';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('JWT_SECRET appears to be a placeholder value');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject placeholder "change-this"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'change-this-secret-to-something-secure-32-chars';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('JWT_SECRET appears to be a placeholder value');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject placeholder "REPLACE_WITH"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'REPLACE_WITH_YOUR_SECRET_KEY_32_CHARACTERS';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('JWT_SECRET appears to be a placeholder value');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject placeholder "example"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'example-jwt-secret-key-32-characters-long';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('JWT_SECRET appears to be a placeholder value');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should warn when JWT_SECRET lacks character variety (line 72)', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      // 32+ characters but all special characters (no letters or numbers)
      process.env.JWT_SECRET = '!@#$%^&*()_+-=[]{}|;:,.<>?/~!@#$%^&*()_+-=[]{}|;:,.<>?/~';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      const warnCalls = loggerWarnSpy.mock.calls.map((call) => call[0]);
      const allWarnings = warnCalls.join(' ');
      expect(allWarnings).toContain('JWT_SECRET should contain a mix of characters');
      expect(processExitSpy).not.toHaveBeenCalled(); // Warning, not error
    });
  });

  describe('DATABASE_URL format validation', () => {
    it('should pass with postgresql:// prefix', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should pass with postgres:// prefix', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should fail without postgresql prefix', () => {
      process.env.DATABASE_URL = 'mysql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('DATABASE_URL must start with postgresql:// or postgres://');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject weak password "password"', () => {
      process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('DATABASE_URL contains a weak password');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject weak password "admin"', () => {
      process.env.DATABASE_URL = 'postgresql://user:admin@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('DATABASE_URL contains a weak password');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject weak password "123456"', () => {
      process.env.DATABASE_URL = 'postgresql://user:123456@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('DATABASE_URL contains a weak password');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject weak password "postgres"', () => {
      process.env.DATABASE_URL = 'postgresql://user:postgres@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');
      expect(allErrors).toContain('DATABASE_URL contains a weak password');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Production HTTPS warnings', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://user:strongpass123@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
    });

    it('should warn about HTTP origins in production', () => {
      process.env.ALLOWED_ORIGINS = 'http://example.com,https://secure.com';

      validateEnvironment();

      const warnCalls = loggerWarnSpy.mock.calls.map((call) => call[0]);
      const allWarnings = warnCalls.join(' ');
      expect(allWarnings).toContain('ALLOWED_ORIGINS contains HTTP URLs in production');
      expect(processExitSpy).not.toHaveBeenCalled(); // Warning, not error
    });

    it('should NOT warn about HTTPS origins in production', () => {
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://secure.com';

      validateEnvironment();

      const warnCalls = loggerWarnSpy.mock.calls.map((call) => call[0]);
      const httpsWarningCall = warnCalls.find((msg) =>
        msg.includes('ALLOWED_ORIGINS contains HTTP URLs')
      );
      expect(httpsWarningCall).toBeUndefined();
    });

    it('should warn about PORT 80 in production', () => {
      process.env.PORT = '80';

      validateEnvironment();

      const warnCalls = loggerWarnSpy.mock.calls.map((call) => call[0]);
      const allWarnings = warnCalls.join(' ');
      expect(allWarnings).toContain('PORT is set to 80 (HTTP) in production');
      expect(processExitSpy).not.toHaveBeenCalled(); // Warning, not error
    });

    it('should NOT warn about PORT 443 in production', () => {
      process.env.PORT = '443';

      validateEnvironment();

      const warnCalls = loggerWarnSpy.mock.calls.map((call) => call[0]);
      const portWarningCall = warnCalls.find((msg) => msg.includes('PORT is set to 80'));
      expect(portWarningCall).toBeUndefined();
    });
  });

  describe('Multiple errors', () => {
    it('should report all validation errors at once', () => {
      process.env.DATABASE_URL = 'short'; // Too short
      process.env.JWT_SECRET = 'tooshort'; // Too short
      process.env.NODE_ENV = 'invalid'; // Invalid value
      process.env.PORT = 'notanumber'; // Invalid type

      validateEnvironment();

      // Check that all errors were logged
      const errorCalls = loggerErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');

      expect(allErrors).toContain('Environment validation failed');
      expect(allErrors).toContain('DATABASE_URL must be at least 20 characters');
      expect(allErrors).toContain('JWT_SECRET must be at least 32 characters');
      expect(allErrors).toContain('NODE_ENV must be one of');
      expect(allErrors).toContain('PORT must be a number');

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
