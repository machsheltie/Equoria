/**
 * horseAgingSystem — branch-coverage tests (Equoria-rr7)
 *
 * Pure functions:
 *   calculateAgeFromBirth — date arithmetic, catch path
 *
 * Safe DB ("not found" / early-return paths only):
 *   updateHorseAge          — horse-not-found → rejects
 *   checkForMilestones      — no milestones / age-1 / additionalMilestone / retirement paths
 *   processHorseBirthdays   — horseIds array branch (returns empty when all IDs missing)
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateAgeFromBirth,
  updateHorseAge,
  checkForMilestones,
  processHorseBirthdays,
} from '../../utils/horseAgingSystem.mjs';

const daysAgo = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

describe('calculateAgeFromBirth', () => {
  it('returns 0 for a horse born today', () => {
    expect(calculateAgeFromBirth(new Date())).toBe(0);
  });

  it('returns 1 for a horse born yesterday', () => {
    expect(calculateAgeFromBirth(daysAgo(1))).toBe(1);
  });

  it('returns 365 for a horse born 365 days ago', () => {
    const result = calculateAgeFromBirth(daysAgo(365));
    // allow ±1 for DST/leap boundaries
    expect(result).toBeGreaterThanOrEqual(364);
    expect(result).toBeLessThanOrEqual(366);
  });

  it('returns 0 for a future birth date', () => {
    const future = new Date(Date.now() + 86400000);
    expect(calculateAgeFromBirth(future)).toBe(0);
  });

  it('accepts ISO date string', () => {
    expect(calculateAgeFromBirth(daysAgo(10).toISOString())).toBe(10);
  });

  it('accepts a custom currentDate as second argument', () => {
    const dob = new Date('2020-01-01');
    const current = new Date('2020-01-11');
    expect(calculateAgeFromBirth(dob, current)).toBe(10);
  });

  it('returns 0 for identical birth and current date', () => {
    const d = new Date('2024-06-15');
    expect(calculateAgeFromBirth(d, d)).toBe(0);
  });

  it('returns a large number for an ancient date (year 1900)', () => {
    const ancient = new Date('1900-01-01');
    const result = calculateAgeFromBirth(ancient);
    expect(result).toBeGreaterThan(40000); // 100+ years in days
  });

  it('returns 0 (fail-safe) when dateOfBirth.valueOf() throws (catch branch)', () => {
    const evil = {
      valueOf() {
        throw new Error('valueOf bomb');
      },
    };
    expect(calculateAgeFromBirth(evil)).toBe(0);
  });
});

// ── processHorseBirthdays — no-horses early return ────────────────────────────

describe('processHorseBirthdays()', () => {
  it('returns totalProcessed=0 when specificHorseId does not exist in DB', async () => {
    const result = await processHorseBirthdays({ specificHorseId: -1 });
    expect(result.totalProcessed).toBe(0);
    expect(result.birthdaysFound).toBe(0);
    expect(result.milestonesTriggered).toBe(0);
    expect(result.errors).toBe(0);
    expect(typeof result.duration).toBe('number');
  });

  it('accepts dryRun option without error when specificHorseId has no match', async () => {
    const result = await processHorseBirthdays({ specificHorseId: -1, dryRun: true });
    expect(result.totalProcessed).toBe(0);
  });

  it('accepts horseIds array and returns 0 when all IDs are missing (horseIds branch)', async () => {
    const result = await processHorseBirthdays({ horseIds: [-1, -2] });
    expect(result.totalProcessed).toBe(0);
    expect(result.birthdaysFound).toBe(0);
    expect(typeof result.duration).toBe('number');
  });
});

// ── updateHorseAge — horse-not-found error path ───────────────────────────────

describe('updateHorseAge()', () => {
  it('rejects with "Horse with ID -1 not found" for a non-existent horse', async () => {
    await expect(updateHorseAge(-1)).rejects.toThrow('Horse with ID -1 not found');
  });
});

// ── checkForMilestones — various milestone branch paths ───────────────────────

describe('checkForMilestones()', () => {
  it('returns empty arrays when no age threshold is crossed (previousAge=newAge=0)', async () => {
    const result = await checkForMilestones(-1, 0, 0);
    expect(result.milestonesTriggered).toEqual([]);
    expect(result.traitsAssigned).toEqual([]);
    expect(result.retirementTriggered).toBe(false);
  });

  it('pushes age_1_trait_evaluation milestone when crossing 7-day threshold (horse not found → no-op)', async () => {
    const result = await checkForMilestones(-1, 0, 7);
    expect(result.milestonesTriggered).toContain('age_1_trait_evaluation');
  });

  it('enters additionalMilestone loop for 14-day threshold (horse not found → no-op)', async () => {
    const result = await checkForMilestones(-1, 13, 14);
    expect(Array.isArray(result.milestonesTriggered)).toBe(true);
  });

  it('enters additionalMilestone loop for 21-day threshold (horse not found → no-op)', async () => {
    const result = await checkForMilestones(-1, 20, 21);
    expect(Array.isArray(result.milestonesTriggered)).toBe(true);
  });

  it('triggers retirement milestone when crossing 147-day threshold', async () => {
    const result = await checkForMilestones(-1, 146, 147);
    expect(result.retirementTriggered).toBe(true);
    expect(result.milestonesTriggered).toContain('retirement');
  });

  it('returns shape with all expected keys', async () => {
    const result = await checkForMilestones(-1, 0, 0);
    expect(result).toHaveProperty('milestonesTriggered');
    expect(result).toHaveProperty('traitsAssigned');
    expect(result).toHaveProperty('retirementTriggered');
  });
});
