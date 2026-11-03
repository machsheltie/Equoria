/**
 * groomMarketplace / riderMarketplace / trainerMarketplace — unit tests (Equoria-rr7)
 *
 * All three files import only `crypto` (no DB). No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  marketplaceConfig,
  generateRandomGroom,
  generateMarketplace,
  needsRefresh,
  getRefreshCost,
} from '../modules/grooms/services/groomMarketplace.mjs';
import {
  riderMarketplaceConfig,
  generateRandomRider,
  generateRiderMarketplace,
  riderMarketplaceNeedsRefresh,
  getRiderRefreshCost,
} from '../modules/riders/services/riderMarketplace.mjs';
import {
  trainerMarketplaceConfig,
  generateRandomTrainer,
  generateTrainerMarketplace,
  trainerMarketplaceNeedsRefresh,
  getTrainerRefreshCost,
} from '../modules/trainers/services/trainerMarketplace.mjs';
import { staffLevelFee } from '../constants/staffLevels.mjs';

// ---------------------------------------------------------------------------
// marketplaceConfig (groom)
// ---------------------------------------------------------------------------
describe('marketplaceConfig', () => {
  it('has defaultMarketplaceSize of 12', () => {
    expect(marketplaceConfig.defaultMarketplaceSize).toBe(12);
  });

  it('has premiumRefreshCost of 100', () => {
    expect(marketplaceConfig.premiumRefreshCost).toBe(100);
  });

  it('qualityDistribution sums to 100', () => {
    const sum = Object.values(marketplaceConfig.qualityDistribution).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('specialtyDistribution sums to 100', () => {
    const sum = Object.values(marketplaceConfig.specialtyDistribution).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('has experienceRanges for all skill levels', () => {
    for (const level of ['novice', 'intermediate', 'expert', 'master']) {
      expect(marketplaceConfig.experienceRanges[level]).toBeDefined();
    }
  });

  it('has baseSessionRates for all skill levels', () => {
    for (const level of ['novice', 'intermediate', 'expert', 'master']) {
      expect(typeof marketplaceConfig.baseSessionRates[level]).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// generateRandomGroom
// ---------------------------------------------------------------------------
describe('generateRandomGroom', () => {
  it('returns an object with expected fields', () => {
    const g = generateRandomGroom();
    expect(typeof g.firstName).toBe('string');
    expect(typeof g.lastName).toBe('string');
    expect(typeof g.specialty).toBe('string');
    expect(typeof g.skillLevel).toBe('string');
    expect(typeof g.personality).toBe('string');
    expect(typeof g.experience).toBe('number');
    expect(typeof g.sessionRate).toBe('number');
    expect(typeof g.bio).toBe('string');
    expect(g.availability).toBe(true);
    expect(typeof g.marketplaceId).toBe('string');
  });

  it('marketplaceId starts with mkt_', () => {
    const g = generateRandomGroom();
    expect(g.marketplaceId.startsWith('mkt_')).toBe(true);
  });

  it('skillLevel is one of known levels', () => {
    const valid = new Set(['novice', 'intermediate', 'expert', 'master']);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(generateRandomGroom().skillLevel)).toBe(true);
    }
  });

  it('specialty is one of known specialties', () => {
    const valid = new Set(['general', 'foalCare', 'training', 'medical']);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(generateRandomGroom().specialty)).toBe(true);
    }
  });

  it('personality is one of known personalities', () => {
    const valid = new Set(['gentle', 'energetic', 'patient', 'strict']);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(generateRandomGroom().personality)).toBe(true);
    }
  });

  it('experience is within skill level range', () => {
    for (let i = 0; i < 30; i++) {
      const g = generateRandomGroom();
      const range = marketplaceConfig.experienceRanges[g.skillLevel];
      expect(g.experience).toBeGreaterThanOrEqual(range.min);
      expect(g.experience).toBeLessThanOrEqual(range.max);
    }
  });

  it('sessionRate is positive', () => {
    for (let i = 0; i < 10; i++) {
      expect(generateRandomGroom().sessionRate).toBeGreaterThan(0);
    }
  });

  it('bio is a non-empty string', () => {
    const g = generateRandomGroom();
    expect(g.bio.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// generateMarketplace (groom)
// ---------------------------------------------------------------------------
describe('generateMarketplace', () => {
  it('returns array of default size (12)', () => {
    const m = generateMarketplace();
    expect(Array.isArray(m)).toBe(true);
    expect(m).toHaveLength(marketplaceConfig.defaultMarketplaceSize);
  });

  it('returns exact count when size given', () => {
    expect(generateMarketplace(5)).toHaveLength(5);
    expect(generateMarketplace(20)).toHaveLength(20);
  });

  it('returns empty array for size 0', () => {
    expect(generateMarketplace(0)).toHaveLength(0);
  });

  it('each entry is a valid groom object', () => {
    const m = generateMarketplace(3);
    for (const g of m) {
      expect(typeof g.firstName).toBe('string');
      expect(typeof g.skillLevel).toBe('string');
      expect(g.availability).toBe(true);
    }
  });

  it('all marketplaceIds are unique', () => {
    const m = generateMarketplace(12);
    const ids = m.map(g => g.marketplaceId);
    expect(new Set(ids).size).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// needsRefresh / getRefreshCost (groom)
// ---------------------------------------------------------------------------
describe('needsRefresh (groom)', () => {
  it('returns true when lastRefresh is null', () => {
    expect(needsRefresh(null)).toBe(true);
  });

  it('returns true when lastRefresh is undefined', () => {
    expect(needsRefresh(undefined)).toBe(true);
  });

  it('returns false for a recent lastRefresh', () => {
    const recent = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    // In test env refreshIntervalHours is 1 hour
    expect(needsRefresh(recent)).toBe(false);
  });

  it('returns true for lastRefresh older than refreshIntervalHours', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    expect(needsRefresh(old)).toBe(true);
  });
});

describe('getRefreshCost (groom)', () => {
  it('returns 0 when refresh is needed (null lastRefresh)', () => {
    expect(getRefreshCost(null)).toBe(0);
  });

  it('returns premiumRefreshCost when refresh is not needed', () => {
    const recent = new Date(Date.now() - 30 * 60 * 1000);
    expect(getRefreshCost(recent)).toBe(marketplaceConfig.premiumRefreshCost);
  });

  it('returns 0 when lastRefresh is very old', () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    expect(getRefreshCost(old)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// riderMarketplaceConfig
// ---------------------------------------------------------------------------
describe('riderMarketplaceConfig', () => {
  it('has defaultMarketplaceSize of 6', () => {
    expect(riderMarketplaceConfig.defaultMarketplaceSize).toBe(6);
  });

  // Owner rulings 2026-10-29 (q282/q283) retired the riders' old skill word and
  // visible speciality. Old contract: skillDistribution (rookie/developing/
  // experienced) summing to 100 and SPECIALTIES listing every discipline.
  it('has no skill-word odds and no speciality list', () => {
    expect(riderMarketplaceConfig).not.toHaveProperty('skillDistribution');
    expect(riderMarketplaceConfig).not.toHaveProperty('SPECIALTIES');
  });
});

// ---------------------------------------------------------------------------
// generateRandomRider
// ---------------------------------------------------------------------------
describe('generateRandomRider', () => {
  it('returns object with expected fields', () => {
    const r = generateRandomRider();
    expect(typeof r.firstName).toBe('string');
    expect(typeof r.lastName).toBe('string');
    expect(r).not.toHaveProperty('skillLevel');
    expect(typeof r.personality).toBe('string');
    expect(r).not.toHaveProperty('speciality');
    expect(typeof r.weeklyRate).toBe('number');
    expect(typeof r.experience).toBe('number');
    expect(typeof r.bio).toBe('string');
    expect(r.availability).toBe(true);
    expect(r).not.toHaveProperty('knownAffinities');
  });

  it('marketplaceId starts with mkt_rider_', () => {
    const r = generateRandomRider();
    expect(r.marketplaceId.startsWith('mkt_rider_')).toBe(true);
  });

  // OLD CONTRACT: a random rate inside a per-skill range. OWNER RULING 2026-10-28
  // (Equoria-nawn5): the price is the star level's (Rookie 100 ... Expert 500).
  it('weeklyRate is the star level price', () => {
    for (let i = 0; i < 30; i++) {
      const r = generateRandomRider();
      expect(r.weeklyRate).toBe(staffLevelFee(r.starLevel));
    }
  });

  // Owner rulings 2026-10-28 (q160/q177, Equoria-xlw03) changed this contract: the old
  // affinity hint (knownAffinities, shown for experienced riders) is gone, and every new
  // rider is a Rookie; its hidden items are revealed only by levelling up.
  it('no offer carries an affinity hint, and every offer is a Rookie', () => {
    for (let i = 0; i < 50; i++) {
      const r = generateRandomRider();
      expect(r).not.toHaveProperty('knownAffinities');
      expect(r.starLevel).toBe('rookie');
    }
  });
});

// ---------------------------------------------------------------------------
// generateRiderMarketplace
// ---------------------------------------------------------------------------
describe('generateRiderMarketplace', () => {
  it('returns array of default size (6)', () => {
    const m = generateRiderMarketplace();
    expect(Array.isArray(m)).toBe(true);
    expect(m).toHaveLength(riderMarketplaceConfig.defaultMarketplaceSize);
  });

  it('returns exact count when size given', () => {
    expect(generateRiderMarketplace(3)).toHaveLength(3);
  });

  it('all marketplaceIds are unique', () => {
    const m = generateRiderMarketplace(6);
    const ids = m.map(r => r.marketplaceId);
    expect(new Set(ids).size).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// riderMarketplaceNeedsRefresh / getRiderRefreshCost
// ---------------------------------------------------------------------------
describe('riderMarketplaceNeedsRefresh', () => {
  it('returns true for null', () => {
    expect(riderMarketplaceNeedsRefresh(null)).toBe(true);
  });

  it('returns false for recent timestamp', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    expect(riderMarketplaceNeedsRefresh(recent)).toBe(false);
  });

  it('returns true for old timestamp (25 hours)', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(riderMarketplaceNeedsRefresh(old)).toBe(true);
  });
});

describe('getRiderRefreshCost', () => {
  it('returns 0 for null (free refresh needed)', () => {
    expect(getRiderRefreshCost(null)).toBe(0);
  });

  it('returns premiumRefreshCost for recent timestamp', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    expect(getRiderRefreshCost(recent)).toBe(riderMarketplaceConfig.premiumRefreshCost);
  });
});

// ---------------------------------------------------------------------------
// trainerMarketplaceConfig
// ---------------------------------------------------------------------------
describe('trainerMarketplaceConfig', () => {
  it('has defaultMarketplaceSize', () => {
    expect(typeof trainerMarketplaceConfig.defaultMarketplaceSize).toBe('number');
  });

  it('skillDistribution sums to 100', () => {
    const sum = Object.values(trainerMarketplaceConfig.skillDistribution).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  // Owner ruling 2026-10-21: specialties are an even pick across every competition
  // discipline. Old contract: a 6-discipline percentage spread summing to 100.
  it('SPECIALTIES lists every competition discipline once', () => {
    expect(trainerMarketplaceConfig.SPECIALTIES).toHaveLength(24);
    expect(new Set(trainerMarketplaceConfig.SPECIALTIES).size).toBe(24);
    expect(trainerMarketplaceConfig.SPECIALTIES).toContain('Pleasure Driving');
  });
});

// ---------------------------------------------------------------------------
// generateRandomTrainer
// ---------------------------------------------------------------------------
describe('generateRandomTrainer', () => {
  it('returns object with expected fields', () => {
    const t = generateRandomTrainer();
    expect(typeof t.firstName).toBe('string');
    expect(typeof t.lastName).toBe('string');
    expect(typeof t.skillLevel).toBe('string');
    expect(typeof t.personality).toBe('string');
    expect(typeof t.speciality).toBe('string');
    expect(typeof t.sessionRate).toBe('number');
    expect(typeof t.bio).toBe('string');
    expect(t.availability).toBe(true);
  });

  it('marketplaceId starts with mkt_trainer_', () => {
    const t = generateRandomTrainer();
    expect(t.marketplaceId.startsWith('mkt_trainer_')).toBe(true);
  });

  // OLD CONTRACT: a random rate inside a per-skill range. OWNER RULING 2026-10-28
  // (Equoria-nawn5): the price is the star level's (Rookie 100 ... Expert 500).
  it('sessionRate is the star level price', () => {
    for (let i = 0; i < 30; i++) {
      const t = generateRandomTrainer();
      expect(t.sessionRate).toBe(staffLevelFee(t.starLevel));
    }
  });

  it('skillLevel is one of known levels', () => {
    const valid = new Set(Object.keys(trainerMarketplaceConfig.skillDistribution));
    for (let i = 0; i < 20; i++) {
      expect(valid.has(generateRandomTrainer().skillLevel)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// generateTrainerMarketplace
// ---------------------------------------------------------------------------
describe('generateTrainerMarketplace', () => {
  it('returns array of default size', () => {
    const m = generateTrainerMarketplace();
    expect(Array.isArray(m)).toBe(true);
    expect(m).toHaveLength(trainerMarketplaceConfig.defaultMarketplaceSize);
  });

  it('returns exact count when size given', () => {
    expect(generateTrainerMarketplace(4)).toHaveLength(4);
  });

  it('first entry is a starter trainer (novice)', () => {
    const m = generateTrainerMarketplace(3);
    expect(m[0].skillLevel).toBe('novice');
  });

  it('all marketplaceIds are unique', () => {
    const m = generateTrainerMarketplace();
    const ids = m.map(t => t.marketplaceId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// trainerMarketplaceNeedsRefresh / getTrainerRefreshCost
// ---------------------------------------------------------------------------
describe('trainerMarketplaceNeedsRefresh', () => {
  it('returns true for null', () => {
    expect(trainerMarketplaceNeedsRefresh(null)).toBe(true);
  });

  it('returns false for recent timestamp', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    expect(trainerMarketplaceNeedsRefresh(recent)).toBe(false);
  });

  it('returns true for old timestamp (25 hours)', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(trainerMarketplaceNeedsRefresh(old)).toBe(true);
  });
});

describe('getTrainerRefreshCost', () => {
  it('returns 0 for null (free refresh needed)', () => {
    expect(getTrainerRefreshCost(null)).toBe(0);
  });

  it('returns premiumRefreshCost for recent timestamp', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    expect(getTrainerRefreshCost(recent)).toBe(trainerMarketplaceConfig.premiumRefreshCost);
  });

  it('returns 0 for expired timestamp', () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    expect(getTrainerRefreshCost(old)).toBe(0);
  });
});
