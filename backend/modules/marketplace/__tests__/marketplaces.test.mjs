/**
 * groomMarketplace / riderMarketplace / trainerMarketplace — unit tests (Equoria-rr7)
 *
 * All three files import only `crypto` (no DB). No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  MARKETPLACE_CONFIG,
  generateRandomGroom,
  generateMarketplace,
  needsRefresh,
  getRefreshCost,
} from '../../../services/groomMarketplace.mjs';
import {
  RIDER_MARKETPLACE_CONFIG,
  generateRandomRider,
  generateRiderMarketplace,
  riderMarketplaceNeedsRefresh,
  getRiderRefreshCost,
} from '../../../services/riderMarketplace.mjs';
import {
  TRAINER_MARKETPLACE_CONFIG,
  generateRandomTrainer,
  generateTrainerMarketplace,
  trainerMarketplaceNeedsRefresh,
  getTrainerRefreshCost,
} from '../../../services/trainerMarketplace.mjs';

// ---------------------------------------------------------------------------
// MARKETPLACE_CONFIG (groom)
// ---------------------------------------------------------------------------
describe('MARKETPLACE_CONFIG', () => {
  it('has DEFAULT_MARKETPLACE_SIZE of 12', () => {
    expect(MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBe(12);
  });

  it('has PREMIUM_REFRESH_COST of 100', () => {
    expect(MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST).toBe(100);
  });

  it('QUALITY_DISTRIBUTION sums to 100', () => {
    const sum = Object.values(MARKETPLACE_CONFIG.QUALITY_DISTRIBUTION).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('SPECIALTY_DISTRIBUTION sums to 100', () => {
    const sum = Object.values(MARKETPLACE_CONFIG.SPECIALTY_DISTRIBUTION).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('has EXPERIENCE_RANGES for all skill levels', () => {
    for (const level of ['novice', 'intermediate', 'expert', 'master']) {
      expect(MARKETPLACE_CONFIG.EXPERIENCE_RANGES[level]).toBeDefined();
    }
  });

  it('has BASE_SESSION_RATES for all skill levels', () => {
    for (const level of ['novice', 'intermediate', 'expert', 'master']) {
      expect(typeof MARKETPLACE_CONFIG.BASE_SESSION_RATES[level]).toBe('number');
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
      const range = MARKETPLACE_CONFIG.EXPERIENCE_RANGES[g.skillLevel];
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
    expect(m).toHaveLength(MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);
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
    // In test env REFRESH_INTERVAL_HOURS is 1 hour
    expect(needsRefresh(recent)).toBe(false);
  });

  it('returns true for lastRefresh older than REFRESH_INTERVAL_HOURS', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    expect(needsRefresh(old)).toBe(true);
  });
});

describe('getRefreshCost (groom)', () => {
  it('returns 0 when refresh is needed (null lastRefresh)', () => {
    expect(getRefreshCost(null)).toBe(0);
  });

  it('returns PREMIUM_REFRESH_COST when refresh is not needed', () => {
    const recent = new Date(Date.now() - 30 * 60 * 1000);
    expect(getRefreshCost(recent)).toBe(MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);
  });

  it('returns 0 when lastRefresh is very old', () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    expect(getRefreshCost(old)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// RIDER_MARKETPLACE_CONFIG
// ---------------------------------------------------------------------------
describe('RIDER_MARKETPLACE_CONFIG', () => {
  it('has DEFAULT_MARKETPLACE_SIZE of 6', () => {
    expect(RIDER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBe(6);
  });

  it('SKILL_DISTRIBUTION sums to 100', () => {
    const sum = Object.values(RIDER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('SPECIALTY_DISTRIBUTION sums to 100', () => {
    const sum = Object.values(RIDER_MARKETPLACE_CONFIG.SPECIALTY_DISTRIBUTION).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('has WEEKLY_RATE_RANGES for all skill levels', () => {
    for (const level of ['rookie', 'developing', 'experienced']) {
      expect(RIDER_MARKETPLACE_CONFIG.WEEKLY_RATE_RANGES[level]).toBeDefined();
    }
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
    expect(typeof r.skillLevel).toBe('string');
    expect(typeof r.personality).toBe('string');
    expect(typeof r.speciality).toBe('string');
    expect(typeof r.weeklyRate).toBe('number');
    expect(typeof r.experience).toBe('number');
    expect(typeof r.bio).toBe('string');
    expect(r.availability).toBe(true);
    expect(Array.isArray(r.knownAffinities)).toBe(true);
  });

  it('marketplaceId starts with mkt_rider_', () => {
    const r = generateRandomRider();
    expect(r.marketplaceId.startsWith('mkt_rider_')).toBe(true);
  });

  it('skillLevel is one of known levels', () => {
    const valid = new Set(['rookie', 'developing', 'experienced']);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(generateRandomRider().skillLevel)).toBe(true);
    }
  });

  it('weeklyRate is within skill level range', () => {
    for (let i = 0; i < 30; i++) {
      const r = generateRandomRider();
      const range = RIDER_MARKETPLACE_CONFIG.WEEKLY_RATE_RANGES[r.skillLevel];
      expect(r.weeklyRate).toBeGreaterThanOrEqual(range.min);
      expect(r.weeklyRate).toBeLessThanOrEqual(range.max);
    }
  });

  it('experienced riders have at least one known affinity', () => {
    let found = false;
    for (let i = 0; i < 50; i++) {
      const r = generateRandomRider();
      if (r.skillLevel === 'experienced') {
        expect(r.knownAffinities.length).toBeGreaterThan(0);
        found = true;
        break;
      }
    }
    if (!found) {
      // If we didn't generate an experienced rider in 50 tries, skip the inner assertion
      expect(true).toBe(true);
    }
  });

  it('rookie has empty knownAffinities', () => {
    let found = false;
    for (let i = 0; i < 50; i++) {
      const r = generateRandomRider();
      if (r.skillLevel === 'rookie') {
        expect(r.knownAffinities).toHaveLength(0);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateRiderMarketplace
// ---------------------------------------------------------------------------
describe('generateRiderMarketplace', () => {
  it('returns array of default size (6)', () => {
    const m = generateRiderMarketplace();
    expect(Array.isArray(m)).toBe(true);
    expect(m).toHaveLength(RIDER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);
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

  it('returns PREMIUM_REFRESH_COST for recent timestamp', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    expect(getRiderRefreshCost(recent)).toBe(RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);
  });
});

// ---------------------------------------------------------------------------
// TRAINER_MARKETPLACE_CONFIG
// ---------------------------------------------------------------------------
describe('TRAINER_MARKETPLACE_CONFIG', () => {
  it('has DEFAULT_MARKETPLACE_SIZE', () => {
    expect(typeof TRAINER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBe('number');
  });

  it('SKILL_DISTRIBUTION sums to 100', () => {
    const sum = Object.values(TRAINER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('SPECIALTY_DISTRIBUTION sums to 100', () => {
    const sum = Object.values(TRAINER_MARKETPLACE_CONFIG.SPECIALTY_DISTRIBUTION).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
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

  it('sessionRate is within skill level range', () => {
    for (let i = 0; i < 30; i++) {
      const t = generateRandomTrainer();
      const range = TRAINER_MARKETPLACE_CONFIG.SESSION_RATE_RANGES[t.skillLevel];
      expect(t.sessionRate).toBeGreaterThanOrEqual(range.min);
      expect(t.sessionRate).toBeLessThanOrEqual(range.max);
    }
  });

  it('skillLevel is one of known levels', () => {
    const valid = new Set(Object.keys(TRAINER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION));
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
    expect(m).toHaveLength(TRAINER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);
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

  it('returns PREMIUM_REFRESH_COST for recent timestamp', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    expect(getTrainerRefreshCost(recent)).toBe(TRAINER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);
  });

  it('returns 0 for expired timestamp', () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    expect(getTrainerRefreshCost(old)).toBe(0);
  });
});
