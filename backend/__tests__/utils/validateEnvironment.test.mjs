/**
 * Environment Validation Tests
 * Tests for startup environment variable validation
 *
 * SECURITY: CWE-798 (Hardcoded Credentials), CWE-321 (Weak Secrets)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { validateEnvironment } from '../../utils/validateEnvironment.mjs';

describe('validateEnvironment()', () => {
  let originalEnv;
  let consoleErrorSpy;
  let processExitSpy;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Mock console.error and process.exit
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Restore mocks
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
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

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing required environment variable: DATABASE_URL'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when JWT_SECRET is missing', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing required environment variable: JWT_SECRET'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when NODE_ENV is missing', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      delete process.env.NODE_ENV;
      process.env.PORT = '3000';

      validateEnvironment();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing required environment variable: NODE_ENV'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when PORT is missing', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      delete process.env.PORT;

      validateEnvironment();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing required environment variable: PORT'),
      );
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

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DATABASE_URL must be at least 20 characters'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when JWT_SECRET is too short (<32 chars)', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(31); // 31 chars
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET must be at least 32 characters'),
      );
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

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('NODE_ENV must be one of: development, production, test'),
      );
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

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('PORT must be a number'),
      );
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

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET appears to be a placeholder value'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject placeholder "change-this"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'change-this-secret-to-something-secure-32-chars';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET appears to be a placeholder value'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject placeholder "REPLACE_WITH"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'REPLACE_WITH_YOUR_SECRET_KEY_32_CHARACTERS';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET appears to be a placeholder value'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject placeholder "example"', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/equoria';
      process.env.JWT_SECRET = 'example-jwt-secret-key-32-characters-long';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET appears to be a placeholder value'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
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

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DATABASE_URL must start with postgresql:// or postgres://'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject weak password "password"', () => {
      process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DATABASE_URL contains a weak password'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject weak password "admin"', () => {
      process.env.DATABASE_URL = 'postgresql://user:admin@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DATABASE_URL contains a weak password'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject weak password "123456"', () => {
      process.env.DATABASE_URL = 'postgresql://user:123456@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DATABASE_URL contains a weak password'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject weak password "postgres"', () => {
      process.env.DATABASE_URL = 'postgresql://user:postgres@localhost:5432/equoria';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      validateEnvironment();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DATABASE_URL contains a weak password'),
      );
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
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      process.env.ALLOWED_ORIGINS = 'http://example.com,https://secure.com';

      validateEnvironment();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('ALLOWED_ORIGINS contains HTTP URLs in production'),
      );
      expect(processExitSpy).not.toHaveBeenCalled(); // Warning, not error

      warnSpy.mockRestore();
    });

    it('should NOT warn about HTTPS origins in production', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://secure.com';

      validateEnvironment();

      const httpsWarningCall = warnSpy.mock.calls.find((call) =>
        call[0].includes('ALLOWED_ORIGINS contains HTTP URLs'),
      );
      expect(httpsWarningCall).toBeUndefined();

      warnSpy.mockRestore();
    });

    it('should warn about PORT 80 in production', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      process.env.PORT = '80';

      validateEnvironment();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PORT is set to 80 (HTTP) in production'),
      );
      expect(processExitSpy).not.toHaveBeenCalled(); // Warning, not error

      warnSpy.mockRestore();
    });

    it('should NOT warn about PORT 443 in production', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      process.env.PORT = '443';

      validateEnvironment();

      const portWarningCall = warnSpy.mock.calls.find((call) =>
        call[0].includes('PORT is set to 80'),
      );
      expect(portWarningCall).toBeUndefined();

      warnSpy.mockRestore();
    });
  });

  describe('Multiple errors', () => {
    it('should report all validation errors at once', () => {
      process.env.DATABASE_URL = 'short'; // Too short
      process.env.JWT_SECRET = 'tooshort'; // Too short
      process.env.NODE_ENV = 'invalid'; // Invalid value
      process.env.PORT = 'notanumber'; // Invalid type

      validateEnvironment();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Environment validation failed'),
      );

      // Check that all errors were logged
      const errorCalls = consoleErrorSpy.mock.calls.map((call) => call[0]);
      const allErrors = errorCalls.join(' ');

      expect(allErrors).toContain('DATABASE_URL must be at least 20 characters');
      expect(allErrors).toContain('JWT_SECRET must be at least 32 characters');
      expect(allErrors).toContain('NODE_ENV must be one of');
      expect(allErrors).toContain('PORT must be a number');

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
