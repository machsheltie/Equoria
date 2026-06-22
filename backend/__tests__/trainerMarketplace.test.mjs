/**
 * trainerMarketplace — unit tests (Equoria-rr7)
 *
 * Covers all exported functions from backend/modules/trainers/services/trainerMarketplace.mjs.
 * No database required — all functions are pure random generators or date checks.
 *
 * Exported:
 *   - TRAINER_MARKETPLACE_CONFIG (constant)
 *   - generateRandomTrainer()
 *   - generateTrainerMarketplace(size?)
 *   - trainerMarketplaceNeedsRefresh(lastRefresh)
 *   - getTrainerRefreshCost(lastRefresh)
 */

import { describe, it, expect } from '@jest/globals';
import {
  TRAINER_MARKETPLACE_CONFIG,
  generateRandomTrainer,
  generateTrainerMarketplace,
  trainerMarketplaceNeedsRefresh,
  getTrainerRefreshCost,
} from '../modules/trainers/index.mjs';

// ─── TRAINER_MARKETPLACE_CONFIG ───────────────────────────────────────────────

describe('TRAINER_MARKETPLACE_CONFIG', () => {
  it('has DEFAULT_MARKETPLACE_SIZE of 6', () => {
    expect(TRAINER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBe(6);
  });

  it('has REFRESH_INTERVAL_HOURS of 24', () => {
    expect(TRAINER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS).toBe(24);
  });

  it('has PREMIUM_REFRESH_COST of 50', () => {
    expect(TRAINER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST).toBe(50);
  });

  it('has SESSION_RATE_RANGES for all skill levels', () => {
    const ranges = TRAINER_MARKETPLACE_CONFIG.SESSION_RATE_RANGES;
    expect(ranges).toHaveProperty('novice');
    expect(ranges).toHaveProperty('developing');
    expect(ranges).toHaveProperty('expert');

    // Each range must have min < max
    Object.values(ranges).forEach(({ min, max }) => {
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThan(min);
    });
  });

  it('SKILL_DISTRIBUTION percentages sum to 100', () => {
    const total = Object.values(TRAINER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION).reduce((s, v) => s + v, 0);
    expect(total).toBe(100);
  });

  it('SPECIALTY_DISTRIBUTION percentages sum to 100', () => {
    const total = Object.values(TRAINER_MARKETPLACE_CONFIG.SPECIALTY_DISTRIBUTION).reduce((s, v) => s + v, 0);
    expect(total).toBe(100);
  });
});

// ─── generateRandomTrainer ────────────────────────────────────────────────────

describe('generateRandomTrainer', () => {
  it('returns an object with required fields', () => {
    const trainer = generateRandomTrainer();
    expect(trainer).toHaveProperty('marketplaceId');
    expect(trainer).toHaveProperty('firstName');
    expect(trainer).toHaveProperty('lastName');
    expect(trainer).toHaveProperty('skillLevel');
    expect(trainer).toHaveProperty('personality');
    expect(trainer).toHaveProperty('speciality');
    expect(trainer).toHaveProperty('sessionRate');
    expect(trainer).toHaveProperty('bio');
    expect(trainer).toHaveProperty('availability');
  });

  it('marketplaceId starts with mkt_trainer_', () => {
    const trainer = generateRandomTrainer();
    expect(trainer.marketplaceId).toMatch(/^mkt_trainer_/);
  });

  it('skillLevel is one of the defined levels', () => {
    const validLevels = Object.keys(TRAINER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION);
    for (let i = 0; i < 20; i++) {
      const trainer = generateRandomTrainer();
      expect(validLevels).toContain(trainer.skillLevel);
    }
  });

  it('personality is one of the 5 valid personalities', () => {
    const validPersonalities = ['focused', 'encouraging', 'technical', 'competitive', 'patient'];
    for (let i = 0; i < 20; i++) {
      const trainer = generateRandomTrainer();
      expect(validPersonalities).toContain(trainer.personality);
    }
  });

  it('speciality is one of the defined disciplines', () => {
    const validSpecialties = Object.keys(TRAINER_MARKETPLACE_CONFIG.SPECIALTY_DISTRIBUTION);
    for (let i = 0; i < 20; i++) {
      const trainer = generateRandomTrainer();
      expect(validSpecialties).toContain(trainer.speciality);
    }
  });

  it('sessionRate is within range for the trainer skill level', () => {
    for (let i = 0; i < 20; i++) {
      const trainer = generateRandomTrainer();
      const range = TRAINER_MARKETPLACE_CONFIG.SESSION_RATE_RANGES[trainer.skillLevel];
      expect(trainer.sessionRate).toBeGreaterThanOrEqual(range.min);
      expect(trainer.sessionRate).toBeLessThanOrEqual(range.max);
    }
  });

  it('availability is true', () => {
    const trainer = generateRandomTrainer();
    expect(trainer.availability).toBe(true);
  });

  it('bio is a non-empty string', () => {
    const trainer = generateRandomTrainer();
    expect(typeof trainer.bio).toBe('string');
    expect(trainer.bio.length).toBeGreaterThan(0);
  });

  it('firstName and lastName are non-empty strings', () => {
    const trainer = generateRandomTrainer();
    expect(typeof trainer.firstName).toBe('string');
    expect(trainer.firstName.length).toBeGreaterThan(0);
    expect(typeof trainer.lastName).toBe('string');
    expect(trainer.lastName.length).toBeGreaterThan(0);
  });

  it('generates unique marketplaceIds on repeated calls', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateRandomTrainer().marketplaceId));
    expect(ids.size).toBe(10);
  });
});

