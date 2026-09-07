/**
 * Tests for userMessageFor — the shared error-taxonomy mapping helper
 * (Equoria-8cnzr). Enforces FRONTEND_ASYNC_STATE_DOCTRINE §3:
 *  - every error class maps to the table's user-safe copy + retryable flag
 *  - a raw server body message is NEVER surfaced verbatim (Equoria-ot1mo:
 *    backend 5xx bodies can leak internals)
 *
 * Pure input→output tests: the helper is a total function over `unknown`,
 * so no DOM, no network, no mocks — this is the ONE mapping point and it is
 * exercised in isolation here.
 */

import { describe, it, expect } from 'vitest';
import { userMessageFor } from '../userMessage.js';
import { confirmRecoveryAddressMessage, recoveryAddressMessage } from '../authErrorMessages.js';
import type { ApiError } from '../types.js';

/** Build an ApiError as the transport (`apiClient`) actually shapes them. */
function apiError(
  statusCode: number,
  message = 'raw server detail',
  extra: Partial<ApiError> = {}
): ApiError {
  return { message, status: 'error', statusCode, ...extra };
}

describe('userMessageFor — §3 error taxonomy', () => {
  it('network / offline (statusCode 0) → connection copy, retryable', () => {
    const result = userMessageFor(apiError(0, 'Failed to fetch'));
    expect(result.message).toBe("Can't reach the stable. Check your connection and try again.");
    expect(result.retryable).toBe(true);
  });

  it('5xx → generic server copy, retryable', () => {
    const result = userMessageFor(apiError(500));
    expect(result.message).toBe('Something went wrong on our end. Try again in a moment.');
    expect(result.retryable).toBe(true);
  });

  it('other 5xx codes (502/503) map to the same server copy', () => {
    for (const code of [502, 503, 504]) {
      const result = userMessageFor(apiError(code));
      expect(result.message).toBe('Something went wrong on our end. Try again in a moment.');
      expect(result.retryable).toBe(true);
    }
  });

  it('429 → rate-limit copy, retryable', () => {
    const result = userMessageFor(apiError(429, 'Too many requests', { retryAfter: 60 }));
    expect(result.message).toBe('Slow down a moment — too many requests. Try again shortly.');
    expect(result.retryable).toBe(true);
  });

  it('404 → not-found copy, NOT retryable', () => {
    const result = userMessageFor(apiError(404));
    expect(result.message).toBe("We couldn't find what you were looking for.");
    expect(result.retryable).toBe(false);
  });

  it('403 / ownership → access-denied copy, NOT retryable', () => {
    const result = userMessageFor(apiError(403));
    expect(result.message).toBe("You don't have access to this.");
    expect(result.retryable).toBe(false);
  });

  it('401 / session → session-expired copy, NOT retryable', () => {
    const result = userMessageFor(apiError(401, 'Session expired. Please log in again.'));
    expect(result.message).toBe('Your session expired — log in again.');
    expect(result.retryable).toBe(false);
  });

  it('400 / validation → generic check-input copy, NOT retryable', () => {
    const result = userMessageFor(apiError(400));
    expect(result.message).toBe('Please check the highlighted fields and try again.');
    expect(result.retryable).toBe(false);
  });

  it('unmapped 4xx (409 conflict) → generic client-error copy, NOT retryable', () => {
    const result = userMessageFor(apiError(409));
    expect(result.retryable).toBe(false);
    expect(result.message).not.toContain('raw server detail');
  });
});

describe('userMessageFor — never leaks the raw server body (Equoria-ot1mo)', () => {
  it('does NOT surface a leaky 5xx server message verbatim', () => {
    const leaky =
      'PrismaClientKnownRequestError: connect ECONNREFUSED 10.0.0.5:5432 (secret=hunter2)';
    const result = userMessageFor(apiError(500, leaky));
    expect(result.message).not.toContain('Prisma');
    expect(result.message).not.toContain('10.0.0.5');
    expect(result.message).not.toContain('hunter2');
    expect(result.message).toBe('Something went wrong on our end. Try again in a moment.');
  });

  it('does NOT surface a leaky network error message verbatim', () => {
    const result = userMessageFor(
      apiError(0, 'TypeError: NetworkError when attempting fetch to http://internal-host')
    );
    expect(result.message).not.toContain('internal-host');
    expect(result.message).toBe("Can't reach the stable. Check your connection and try again.");
  });
});

