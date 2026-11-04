/**
 * groomMarketplace + riderMarketplace + trainerMarketplace branch-coverage tests
 * (Equoria-jkht coverage sprint).
 *
 * All pure functions — no DB fixture required.
 *
 * groomMarketplace:
 *   generateRandomGroom — returns expected shape
 *   generateMarketplace — returns array of default size
 *   needsRefresh — null → true; recent → false; stale → true
 *   getRefreshCost — needsRefresh=true → 0; needsRefresh=false → premiumRefreshCost
 *
 * riderMarketplace:
 *   generateRandomRider — rookie has experience=0 and no affinity hint (Equoria-xlw03)
 *   generateRiderMarketplace — starter rider at index 0
 *   riderMarketplaceNeedsRefresh — same 3 branches as groomMarketplace
 *   getRiderRefreshCost — same 2 branches
 *
 * trainerMarketplace:
 *   generateRandomTrainer — returns expected shape
 *   generateTrainerMarketplace — starter trainer at index 0 (patient/novice/Dressage)
 *   trainerMarketplaceNeedsRefresh — same 3 branches
 *   getTrainerRefreshCost — same 2 branches
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

// ── groomMarketplace ──────────────────────────────────────────────────────────

describe('groomMarketplace — generateRandomGroom', () => {
  it('returns expected shape with all required fields', () => {
    const groom = generateRandomGroom();
    expect(groom).toHaveProperty('firstName');
    expect(groom).toHaveProperty('lastName');
    expect(groom).toHaveProperty('specialty');
    expect(groom).toHaveProperty('skillLevel');
    expect(groom).toHaveProperty('personality');
    expect(typeof groom.experience).toBe('number');
    expect(typeof groom.sessionRate).toBe('number');
    expect(typeof groom.bio).toBe('string');
    expect(groom.availability).toBe(true);
    expect(groom.marketplaceId).toMatch(/^mkt-/);
  });

  it('skillLevel is one of the defined quality distribution keys', () => {
    const validSkillLevels = Object.keys(marketplaceConfig.qualityDistribution);
    const groom = generateRandomGroom();
    expect(validSkillLevels).toContain(groom.skillLevel);
  });
});

describe('groomMarketplace — generateMarketplace', () => {
  it('returns array of defaultMarketplaceSize grooms', () => {
    const marketplace = generateMarketplace();
    expect(marketplace).toHaveLength(marketplaceConfig.defaultMarketplaceSize);
    expect(marketplace[0]).toHaveProperty('marketplaceId');
  });

  it('returns array of requested size', () => {
    const marketplace = generateMarketplace(3);
    expect(marketplace).toHaveLength(3);
  });
});

describe('groomMarketplace — needsRefresh', () => {
  it('returns true when lastRefresh is null (!lastRefresh branch)', () => {
    expect(needsRefresh(null)).toBe(true);
  });

  it('returns true when lastRefresh is undefined (!lastRefresh branch)', () => {
    expect(needsRefresh(undefined)).toBe(true);
  });

  it('returns false when lastRefresh is recent (hoursDiff < refreshIntervalHours)', () => {
    // lastRefresh = 30 seconds ago → well within any interval
    const recent = new Date(Date.now() - 30 * 1000);
    expect(needsRefresh(recent)).toBe(false);
  });

  it('returns true when lastRefresh is stale (hoursDiff >= refreshIntervalHours)', () => {
    // lastRefresh = 3 days ago → always stale
    const stale = new Date(Date.now() - 72 * 60 * 60 * 1000);
    expect(needsRefresh(stale)).toBe(true);
  });
});

describe('groomMarketplace — getRefreshCost', () => {
  it('returns 0 when free refresh is available (needsRefresh=true)', () => {
    expect(getRefreshCost(null)).toBe(0);
  });

  it('returns premiumRefreshCost when no free refresh available (needsRefresh=false)', () => {
    const recent = new Date(Date.now() - 30 * 1000);
    expect(getRefreshCost(recent)).toBe(marketplaceConfig.premiumRefreshCost);
  });
});

describe('groomMarketplace — marketplaceConfig export', () => {
  it('has expected constants', () => {
    expect(marketplaceConfig.defaultMarketplaceSize).toBe(12);
    expect(marketplaceConfig.premiumRefreshCost).toBe(100);
    expect(typeof marketplaceConfig.refreshIntervalHours).toBe('number');
    // Owner ruling 2026-10-28 (q177): every new groom on the hiring list is a Rookie,
    // from the novice tier. Old contract: novice 40%.
    expect(marketplaceConfig.qualityDistribution.novice).toBe(100);
  });
});

// ── riderMarketplace ──────────────────────────────────────────────────────────

describe('riderMarketplace — generateRiderMarketplace', () => {
  it('returns array of defaultMarketplaceSize riders', () => {
    const marketplace = generateRiderMarketplace();
    expect(marketplace).toHaveLength(riderMarketplaceConfig.defaultMarketplaceSize);
  });

  // Owner rulings 2026-10-29 (q282/q283): the rider skill word and the visible
  // speciality are retired; star level is the only level. Old contract:
  // skillLevel 'rookie', speciality 'Dressage'.
  it('index 0 is always the starter rider (Rookie, methodical, no speciality)', () => {
    const marketplace = generateRiderMarketplace();
    const starter = marketplace[0];
    expect(starter.starLevel).toBe('rookie');
    expect(starter).not.toHaveProperty('skillLevel');
    expect(starter.personality).toBe('methodical');
    expect(starter).not.toHaveProperty('speciality');
    expect(starter.experience).toBe(0);
    // Equoria-xlw03 (owner rulings 2026-10-28): the old affinity hint is gone.
    expect(starter).not.toHaveProperty('knownAffinities');
  });

  it('returns array of requested size', () => {
    const marketplace = generateRiderMarketplace(4);
    expect(marketplace).toHaveLength(4);
  });
});

describe('riderMarketplace — riderMarketplaceNeedsRefresh', () => {
  it('returns true for null lastRefresh', () => {
    expect(riderMarketplaceNeedsRefresh(null)).toBe(true);
  });

  it('returns false for recent lastRefresh', () => {
    const recent = new Date(Date.now() - 30 * 1000);
    expect(riderMarketplaceNeedsRefresh(recent)).toBe(false);
  });

  it('returns true for stale lastRefresh', () => {
    const stale = new Date(Date.now() - 48 * 60 * 60 * 1000);
    expect(riderMarketplaceNeedsRefresh(stale)).toBe(true);
  });
});

describe('riderMarketplace — getRiderRefreshCost', () => {
  it('returns 0 when refresh available (null lastRefresh)', () => {
    expect(getRiderRefreshCost(null)).toBe(0);
  });

  it('returns premiumRefreshCost when no free refresh', () => {
    const recent = new Date(Date.now() - 30 * 1000);
    expect(getRiderRefreshCost(recent)).toBe(riderMarketplaceConfig.premiumRefreshCost);
  });
});

describe('riderMarketplace — riderMarketplaceConfig export', () => {
  it('has expected constants', () => {
    expect(riderMarketplaceConfig.defaultMarketplaceSize).toBe(6);
    expect(riderMarketplaceConfig.premiumRefreshCost).toBe(50);
    // Equoria-nawn5: weekly rates are now the star level's price (constants/staffLevels.mjs).
    // Owner ruling 2026-10-29 (q282): no skill-word odds. Old contract: skillDistribution.rookie 45.
    expect(riderMarketplaceConfig).not.toHaveProperty('skillDistribution');
  });
});

// ── trainerMarketplace ────────────────────────────────────────────────────────

describe('trainerMarketplace — generateRandomTrainer', () => {
  it('returns expected shape', () => {
    const trainer = generateRandomTrainer();
    expect(trainer).toHaveProperty('firstName');
    expect(trainer).toHaveProperty('lastName');
    expect(trainer).toHaveProperty('skillLevel');
    expect(trainer).toHaveProperty('personality');
    expect(trainer).toHaveProperty('speciality');
    expect(typeof trainer.sessionRate).toBe('number');
    expect(trainer.availability).toBe(true);
    expect(trainer.marketplaceId).toMatch(/^mkt-trainer-/);
  });
});

describe('trainerMarketplace — generateTrainerMarketplace', () => {
  it('returns array of defaultMarketplaceSize trainers', () => {
    const marketplace = generateTrainerMarketplace();
    expect(marketplace).toHaveLength(trainerMarketplaceConfig.defaultMarketplaceSize);
  });

  it('index 0 is always the starter trainer (novice/patient/Dressage)', () => {
    const marketplace = generateTrainerMarketplace();
    const starter = marketplace[0];
    expect(starter.skillLevel).toBe('novice');
    expect(starter.personality).toBe('patient');
    expect(starter.speciality).toBe('Dressage');
  });

  it('returns array of requested size', () => {
    const marketplace = generateTrainerMarketplace(3);
    expect(marketplace).toHaveLength(3);
  });
});

describe('trainerMarketplace — trainerMarketplaceNeedsRefresh', () => {
  it('returns true for null lastRefresh', () => {
    expect(trainerMarketplaceNeedsRefresh(null)).toBe(true);
  });

  it('returns false for recent lastRefresh', () => {
    const recent = new Date(Date.now() - 30 * 1000);
    expect(trainerMarketplaceNeedsRefresh(recent)).toBe(false);
  });

  it('returns true for stale lastRefresh', () => {
    const stale = new Date(Date.now() - 48 * 60 * 60 * 1000);
    expect(trainerMarketplaceNeedsRefresh(stale)).toBe(true);
  });
});

describe('trainerMarketplace — getTrainerRefreshCost', () => {
  it('returns 0 when refresh available (null lastRefresh)', () => {
    expect(getTrainerRefreshCost(null)).toBe(0);
  });

  it('returns premiumRefreshCost when no free refresh', () => {
    const recent = new Date(Date.now() - 30 * 1000);
    expect(getTrainerRefreshCost(recent)).toBe(trainerMarketplaceConfig.premiumRefreshCost);
  });
});

describe('trainerMarketplace — trainerMarketplaceConfig export', () => {
  it('has expected constants', () => {
    expect(trainerMarketplaceConfig.defaultMarketplaceSize).toBe(6);
    expect(trainerMarketplaceConfig.premiumRefreshCost).toBe(50);
    // Equoria-nawn5: session rates are now the star level's price (constants/staffLevels.mjs).
    expect(trainerMarketplaceConfig.skillDistribution.novice).toBe(45);
  });
});