// ─── generateTrainerMarketplace ────────────────────────────────────────────────

describe('generateTrainerMarketplace', () => {
  it('returns an array of default size (6) when no size given', () => {
    const marketplace = generateTrainerMarketplace();
    expect(Array.isArray(marketplace)).toBe(true);
    expect(marketplace).toHaveLength(TRAINER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);
  });

  it('returns array of the requested size', () => {
    expect(generateTrainerMarketplace(3)).toHaveLength(3);
    expect(generateTrainerMarketplace(10)).toHaveLength(10);
    expect(generateTrainerMarketplace(1)).toHaveLength(1);
  });

  it('first trainer is always a starter trainer (novice/patient)', () => {
    // The internal generateStarterTrainer always sets skillLevel='novice',
    // personality='patient', speciality='Dressage'
    const marketplace = generateTrainerMarketplace(6);
    const starter = marketplace[0];
    expect(starter.skillLevel).toBe('novice');
    expect(starter.personality).toBe('patient');
    expect(starter.speciality).toBe('Dressage');
  });

  it('starter trainer sessionRate equals novice minimum', () => {
    const marketplace = generateTrainerMarketplace(6);
    const starter = marketplace[0];
    expect(starter.sessionRate).toBe(TRAINER_MARKETPLACE_CONFIG.SESSION_RATE_RANGES.novice.min);
  });

  it('all trainers have the required shape', () => {
    const marketplace = generateTrainerMarketplace(4);
    marketplace.forEach(trainer => {
      expect(trainer).toHaveProperty('marketplaceId');
      expect(trainer).toHaveProperty('firstName');
      expect(trainer).toHaveProperty('skillLevel');
      expect(trainer).toHaveProperty('sessionRate');
      expect(trainer).toHaveProperty('availability');
    });
  });

  it('returns array of length 1 for size=1 (only starter)', () => {
    const marketplace = generateTrainerMarketplace(1);
    expect(marketplace).toHaveLength(1);
    expect(marketplace[0].skillLevel).toBe('novice');
  });
});

// ─── trainerMarketplaceNeedsRefresh ───────────────────────────────────────────

