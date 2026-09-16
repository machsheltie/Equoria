/**
 * horseNamePolicy (frontend mirror) — the boundary the player meets.
 *
 * These cases exist either side of the same boundary as
 * `backend/modules/horses/__tests__/renameHorseEndpoint.integration.test.mjs`
 * and the onboarding integration suite: 40 accepted, 41 refused, `<` refused,
 * `>` allowed. If the server rule ever moves without this module moving with
 * it, the two sets of numbers stop agreeing and one of the two suites fails.
 */

import { describe, it, expect } from 'vitest';
import {
  HORSE_NAME_MAX_LENGTH,
  UNNAMED_HORSE_NAME,
  horseNameRejection,
  horseNameRejectionCopy,
  isUnnamed,
} from '../horseNamePolicy';

describe('horse name policy (client mirror)', () => {
  it('caps at 40 characters, the limit the owner set', () => {
    expect(HORSE_NAME_MAX_LENGTH).toBe(40);
  });

  it('accepts a name of exactly 40 characters', () => {
    const atLimit = 'M'.repeat(40);
    expect(atLimit.length).toBe(40);
    expect(horseNameRejection(atLimit)).toBeNull();
  });

  it('refuses a name of 41 characters rather than shortening it', () => {
    const overLimit = 'M'.repeat(41);
    expect(horseNameRejection(overLimit)).toBe('length');
    // Nothing in this module ever returns a repaired string — there is no
    // truncation to return. Refusal is the whole contract.
    const copy = horseNameRejectionCopy('length', overLimit);
    expect(copy).toContain('41');
    expect(copy).toContain('40');
  });

  it('refuses `<` and allows `>`, which is the ratified scope of the character rule', () => {
    expect(horseNameRejection('Fred <3')).toBe('characters');
    expect(horseNameRejection('Fred > Barney')).toBeNull();
  });

  it('refuses a whitespace-only name and says so in the game’s voice', () => {
    expect(horseNameRejection('   ')).toBe('empty');
    expect(horseNameRejectionCopy('empty', '   ')).toMatch(/name/i);
  });

  it('accepts apostrophes and non-ASCII letters, as the server does', () => {
    expect(horseNameRejection("O'Malley's Étoile")).toBeNull();
  });

  it('recognises the birth name so a surface can invite a player to name her', () => {
    expect(UNNAMED_HORSE_NAME).toBe('unnamed');
    expect(isUnnamed('unnamed')).toBe(true);
    expect(isUnnamed('Moonflower')).toBe(false);
    expect(isUnnamed(null)).toBe(false);
    // And the birth name is itself acceptable — the game never mints a name it
    // would refuse to accept back.
    expect(horseNameRejection(UNNAMED_HORSE_NAME)).toBeNull();
  });
});
