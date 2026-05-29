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
 *   getRefreshCost — needsRefresh=true → 0; needsRefresh=false → PREMIUM_REFRESH_COST
 *
 * riderMarketplace:
 *   generateRandomRider — rookie has experience=0 + knownAffinities=[]
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
  MARKETPLACE_CONFIG,
  generateRandomGroom,
  generateMarketplace,
  needsRefresh,
  getRefreshCost,
} from '../../grooms/services/groomMarketplace.mjs';
import {
  RIDER_MARKETPLACE_CONFIG,
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
    expect(groom.marketplaceId).toMatch(/^mkt_/);
  });

  it('skillLevel is one of the defined quality distribution keys', () => {
    const validSkillLevels = Object.keys(MARKETPLACE_CONFIG.QUALITY_DISTRIBUTION);
    const groom = generateRandomGroom();
    expect(validSkillLevels).toContain(groom.skillLevel);
  });
});

describe('groomMarketplace — generateMarketplace', () => {
  it('returns array of DEFAULT_MARKETPLACE_SIZE grooms', () => {
    const marketplace = generateMarketplace();
    expect(marketplace).toHaveLength(MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);
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

  it('returns false when lastRefresh is recent (hoursDiff < REFRESH_INTERVAL_HOURS)', () => {
    // lastRefresh = 30 seconds ago → well within any interval
    const recent = new Date(Date.now() - 30 * 1000);
    expect(needsRefresh(recent)).toBe(false);
  });

  it('returns true when lastRefresh is stale (hoursDiff >= REFRESH_INTERVAL_HOURS)', () => {
    // lastRefresh = 3 days ago → always stale
    const stale = new Date(Date.now() - 72 * 60 * 60 * 1000);
    expect(needsRefresh(stale)).toBe(true);
  });
});

describe('groomMarketplace — getRefreshCost', () => {
  it('returns 0 when free refresh is available (needsRefresh=true)', () => {
    expect(getRefreshCost(null)).toBe(0);
  });

  it('returns PREMIUM_REFRESH_COST when no free refresh available (needsRefresh=false)', () => {
    const recent = new Date(Date.now() - 30 * 1000);
    expect(getRefreshCost(recent)).toBe(MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);
  });
});

describe('groomMarketplace — MARKETPLACE_CONFIG export', () => {
  it('has expected constants', () => {
    expect(MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBe(12);
    expect(MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST).toBe(100);
    expect(typeof MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS).toBe('number');
    expect(MARKETPLACE_CONFIG.QUALITY_DISTRIBUTION.novice).toBe(40);
  });
});

// ── riderMarketplace ──────────────────────────────────────────────────────────

describe('riderMarketplace — generateRiderMarketplace', () => {
  it('returns array of DEFAULT_MARKETPLACE_SIZE riders', () => {
    const marketplace = generateRiderMarketplace();
    expect(marketplace).toHaveLength(RIDER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);
  });

  it('index 0 is always the starter rider (rookie/methodical/Dressage)', () => {
    const marketplace = generateRiderMarketplace();
    const starter = marketplace[0];
    expect(starter.skillLevel).toBe('rookie');
    expect(starter.personality).toBe('methodical');
    expect(starter.speciality).toBe('Dressage');
    expect(starter.experience).toBe(0);
    expect(starter.knownAffinities).toEqual([]);
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

  it('returns PREMIUM_REFRESH_COST when no free refresh', () => {
    const recent = new Date(Date.now() - 30 * 1000);
    expect(getRiderRefreshCost(recent)).toBe(RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);
  });
});

describe('riderMarketplace — RIDER_MARKETPLACE_CONFIG export', () => {
  it('has expected constants', () => {
    expect(RIDER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBe(6);
    expect(RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST).toBe(50);
    expect(RIDER_MARKETPLACE_CONFIG.WEEKLY_RATE_RANGES.rookie.min).toBe(150);
    expect(RIDER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION.rookie).toBe(45);
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
    expect(trainer.marketplaceId).toMatch(/^mkt_trainer_/);
  });
});

describe('trainerMarketplace — generateTrainerMarketplace', () => {
  it('returns array of DEFAULT_MARKETPLACE_SIZE trainers', () => {
    const marketplace = generateTrainerMarketplace();
    expect(marketplace).toHaveLength(TRAINER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);
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

  it('returns PREMIUM_REFRESH_COST when no free refresh', () => {
    const recent = new Date(Date.now() - 30 * 1000);
    expect(getTrainerRefreshCost(recent)).toBe(TRAINER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);
  });
});

describe('trainerMarketplace — TRAINER_MARKETPLACE_CONFIG export', () => {
  it('has expected constants', () => {
    expect(TRAINER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBe(6);
    expect(TRAINER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST).toBe(50);
    expect(TRAINER_MARKETPLACE_CONFIG.SESSION_RATE_RANGES.novice.min).toBe(100);
    expect(TRAINER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION.novice).toBe(45);
  });
});
