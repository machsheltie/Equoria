/**
 * Password complexity at /auth/register + /auth/reset-password — sentinel
 * (Equoria-ie4wc, OWASP ASVS L1).
 *
 * Before: register required 4 character classes but 8-char floor; reset-
 * password required 3 classes (no special) and 8-char floor. `Password1`,
 * `Equoria1`, `Welcome2024`, and similar dictionary-suffix patterns passed.
 *
 * After: all 3 write sites (register / reset-password.newPassword /
 * reset-password.password) require 12 chars + 4 classes (lower/upper/
 * digit/special @$!%*?&). Existing 8-char users still log in via bcrypt
 * (the policy is only enforced on the WRITE path).
 *
 * This sentinel locks the policy at the route layer using express-validator
 * (no DB / no controller invocation needed). The fail-cases would have
 * passed pre-fix; they fail post-fix because the validator rejects the
 * shape before the controller sees it.
 *
 * Real-stack supertest, no mocks. The CSRF token is fetched normally; the
 * goal of the sentinel is to lock the VALIDATION layer, not to test the
 * full register lifecycle (which mfa.integration covers).
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

let csrf;

beforeAll(async () => {
  csrf = await fetchCsrf(app);
});

const validBody = (overrides = {}) => ({
  username: `pwc${randomBytes(4).toString('hex')}`,
  email: `pwc-${randomBytes(8).toString('hex')}@example.com`,
  password: 'ValidPassword1!@#',
  firstName: 'P',
  lastName: 'W',
  dateOfBirth: '1990-01-01',
  ...overrides,
});

function register(body) {
  return request(app)
    .post('/api/v1/auth/register')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

function resetPassword(body) {
  return request(app)
    .post('/api/v1/auth/reset-password')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

describe('Password complexity ASVS L1 (Equoria-ie4wc)', () => {
  describe('POST /api/v1/auth/register', () => {
    it("SENTINEL: 'Password1' (9 chars, 3 classes, no special) is REJECTED with 400", async () => {
      const res = await register(validBody({ password: 'Password1' }));
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/12|between 12 and 128|special character|lowercase/i);
    });

    it("SENTINEL: 'Password1!' (10 chars, 4 classes) is REJECTED on LENGTH (was 8-char floor)", async () => {
      const res = await register(validBody({ password: 'Password1!' }));
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/between 12 and 128|12 char|length/i);
    });

    it("'Aa1!Aa1!Aa1!' (12 chars, 4 classes) PASSES validation", async () => {
      // Use a unique payload to avoid clashing with an existing test user.
      const body = validBody({ password: 'Aa1!Aa1!Aa1!' });
      const res = await register(body);
      // We accept either 201 (created) or 400 with a NON-password validation
      // error (e.g. username/email collision). The CRITICAL assertion is
      // that no password-related error appears.
      expect([200, 201, 400].includes(res.status)).toBe(true);
      if (res.status === 400) {
        const blob = JSON.stringify(res.body);
        expect(blob).not.toMatch(/12 and 128|special character|lowercase letter, one uppercase/i);
      }
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it("SENTINEL: newPassword 'Password1' (3 classes, < 12 chars) is REJECTED with 400", async () => {
      const res = await resetPassword({
        token: 'a'.repeat(64),
        newPassword: 'Password1',
      });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/12|special character|lowercase letter, one uppercase/i);
    });

    it("SENTINEL: password 'Welcome2024' (3 classes, 11 chars) is REJECTED with 400", async () => {
      const res = await resetPassword({
        token: 'a'.repeat(64),
        password: 'Welcome2024',
      });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/12|special character|lowercase letter, one uppercase/i);
    });
  });
});
