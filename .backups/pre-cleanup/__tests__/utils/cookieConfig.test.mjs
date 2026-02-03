/**
 * 🧪 COOKIE CONFIGURATION TESTS
 *
 * Tests for centralized cookie configuration module
 * Validates security properties, environment handling, and configuration consistency
 *
 * Test Coverage:
 * - Cookie option structure validation
 * - Environment-specific behavior (dev vs production)
 * - Domain configuration handling
 * - Clear cookie options matching
 * - Configuration summary generation
 *
 * @module __tests__/utils/cookieConfig.test
 */

import { jest } from '@jest/globals';

describe('Cookie Configuration Module', () => {
  let originalEnv;
  let COOKIE_OPTIONS;
  let CLEAR_COOKIE_OPTIONS;
  let getCookieConfigSummary;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear module cache to allow fresh imports with different env variables
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Access Token Cookie Options', () => {
    test('should have correct security properties in development', async () => {
      process.env.NODE_ENV = 'development';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.accessToken).toEqual({
        httpOnly: true,
        secure: false, // Not secure in development
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/',
        domain: undefined,
      });
    });

    test('should have correct security properties in production', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.accessToken).toEqual({
        httpOnly: true,
        secure: true, // Secure in production
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/',
        domain: undefined,
      });
    });

    test('should use custom domain when COOKIE_DOMAIN is set', async () => {
      process.env.NODE_ENV = 'production';
      process.env.COOKIE_DOMAIN = '.equoria.com';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.accessToken.domain).toBe('.equoria.com');
    });

    test('should have httpOnly true (XSS protection)', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.accessToken.httpOnly).toBe(true);
    });

    test('should have sameSite strict (CSRF protection)', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.accessToken.sameSite).toBe('strict');
    });

    test('should have maxAge matching access token expiry (15 minutes)', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      const expectedMaxAge = 15 * 60 * 1000; // 15 minutes in milliseconds
      expect(COOKIE_OPTIONS.accessToken.maxAge).toBe(expectedMaxAge);
    });

    test('should have path set to root', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.accessToken.path).toBe('/');
    });
  });

  describe('Refresh Token Cookie Options', () => {
    test('should have correct security properties', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.refreshToken).toEqual({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/auth/refresh-token', // Scoped to cookie-based refresh endpoint
        domain: undefined,
      });
    });

    test('should have maxAge matching refresh token expiry (7 days)', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      const expectedMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      expect(COOKIE_OPTIONS.refreshToken.maxAge).toBe(expectedMaxAge);
    });

    test('should have path scoped to refresh endpoint (least privilege)', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.refreshToken.path).toBe('/auth/refresh-token');
    });
  });

  describe('CSRF Token Cookie Options', () => {
    test('should have httpOnly false (client must read for X-CSRF-Token header)', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.csrfToken.httpOnly).toBe(false);
    });

    test('should have correct security properties', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.csrfToken).toEqual({
        httpOnly: false,
        secure: true,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes (matches access token)
        path: '/',
        domain: undefined,
      });
    });

    test('should have maxAge matching access token (session-tied)', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.csrfToken.maxAge).toBe(COOKIE_OPTIONS.accessToken.maxAge);
    });
  });

  describe('Clear Cookie Options', () => {
    test('should match access token options (except maxAge)', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;
      CLEAR_COOKIE_OPTIONS = config.CLEAR_COOKIE_OPTIONS;

      expect(CLEAR_COOKIE_OPTIONS.accessToken).toEqual({
        httpOnly: COOKIE_OPTIONS.accessToken.httpOnly,
        secure: COOKIE_OPTIONS.accessToken.secure,
        sameSite: COOKIE_OPTIONS.accessToken.sameSite,
        path: COOKIE_OPTIONS.accessToken.path,
        domain: COOKIE_OPTIONS.accessToken.domain,
      });
    });

    test('should match refresh token options (except maxAge)', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;
      CLEAR_COOKIE_OPTIONS = config.CLEAR_COOKIE_OPTIONS;

      expect(CLEAR_COOKIE_OPTIONS.refreshToken).toEqual({
        httpOnly: COOKIE_OPTIONS.refreshToken.httpOnly,
        secure: COOKIE_OPTIONS.refreshToken.secure,
        sameSite: COOKIE_OPTIONS.refreshToken.sameSite,
        path: COOKIE_OPTIONS.refreshToken.path,
        domain: COOKIE_OPTIONS.refreshToken.domain,
      });
    });

    test('should have same path as original cookie (required for proper deletion)', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;
      CLEAR_COOKIE_OPTIONS = config.CLEAR_COOKIE_OPTIONS;

      expect(CLEAR_COOKIE_OPTIONS.accessToken.path).toBe(COOKIE_OPTIONS.accessToken.path);
      expect(CLEAR_COOKIE_OPTIONS.refreshToken.path).toBe(COOKIE_OPTIONS.refreshToken.path);
      expect(CLEAR_COOKIE_OPTIONS.csrfToken.path).toBe(COOKIE_OPTIONS.csrfToken.path);
    });

    test('should have same domain as original cookie (required for proper deletion)', async () => {
      process.env.NODE_ENV = 'production';
      process.env.COOKIE_DOMAIN = '.equoria.com';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;
      CLEAR_COOKIE_OPTIONS = config.CLEAR_COOKIE_OPTIONS;

      expect(CLEAR_COOKIE_OPTIONS.accessToken.domain).toBe(COOKIE_OPTIONS.accessToken.domain);
      expect(CLEAR_COOKIE_OPTIONS.refreshToken.domain).toBe(COOKIE_OPTIONS.refreshToken.domain);
      expect(CLEAR_COOKIE_OPTIONS.csrfToken.domain).toBe(COOKIE_OPTIONS.csrfToken.domain);
    });
  });

  describe('Environment-Specific Behavior', () => {
    test('should have secure: false in development', async () => {
      process.env.NODE_ENV = 'development';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.accessToken.secure).toBe(false);
      expect(COOKIE_OPTIONS.refreshToken.secure).toBe(false);
      expect(COOKIE_OPTIONS.csrfToken.secure).toBe(false);
    });

    test('should have secure: false in test', async () => {
      process.env.NODE_ENV = 'test';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.accessToken.secure).toBe(false);
      expect(COOKIE_OPTIONS.refreshToken.secure).toBe(false);
      expect(COOKIE_OPTIONS.csrfToken.secure).toBe(false);
    });

    test('should have secure: true in production', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.accessToken.secure).toBe(true);
      expect(COOKIE_OPTIONS.refreshToken.secure).toBe(true);
      expect(COOKIE_OPTIONS.csrfToken.secure).toBe(true);
    });
  });

  describe('Cookie Configuration Summary', () => {
    test('should return configuration summary', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      getCookieConfigSummary = config.getCookieConfigSummary;

      const summary = getCookieConfigSummary();

      expect(summary).toHaveProperty('environment');
      expect(summary).toHaveProperty('isProduction');
      expect(summary).toHaveProperty('domain');
      expect(summary).toHaveProperty('accessToken');
      expect(summary).toHaveProperty('refreshToken');
      expect(summary).toHaveProperty('csrfToken');
    });

    test('should show production environment correctly', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      getCookieConfigSummary = config.getCookieConfigSummary;

      const summary = getCookieConfigSummary();

      expect(summary.isProduction).toBe(true);
      expect(summary.accessToken.secure).toBe(true);
    });

    test('should show custom domain when set', async () => {
      process.env.NODE_ENV = 'production';
      process.env.COOKIE_DOMAIN = '.equoria.com';
      const config = await import('../../utils/cookieConfig.mjs');
      getCookieConfigSummary = config.getCookieConfigSummary;

      const summary = getCookieConfigSummary();

      expect(summary.domain).toBe('.equoria.com');
    });

    test('should show same-domain when COOKIE_DOMAIN not set', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.COOKIE_DOMAIN;
      const config = await import('../../utils/cookieConfig.mjs');
      getCookieConfigSummary = config.getCookieConfigSummary;

      const summary = getCookieConfigSummary();

      expect(summary.domain).toBe('same-domain');
    });
  });

  describe('Security Compliance', () => {
    test('should have all security flags enabled in production', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      // Access token security
      expect(COOKIE_OPTIONS.accessToken.httpOnly).toBe(true);
      expect(COOKIE_OPTIONS.accessToken.secure).toBe(true);
      expect(COOKIE_OPTIONS.accessToken.sameSite).toBe('strict');

      // Refresh token security
      expect(COOKIE_OPTIONS.refreshToken.httpOnly).toBe(true);
      expect(COOKIE_OPTIONS.refreshToken.secure).toBe(true);
      expect(COOKIE_OPTIONS.refreshToken.sameSite).toBe('strict');

      // CSRF token security (httpOnly false is intentional)
      expect(COOKIE_OPTIONS.csrfToken.secure).toBe(true);
      expect(COOKIE_OPTIONS.csrfToken.sameSite).toBe('strict');
    });

    test('should prevent JavaScript access to auth tokens (XSS mitigation)', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.accessToken.httpOnly).toBe(true);
      expect(COOKIE_OPTIONS.refreshToken.httpOnly).toBe(true);
    });

    test('should require HTTPS in production (MitM mitigation)', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.accessToken.secure).toBe(true);
      expect(COOKIE_OPTIONS.refreshToken.secure).toBe(true);
      expect(COOKIE_OPTIONS.csrfToken.secure).toBe(true);
    });

    test('should prevent cross-site requests (CSRF mitigation)', async () => {
      process.env.NODE_ENV = 'production';
      const config = await import('../../utils/cookieConfig.mjs');
      COOKIE_OPTIONS = config.COOKIE_OPTIONS;

      expect(COOKIE_OPTIONS.accessToken.sameSite).toBe('strict');
      expect(COOKIE_OPTIONS.refreshToken.sameSite).toBe('strict');
      expect(COOKIE_OPTIONS.csrfToken.sameSite).toBe('strict');
    });
  });

  describe('Exports', () => {
    test('should export all required constants', async () => {
      const config = await import('../../utils/cookieConfig.mjs');

      expect(config.ACCESS_TOKEN_COOKIE_OPTIONS).toBeDefined();
      expect(config.REFRESH_TOKEN_COOKIE_OPTIONS).toBeDefined();
      expect(config.CSRF_TOKEN_COOKIE_OPTIONS).toBeDefined();
      expect(config.COOKIE_OPTIONS).toBeDefined();
      expect(config.CLEAR_COOKIE_OPTIONS).toBeDefined();
      expect(config.getCookieConfigSummary).toBeDefined();
      expect(config.default).toBe(config.COOKIE_OPTIONS);
    });
  });
});
