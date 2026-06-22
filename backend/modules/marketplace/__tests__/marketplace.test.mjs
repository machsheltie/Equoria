/**
 * marketplace (groom/rider/trainer) — unit tests (Equoria-rr7)
 *
 * Three marketplace services with identical structure: pure-function generators,
 * needsRefresh date comparison, getRefreshCost calculation. Only imports crypto.
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateRandomGroom,
  generateMarketplace,
  needsRefresh,
  getRefreshCost,
  MARKETPLACE_CONFIG,
} from '../../grooms/index.mjs';
import {
  generateRandomRider,
  generateRiderMarketplace,
  riderMarketplaceNeedsRefresh,
  getRiderRefreshCost,
  RIDER_MARKETPLACE_CONFIG,
} from '../../riders/index.mjs';
import {
  generateRandomTrainer,
  generateTrainerMarketplace,
  trainerMarketplaceNeedsRefresh,
  getTrainerRefreshCost,
  TRAINER_MARKETPLACE_CONFIG,
} from '../../trainers/index.mjs';

// ---------------------------------------------------------------------------
// MARKETPLACE_CONFIG shape
// ---------------------------------------------------------------------------
describe('MARKETPLACE_CONFIG', () => {
  it('has DEFAULT_MARKETPLACE_SIZE', () => {
    expect(typeof MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBe('number');
  });

  it('QUALITY_DISTRIBUTION values sum to 100', () => {
    const total = Object.values(MARKETPLACE_CONFIG.QUALITY_DISTRIBUTION).reduce((s, v) => s + v, 0);
    expect(total).toBe(100);
  });

  it('SPECIALTY_DISTRIBUTION values sum to 100', () => {
    const total = Object.values(MARKETPLACE_CONFIG.SPECIALTY_DISTRIBUTION).reduce((s, v) => s + v, 0);
    expect(total).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// generateRandomGroom
// ---------------------------------------------------------------------------
describe('generateRandomGroom', () => {
  it('returns an object with required fields', () => {
    const groom = generateRandomGroom();
    expect(groom).toHaveProperty('firstName');
    expect(groom).toHaveProperty('lastName');
    expect(groom).toHaveProperty('specialty');
    expect(groom).toHaveProperty('skillLevel');
    expect(groom).toHaveProperty('personality');
    expect(groom).toHaveProperty('experience');
    expect(groom).toHaveProperty('sessionRate');
    expect(groom).toHaveProperty('bio');
    expect(groom).toHaveProperty('availability');
    expect(groom).toHaveProperty('marketplaceId');
  });

  it('skillLevel is one of known values', () => {
    const groom = generateRandomGroom();
    expect(['novice', 'intermediate', 'expert', 'master']).toContain(groom.skillLevel);
  });

  it('specialty is one of known values', () => {
    const groom = generateRandomGroom();
    expect(['general', 'foalCare', 'training', 'medical']).toContain(groom.specialty);
  });

  it('experience is within expected range for skill level', () => {
    const groom = generateRandomGroom();
    const range = MARKETPLACE_CONFIG.EXPERIENCE_RANGES[groom.skillLevel];
    expect(groom.experience).toBeGreaterThanOrEqual(range.min);
    expect(groom.experience).toBeLessThanOrEqual(range.max);
  });

  it('sessionRate is a positive number', () => {
    const groom = generateRandomGroom();
    expect(typeof groom.sessionRate).toBe('number');
    expect(groom.sessionRate).toBeGreaterThan(0);
  });

  it('availability is true', () => {
    expect(generateRandomGroom().availability).toBe(true);
  });

  it('marketplaceId is a non-empty string', () => {
    const groom = generateRandomGroom();
    expect(typeof groom.marketplaceId).toBe('string');
    expect(groom.marketplaceId.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// generateMarketplace
// ---------------------------------------------------------------------------
describe('generateMarketplace', () => {
  it('returns array of default size', () => {
    const marketplace = generateMarketplace();
    expect(Array.isArray(marketplace)).toBe(true);
    expect(marketplace).toHaveLength(MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);
  });

  it('returns array of specified size', () => {
    expect(generateMarketplace(5)).toHaveLength(5);
    expect(generateMarketplace(1)).toHaveLength(1);
  });

  it('all entries are valid groom objects', () => {
    const marketplace = generateMarketplace(3);
    for (const groom of marketplace) {
      expect(groom).toHaveProperty('skillLevel');
      expect(groom).toHaveProperty('specialty');
    }
  });
});

// ---------------------------------------------------------------------------
// needsRefresh / getRefreshCost (groom)
// ---------------------------------------------------------------------------
describe('needsRefresh — groom marketplace', () => {
  it('returns true when lastRefresh is null', () => {
    expect(needsRefresh(null)).toBe(true);
  });

  it('returns true when lastRefresh is undefined', () => {
    expect(needsRefresh(undefined)).toBe(true);
  });

  it('returns true for a date 25 hours ago (beyond refresh interval)', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(needsRefresh(old)).toBe(true);
  });

  it('returns false for a very recent date (just now)', () => {
    const now = new Date();
    expect(needsRefresh(now)).toBe(false);
  });
});

describe('getRefreshCost — groom marketplace', () => {
  it('returns 0 when refresh is available (old lastRefresh)', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(getRefreshCost(old)).toBe(0);
  });

  it('returns PREMIUM_REFRESH_COST when refresh is not yet due', () => {
    const now = new Date();
    expect(getRefreshCost(now)).toBe(MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);
  });

  it('returns 0 for null lastRefresh', () => {
    expect(getRefreshCost(null)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateRandomRider
// ---------------------------------------------------------------------------
describe('generateRandomRider', () => {
  it('returns an object with required rider fields', () => {
    const rider = generateRandomRider();
    expect(typeof rider).toBe('object');
    expect(rider).not.toBeNull();
    // Should have some expected fields
    expect(Object.keys(rider).length).toBeGreaterThan(0);
  });

  it('rider has a marketplaceId', () => {
    const rider = generateRandomRider();
    expect(rider).toHaveProperty('marketplaceId');
  });
});

describe('generateRiderMarketplace', () => {
  it('returns array of default size', () => {
    const marketplace = generateRiderMarketplace();
    expect(Array.isArray(marketplace)).toBe(true);
    expect(marketplace).toHaveLength(RIDER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);
  });

  it('returns specified size', () => {
    expect(generateRiderMarketplace(3)).toHaveLength(3);
  });
});

describe('riderMarketplaceNeedsRefresh', () => {
  it('returns true for null', () => {
    expect(riderMarketplaceNeedsRefresh(null)).toBe(true);
  });

  it('returns true for old date', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(riderMarketplaceNeedsRefresh(old)).toBe(true);
  });

  it('returns false for very recent date', () => {
    expect(riderMarketplaceNeedsRefresh(new Date())).toBe(false);
  });
});

describe('getRiderRefreshCost', () => {
  it('returns 0 for null (refresh available)', () => {
    expect(getRiderRefreshCost(null)).toBe(0);
  });

  it('returns premium cost for fresh marketplace', () => {
    expect(getRiderRefreshCost(new Date())).toBe(RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);
  });
});

// ---------------------------------------------------------------------------
// generateRandomTrainer
// ---------------------------------------------------------------------------
describe('generateRandomTrainer', () => {
  it('returns an object with required trainer fields', () => {
    const trainer = generateRandomTrainer();
    expect(typeof trainer).toBe('object');
    expect(trainer).not.toBeNull();
    expect(Object.keys(trainer).length).toBeGreaterThan(0);
  });

  it('trainer has a marketplaceId', () => {
    expect(generateRandomTrainer()).toHaveProperty('marketplaceId');
  });
});

describe('generateTrainerMarketplace', () => {
  it('returns array of default size', () => {
    const marketplace = generateTrainerMarketplace();
    expect(Array.isArray(marketplace)).toBe(true);
    expect(marketplace).toHaveLength(TRAINER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);
  });

  it('returns specified size', () => {
    expect(generateTrainerMarketplace(4)).toHaveLength(4);
  });
});

describe('trainerMarketplaceNeedsRefresh', () => {
  it('returns true for null', () => {
    expect(trainerMarketplaceNeedsRefresh(null)).toBe(true);
  });

  it('returns true for old date', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(trainerMarketplaceNeedsRefresh(old)).toBe(true);
  });

  it('returns false for fresh date', () => {
    expect(trainerMarketplaceNeedsRefresh(new Date())).toBe(false);
  });
});

describe('getTrainerRefreshCost', () => {
  it('returns 0 for null', () => {
    expect(getTrainerRefreshCost(null)).toBe(0);
  });

  it('returns premium cost for fresh marketplace', () => {
    expect(getTrainerRefreshCost(new Date())).toBe(TRAINER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);
  });
});
