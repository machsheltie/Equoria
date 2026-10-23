/**
 * secondFactorMessage names a throttled second factor (Equoria-6p398.13).
 *
 * LoginPage intercepts 429 before this mapper today, but the mapper is exported
 * for reuse, and a 429 from the code step (the MFA lockout) must not fall
 * through to "That code wasn't accepted" — the code may have been right.
 */

import { describe, it, expect } from 'vitest';
import { secondFactorMessage } from '../authErrorMessages.js';
import type { ApiError } from '../types.js';

const apiError = (statusCode: number): ApiError => ({
  message: 'raw server detail',
  status: 'error',
  statusCode,
});

describe('secondFactorMessage — 429', () => {
  it('says the attempts were throttled, not that the code was wrong', () => {
    const message = secondFactorMessage(apiError(429));

    expect(message).toMatch(/too many/i);
    expect(message).not.toMatch(/wasn't accepted/i);
    expect(message).not.toContain('raw server detail');
  });

  it('keeps the existing copy for the refusals it already mapped', () => {
    expect(secondFactorMessage(apiError(401))).toMatch(/wasn't accepted/i);
    expect(secondFactorMessage(apiError(500))).toMatch(/our end/i);
  });
});
