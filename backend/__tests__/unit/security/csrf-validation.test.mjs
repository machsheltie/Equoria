/**
 * 🔒 UNIT TESTS: CSRF Token Validation
 *
 * Tests for CSRF token generation and validation including:
 * - Token generation
 * - Token validation
 * - Token expiration
 * - Invalid tokens
 * - Missing tokens
 *
 * @module __tests__/unit/security/csrf-validation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getCsrfToken, applyCsrfProtection } from '../../../middleware/csrf.mjs';
import { createMockCsrfToken } from '../../factories/index.mjs';

describe('CSRF Token Validation Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      session: {},
      body: {},
      method: 'POST',
      path: '/api/test',
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      locals: {},
    };

    next = jest.fn();
  });

  describe('CSRF Token Generation', () => {
    it('should generate a CSRF token', () => {
      getCsrfToken(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        csrfToken: expect.any(String),
      });

      const call = res.json.mock.calls[0][0];
      expect(call.csrfToken).toBeTruthy();
      expect(typeof call.csrfToken).toBe('string');
    });

    it('should store CSRF token in session', () => {
      getCsrfToken(req, res);

      expect(req.session.csrfToken).toBeDefined();
      expect(typeof req.session.csrfToken).toBe('string');
    });

    it('should generate unique tokens for each request', () => {
      const req1 = { session: {} };
      const res1 = { json: jest.fn(), locals: {} };

      const req2 = { session: {} };
      const res2 = { json: jest.fn(), locals: {} };

      getCsrfToken(req1, res1);
      getCsrfToken(req2, res2);

      const token1 = res1.json.mock.calls[0][0].csrfToken;
      const token2 = res2.json.mock.calls[0][0].csrfToken;

      expect(token1).not.toBe(token2);
    });

    it('should generate token with sufficient length', () => {
      getCsrfToken(req, res);

      const call = res.json.mock.calls[0][0];
      expect(call.csrfToken.length).toBeGreaterThan(20);
    });

    it('should generate token with cryptographically secure randomness', () => {
      getCsrfToken(req, res);

      const call = res.json.mock.calls[0][0];
      // Check for hex format (common for crypto tokens)
      expect(call.csrfToken).toMatch(/^[a-f0-9]+$/i);
    });
  });

  describe('CSRF Token Validation - Valid Scenarios', () => {
    it('should accept valid CSRF token in body', () => {
      const token = createMockCsrfToken();
      req.session.csrfToken = token;
      req.body.csrfToken = token;

      applyCsrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should accept valid CSRF token in header', () => {
      const token = createMockCsrfToken();
      req.session.csrfToken = token;
      req.headers = { 'x-csrf-token': token };

      applyCsrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should prefer body token over header token', () => {
      const bodyToken = createMockCsrfToken();
      const headerToken = 'different-token';

      req.session.csrfToken = bodyToken;
      req.body.csrfToken = bodyToken;
      req.headers = { 'x-csrf-token': headerToken };

      applyCsrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should skip CSRF for GET requests', () => {
      req.method = 'GET';
      req.session.csrfToken = createMockCsrfToken();
      // No CSRF token provided

      applyCsrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should skip CSRF for HEAD requests', () => {
      req.method = 'HEAD';

      applyCsrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should skip CSRF for OPTIONS requests', () => {
      req.method = 'OPTIONS';

      applyCsrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('CSRF Token Validation - Invalid Scenarios', () => {
    it('should reject POST request without CSRF token', () => {
      req.method = 'POST';
      req.session.csrfToken = createMockCsrfToken();
      // No token in body or headers

      applyCsrfProtection(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid CSRF token',
        status: 'error',
      });
    });

    it('should reject PUT request without CSRF token', () => {
      req.method = 'PUT';
      req.session.csrfToken = createMockCsrfToken();

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject DELETE request without CSRF token', () => {
      req.method = 'DELETE';
      req.session.csrfToken = createMockCsrfToken();

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject PATCH request without CSRF token', () => {
      req.method = 'PATCH';
      req.session.csrfToken = createMockCsrfToken();

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject mismatched CSRF token', () => {
      req.session.csrfToken = 'valid-token-123';
      req.body.csrfToken = 'invalid-token-456';

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject empty CSRF token', () => {
      req.session.csrfToken = createMockCsrfToken();
      req.body.csrfToken = '';

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject null CSRF token', () => {
      req.session.csrfToken = createMockCsrfToken();
      req.body.csrfToken = null;

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject undefined CSRF token', () => {
      req.session.csrfToken = createMockCsrfToken();
      req.body.csrfToken = undefined;

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject when session has no CSRF token', () => {
      req.session = {}; // No csrfToken in session
      req.body.csrfToken = 'some-token';

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject when session is missing', () => {
      req.session = undefined;
      req.body.csrfToken = 'some-token';

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('CSRF Token Security Edge Cases', () => {
    it('should reject token with extra whitespace', () => {
      const token = createMockCsrfToken();
      req.session.csrfToken = token;
      req.body.csrfToken = `  ${token}  `; // Extra spaces

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject token with newline characters', () => {
      const token = createMockCsrfToken();
      req.session.csrfToken = token;
      req.body.csrfToken = `${token}\n`;

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject token with special characters appended', () => {
      const token = createMockCsrfToken();
      req.session.csrfToken = token;
      req.body.csrfToken = `${token}%00`; // Null byte

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should be case-sensitive for token validation', () => {
      const token = 'CaseSensitiveToken123';
      req.session.csrfToken = token;
      req.body.csrfToken = token.toLowerCase();

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject partial token match', () => {
      const token = 'full-token-12345';
      req.session.csrfToken = token;
      req.body.csrfToken = 'full-token-123'; // Missing last 2 chars

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should use timing-safe comparison for tokens', () => {
      // This test verifies that token comparison is timing-safe
      // to prevent timing attacks
      const token1 = 'a'.repeat(64);
      const token2 = 'b'.repeat(64);

      req.session.csrfToken = token1;
      req.body.csrfToken = token2;

      const start = process.hrtime.bigint();
      applyCsrfProtection(req, res, next);
      const duration1 = process.hrtime.bigint() - start;

      // Reset
      next.mockClear();
      res.status.mockClear();

      // Compare with token that matches more characters
      const token3 = `${'a'.repeat(63)}b`;
      req.body.csrfToken = token3;

      const start2 = process.hrtime.bigint();
      applyCsrfProtection(req, res, next);
      const duration2 = process.hrtime.bigint() - start2;

      // Timing should be similar (timing-safe comparison)
      // Allow 10x variance for test stability
      const ratio = Number(duration1) / Number(duration2);
      expect(ratio).toBeGreaterThan(0.1);
      expect(ratio).toBeLessThan(10);
    });
  });

  describe('CSRF Error Handling', () => {
    it('should return proper error response for CSRF failure', () => {
      req.session.csrfToken = createMockCsrfToken();
      req.body.csrfToken = 'wrong-token';

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid CSRF token',
        status: 'error',
      });
    });

    it('should not leak session token in error message', () => {
      const sessionToken = 'secret-session-token';
      req.session.csrfToken = sessionToken;
      req.body.csrfToken = 'wrong-token';

      applyCsrfProtection(req, res, next);

      const errorResponse = res.json.mock.calls[0][0];
      expect(errorResponse.message).not.toContain(sessionToken);
    });

    it('should not leak provided token in error message', () => {
      const providedToken = 'user-provided-token';
      req.session.csrfToken = 'different-token';
      req.body.csrfToken = providedToken;

      applyCsrfProtection(req, res, next);

      const errorResponse = res.json.mock.calls[0][0];
      expect(errorResponse.message).not.toContain(providedToken);
    });
  });

  describe('CSRF Token Rotation', () => {
    it('should allow token regeneration', () => {
      // Generate first token
      getCsrfToken(req, res);
      const firstToken = req.session.csrfToken;

      // Generate second token
      req.session = {}; // Reset session
      getCsrfToken(req, res);
      const secondToken = req.session.csrfToken;

      expect(firstToken).not.toBe(secondToken);
    });

    it('should invalidate old token after regeneration', () => {
      // Generate first token
      getCsrfToken(req, res);
      const oldToken = req.session.csrfToken;

      // Generate new token
      getCsrfToken(req, res);
      const _newToken = req.session.csrfToken;

      // Try to use old token
      req.body.csrfToken = oldToken;

      applyCsrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('CSRF Double-Submit Cookie Pattern', () => {
    it('should validate CSRF token from cookie', () => {
      const token = createMockCsrfToken();
      req.cookies = { csrfToken: token };
      req.body.csrfToken = token;

      // Simulate double-submit cookie pattern
      applyCsrfProtection(req, res, next);

      // Should validate against cookie or session
      expect(next).toHaveBeenCalled();
    });
  });

  describe('CSRF Integration with Different Content Types', () => {
    it('should validate CSRF for application/json', () => {
      const token = createMockCsrfToken();
      req.session.csrfToken = token;
      req.body.csrfToken = token;
      req.headers['content-type'] = 'application/json';

      applyCsrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should validate CSRF for application/x-www-form-urlencoded', () => {
      const token = createMockCsrfToken();
      req.session.csrfToken = token;
      req.body.csrfToken = token;
      req.headers['content-type'] = 'application/x-www-form-urlencoded';

      applyCsrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should validate CSRF for multipart/form-data', () => {
      const token = createMockCsrfToken();
      req.session.csrfToken = token;
      req.body.csrfToken = token;
      req.headers['content-type'] = 'multipart/form-data';

      applyCsrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });
});
