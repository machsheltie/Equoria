/**
 * 🔒 INTEGRATION TESTS: errorRequestLogger redacts credentials from logged
 * request fields (21R-OBS-2, Equoria-2ns5).
 *
 * Pre-21R-OBS-1 (commit 1b828fd4 in this branch), the Winston printf
 * format silently dropped every metadata field, which accidentally
 * masked an unsanitised credential exposure in
 * `backend/middleware/requestLogger.mjs:46-57`. The errorRequestLogger
 * passes `body: req.body`, `query: req.query`, `params: req.params` as
 * metadata to logger.error on every failed request — so once OBS-1
 * preserves metadata, every failed /auth/login, /auth/register,
 * /auth/reset-password, /auth/change-password writes plaintext password,
 * refresh tokens, reset tokens, etc. to stdout / SIEM / log files.
 * GDPR / PCI-DSS class incident waiting on the next 5xx.
 *
 * This test captures REAL transport output (a winston Stream transport
 * with a Node Writable that pushes formatted lines into an in-memory
 * array). NOT jest.spyOn — the spy approach captures the API call before
 * the format chain runs, so it's structurally incapable of detecting
 * what reaches the log transport. The same lesson 21R-OBS-1 surfaced.
 *
 * Acceptance criteria for Equoria-2ns5:
 *   - The captured log line does NOT contain the credential VALUE.
 *   - The captured log line DOES contain '[REDACTED]' for every
 *     redacted key.
 *   - Non-sensitive keys (email, userAgent, ip, etc.) are preserved.
 *   - Redaction matches keys EXACTLY (case-insensitive), not by
 *     substring — `authorizationStatus` and `tokenization` are NOT
 *     redacted; `Authorization` and `Token` ARE.
 *   - Redaction recurses into nested objects (body.user.password is
 *     redacted even when nested) and arrays of objects.
 *   - The fix does not crash on null/undefined/primitive inputs.
 *
 * @module __tests__/middleware/requestLogger-redaction
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Writable } from 'stream';
import winston from 'winston';
import logger from '../../utils/logger.mjs';
import { errorRequestLogger } from '../../middleware/requestLogger.mjs';

describe('errorRequestLogger redaction (21R-OBS-2)', () => {
  let capturedLines;
  let captureTransport;

  beforeEach(() => {
    capturedLines = [];
    const captureStream = new Writable({
      write(chunk, _encoding, callback) {
        capturedLines.push(chunk.toString().replace(/\n$/, ''));
        callback();
      },
    });
    captureTransport = new winston.transports.Stream({ stream: captureStream });
    logger.add(captureTransport);
  });

  afterEach(() => {
    logger.remove(captureTransport);
  });

  // Build a stub Express request shaped like what the real middleware
  // chain hands to errorRequestLogger.
  const buildReq = (body = {}, query = {}, params = {}) => ({
    method: 'POST',
    originalUrl: '/api/v1/auth/login',
    ip: '203.0.113.42',
    user: undefined,
    body,
    query,
    params,
    get: header => {
      if (header === 'User-Agent') {
        return 'curl/8.0';
      }
      return undefined;
    },
  });

  // Helper: pull the JSON metadata suffix out of the captured log line.
  // The Winston format chain may pad the formatted line with trailing
  // whitespace (uncolorize / color-stripping artifacts), so we trim
  // before matching the trailing JSON object.
  const metaSuffixOf = line => {
    const match = line.trimEnd().match(/\{.*\}$/);
    return match ? match[0] : '';
  };

  describe('top-level body credentials must be redacted', () => {
    const SENSITIVE_FIELDS = [
      ['password', 'PROOF-OF-EXPOSURE-pwd'],
      ['newPassword', 'PROOF-OF-EXPOSURE-newpwd'],
      ['oldPassword', 'PROOF-OF-EXPOSURE-oldpwd'],
      ['currentPassword', 'PROOF-OF-EXPOSURE-curpwd'],
      ['token', 'PROOF-OF-EXPOSURE-token'],
      ['refreshToken', 'PROOF-OF-EXPOSURE-rtoken'],
      ['accessToken', 'PROOF-OF-EXPOSURE-atoken'],
      ['csrfToken', 'PROOF-OF-EXPOSURE-csrftoken'],
      ['jwt', 'PROOF-OF-EXPOSURE-jwt'],
      ['authorization', 'PROOF-OF-EXPOSURE-auth'],
      ['cookie', 'PROOF-OF-EXPOSURE-cookie'],
      ['secret', 'PROOF-OF-EXPOSURE-secret'],
      ['apiKey', 'PROOF-OF-EXPOSURE-apikey'],
      ['privateKey', 'PROOF-OF-EXPOSURE-privkey'],
      ['creditCard', 'PROOF-OF-EXPOSURE-ccard'],
      ['ssn', 'PROOF-OF-EXPOSURE-ssn'],
    ];

    SENSITIVE_FIELDS.forEach(([fieldName, sentinelValue]) => {
      it(`redacts top-level body.${fieldName}`, () => {
        const req = buildReq({ email: 'user@example.com', [fieldName]: sentinelValue });
        const err = new Error('validation failed');

        errorRequestLogger(err, req, {}, () => {});

        expect(capturedLines).toHaveLength(1);
        const line = capturedLines[0];
        expect(line).not.toContain(sentinelValue);
        expect(line).toContain('[REDACTED]');
        // Non-sensitive field still emitted.
        expect(line).toContain('"email":"user@example.com"');
      });
    });
  });

  describe('case-insensitive key matching', () => {
    it('redacts Password, REFRESHTOKEN, and Authorization (case variants)', () => {
      const req = buildReq({
        Password: 'PROOF-uppercase-P',
        REFRESHTOKEN: 'PROOF-allcaps',
        Authorization: 'Bearer PROOF-mixed',
      });

      errorRequestLogger(new Error('test'), req, {}, () => {});

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      expect(line).not.toContain('PROOF-uppercase-P');
      expect(line).not.toContain('PROOF-allcaps');
      expect(line).not.toContain('PROOF-mixed');
    });

    it('does NOT redact substring matches (authorizationStatus, tokenization)', () => {
      // The legacy auditLog sanitizer used `includes()` matching which
      // over-redacts. THIS redactor must use exact-key (case-insensitive)
      // matching — `authorization` is sensitive, but `authorizationStatus`
      // is a different field name.
      const req = buildReq({
        authorizationStatus: 'pending-not-sensitive',
        tokenization: 'enabled-not-sensitive',
        passwordPolicy: 'min8-not-sensitive',
      });

      errorRequestLogger(new Error('test'), req, {}, () => {});

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      expect(line).toContain('"authorizationStatus":"pending-not-sensitive"');
      expect(line).toContain('"tokenization":"enabled-not-sensitive"');
      expect(line).toContain('"passwordPolicy":"min8-not-sensitive"');
    });
  });

  describe('recursive redaction', () => {
    it('redacts password nested inside an object (body.user.password)', () => {
      const req = buildReq({
        user: {
          email: 'nested@example.com',
          password: 'PROOF-nested-pwd',
        },
      });

      errorRequestLogger(new Error('nested validation'), req, {}, () => {});

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      expect(line).not.toContain('PROOF-nested-pwd');
      expect(line).toContain('[REDACTED]');
      expect(line).toContain('"email":"nested@example.com"');
    });

    it('redacts tokens inside arrays of objects', () => {
      const req = buildReq({
        sessions: [
          { id: 1, token: 'PROOF-arr-token-1' },
          { id: 2, token: 'PROOF-arr-token-2' },
        ],
      });

      errorRequestLogger(new Error('test'), req, {}, () => {});

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      expect(line).not.toContain('PROOF-arr-token-1');
      expect(line).not.toContain('PROOF-arr-token-2');
      expect(line).toContain('"id":1');
      expect(line).toContain('"id":2');
    });

    it('redacts deeply nested credentials (3+ levels)', () => {
      const req = buildReq({
        wrapper: {
          inner: {
            deep: {
              password: 'PROOF-deep-pwd',
              ok: 'value',
            },
          },
        },
      });

      errorRequestLogger(new Error('test'), req, {}, () => {});

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      expect(line).not.toContain('PROOF-deep-pwd');
      expect(line).toContain('"ok":"value"');
    });
  });

  describe('redaction also applies to query and params', () => {
    it('redacts ?token= in the query string portion of the log', () => {
      const req = buildReq({}, { token: 'PROOF-query-token', page: 1 });

      errorRequestLogger(new Error('test'), req, {}, () => {});

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      expect(line).not.toContain('PROOF-query-token');
      expect(line).toContain('"page":1');
    });

    it('redacts /:secret/ in the params', () => {
      const req = buildReq({}, {}, { secret: 'PROOF-param-secret', id: 'h-42' });

      errorRequestLogger(new Error('test'), req, {}, () => {});

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      expect(line).not.toContain('PROOF-param-secret');
      expect(line).toContain('"id":"h-42"');
    });
  });

  describe('robustness — does not crash on edge inputs', () => {
    it('handles req.body === undefined', () => {
      const req = buildReq();
      delete req.body;

      expect(() => {
        errorRequestLogger(new Error('test'), req, {}, () => {});
      }).not.toThrow();
      expect(capturedLines).toHaveLength(1);
    });

    it('handles req.body === null', () => {
      const req = buildReq();
      req.body = null;

      expect(() => {
        errorRequestLogger(new Error('test'), req, {}, () => {});
      }).not.toThrow();
      expect(capturedLines).toHaveLength(1);
    });

    it('handles req.body as a primitive (e.g. string body)', () => {
      const req = buildReq();
      req.body = 'a raw string body';

      expect(() => {
        errorRequestLogger(new Error('test'), req, {}, () => {});
      }).not.toThrow();
      expect(capturedLines).toHaveLength(1);
    });
  });

  describe('snake_case and kebab-case variants must redact (iteration-2)', () => {
    // The REDACTED_KEYS set contains camelCase entries (e.g., accesstoken
    // is the lowercase form of accessToken). Many real-world clients —
    // OAuth2 (RFC 6749) reference implementations, mobile SDKs, third-party
    // webhooks — send snake_case body fields like access_token, refresh_token,
    // password_hash, csrf_token. A naive `key.toLowerCase()` Set lookup misses
    // these (underscores are preserved by toLowerCase). The redactor MUST
    // normalise the key (strip non-alphanumerics) before lookup so the same
    // semantic field is redacted regardless of casing convention.

    const SNAKE_CASE_FIELDS = [
      ['access_token', 'PROOF-snake-access-token'],
      ['refresh_token', 'PROOF-snake-refresh-token'],
      ['csrf_token', 'PROOF-snake-csrf'],
      ['new_password', 'PROOF-snake-new-pwd'],
      ['old_password', 'PROOF-snake-old-pwd'],
      ['current_password', 'PROOF-snake-cur-pwd'],
      ['api_key', 'PROOF-snake-apikey'],
      ['private_key', 'PROOF-snake-privkey'],
      ['credit_card', 'PROOF-snake-card'],
    ];

    SNAKE_CASE_FIELDS.forEach(([fieldName, sentinelValue]) => {
      it(`redacts top-level body.${fieldName} (snake_case variant of camelCase entry)`, () => {
        const req = buildReq({ email: 'user@example.com', [fieldName]: sentinelValue });

        errorRequestLogger(new Error('test'), req, {}, () => {});

        expect(capturedLines).toHaveLength(1);
        const line = capturedLines[0];
        expect(line).not.toContain(sentinelValue);
        expect(line).toContain('[REDACTED]');
        expect(line).toContain('"email":"user@example.com"');
      });
    });

    it('redacts kebab-case variant (header-style key shape)', () => {
      // If a body parser ever produces hyphenated keys (e.g., from a
      // form field named with dashes), the redactor must still match.
      const req = buildReq({ 'csrf-token': 'PROOF-kebab-csrf' });

      errorRequestLogger(new Error('test'), req, {}, () => {});

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      expect(line).not.toContain('PROOF-kebab-csrf');
      expect(line).toContain('[REDACTED]');
    });

    it('still does NOT over-redact substring matches — passwordPolicy / tokenization / authorizationStatus stay visible', () => {
      // Sanity guard: the normalisation must not start matching by substring.
      // After stripping non-alphanumerics, `passwordpolicy` is still NOT in
      // the set (the set has `password` but NOT `passwordpolicy`).
      const req = buildReq({
        passwordPolicy: 'min8-not-sensitive',
        tokenization: 'enabled-not-sensitive',
        authorizationStatus: 'pending-not-sensitive',
      });

      errorRequestLogger(new Error('test'), req, {}, () => {});

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      expect(line).toContain('"passwordPolicy":"min8-not-sensitive"');
      expect(line).toContain('"tokenization":"enabled-not-sensitive"');
      expect(line).toContain('"authorizationStatus":"pending-not-sensitive"');
      expect(line).not.toContain('[REDACTED]');
    });
  });

  describe('idempotence and non-mutation contracts (iteration-2)', () => {
    it('does NOT mutate req.body — the original object is unchanged after the call', () => {
      const originalBody = { email: 'u@x.y', password: 'PROOF-mutation-test' };
      const req = buildReq(originalBody);
      // Capture a snapshot via JSON-roundtrip BEFORE the call to compare
      // against AFTER. Direct equality wouldn't catch nested mutation.
      const before = JSON.parse(JSON.stringify(originalBody));

      errorRequestLogger(new Error('test'), req, {}, () => {});

      expect(req.body).toEqual(before);
      // Specifically: req.body.password is still the sentinel, not '[REDACTED]'.
      expect(req.body.password).toBe('PROOF-mutation-test');
    });

    it('does NOT mutate nested req.body properties', () => {
      const req = buildReq({
        user: { email: 'u@x.y', password: 'PROOF-nested-mutation' },
      });
      const before = JSON.parse(JSON.stringify(req.body));

      errorRequestLogger(new Error('test'), req, {}, () => {});

      expect(req.body).toEqual(before);
      expect(req.body.user.password).toBe('PROOF-nested-mutation');
    });

    it('redaction-marker collision: a user-supplied "[REDACTED]" non-sensitive value is preserved verbatim', () => {
      // Edge case: a caller sets `notes: '[REDACTED]'` literally. After
      // redaction, the log line should contain the marker exactly once
      // (from the `notes` field, not because we redacted anything).
      const req = buildReq({ notes: '[REDACTED]', email: 'u@x.y' });

      errorRequestLogger(new Error('test'), req, {}, () => {});

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      // Match the JSON-encoded form of the user's literal string.
      expect(line).toContain('"notes":"[REDACTED]"');
      expect(line).toContain('"email":"u@x.y"');
    });
  });

  describe('non-credential fields are preserved unchanged', () => {
    it('preserves method, url, ip, userAgent, error.message, stack, userId', () => {
      const req = buildReq({ password: 'redact-me' });
      req.user = { id: 'u-1234' };
      const err = new Error('login failed');

      errorRequestLogger(err, req, {}, () => {});

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      const meta = metaSuffixOf(line);
      // Non-credential fields all present.
      expect(meta).toContain('"method":"POST"');
      expect(meta).toContain('"url":"/api/v1/auth/login"');
      expect(meta).toContain('"ip":"203.0.113.42"');
      expect(meta).toContain('"userAgent":"curl/8.0"');
      expect(meta).toContain('"error":"login failed"');
      expect(meta).toContain('"userId":"u-1234"');
      expect(meta).toContain('"stack":');
      // Credential redacted.
      expect(meta).not.toContain('redact-me');
    });
  });
});
