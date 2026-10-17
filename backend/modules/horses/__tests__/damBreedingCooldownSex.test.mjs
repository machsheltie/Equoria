/**
 * damBreedingCooldownEndsAt reads the horse's sex case-insensitively
 * (Equoria-kha18 review), as next-actions does (`sex?.toLowerCase()`). Writes
 * are canonicalised to 'Mare' by the Prisma sex extension, but a caller that
 * hands in a lowercase 'mare' must not lose her cooldown: next-actions would
 * then suggest breeding a mare the breeding guard still refuses.
 *
 * Pure over its arguments; the instant is pinned.
 */

import { describe, it, expect } from '@jest/globals';

import { damBreedingCooldownEndsAt } from '../services/breedingPairRules.mjs';

// 2026-10-16 15:00 EDT; bred on 2026-10-13 (date-only), so the cooldown ends at
// 00:00 EDT on 2026-10-20 = 04:00Z.
const NOW = new Date('2026-10-16T19:00:00.000Z');
const BRED = new Date('2026-10-13T00:00:00.000Z');

describe('damBreedingCooldownEndsAt — sex compared case-insensitively (Equoria-kha18)', () => {
  it.each(['Mare', 'mare', 'MARE'])('a %s bred 3 game days ago is on cooldown until 00:00 Eastern on day 7', sex => {
    expect(damBreedingCooldownEndsAt({ sex, lastBredDate: BRED }, NOW)).toBe('2026-10-20T04:00:00.000Z');
  });

  it.each(['Stallion', 'stallion', null])('a %s is never on cooldown', sex => {
    expect(damBreedingCooldownEndsAt({ sex, lastBredDate: BRED }, NOW)).toBeNull();
  });
});
