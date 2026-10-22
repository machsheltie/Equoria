/**
 * actionMessageFor with refusal codes (Equoria-dosig) — an action may name a
 * machine-readable `code` the server sent. A code the action names wins over
 * the status copy; an unknown or missing code falls back to the status copy;
 * the server's own words are never returned.
 */

import { describe, it, expect } from 'vitest';
import { actionMessageFor, hireRefused, hireRefusalCodes } from '../actionMessage.js';
import { userMessageFor } from '../userMessage.js';
import type { ApiError } from '../types.js';

function apiError(statusCode: number, code?: string): ApiError {
  return { message: 'RAW-SERVER-TEXT', status: 'error', statusCode, ...(code ? { code } : {}) };
}

describe('actionMessageFor — refusal codes', () => {
  it('uses the copy for a code the action names, ahead of the status copy', () => {
    const msg = actionMessageFor(apiError(400, 'ROSTER_CAP_REACHED'), hireRefused, {
      ROSTER_CAP_REACHED: 'Roster full.',
    });
    expect(msg).toBe('Roster full.');
  });

  it('falls back to the status copy when the code is missing or not named', () => {
    const codes = { ROSTER_CAP_REACHED: 'Roster full.' };
    expect(actionMessageFor(apiError(400), hireRefused, codes)).toBe(hireRefused[400]);
    expect(actionMessageFor(apiError(400, 'SOMETHING_ELSE'), hireRefused, codes)).toBe(
      hireRefused[400]
    );
  });

  it('never lets a code override a network failure, expired session or rate limit', () => {
    for (const status of [0, 401, 429]) {
      expect(
        actionMessageFor(apiError(status, 'ROSTER_CAP_REACHED'), {}, { ROSTER_CAP_REACHED: 'x' })
      ).toBe(userMessageFor(apiError(status)).message);
    }
  });

  it('a rider, trainer and groom each name the roster and the balance separately', () => {
    for (const staff of ['rider', 'trainer', 'groom'] as const) {
      const codes = hireRefusalCodes(staff);
      const roster = actionMessageFor(apiError(400, 'ROSTER_CAP_REACHED'), hireRefused, codes);
      const funds = actionMessageFor(apiError(400, 'INSUFFICIENT_FUNDS'), hireRefused, codes);
      expect(roster).toMatch(new RegExp(`${staff}`, 'i'));
      expect(roster).toMatch(/full/i);
      expect(roster).not.toMatch(/balance|funds/i);
      expect(funds).toMatch(/balance|afford|funds/i);
      expect(funds).not.toMatch(/roster/i);
      expect(roster).not.toContain('RAW-SERVER-TEXT');
    }
  });
});