describe('trainerMarketplaceNeedsRefresh', () => {
  it('returns true when lastRefresh is null', () => {
    expect(trainerMarketplaceNeedsRefresh(null)).toBe(true);
  });

  it('returns true when lastRefresh is undefined', () => {
    expect(trainerMarketplaceNeedsRefresh(undefined)).toBe(true);
  });

  it('returns false when lastRefresh is less than 24 hours ago', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
    expect(trainerMarketplaceNeedsRefresh(oneHourAgo)).toBe(false);
  });

  it('returns false when lastRefresh is 23 hours ago', () => {
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
    expect(trainerMarketplaceNeedsRefresh(twentyThreeHoursAgo)).toBe(false);
  });

  it('returns true when lastRefresh is more than 24 hours ago', () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(trainerMarketplaceNeedsRefresh(twentyFiveHoursAgo)).toBe(true);
  });

  it('returns true when lastRefresh is a week ago', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(trainerMarketplaceNeedsRefresh(sevenDaysAgo)).toBe(true);
  });

  it('accepts a date string as lastRefresh', () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(trainerMarketplaceNeedsRefresh(recentDate)).toBe(false);

    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(trainerMarketplaceNeedsRefresh(oldDate)).toBe(true);
  });
});

// ─── getTrainerRefreshCost ────────────────────────────────────────────────────

describe('getTrainerRefreshCost', () => {
  it('returns 0 when refresh is needed (null lastRefresh)', () => {
    expect(getTrainerRefreshCost(null)).toBe(0);
  });

  it('returns 0 when refresh is needed (old date)', () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    expect(getTrainerRefreshCost(oldDate)).toBe(0);
  });

  it('returns PREMIUM_REFRESH_COST when refresh is not yet needed', () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000);
    expect(getTrainerRefreshCost(recentDate)).toBe(TRAINER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);
  });

  it('PREMIUM_REFRESH_COST matches config (50)', () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000);
    expect(getTrainerRefreshCost(recentDate)).toBe(50);
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Multi-iteration rate sweep, bio-content, statistical distribution sweep, and
// config range/positivity invariants not covered above.
describe('trainerMarketplace — distribution, bio & config invariants (merged from legacy backend/tests, Equoria-wvuin)', () => {
  it('session rate is within the configured range for each generated skill level (50-run sweep)', () => {
    for (let i = 0; i < 50; i++) {
      const trainer = generateRandomTrainer();
      const range = TRAINER_MARKETPLACE_CONFIG.SESSION_RATE_RANGES[trainer.skillLevel];
      expect(trainer.sessionRate).toBeGreaterThanOrEqual(range.min);
      expect(trainer.sessionRate).toBeLessThanOrEqual(range.max);
    }
  });

  it('bios mention the trainer first name and are reasonably long', () => {
    for (let i = 0; i < 20; i++) {
      const trainer = generateRandomTrainer();
      expect(trainer.bio).toContain(trainer.firstName);
      expect(trainer.bio.length).toBeGreaterThan(20);
    }
  });

  it('respects skill-level distribution over a large (1000) sample within ±10%', () => {
    const sample = generateTrainerMarketplace(1000);
    const counts = { novice: 0, developing: 0, expert: 0 };
    sample.forEach(t => {
      counts[t.skillLevel]++;
    });
    const expected = TRAINER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION;
    Object.keys(counts).forEach(skill => {
      const actual = (counts[skill] / 1000) * 100;
      expect(actual).toBeGreaterThanOrEqual(expected[skill] - 10);
      expect(actual).toBeLessThanOrEqual(expected[skill] + 10);
    });
  });

  it('config SESSION_RATE_RANGES all have 0 < min < max', () => {
    Object.values(TRAINER_MARKETPLACE_CONFIG.SESSION_RATE_RANGES).forEach(range => {
      expect(range.min).toBeGreaterThan(0);
      expect(range.max).toBeGreaterThan(range.min);
    });
  });

  it('config marketplace size and premium cost are positive', () => {
    expect(TRAINER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBeGreaterThan(0);
    expect(TRAINER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST).toBeGreaterThan(0);
  });
});
