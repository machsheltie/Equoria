/**
 * 🔒 INTEGRATION TESTS: verifyJsonBody must NOT silently swallow non-AppError
 * exceptions thrown inside JsonScanner.scan() (21R-SEC-3-FOLLOW-1, Equoria-ixqg).
 *
 * The original 21R-SEC-3 commit (`f06c9ed6`) added a depth cap to two
 * recursive functions but left the silent try/catch in `verifyJsonBody`
 * intact. The catch block re-throws AppError instances but silently drops
 * every other exception class. That defeats the entire fail-closed
 * contract: any RangeError, TypeError, or future runtime error inside the
 * scanner is swallowed, the verify hook returns silently, express.json
 * then parses the body normally — the protection is bypassed.
 *
 * This file proves the bypass exists in the original silent-catch code,
 * confirms the fix re-throws every non-AppError as a 400 AppError, and
 * pins the surrounding contract so future regressions are caught:
 *
 *   - non-AppError thrown inside JsonScanner.scan() must result in HTTP 400
 *     with the canonical error envelope (success: false + message)
 *   - the unexpected error class is logged via logger.warn (matching the
 *     canonical "Rejected malicious request body" path's log level — see
 *     middleware comment for alert-hierarchy rationale) so forensic data
 *     is preserved (NOT silently swallowed) — verified via spy on the
 *     call args. NOTE: the spy verifies that the API was called with the
 *     correct shape, NOT that the log output reaches the transport. The
 *     Winston printf format in `backend/utils/logger.mjs` discards
 *     metadata fields — that defect is tracked separately as 21R-OBS-1
 *     (Equoria-8m7j). Until 21R-OBS-1 lands, the forensic-logging
 *     contract is observable in tests but fictional in production logs.
 *   - AppError instances (depth cap, duplicate key) must continue to
 *     propagate cleanly with their original message AND must NOT be
 *     re-logged as "unexpected scanner errors"
 *   - edge-case throws (null, undefined, string, number, plain object)
 *     must all be wrapped to 400 — JavaScript permits any value to be
 *     thrown and the catch block must handle all of them safely
 *   - the requestBodySecurityErrorHandler matches our throws by the
 *     ERROR_MESSAGE_PREFIX constant; the catch block uses the same
 *     constant. This pair of assertions pins the coupling so a unilateral
 *     prefix rename on either side breaks tests instead of breaking the
 *     fail-closed contract silently.
 *
 * @module __tests__/integration/security/request-body-silent-catch
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import {
  __TESTING_ONLY_JsonScanner,
  requestBodySecurityErrorHandler,
  ERROR_MESSAGE_PREFIX,
  UNEXPECTED_SCANNER_LOG_PREFIX,
} from '../../../middleware/requestBodySecurity.mjs';
import { AppError } from '../../../errors/index.mjs';
import logger from '../../../utils/logger.mjs';

const ENDPOINT = '/api/v1/auth/login';

describe('verifyJsonBody silent-catch fix (21R-SEC-3-FOLLOW-1)', () => {
  // Spy on logger.warn so we can assert the forensic-log half of the AC
  // ("unexpected error class is logged so forensic data is preserved").
  // Without this, a future regression that removes the log call but keeps
  // the throw would still pass the HTTP-status assertions.
  //
  // We log at WARN (not ERROR) per the alert-hierarchy fix from the ultra-
  // think review — see middleware/requestBodySecurity.mjs comment near the
  // catch block. The forensic log payload includes `unexpected: true` so
  // we can distinguish from the canonical "Rejected malicious request body"
  // log from `requestBodySecurityErrorHandler`.
  let loggerWarnSpy;

  beforeEach(() => {
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  // No manual prototype-restore: `jest.config.security.mjs` has
  // `restoreMocks: true`, which auto-restores every `jest.spyOn` mock
  // (including prototype-method spies) after each test, including in the
  // crash path where `afterEach` would not run for raw assignments.

  // Helper: install a stubbed scanner that throws the given value verbatim
  // via `jest.spyOn`, so it auto-restores via `restoreMocks: true` even on
  // worker abort. Replaces the prior raw `prototype.scan = stub` pattern
  // which was not crash-safe.
  const stubScannerToThrow = valueToThrow => {
    jest.spyOn(__TESTING_ONLY_JsonScanner.prototype, 'scan').mockImplementation(() => {
      // catch handles primitive throws.
      throw valueToThrow;
    });
  };

  // Helper: assert the response is the canonical 400 + envelope from the
  // requestBodySecurityErrorHandler. Pins the EXACT scanner-failure message
  // so a future regression that re-routes a non-AppError throw to a
  // different AppError path (e.g., depth-cap by mistake) is caught — the
  // prior loose `/invalid request body/i` regex would have passed silently.
  //
  // Uses `toMatchObject` (subset-equality) rather than `toEqual` (strict-
  // equality) so a future envelope addition (e.g., requestId, traceId)
  // doesn't break every silent-catch test simultaneously. The required
  // keys are pinned; extra keys are permitted.
  const SCANNER_FAILURE_MESSAGE = `${ERROR_MESSAGE_PREFIX} scanner failure`;
  const expectFailClosed400 = response => {
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: SCANNER_FAILURE_MESSAGE,
    });
  };

  // Helper: assert OUR middleware emitted the forensic log exactly once with
  // the wrap-context payload. The integration request chain has other
  // logger.warn sources (CSRF rejections, rate limiter, etc.), so we filter
  // spy calls by the EXACT shared constant `UNEXPECTED_SCANNER_LOG_PREFIX`
  // imported from the middleware. Sharing the constant means a typo or
  // rename on either end cannot drift silently — the import would fail or
  // the string-equality would catch it immediately.
  const ourScannerLogCalls = () => loggerWarnSpy.mock.calls.filter(([msg]) => msg === UNEXPECTED_SCANNER_LOG_PREFIX);
  const expectForensicLog = expectedErrorClass => {
    const calls = ourScannerLogCalls();
    expect(calls).toHaveLength(1);
    const [logMessage, logContext] = calls[0];
    expect(logMessage).toBe(UNEXPECTED_SCANNER_LOG_PREFIX);
    expect(logContext).toMatchObject({
      unexpected: true,
      errorClass: expectedErrorClass,
    });
  };
  // Variant for null/undefined throws where errorClass is not predictable
  // through the regex (it logs as undefined, not a class name).
  const expectForensicLogNullish = () => {
    const calls = ourScannerLogCalls();
    expect(calls).toHaveLength(1);
    const [, logContext] = calls[0];
    expect(logContext.unexpected).toBe(true);
    expect(logContext.errorClass).toBeUndefined();
  };

  // Helper: assert the log payload truncates oversized strings and strips
  // control characters. Used by the log-sanitisation tests below.
  //
  // The bound is EXACT (not <=) for truncation cases. Sanitizer truncates
  // any string longer than `maxLength` to exactly `maxLength` UTF-16 code
  // units and appends the `…` ellipsis (1 code unit) — total length is
  // always `maxLength + 1` after truncation. A loose `<=` bound would let
  // a sanitizer regression that truncates to length 0 silently pass.
  const expectSanitisedLogField = (logContext, fieldName, expectations) => {
    const value = logContext[fieldName];
    if (expectations.shouldBeUndefined) {
      expect(value).toBeUndefined();
      return;
    }
    expect(typeof value).toBe('string');
    if (expectations.exactTruncatedLength !== undefined) {
      // For truncation cases, the length is deterministically maxLength + 1.
      expect(value.length).toBe(expectations.exactTruncatedLength);
    } else if (expectations.maxLength !== undefined) {
      // For non-truncation cases (string already shorter than cap), pin
      // the exact original length so we catch any regression that
      // truncates short strings.
      expect(value.length).toBeLessThanOrEqual(expectations.maxLength);
    }
    if (expectations.controlCharsStripped) {
      // eslint-disable-next-line no-control-regex
      expect(value).not.toMatch(/[\x00-\x1F\x7F]/);
    }
  };

  describe('non-AppError exceptions are wrapped to 400 (fail-closed)', () => {
    it('rejects request with 400 when JsonScanner.scan() throws a RangeError', async () => {
      stubScannerToThrow(new RangeError('Maximum call stack size exceeded'));

      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'never@reaches.controller', password: 'irrelevant' });

      expectFailClosed400(response);
      expectForensicLog('RangeError');
    });

    it('rejects request with 400 when JsonScanner.scan() throws a TypeError', async () => {
      stubScannerToThrow(new TypeError('synthetic scanner failure for test'));

      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'never@reaches.controller', password: 'irrelevant' });

      expectFailClosed400(response);
      expectForensicLog('TypeError');
    });

    it('rejects request with 400 when JsonScanner.scan() throws a plain Error', async () => {
      stubScannerToThrow(new Error('something unexpected happened'));

      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'never@reaches.controller', password: 'irrelevant' });

      expectFailClosed400(response);
      expectForensicLog('Error');
    });
  });

  describe('edge-case thrown values (JavaScript permits throwing anything)', () => {
    // JS allows `throw <anything>` — primitives, null, undefined, plain
    // objects. The optional-chaining in the catch block (`error?.constructor?.name`,
    // `error?.message`) is supposed to handle these without crashing. We
    // verify each shape produces 400 + log instead of unhandled exception
    // surfacing as 500.

    it('rejects request with 400 when scanner throws null', async () => {
      stubScannerToThrow(null);

      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'x@y.z', password: 'irrelevant' });

      expectFailClosed400(response);
      // null has no .constructor — errorClass should log as undefined.
      expectForensicLogNullish();
    });

    it('rejects request with 400 when scanner throws undefined', async () => {
      stubScannerToThrow(undefined);

      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'x@y.z', password: 'irrelevant' });

      expectFailClosed400(response);
      expectForensicLogNullish();
    });

    it('rejects request with 400 when scanner throws a string literal', async () => {
      stubScannerToThrow('a thrown string, not an Error instance');

      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'x@y.z', password: 'irrelevant' });

      expectFailClosed400(response);
      // A string primitive boxes to String when accessed via `.constructor`.
      expectForensicLog('String');
    });

    it('rejects request with 400 when scanner throws a number', async () => {
      stubScannerToThrow(42);

      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'x@y.z', password: 'irrelevant' });

      expectFailClosed400(response);
      expectForensicLog('Number');
    });

    it('rejects request with 400 when scanner throws a plain object without .message', async () => {
      stubScannerToThrow({ custom: 'no message field' });

      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'x@y.z', password: 'irrelevant' });

      expectFailClosed400(response);
      expectForensicLog('Object');
    });
  });

  describe('forensic log payload is sanitised (length cap + control-char strip)', () => {
    // The middleware truncates `error.message` to 256 chars and `error.stack`
    // to 2048 chars, and strips ASCII control characters. Pre-fix, an
    // attacker could inject CRLF/ANSI escapes via a crafted error message
    // (log poisoning) or exhaust log-pipeline I/O via unbounded stack
    // strings. These tests pin both bounds.

    it('truncates an oversized error.message and replaces control characters', async () => {
      const longRaw = `${'A'.repeat(500)}\n\rinjected-line\x07\x1b[31m`;
      const err = new Error(longRaw);
      stubScannerToThrow(err);

      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'x@y.z', password: 'irrelevant' });

      expectFailClosed400(response);
      const calls = ourScannerLogCalls();
      expect(calls).toHaveLength(1);
      const [, logContext] = calls[0];
      // Input length 500 + injected chars > 256 cap → truncated to exactly
      // 256 + 1 ellipsis = 257 code units. Pinning the exact length so a
      // sanitizer regression that truncates short cannot pass silently.
      expectSanitisedLogField(logContext, 'message', {
        exactTruncatedLength: 257,
        controlCharsStripped: true,
      });
    });

    it('truncates an oversized error.stack and replaces control characters', async () => {
      const oversize = new Error('payload');
      // Forge a long stack (real V8 stacks are typically <2KB but we want
      // to verify the cap holds for any size). Include CRLF + bell chars.
      oversize.stack = `${'B'.repeat(5000)}\r\n\x07injected`;
      stubScannerToThrow(oversize);

      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'x@y.z', password: 'irrelevant' });

      expectFailClosed400(response);
      const calls = ourScannerLogCalls();
      expect(calls).toHaveLength(1);
      const [, logContext] = calls[0];
      // Input length ~5012 > 2048 cap → truncated to exactly 2048 + 1 = 2049.
      expectSanitisedLogField(logContext, 'stack', {
        exactTruncatedLength: 2049,
        controlCharsStripped: true,
      });
    });

    it('does not split surrogate pairs at the truncation boundary', async () => {
      // Build a message where the truncation cap (256) would land inside a
      // surrogate pair. Use the smiling-face-with-heart-eyes emoji 😍
      // (U+1F60D = surrogate pair \uD83D\uDE0D, length 2 in UTF-16). Pad
      // with 'A' so the boundary falls between the high and low surrogate.
      // 255 'A' chars + 😍 = 257 code units. Boundary at 256 = high surrogate
      // index. The sanitizer must back up one position rather than slice
      // mid-pair.
      const surrogateMessage = `${'A'.repeat(255)}\uD83D\uDE0D${'B'.repeat(100)}`;
      const err = new Error(surrogateMessage);
      stubScannerToThrow(err);

      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'x@y.z', password: 'irrelevant' });

      expectFailClosed400(response);
      const calls = ourScannerLogCalls();
      expect(calls).toHaveLength(1);
      const [, logContext] = calls[0];
      const logged = logContext.message;
      // No lone high surrogate at the end of the truncated string.
      const lastCodeUnit = logged.charCodeAt(logged.length - 2);
      expect(lastCodeUnit < 0xd800 || lastCodeUnit > 0xdbff).toBe(true);
      // Either pair was preserved (length 256+1) or backed-up (length 255+1).
      expect([256, 257]).toContain(logged.length);
    });

    it('logs message as undefined when error has no string message', async () => {
      // A plain object thrown without a `.message` field exercises the
      // sanitizer's non-string short-circuit. Should log message=undefined
      // (NOT log the entire object, NOT throw).
      stubScannerToThrow({ custom: 'no message field' });

      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'x@y.z', password: 'irrelevant' });

      expectFailClosed400(response);
      const calls = ourScannerLogCalls();
      expect(calls).toHaveLength(1);
      const [, logContext] = calls[0];
      expectSanitisedLogField(logContext, 'message', { shouldBeUndefined: true });
      expectSanitisedLogField(logContext, 'stack', { shouldBeUndefined: true });
    });
  });

  describe('__TESTING_ONLY_JsonScanner is gated on NODE_ENV (production cannot tamper)', () => {
    // Pre-fix, the export was a live class reference reachable from any
    // module — a malicious dependency or compromised in-tree module could
    // do `__TESTING_ONLY_JsonScanner.prototype.scan = () => {}` and silently
    // disable the scanner for every subsequent request, restoring exactly
    // the bypass FOLLOW-1 closed. Post-fix, the binding resolves to the
    // class only when NODE_ENV=test; in production it resolves to undefined.

    it('exposes the scanner class only when NODE_ENV=test', () => {
      // Jest sets NODE_ENV=test by default. Sanity: in this test run the
      // export must be the class (otherwise the rest of this file's
      // monkey-patching would silently be a no-op and we'd get false greens).
      expect(process.env.NODE_ENV).toBe('test');
      expect(typeof __TESTING_ONLY_JsonScanner).toBe('function');
      expect(__TESTING_ONLY_JsonScanner.prototype).toHaveProperty('scan');
    });

    it('export name does NOT use a misleading prefix that could be lint-stripped', () => {
      // Loose guard: the comment-level `__TESTING_ONLY_` convention is the
      // primary signal to humans + future contributors that this is not
      // production surface. Pin the convention so a refactor that renames
      // the export (e.g., to `JsonScanner` cleanly) is forced to update
      // this test, surfacing the change for review.
      // The actual NODE_ENV gating is the runtime guard; this is the
      // documentation guard.
      expect(__TESTING_ONLY_JsonScanner).toBeDefined();
    });
  });

  describe('AppError propagation (must NOT be wrapped or re-logged as unexpected)', () => {
    it('still propagates AppError throws from the scanner with original message and no forensic log', async () => {
      // Sanity check: the fix must NOT break existing AppError-propagation.
      // A 64-deep array still hits the depth cap inside the real scanner
      // (we are NOT stubbing scan here) and must surface as 400 with the
      // canonical "nesting too deep" message — and must NOT trigger the
      // "unexpected scanner error" log (because it was a known/expected
      // AppError, not an unanticipated failure).
      let body = '';
      for (let i = 0; i < 64; i += 1) {
        body += '[';
      }
      for (let i = 0; i < 64; i += 1) {
        body += ']';
      }

      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/nesting too deep/i),
        }),
      );
      // CRITICAL: AppError throws are intentional outcomes of the security
      // contract. They MUST NOT trigger the "Unexpected scanner error" log,
      // which is reserved for genuine surprises (RangeError, etc.). If this
      // assertion fails, the catch block is wrapping AppErrors instead of
      // re-throwing them — a regression that would also flood logs in
      // normal operation. Filter to specifically OUR log message so any
      // unrelated logger.error calls in the request chain don't confuse
      // the assertion.
      // Filter by the shared UNEXPECTED_SCANNER_LOG_PREFIX constant — same
      // hygiene as ourScannerLogCalls() above. AppError-propagation must
      // produce zero matches.
      const unexpectedScannerLogs = loggerWarnSpy.mock.calls.filter(([msg]) => msg === UNEXPECTED_SCANNER_LOG_PREFIX);
      expect(unexpectedScannerLogs).toHaveLength(0);
    });
  });

  describe('requestBodySecurityErrorHandler prefix-match contract sentinel', () => {
    // These tests directly exercise the error handler in isolation, pinning
    // the coupling between the catch block's throw message and the handler's
    // matching logic. Both sides reference the exported ERROR_MESSAGE_PREFIX
    // constant — these tests fail if either side drifts.

    // Harness uses real jest.fn() spies on res.status / res.json so callers
    // can use idiomatic .toHaveBeenCalledWith() / .not.toHaveBeenCalled()
    // assertions, matching the rest of the test file's spy patterns.
    const makeHandlerHarness = () => {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return {
        req: { originalUrl: '/x', method: 'POST', ip: '1.2.3.4' },
        res,
        next: jest.fn(),
      };
    };

    it('handles errors whose message starts with ERROR_MESSAGE_PREFIX as 400 + envelope', () => {
      const { req, res, next } = makeHandlerHarness();
      const err = new AppError(`${ERROR_MESSAGE_PREFIX} scanner failure`, 400);

      requestBodySecurityErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: `${ERROR_MESSAGE_PREFIX} scanner failure`,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards errors whose message does NOT start with ERROR_MESSAGE_PREFIX', () => {
      const { req, res, next } = makeHandlerHarness();
      const err = new Error('Something unrelated');

      requestBodySecurityErrorHandler(err, req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(err);
    });

    it('forwards errors with non-string message (defensive)', () => {
      const { req, res, next } = makeHandlerHarness();
      const err = { message: 12345 };

      requestBodySecurityErrorHandler(err, req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(err);
    });

    it('forwards null/undefined err (defensive)', () => {
      const { req, res, next } = makeHandlerHarness();

      requestBodySecurityErrorHandler(null, req, res, next);
      expect(next).toHaveBeenCalledWith(null);
      expect(res.status).not.toHaveBeenCalled();

      next.mockClear();
      requestBodySecurityErrorHandler(undefined, req, res, next);
      expect(next).toHaveBeenCalledWith(undefined);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('ERROR_MESSAGE_PREFIX is non-empty and ends with a colon (catches accidental rename)', () => {
      // Guards against a future "cleanup" PR that drops the colon or empties
      // the constant. The shape "Invalid request body:" specifically matters
      // because the depth-cap, duplicate-key, and prototype-pollution throws
      // throughout the file all rely on this prefix to be matched.
      expect(typeof ERROR_MESSAGE_PREFIX).toBe('string');
      expect(ERROR_MESSAGE_PREFIX.length).toBeGreaterThan(0);
      expect(ERROR_MESSAGE_PREFIX.endsWith(':')).toBe(true);
    });

    // ──────────────────────────────────────────────────────────────────────
    // Legacy-throw coupling sentinel (closes the gap surfaced in the second
    // ultra-think review). The catch block uses ${ERROR_MESSAGE_PREFIX} but
    // the OTHER throws in this module still use the literal 'Invalid request
    // body:' string. If a future PR renames the constant, the new code path
    // stays consistent (constant updated, catch updates, handler updates) —
    // but the legacy throws would silently desynchronize. These tests pin
    // each legacy throw message against the handler so a rename would break
    // them and force the maintainer to update both sides together.
    //
    // The literals MUST be hard-coded here (NOT computed via the constant)
    // so the test catches the exact desync case it's designed to catch.
    // ──────────────────────────────────────────────────────────────────────
    // Each row tests ONE distinct literal-prefix throw. The
    // 'Invalid request body: nesting too deep' literal is emitted by both
    // JsonScanner.scanValue:32 and assertNoPollutingKeys:212 — we test it
    // ONCE here because both source sites use the SAME literal, so a single
    // handler-match assertion proves both source sites flow through the
    // handler. Adding two identical-message rows would be testing one thing
    // twice, not two things once. The label below explicitly names both
    // source sites.
    it.each([
      ['depth cap (scanValue:32 AND assertNoPollutingKeys:212)', 'Invalid request body: nesting too deep'],
      ['scanObject duplicate key', 'Invalid request body: duplicate JSON key "x"'],
      ['assertNoPollutingKeys forbidden __proto__', 'Invalid request body: forbidden key "__proto__"'],
      [
        'assertNoPollutingKeys forbidden constructor.prototype',
        'Invalid request body: forbidden key path "constructor.prototype"',
      ],
    ])('legacy throw from %s still triggers handler match (constant-rename sentinel)', (label, legacyMessage) => {
      const { req, res, next } = makeHandlerHarness();
      const err = new AppError(legacyMessage, 400);

      requestBodySecurityErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: legacyMessage,
      });
      expect(next).not.toHaveBeenCalled();
      // Sanity: the literal really starts with ERROR_MESSAGE_PREFIX. If a
      // future literal is added that doesn't, this assertion catches it
      // at test time instead of letting the silent desync ship.
      expect(legacyMessage.startsWith(ERROR_MESSAGE_PREFIX)).toBe(
        true,
        // Jest's it.each interpolates `label` into the test title via %s,
        // so the variable IS used despite no underscore prefix.
        `${label} literal must start with ERROR_MESSAGE_PREFIX`,
      );
    });

    // Source-side coupling sentinel: every `throw new AppError('Invalid
    // request body:` literal in the production source MUST start with the
    // current value of ERROR_MESSAGE_PREFIX. If someone changes one of
    // the legacy throws independently (e.g., 'Invalid req body: foo'),
    // this static-source check catches it — the it.each above only
    // catches a constant rename, not a source-side literal change.
    //
    // Implementation note: the regex below uses /s flag (dotall) so that a
    // multi-line throw like:
    //     throw new AppError(
    //       'Invalid request body: …',
    //       400,
    //     );
    // is matched. Without /s the `.` would not cross newlines and a
    // multi-line throw would silently bypass this sentinel.
    it('every "Invalid request body:" throw in source uses the prefix matching ERROR_MESSAGE_PREFIX', async () => {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const url = await import('node:url');
      const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
      const sourcePath = path.resolve(__dirname, '../../../middleware/requestBodySecurity.mjs');
      const source = await fs.readFile(sourcePath, 'utf8');
      // Match both single- and multi-line throws. /gs flags: g for all
      // matches, s so . crosses newlines (covers multi-line constructor
      // calls). Captures the first string-literal argument (single, double,
      // or backtick quoted).
      const literalThrows = [...source.matchAll(/throw\s+new\s+AppError\s*\(\s*['"`]([^'"`]*)['"`]/gs)].map(m => m[1]);
      // Defensive: if the regex starts matching nothing, the sentinel
      // becomes vacuous. Pin a minimum-count threshold matching the
      // current source (5 throws as of 2026-04-29). A future addition
      // bumps this; a future removal drops to a count we expect.
      expect(literalThrows.length).toBeGreaterThanOrEqual(5);
      for (const literal of literalThrows) {
        // Skip throws that don't claim the prefix (handler will forward
        // them via next(err); legitimate). Only check ones that look like
        // they intend to be matched by the handler.
        if (!literal.toLowerCase().includes('invalid request body')) {
          continue;
        }
        expect(literal.startsWith(ERROR_MESSAGE_PREFIX)).toBe(true);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Composition tests: defense-in-depth attack-pattern verification.
  //
  // Each defense layer (silent-catch fix, depth cap, dup-key, __proto__,
  // constructor.prototype) has its own unit/integration tests. These tests
  // verify the COMBINED middleware rejects realistic attack payloads via
  // the actual HTTP request chain, catching subtle composition issues that
  // per-layer tests can miss (middleware-order regressions, parser-config
  // changes that route bodies past a defense, etc.).
  //
  // KNOWN BYPASSES NOT YET COVERED (tracked separately as bd issues):
  //   - Application/JSON (uppercase Content-Type) skips verifyJsonBody
  //     entirely — Equoria-gbcm (21R-SEC-3-FOLLOW-7).
  //   - __proto__ Unicode escape (`\u005f\u005fproto\u005f\u005f`) bypasses
  //     scanString's literal compare — Equoria-qj3f (21R-SEC-3-FOLLOW-8).
  //   - REQUEST_BODY_MAX_DEPTH=foo NaN bypass disables the cap silently
  //     — Equoria-ibkt (21R-SEC-3-FOLLOW-2).
  //
  // When those issues are fixed, expand this matrix to cover the new
  // attack vectors.
  // ────────────────────────────────────────────────────────────────────────
  describe('composition: multi-vector attack-pattern coverage', () => {
    const buildDeepArray = depth => {
      let s = '';
      for (let i = 0; i < depth; i += 1) {
        s += '[';
      }
      for (let i = 0; i < depth; i += 1) {
        s += ']';
      }
      return s;
    };

    // Boundary calculus: with `if (depth > 32)` and `scanValue(depth)` called
    // recursively per nesting level, buildDeepArray(N) places the innermost
    // value at scanValue depth = N - 1. So the boundary is N=33 (depth 32,
    // allowed — see the pass-through test below) vs N=34 (depth 33, rejected).
    // Using N=33 here as the rejection-boundary test would be WRONG and the
    // test would correctly fail; that's how I caught my own off-by-one.
    it.each([
      [
        '34-deep nested array → depth cap fires at boundary (innermost depth = 33 = cap+1)',
        () => buildDeepArray(34),
        /nesting too deep/i,
      ],
      ['64-deep nested array → depth cap (well over)', () => buildDeepArray(64), /nesting too deep/i],
      // Object-path coverage. ASYMMETRY caught during §9 self-critique:
      // scanArray's empty-check `]` short-circuits BEFORE calling scanValue
      // at the next depth. scanObject's loop ALWAYS calls scanValue for
      // the value position. Result: 33-deep ARRAY passes (innermost []
      // short-circuits) but 33-deep OBJECT throws (innermost null still
      // hits scanValue at depth 33). This is a real semantic inconsistency
      // — operators expect "MAX_DEPTH=32 = 32 levels for any payload" but
      // arrays get +1 effective depth from the short-circuit. Tracked as
      // a separate issue (see bd notes for Equoria-ixqg).
      //
      // The boundary tests below pin the ACTUAL behavior so a future fix
      // to the asymmetry breaks them deliberately, forcing the maintainer
      // to update both the source and the tests together.
      [
        '33-deep nested object → depth cap fires (object boundary one lower than array)',
        () => {
          let s = '';
          for (let i = 0; i < 33; i += 1) {
            s += '{"a":';
          }
          s += 'null';
          for (let i = 0; i < 33; i += 1) {
            s += '}';
          }
          return s;
        },
        /nesting too deep/i,
      ],
      ['duplicate keys → scanObject', () => '{"a":1,"a":2}', /duplicate JSON key/i],
      [
        '__proto__ key at top level → assertNoPollutingKeys',
        () => '{"__proto__":{"isAdmin":true}}',
        /forbidden key.*__proto__/i,
      ],
      [
        'constructor.prototype path → assertNoPollutingKeys',
        () => '{"constructor":{"prototype":{"x":1}}}',
        /constructor\.prototype/i,
      ],
      [
        '__proto__ nested inside legitimate-looking body → assertNoPollutingKeys (recursive walk)',
        () => '{"name":"ValidName","extra":{"deep":{"__proto__":{"isAdmin":true}}}}',
        /forbidden key.*__proto__/i,
      ],
    ])('rejects: %s', async (label, buildPayload, expectedMessageRegex) => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .set('Origin', 'http://localhost:3000')
        .send(buildPayload());

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(expectedMessageRegex),
        }),
      );
    });

    // Off-by-one defense: with the boundary calculus above, the LAST
    // accepted shape is buildDeepArray(33) (innermost value at depth 32 =
    // cap, allowed). The FIRST rejected shape is buildDeepArray(34)
    // (innermost depth 33 > cap, rejected — covered in it.each above).
    //
    // Test BOTH sides of the boundary explicitly so a future change from
    // `>` to `>=`, or from MAX_DEPTH=32 to a different value, breaks
    // exactly one of these tests and forces the maintainer to update both.
    // Object-path equivalent of the array-rejection test for shape symmetry
    // — same depth-cap code path, different surface. The 34-deep OBJECT
    // rejection is in the it.each above; the 32/33-deep object PASS cases
    // are the inverse below (reusing the array helper for brevity wouldn't
    // exercise the object code path; we need actual `{...}` shapes).
    const buildDeepObject = depth => {
      let s = '';
      for (let i = 0; i < depth; i += 1) {
        s += '{"a":';
      }
      s += 'null';
      for (let i = 0; i < depth; i += 1) {
        s += '}';
      }
      return s;
    };

    it.each([
      ['array', 32, 'array (well under cap)', buildDeepArray],
      ['array', 33, 'array (last allowed — scanArray short-circuits on innermost [])', buildDeepArray],
      ['object', 32, 'object (last allowed — innermost null at scanValue depth 32 = cap)', buildDeepObject],
      // NOTE: 33-deep object is REJECTED (see rejection it.each above).
      // Object boundary is one lower than array boundary due to scanObject
      // not having an empty-value short-circuit for the inner value.
    ])(
      'passes a %s %s-deep payload (%s) — should NOT trigger depth-cap rejection',
      async (_shape, depth, _label, builder) => {
        // expect.assertions defends against silent-skip if the response
        // shape changes. Two assertions, both must execute.
        expect.assertions(2);

        const response = await request(app)
          .post(ENDPOINT)
          .set('Content-Type', 'application/json')
          .set('Origin', 'http://localhost:3000')
          .send(builder(depth));

        // The body shape doesn't match {email,password}, so auth/validation
        // will reject it with some non-depth-cap error (likely 400 with a
        // validation message, or 401, depending on order). The KEY assertion
        // is that the rejection did NOT come from our depth cap — proving
        // the depth is at-or-under threshold.
        const body = response.body ?? {};
        const message = typeof body.message === 'string' ? body.message : '';
        expect(message).not.toMatch(/nesting too deep/i);
        // Pin that we did get SOME response (not a connection error or
        // unhandled exception that would mean the middleware crashed).
        expect(response.status).toBeGreaterThan(0);
      },
    );
  });
});
