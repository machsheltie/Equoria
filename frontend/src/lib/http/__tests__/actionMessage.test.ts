/**
 * actionMessageFor — an action may name what a status means for its own request;
 * everything else, and every status that says nothing about the action, uses the
 * shared copy; the server's own words are never returned.
 */

import { describe, it, expect } from 'vitest';
import { actionMessageFor, hireRefused, refreshRefused } from '../actionMessage.js';
import { userMessageFor } from '../userMessage.js';
import type { ApiError } from '../types.js';

function apiError(statusCode: number, message = 'RAW-SERVER-TEXT'): ApiError {
  return { message, status: 'error', statusCode };
}

describe('actionMessageFor', () => {
  it('uses the action copy for a status the action names', () => {
    expect(actionMessageFor(apiError(409), { 409: 'Already a member.' })).toBe('Already a member.');
  });

  it('falls through to the shared copy for a status the action does not name', () => {
    expect(actionMessageFor(apiError(409), { 400: 'x' })).toBe(
      userMessageFor(apiError(409)).message
    );
    expect(actionMessageFor(apiError(500), hireRefused)).toBe(
      userMessageFor(apiError(500)).message
    );
  });

  it('never overrides a network failure, an expired session or a rate limit', () => {
    for (const status of [0, 401, 429]) {
      expect(actionMessageFor(apiError(status), { [status]: 'mine' })).toBe(
        userMessageFor(apiError(status)).message
      );
    }
  });

  it('never returns the server message, for any status or a non-ApiError throw', () => {
    for (const err of [apiError(400), apiError(404), apiError(500), new Error('RAW-SERVER-TEXT')]) {
      expect(actionMessageFor(err, {})).not.toContain('RAW-SERVER-TEXT');
    }
  });

  it('the marketplace copy names the roster and the balance honestly', () => {
    expect(actionMessageFor(apiError(400), hireRefused)).toMatch(/roster.*balance/i);
    expect(actionMessageFor(apiError(400), refreshRefused)).toMatch(/refresh/i);
  });
});
