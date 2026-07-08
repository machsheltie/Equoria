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
