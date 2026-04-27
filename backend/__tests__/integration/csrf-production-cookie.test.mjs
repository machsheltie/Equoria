/**
 * Production cookie-name contract — regression canary.
 *
 * In production the CSRF cookie is named `__Host-csrf` (browser rules: must
 * be Secure, Path=/, no Domain). In every other env it is `_csrf`. The
 * adversarial review that triggered this correction found that the
 * generator was emitting `__Host-csrf` in production while the validator
 * read `_csrf` — breaking every real-world mutation.
 *
 * The correction unified both ends behind `CSRF_COOKIE_NAME` in
 * `backend/middleware/csrf.mjs`. This file proves two things the checklist
 * demands:
 *
 *   1. The single source of truth resolves correctly per-env. `_csrf` in
 *      the current test env, `__Host-csrf` when the module is reloaded
 *      with NODE_ENV=production.
 *   2. `GET /auth/csrf-token` under production settings actually emits a
 *      `__Host-csrf=` Set-Cookie. (If the generator drifts back to `_csrf`
 *      in production, this test fails.)
 *
 * If either contract breaks, a mutation in production will never find a
 * readable cookie and every browser user will hit a 403 loop.
 *
 * @module __tests__/integration/csrf-production-cookie.test
 */

import { jest as _jest } from '@jest/globals';

_jest.setTimeout(30000);

const importFresh = path =>
  import(`${path}?cacheBust=${Date.now()}-${Math.random().toString(16).slice(2)}`);

describe('CSRF cookie-name contract', () => {
  it('resolves to `_csrf` in the current (non-production) test env', async () => {
    const { CSRF_COOKIE_NAME } = await import('../../middleware/csrf.mjs');
    expect(CSRF_COOKIE_NAME).toBe('_csrf');
  });

  it('resolves to `__Host-csrf` when NODE_ENV=production and the module is loaded fresh', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const originalJwtSecret = process.env.JWT_SECRET;
    const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalPort = process.env.PORT;
    _jest.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'StrongSecret1234567890ABCDEFGHIJK';
    process.env.JWT_REFRESH_SECRET = 'StrongRefreshSecret1234567890ABCD';
    process.env.DATABASE_URL = 'postgresql://user:StrongPass123!@localhost:5432/equoria';
    process.env.PORT = '3001';
    try {
      const { CSRF_COOKIE_NAME: prodName } = await importFresh('../../middleware/csrf.mjs');
      expect(prodName).toBe('__Host-csrf');
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.JWT_SECRET = originalJwtSecret;
      process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
      process.env.DATABASE_URL = originalDatabaseUrl;
      process.env.PORT = originalPort;
      _jest.resetModules();
    }
  });

  it('GET /auth/csrf-token under NODE_ENV=production emits __Host-csrf Set-Cookie', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const originalJwtSecret = process.env.JWT_SECRET;
    const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalPort = process.env.PORT;
    _jest.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'StrongSecret1234567890ABCDEFGHIJK';
    process.env.JWT_REFRESH_SECRET = 'StrongRefreshSecret1234567890ABCD';
    process.env.DATABASE_URL = 'postgresql://user:StrongPass123!@localhost:5432/equoria';
    process.env.PORT = '3001';
    try {
      const { default: prodApp } = await importFresh('../../app.mjs');
      const request = (await import('supertest')).default;

      const res = await request(prodApp).get('/auth/csrf-token').set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(200);
      const setCookies = res.headers['set-cookie'] || [];
      const hostCsrfCookie = setCookies.find(c => c.startsWith('__Host-csrf='));
      expect(hostCsrfCookie).toBeTruthy();

      // `_csrf` (the non-production name) MUST NOT appear under production.
      const devCsrfCookie = setCookies.find(c => c.startsWith('_csrf='));
      expect(devCsrfCookie).toBeFalsy();
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.JWT_SECRET = originalJwtSecret;
      process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
      process.env.DATABASE_URL = originalDatabaseUrl;
      process.env.PORT = originalPort;
      _jest.resetModules();
    }
  });

  it('fails startup under NODE_ENV=production when JWT_SECRET is absent', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const originalJwtSecret = process.env.JWT_SECRET;
    const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalPort = process.env.PORT;
    _jest.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = '';
    process.env.JWT_REFRESH_SECRET = 'StrongRefreshSecret1234567890ABCD';
    process.env.DATABASE_URL = 'postgresql://user:StrongPass123!@localhost:5432/equoria';
    process.env.PORT = '3001';
    try {
      await expect(importFresh('../../middleware/csrf.mjs')).rejects.toThrow(/JWT_SECRET/);
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.JWT_SECRET = originalJwtSecret;
      process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
      process.env.DATABASE_URL = originalDatabaseUrl;
      process.env.PORT = originalPort;
      _jest.resetModules();
    }
  });
});
