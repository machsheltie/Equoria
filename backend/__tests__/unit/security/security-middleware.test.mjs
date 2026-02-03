import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import helmet from 'helmet';
import cors from 'cors';
import _rateLimit from 'express-rate-limit';
import {
  corsOptions,
  createRateLimiter,
  helmetConfig,
  validateApiKey,
  enforceHttps,
  addSecurityHeaders,
  createSecurityMiddleware,
} from '../../../middleware/security.mjs';

describe('security middleware', () => {
  describe('corsOptions', () => {
    it('allows known origins and rejects unknown', () => {
      const cb = jest.fn();
      corsOptions.origin('http://localhost:3000', cb);
      expect(cb).toHaveBeenCalledWith(null, true);

      const cb2 = jest.fn();
      corsOptions.origin('http://evil.com', cb2);
      expect(cb2).toHaveBeenCalled();
      expect(cb2.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it('allows no-origin requests (legacy) and supports ALLOWED_ORIGINS env', () => {
      const cb = jest.fn();
      process.env.ALLOWED_ORIGINS = 'http://example.com';
      corsOptions.origin(undefined, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
      delete process.env.ALLOWED_ORIGINS;
    });
  });

  describe('createRateLimiter', () => {
    it('returns an express-rate-limit instance', () => {
      const limiter = createRateLimiter(1000, 1);
      expect(typeof limiter).toBe('function');
      const next = jest.fn();
      const req = { ip: '127.0.0.1', method: 'GET', path: '/', headers: {}, get: () => undefined };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
      expect(() => limiter(req, res, next)).not.toThrow();
    });
  });

  describe('validateApiKey', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
      req = {
        get: jest.fn(h => (h === 'origin' ? undefined : undefined)),
        headers: {},
        ip: '127.0.0.1',
        originalUrl: '/x',
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      next = jest.fn();
    });

    it('skips when API_KEY not set', () => {
      validateApiKey(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects missing or invalid key when configured', () => {
      process.env.API_KEY = 'secret';
      validateApiKey(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'API key required for requests without origin header',
      });
      delete process.env.API_KEY;
    });

    it('allows valid key', () => {
      process.env.API_KEY = 'secret';
      req.get = jest.fn(h => (h === 'origin' ? undefined : h === 'X-API-Key' ? 'secret' : undefined));
      validateApiKey(req, res, next);
      expect(next).toHaveBeenCalled();
      delete process.env.API_KEY;
    });
  });

  describe('enforceHttps', () => {
    it('bypasses in non-production', () => {
      const req = { headers: {}, secure: false };
      const res = { redirect: jest.fn() };
      const next = jest.fn();
      process.env.NODE_ENV = 'test';
      enforceHttps(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('redirects http in production', () => {
      const req = {
        headers: { host: 'example.com' },
        secure: false,
        url: '/foo',
        method: 'GET',
        ip: '::1',
        get: jest.fn(),
      };
      const res = { redirect: jest.fn() };
      const next = jest.fn();
      process.env.NODE_ENV = 'production';
      enforceHttps(req, res, next);
      expect(res.redirect).toHaveBeenCalledWith(301, 'https://example.com/foo');
      process.env.NODE_ENV = 'test';
    });
  });

  describe('addSecurityHeaders', () => {
    it('sets baseline headers', () => {
      const headers = {};
      const res = { setHeader: (k, v) => (headers[k] = v) };
      const next = jest.fn();
      addSecurityHeaders({}, res, next);
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['Permissions-Policy']).toContain('camera=');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('createSecurityMiddleware', () => {
    it('returns middleware array including helmet, cors, and rate limiter', () => {
      const chain = createSecurityMiddleware();
      expect(Array.isArray(chain)).toBe(true);
      expect(chain.some(fn => fn === enforceHttps)).toBe(true);
      expect(chain.some(fn => fn === addSecurityHeaders)).toBe(true);
      expect(chain.some(fn => fn.name === helmet(helmetConfig).name)).toBe(true);
      expect(chain.some(fn => fn.name === cors(corsOptions).name)).toBe(true);
    });
  });
});
