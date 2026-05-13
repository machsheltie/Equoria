/**
 * 🔒 INTEGRATION TESTS: Validation Error Handler (real express-validator)
 *
 * NO MOCKS. Rewritten 2026-04-30 (Equoria-p6fx, no-mocks doctrine epic)
 * from a jest.unstable_mockModule-of-express-validator pattern to one
 * that runs real express-validator chains via `.run(req)` to populate
 * real validation results, then exercises the middleware against the
 * real result.
 *
 * SECURITY: CWE-79 (XSS), CWE-20 (Improper Input Validation)
 *
 * Pattern: each test
 *   1. Sets req.body / req.query / req.params with test data.
 *   2. Optionally runs validation chains via `await body(...)…run(req)`
 *      to register real validation results in req's express-validator
 *      context.
 *   3. Calls handleValidationErrors / sanitizeRequestData with a real
 *      req/res/next harness.
 *   4. Asserts on res.statusValue, res.jsonValue, next() call shape.
 *
 * @module __tests__/middleware/validationErrorHandler
 */

import { describe, it, expect } from '@jest/globals';
import { body, query, param } from 'express-validator';
import { handleValidationErrors, sanitizeRequestData } from '../../../middleware/validationErrorHandler.mjs';

// Test harness: real-shape res/next that record what middleware did.
function makeHarness(req = {}) {
  let statusValue;
  let jsonValue;
  let nextCallCount = 0;
  const baseReq = {
    body: {},
    query: {},
    params: {},
    headers: {},
    originalUrl: '/test',
    method: 'POST',
    ip: '127.0.0.1',
    get(name) {
      return this.headers[name?.toLowerCase()];
    },
    ...req,
  };
  return {
    req: baseReq,
    res: {
      status(code) {
        statusValue = code;
        return this;
      },
      json(body) {
        jsonValue = body;
        return this;
      },
      get statusValue() {
        return statusValue;
      },
      get jsonValue() {
        return jsonValue;
      },
    },
    next() {
      nextCallCount += 1;
    },
    nextCallCount() {
      return nextCallCount;
    },
  };
}