describe('userMessageFor — defensive over non-ApiError input', () => {
  it('a plain Error does not throw and does not leak its message', () => {
    const result = userMessageFor(new Error('secret stack trace detail'));
    expect(result.message).not.toContain('secret stack trace');
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
    expect(typeof result.retryable).toBe('boolean');
  });

  it('null / undefined / string inputs return a safe generic message', () => {
    for (const bad of [null, undefined, 'boom', 42]) {
      const result = userMessageFor(bad);
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
      expect(typeof result.retryable).toBe('boolean');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recovery-address mappers (Finding 9, Equoria-6p398.11)
//
// `authErrorMessages.ts` sits beside `userMessage.ts` and follows the same rule:
// classify by `ApiError.statusCode`, never echo `error.message`. These are the
// ONE mapping point for the recovery-address flow, so every branch is exercised
// here in isolation — including 0, 502 and 5xx, which the surface tests cannot
// reach through MSW without inventing failures the backend cannot produce.
// ─────────────────────────────────────────────────────────────────────────────

const RAW_SERVER_STRINGS = [
  'Current password is incorrect',
  'Invalid TOTP token',
  'That email address is already in use',
  'Please wait 240 seconds before requesting another email change',
  'This email change link is invalid, expired, or has already been used.',
  'Maximum pending email changes (5) reached',
];

/** No mapper may ever return a server string verbatim, at any status. */
function expectNoRawLeak(copy: string | null) {
  expect(copy).not.toBeNull();
  for (const raw of RAW_SERVER_STRINGS) {
    expect(copy as string).not.toContain(raw);
  }
}

describe('recoveryAddressMessage — every branch', () => {
  it('returns null for no error, so the surface renders nothing', () => {
    expect(recoveryAddressMessage(null)).toBeNull();
    expect(recoveryAddressMessage(undefined)).toBeNull();
  });

  it.each([
    [0, /can't reach the stable/i],
    [400, /check the address you entered/i],
    [409, /belongs to another stable/i],
    [500, /on our end/i],
    [503, /on our end/i],
    [418, /didn't work/i],
  ])('status %i maps to its own copy', (status, expected) => {
    const copy = recoveryAddressMessage(apiError(status));
    expect(copy).toMatch(expected);
    expectNoRawLeak(copy);
  });

  it('502 says the change IS staged — only the letter failed', () => {
    // The backend answers 502 with the pending row RETAINED
    // (emailChangeController). Copy that implied failure would be a lie.
    const copy = recoveryAddressMessage(apiError(502));
    expect(copy).toMatch(/your change is waiting/i);
    expect(copy).toMatch(/couldn.t send the letter/i);
    expectNoRawLeak(copy);
  });

  it('401 blames the password alone when the account has no second factor', () => {
    const copy = recoveryAddressMessage(apiError(401), { secondFactorRequired: false });
    expect(copy).toMatch(/that password wasn't accepted/i);
    expect(copy).not.toMatch(/code/i);
    expectNoRawLeak(copy);
  });

  it('401 names BOTH the password and the code when the account carries one', () => {
    // The backend refuses a wrong password and a wrong/missing TOTP with the
    // same bare 401, so naming only one of them would blame the wrong field.
    const copy = recoveryAddressMessage(apiError(401), { secondFactorRequired: true });
    expect(copy).toMatch(/password or code/i);
    expectNoRawLeak(copy);
  });

  it('401 defaults to the password-only copy when the caller says nothing', () => {
    expect(recoveryAddressMessage(apiError(401))).toMatch(/that password wasn't accepted/i);
  });

  it('429 renders the wait the backend actually asked for', () => {
    const copy = recoveryAddressMessage(
      apiError(429, 'Please wait 240 seconds', {
        retryAfter: 240,
      })
    );
    expect(copy).toMatch(/too many attempts/i);
    expect(copy).toMatch(/4 minute/i); // ceil(240 / 60)
    expectNoRawLeak(copy);
  });

  it('429 says "1 minute", not "1 minutes", for a sub-minute wait', () => {
    for (const seconds of [1, 30, 60]) {
      const copy = recoveryAddressMessage(apiError(429, 'x', { retryAfter: seconds }));
      expect(copy).toContain('about 1 minute,');
      expect(copy).not.toContain('minutes');
    }
  });

  it('429 without a retryAfter still gives an honest, unquantified wait', () => {
    const copy = recoveryAddressMessage(apiError(429));
    expect(copy).toMatch(/too many attempts/i);
    expect(copy).toMatch(/a few minutes/i);
    expect(copy).not.toMatch(/\d+ minute/);
  });

  it('429 with a zero retryAfter does not claim a zero-minute wait', () => {
    const copy = recoveryAddressMessage(apiError(429, 'x', { retryAfter: 0 }));
    expect(copy).toMatch(/a few minutes/i);
  });
});

describe('confirmRecoveryAddressMessage — every branch', () => {
  it('returns null for no error', () => {
    expect(confirmRecoveryAddressMessage(null)).toBeNull();
    expect(confirmRecoveryAddressMessage(undefined)).toBeNull();
  });

  it.each([
    [0, /can't reach the stable/i],
    [409, /belongs to another stable/i],
    [429, /too many attempts/i],
    [500, /on our end/i],
    [504, /on our end/i],
    [418, /could not be used/i],
  ])('status %i maps to its own copy', (status, expected) => {
    const copy = confirmRecoveryAddressMessage(apiError(status));
    expect(copy).toMatch(expected);
    expectNoRawLeak(copy);
  });

  it('400 names the remedy, never the cause', () => {
    // Every unusable link — unknown, expired, consumed, superseded, wrong
    // purpose, wrong account — is deliberately ONE generic 400 so a holder
    // cannot probe other people's pending changes. The copy must not undo that.
    const copy = confirmRecoveryAddressMessage(apiError(400));
    expect(copy).toMatch(/lasts 24 hours/i);
    expect(copy).toMatch(/works once/i);
    expect(copy).toMatch(/fresh one from your settings/i);
    expect(copy).not.toMatch(/expired|already been used|unknown account/i);
    expectNoRawLeak(copy);
  });
});
