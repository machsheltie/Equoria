/**
 * Security Middleware Tests
 * Tests for HTTPS enforcement, security headers, and API key validation
 *
 * SECURITY: CWE-319 (Cleartext Transmission), CWE-942 (Permissive CORS)
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  enforceHttps,
  addSecurityHeaders,
  validateApiKey,
  corsOptions,
} from '../../middleware/security.mjs';
import { mockRequest, mockResponse, mockNext } from '../setup.mjs';

describe('Security Middleware', () => {
  describe('enforceHttps()', () => {
    let req, res, next;

    beforeEach(() => {
      req = mockRequest();
      res = mockResponse();
      next = mockNext();
    });

    describe('Development environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      it('should allow HTTP requests in development', () => {
        req.secure = false;
        req.headers = { host: 'localhost:3000' };
        req.url = '/api/auth/login';

        enforceHttps(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.redirect).not.toHaveBeenCalled();
      });
    });

    describe('Production environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      it('should allow HTTPS requests (req.secure)', () => {
        req.secure = true;
        req.headers = { host: 'api.equoria.com' };

        enforceHttps(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.redirect).not.toHaveBeenCalled();
      });

      it('should allow HTTPS requests (x-forwarded-proto header)', () => {
        req.secure = false;
        req.headers = {
          host: 'api.equoria.com',
          'x-forwarded-proto': 'https',
        };

        enforceHttps(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.redirect).not.toHaveBeenCalled();
      });

      it('should allow HTTPS requests (x-forwarded-ssl header)', () => {
        req.secure = false;
        req.headers = {
          host: 'api.equoria.com',
          'x-forwarded-ssl': 'on',
        };

        enforceHttps(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.redirect).not.toHaveBeenCalled();
      });

      it('should redirect HTTP to HTTPS with 301 status', () => {
        req.secure = false;
        req.headers = { host: 'api.equoria.com' };
        req.url = '/api/auth/login';

        enforceHttps(req, res, next);

        expect(res.redirect).toHaveBeenCalledWith(301, 'https://api.equoria.com/api/auth/login');
        expect(next).not.toHaveBeenCalled();
      });

      it('should preserve query parameters in redirect', () => {
        req.secure = false;
        req.headers = { host: 'api.equoria.com' };
        req.url = '/api/horses?breed=thoroughbred&color=bay';

        enforceHttps(req, res, next);

        expect(res.redirect).toHaveBeenCalledWith(
          301,
          'https://api.equoria.com/api/horses?breed=thoroughbred&color=bay',
        );
      });
    });
  });

  describe('addSecurityHeaders()', () => {
    let req, res, next;

    beforeEach(() => {
      req = mockRequest();
      res = mockResponse();
      next = mockNext();
      process.env.NODE_ENV = 'production';
    });

    it('should add HSTS header in production', () => {
      addSecurityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
      expect(next).toHaveBeenCalled();
    });

    it('should NOT add HSTS header in development', () => {
      process.env.NODE_ENV = 'development';

      addSecurityHeaders(req, res, next);

      const hstsCall = res.setHeader.mock.calls.find(
        (call) => call[0] === 'Strict-Transport-Security',
      );
      expect(hstsCall).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should add X-Frame-Options header', () => {
      addSecurityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });

    it('should add X-Content-Type-Options header', () => {
      addSecurityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('should add X-XSS-Protection header', () => {
      addSecurityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    });

    it('should add Referrer-Policy header', () => {
      addSecurityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin',
      );
    });

    it('should add Permissions-Policy header', () => {
      addSecurityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=()',
      );
    });

    it('should add all 6 security headers in production', () => {
      addSecurityHeaders(req, res, next);

      const expectedHeaders = [
        'Strict-Transport-Security',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'X-XSS-Protection',
        'Referrer-Policy',
        'Permissions-Policy',
      ];

      expectedHeaders.forEach((header) => {
        const headerCall = res.setHeader.mock.calls.find((call) => call[0] === header);
        expect(headerCall).toBeDefined();
      });
    });
  });

  describe('validateApiKey()', () => {
    let req, res, next;

    beforeEach(() => {
      req = mockRequest();
      res = mockResponse();
      next = mockNext();
      process.env.API_KEY = 'test-api-key-12345';
    });

    describe('Requests WITH origin header', () => {
      it('should skip API key validation for browser requests', () => {
        req.headers = {
          origin: 'http://localhost:3000',
        };

        validateApiKey(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should skip validation even if X-API-Key is missing', () => {
        req.headers = {
          origin: 'https://app.equoria.com',
          // No X-API-Key header
        };

        validateApiKey(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    describe('Requests WITHOUT origin header (mobile/API clients)', () => {
      it('should accept valid API key', () => {
        req.headers = {
          'x-api-key': 'test-api-key-12345',
          // No origin header
        };

        validateApiKey(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should reject missing API key', () => {
        req.headers = {
          // No origin, no X-API-Key
        };
        req.ip = '203.0.113.42';
        req.originalUrl = '/api/horses';

        validateApiKey(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'API key required for requests without origin header',
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should reject invalid API key', () => {
        req.headers = {
          'x-api-key': 'wrong-api-key',
        };
        req.ip = '203.0.113.42';

        validateApiKey(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'API key required for requests without origin header',
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should be case-sensitive for API key', () => {
        req.headers = {
          'x-api-key': 'TEST-API-KEY-12345', // Wrong case
        };

        validateApiKey(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('Missing API_KEY environment variable', () => {
      beforeEach(() => {
        delete process.env.API_KEY;
      });

      it('should allow requests without API key (backward compatibility)', () => {
        req.headers = {
          // No origin, no X-API-Key
        };

        validateApiKey(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should log warning when API_KEY not configured', () => {
        const loggerSpy = jest.spyOn(console, 'warn').mockImplementation();

        req.headers = {};
        validateApiKey(req, res, next);

        expect(next).toHaveBeenCalled();

        loggerSpy.mockRestore();
      });
    });
  });

  describe('CORS Configuration', () => {
    describe('corsOptions.origin()', () => {
      it('should allow localhost:3000', (done) => {
        corsOptions.origin('http://localhost:3000', (err, allowed) => {
          expect(err).toBeNull();
          expect(allowed).toBe(true);
          done();
        });
      });

      it('should allow localhost:3001', (done) => {
        corsOptions.origin('http://localhost:3001', (err, allowed) => {
          expect(err).toBeNull();
          expect(allowed).toBe(true);
          done();
        });
      });

      it('should allow 127.0.0.1:3000', (done) => {
        corsOptions.origin('http://127.0.0.1:3000', (err, allowed) => {
          expect(err).toBeNull();
          expect(allowed).toBe(true);
          done();
        });
      });

      it('should allow additional origins from environment', (done) => {
        process.env.ALLOWED_ORIGINS = 'https://app.equoria.com,https://staging.equoria.com';

        corsOptions.origin('https://app.equoria.com', (err, allowed) => {
          expect(err).toBeNull();
          expect(allowed).toBe(true);
          done();
        });
      });

      it('should block unknown origins', (done) => {
        corsOptions.origin('https://evil.com', (err, allowed) => {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('Not allowed by CORS');
          expect(allowed).toBeUndefined();
          done();
        });
      });

      it('should allow requests with no origin (mobile apps)', (done) => {
        corsOptions.origin(undefined, (err, allowed) => {
          expect(err).toBeNull();
          expect(allowed).toBe(true);
          done();
        });
      });

      it('should allow requests with null origin', (done) => {
        corsOptions.origin(null, (err, allowed) => {
          expect(err).toBeNull();
          expect(allowed).toBe(true);
          done();
        });
      });
    });

    it('should have credentials enabled', () => {
      expect(corsOptions.credentials).toBe(true);
    });

    it('should allow standard HTTP methods', () => {
      expect(corsOptions.methods).toContain('GET');
      expect(corsOptions.methods).toContain('POST');
      expect(corsOptions.methods).toContain('PUT');
      expect(corsOptions.methods).toContain('DELETE');
      expect(corsOptions.methods).toContain('PATCH');
      expect(corsOptions.methods).toContain('OPTIONS');
    });

    it('should allow required headers', () => {
      expect(corsOptions.allowedHeaders).toContain('Content-Type');
      expect(corsOptions.allowedHeaders).toContain('Authorization');
      expect(corsOptions.allowedHeaders).toContain('X-API-Key');
    });
  });
});
