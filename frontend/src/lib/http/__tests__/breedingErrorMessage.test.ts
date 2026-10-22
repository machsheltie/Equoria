/**
 * breedingErrorMessage — what the breeding surface says when a pairing is
 * refused (Equoria-2yn9j).
 *
 * The backend's request-shape envelope message is the developer string
 * 'Validation failed'; the breeding rules' own refusals ('Insufficient funds',
 * 'Mare is already in foal.') are authored game copy and stay readable.
 * Transport and server faults use the shared taxonomy, never the raw body.
 */

import { describe, it, expect } from 'vitest';
import { breedingErrorMessage } from '../breedingErrorMessage.js';
import { userMessageFor } from '../userMessage.js';
import type { ApiError } from '../types.js';

function apiError(statusCode: number, message: string): ApiError {
  return { message, status: 'error', statusCode };
}

describe('breedingErrorMessage', () => {
  it('replaces the validation envelope with designed copy', () => {
    const message = breedingErrorMessage(apiError(400, 'Validation failed'));
    expect(message).toMatch(/couldn't be paired as chosen/i);
    expect(message).not.toMatch(/validation failed/i);
  });

  it('keeps a breeding rule refusal readable', () => {
    expect(breedingErrorMessage(apiError(400, 'Insufficient funds'))).toBe('Insufficient funds');
  });

  it('never echoes a server fault body', () => {
    const error = apiError(500, 'PrismaClientKnownRequestError: relation "horses" ...');
    expect(breedingErrorMessage(error)).toBe(userMessageFor(error).message);
  });

  it('uses the shared copy for a lost connection', () => {
    const error = apiError(0, 'Failed to fetch');
    expect(breedingErrorMessage(error)).toBe(userMessageFor(error).message);
  });

  it('falls back to a safe sentence when there is nothing to say', () => {
    expect(breedingErrorMessage(apiError(400, ''))).toMatch(/try again/i);
    expect(breedingErrorMessage(new Error('boom'))).not.toContain('boom');
  });
});