describe('Validation Error Handler — real express-validator', () => {
  describe('handleValidationErrors()', () => {
    it('should call next() when no validation chains have run (empty validation context)', () => {
      const h = makeHarness();
      handleValidationErrors(h.req, h.res, h.next);
      expect(h.nextCallCount()).toBe(1);
      expect(h.res.statusValue).toBeUndefined();
    });

    it('should call next() when a real validation chain passed', async () => {
      const h = makeHarness({ body: { email: 'valid@example.com' } });
      await body('email').isEmail().run(h.req);

      handleValidationErrors(h.req, h.res, h.next);

      expect(h.nextCallCount()).toBe(1);
      expect(h.res.statusValue).toBeUndefined();
    });

    it('should return 400 when a real validation chain failed', async () => {
      const h = makeHarness({ body: { email: 'not-an-email' } });
      await body('email').isEmail().withMessage('Email is required').run(h.req);

      handleValidationErrors(h.req, h.res, h.next);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.success).toBe(false);
      expect(h.res.jsonValue.message).toBe('Email is required');
      expect(h.res.jsonValue.errors).toBeDefined();
      expect(h.res.jsonValue.errors.length).toBeGreaterThan(0);
      expect(h.nextCallCount()).toBe(0);
    });

    it('should return 400 with the FIRST error message when multiple fields fail', async () => {
      const h = makeHarness({ body: { email: 'bad', password: 'short' } });
      await body('email').isEmail().withMessage('Email is required').run(h.req);
      await body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters').run(h.req);

      handleValidationErrors(h.req, h.res, h.next);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toBe('Email is required');
      expect(h.res.jsonValue.errors.length).toBe(2);
    });

    it('should report nested field paths in error.path (e.g. user.address.street)', async () => {
      const h = makeHarness({ body: { user: { address: { street: '' } } } });
      await body('user.address.street').notEmpty().withMessage('Invalid address').run(h.req);

      handleValidationErrors(h.req, h.res, h.next);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toBe('Invalid address');
      expect(h.res.jsonValue.errors[0].path).toContain('user');
    });
  });

  describe('sanitizeRequestData() — XSS Prevention', () => {
    describe('No validation errors', () => {
      it('should remove non-validated body fields', async () => {
        const h = makeHarness({
          body: {
            email: 'test@example.com',
            password: 'password123',
            maliciousField: '<script>alert("XSS")</script>',
          },
        });
        // Validate only email + password; maliciousField is NOT in any chain
        // so it doesn't appear in matchedData.
        await body('email').isEmail().run(h.req);
        await body('password').isLength({ min: 1 }).run(h.req);

        sanitizeRequestData(h.req, h.res, h.next);

        expect(h.req.body.email).toBe('test@example.com');
        expect(h.req.body.password).toBe('password123');
        expect(h.req.body.maliciousField).toBeUndefined();
        expect(h.nextCallCount()).toBe(1);
      });

      it('should remove non-validated query parameters', async () => {
        const h = makeHarness({
          query: {
            search: 'thoroughbred',
            page: '1',
            invalidParam: '<img src=x onerror=alert(1)>',
          },
        });
        await query('search').isString().run(h.req);
        await query('page').isString().run(h.req);

        sanitizeRequestData(h.req, h.res, h.next);

        expect(h.req.query.search).toBe('thoroughbred');
        expect(h.req.query.page).toBe('1');
        expect(h.req.query.invalidParam).toBeUndefined();
      });

      it('should remove non-validated route parameters', async () => {
        const h = makeHarness({
          params: { id: '123', malicious: '"><script>alert(1)</script>' },
        });
        await param('id').isString().run(h.req);

        sanitizeRequestData(h.req, h.res, h.next);

        expect(h.req.params.id).toBe('123');
        expect(h.req.params.malicious).toBeUndefined();
      });

      it('should preserve special characters in validated fields (apostrophe, ampersand)', async () => {
        const h = makeHarness({
          body: {
            firstName: "O'Brien",
            bio: 'Loves horses & riding',
          },
        });
        await body('firstName').isString().run(h.req);
        await body('bio').isString().run(h.req);

        sanitizeRequestData(h.req, h.res, h.next);

        expect(h.req.body.firstName).toBe("O'Brien");
        expect(h.req.body.bio).toBe('Loves horses & riding');
      });

      it('should NOT replace req.body when no chains have run (matchedData empty)', async () => {
        const h = makeHarness({
          body: {
            malicious1: '<script>alert(1)</script>',
            malicious2: 'DROP TABLE users;',
          },
        });
        // No chains run => matchedData is empty => the middleware preserves
        // the original body (production-defined behaviour: don't strip if
        // there's nothing validated to strip TO).

        sanitizeRequestData(h.req, h.res, h.next);

        expect(h.req.body.malicious1).toBe('<script>alert(1)</script>');
        expect(h.req.body.malicious2).toBe('DROP TABLE users;');
        expect(h.nextCallCount()).toBe(1);
      });
    });

    describe('With validation errors', () => {
      it('should NOT modify req when validation has failed', async () => {
        const h = makeHarness({
          body: {
            email: 'not-an-email',
            malicious: '<script>alert(1)</script>',
          },
        });
        await body('email').isEmail().run(h.req); // FAILS

        const originalBody = { ...h.req.body };
        sanitizeRequestData(h.req, h.res, h.next);

        expect(h.req.body).toEqual(originalBody);
        expect(h.nextCallCount()).toBe(1); // sanitize STILL calls next so handleValidationErrors can run
      });
    });

    describe('XSS Attack Scenarios — non-validated fields are stripped', () => {
      it('should strip <script> injection from non-validated fields', async () => {
        const h = makeHarness({
          body: {
            comment: '<script>alert("XSS")</script>',
            validField: 'safe data',
          },
        });
        await body('validField').isString().run(h.req);

        sanitizeRequestData(h.req, h.res, h.next);

        expect(h.req.body.comment).toBeUndefined();
        expect(h.req.body.validField).toBe('safe data');
      });

      it('should strip event-handler injection from non-validated fields', async () => {
        const h = makeHarness({
          body: { bio: '<img src=x onerror=alert(1)>', name: 'John' },
        });
        await body('name').isString().run(h.req);

        sanitizeRequestData(h.req, h.res, h.next);

        expect(h.req.body.bio).toBeUndefined();
        expect(h.req.body.name).toBe('John');
      });

      it('should strip iframe injection from non-validated fields', async () => {
        const h = makeHarness({
          body: {
            description: '<iframe src="javascript:alert(1)"></iframe>',
            title: 'My Horse',
          },
        });
        await body('title').isString().run(h.req);

        sanitizeRequestData(h.req, h.res, h.next);

        expect(h.req.body.description).toBeUndefined();
        expect(h.req.body.title).toBe('My Horse');
      });

      it('should strip SVG XSS from non-validated fields', async () => {
        const h = makeHarness({
          body: {
            avatar: '<svg><script>alert(1)</script></svg>',
            username: 'user123',
          },
        });
        await body('username').isString().run(h.req);

        sanitizeRequestData(h.req, h.res, h.next);

        expect(h.req.body.avatar).toBeUndefined();
        expect(h.req.body.username).toBe('user123');
      });
    });

    describe('Parameter Pollution Prevention (CWE-20)', () => {
      it('should strip unvalidated extra query parameters', async () => {
        const h = makeHarness({
          query: {
            sort: 'price',
            extraParam1: 'value1',
            extraParam2: 'value2',
          },
        });
        await query('sort').isString().run(h.req);

        sanitizeRequestData(h.req, h.res, h.next);

        expect(h.req.query.sort).toBe('price');
        expect(h.req.query.extraParam1).toBeUndefined();
        expect(h.req.query.extraParam2).toBeUndefined();
      });

      it('should strip unvalidated nested object fields (no privilege escalation)', async () => {
        const h = makeHarness({
          body: {
            user: { email: 'test@example.com', isAdmin: true },
            password: 'pass123',
          },
        });
        // Only password is in the validation chain — `user` is unvalidated
        // and must be stripped, preventing isAdmin escalation.
        await body('password').isString().run(h.req);

        sanitizeRequestData(h.req, h.res, h.next);

        expect(h.req.body.password).toBe('pass123');
        expect(h.req.body.user).toBeUndefined();
      });
    });
  });
});
