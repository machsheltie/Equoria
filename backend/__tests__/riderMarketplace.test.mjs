/**
 * riderMarketplace — unit tests (Equoria-rr7)
 *
 * Covers all exported functions from backend/modules/riders/services/riderMarketplace.mjs.
 * No database required — all functions are pure random generators or date checks.
 *
 * Owner rulings 2026-10-29 (q282/q283, Equoria-waqkr) changed the offer shape: a rider
 * has no old skill word (rookie / developing / experienced, drawn at 45/40/15 with
 * experience by tier) and no visible speciality discipline. Every new rider is a Rookie
 * with 0 experience whose bio names no discipline.
 *
 * Exported:
 *   - RIDER_MARKETPLACE_CONFIG (constant)
 *   - generateRandomRider()
 *   - generateRiderMarketplace(size?)
 *   - riderMarketplaceNeedsRefresh(lastRefresh)
 *   - getRiderRefreshCost(lastRefresh)
 */

import { describe, it, expect } from '@jest/globals';
import {
  RIDER_MARKETPLACE_CONFIG,
  generateRandomRider,
  generateRiderMarketplace,
  riderMarketplaceNeedsRefresh,
  getRiderRefreshCost,
} from '../modules/riders/services/riderMarketplace.mjs';
import { DISCIPLINE_VALUES } from '../constants/schema.mjs';
import { staffLevelFee, staffLevels } from '../constants/staffLevels.mjs';

// ─── RIDER_MARKETPLACE_CONFIG ─────────────────────────────────────────────────

describe('RIDER_MARKETPLACE_CONFIG', () => {
  it('has DEFAULT_MARKETPLACE_SIZE of 6', () => {
    expect(RIDER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBe(6);
  });

  it('has REFRESH_INTERVAL_HOURS of 24', () => {
    expect(RIDER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS).toBe(24);
  });

  it('has PREMIUM_REFRESH_COST of 50', () => {
    expect(RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST).toBe(50);
  });

  // OLD CONTRACT: a random weekly rate inside a per-skill range.
  // OWNER RULING 2026-10-28 (Equoria-nawn5): the price is the star level's (Rookie 100 ...
  // Expert 500), drawn inside the old skill tier.
  it('prices every rider from its star level', () => {
    for (let i = 0; i < 20; i++) {
      const rider = generateRandomRider();
      expect(staffLevels).toContain(rider.starLevel);
      expect(rider.weeklyRate).toBe(staffLevelFee(rider.starLevel));
    }
  });

  it('has no skill-word odds and no speciality list (q282/q283)', () => {
    expect(RIDER_MARKETPLACE_CONFIG).not.toHaveProperty('SKILL_DISTRIBUTION');
    expect(RIDER_MARKETPLACE_CONFIG).not.toHaveProperty('SPECIALTIES');
  });
});

// ─── generateRandomRider ──────────────────────────────────────────────────────

describe('generateRandomRider', () => {
  it('returns an object with required fields', () => {
    const rider = generateRandomRider();
    expect(rider).toHaveProperty('marketplaceId');
    expect(rider).toHaveProperty('firstName');
    expect(rider).toHaveProperty('lastName');
    expect(rider).toHaveProperty('starLevel');
    expect(rider).toHaveProperty('personality');
    expect(rider).toHaveProperty('weeklyRate');
    expect(rider).toHaveProperty('experience');
    expect(rider).toHaveProperty('bio');
    expect(rider).toHaveProperty('availability');
    expect(rider).not.toHaveProperty('knownAffinities');
    expect(rider).not.toHaveProperty('skillLevel');
    expect(rider).not.toHaveProperty('speciality');
  });

  it('marketplaceId starts with mkt_rider_', () => {
    const rider = generateRandomRider();
    expect(rider.marketplaceId).toMatch(/^mkt_rider_/);
  });

  it('personality is one of the 4 valid personalities', () => {
    const validPersonalities = ['daring', 'methodical', 'intuitive', 'competitive'];
    for (let i = 0; i < 20; i++) {
      const rider = generateRandomRider();
      expect(validPersonalities).toContain(rider.personality);
    }
  });

  // Owner rulings 2026-10-28 (q160/q177, Equoria-xlw03) changed this contract: every new
  // rider is a Rookie, and the old affinity hint (knownAffinities, the specialty shown for
  // experienced riders) is gone — hidden items are revealed only by levelling up.
  it('every new rider is a Rookie', () => {
    for (let i = 0; i < 50; i++) {
      const rider = generateRandomRider();
      expect(rider.starLevel).toBe('rookie');
    }
  });

  it('availability is true', () => {
    const rider = generateRandomRider();
    expect(rider.availability).toBe(true);
  });

  it('bio is a non-empty string', () => {
    const rider = generateRandomRider();
    expect(typeof rider.bio).toBe('string');
    expect(rider.bio.length).toBeGreaterThan(0);
  });

  it('firstName and lastName are non-empty strings', () => {
    const rider = generateRandomRider();
    expect(typeof rider.firstName).toBe('string');
    expect(rider.firstName.length).toBeGreaterThan(0);
    expect(typeof rider.lastName).toBe('string');
    expect(rider.lastName.length).toBeGreaterThan(0);
  });

  // Old contract: experience 0 / 0-49 / 50-149 by skill tier. Staff earn no XP and the
  // tiers are retired (q282), so every new rider starts at 0.
  it('every new rider has experience 0 (50-run sweep)', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRandomRider().experience).toBe(0);
    }
  });

  // Owner rulings 2026-10-28 (q160/q177) removed the affinity hint; 2026-10-29 (q283)
  // removed the visible speciality: disciplines are learned only through growth.
  it('no offer carries an affinity hint, a speciality, or a discipline in its bio', () => {
    for (let i = 0; i < 100; i++) {
      const rider = generateRandomRider();
      expect(rider).not.toHaveProperty('knownAffinities');
      expect(rider).not.toHaveProperty('speciality');
      for (const discipline of DISCIPLINE_VALUES) {
        expect(rider.bio).not.toContain(discipline);
      }
    }
  });

  it('generates unique marketplaceIds on repeated calls', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateRandomRider().marketplaceId));
    expect(ids.size).toBe(10);
  });
});

// ─── generateRiderMarketplace ─────────────────────────────────────────────────

describe('generateRiderMarketplace', () => {
  it('returns an array of default size (6) when no size given', () => {
    const marketplace = generateRiderMarketplace();
    expect(Array.isArray(marketplace)).toBe(true);
    expect(marketplace).toHaveLength(RIDER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);
  });

  it('returns array of the requested size', () => {
    expect(generateRiderMarketplace(3)).toHaveLength(3);
    expect(generateRiderMarketplace(10)).toHaveLength(10);
    expect(generateRiderMarketplace(1)).toHaveLength(1);
  });

  it('first rider is always a starter rider (Rookie, methodical, no speciality)', () => {
    const marketplace = generateRiderMarketplace(6);
    const starter = marketplace[0];
    expect(starter.starLevel).toBe('rookie');
    expect(starter.personality).toBe('methodical');
    expect(starter).not.toHaveProperty('speciality');
  });

  it('starter rider is a Rookie at the Rookie price', () => {
    const marketplace = generateRiderMarketplace(6);
    const starter = marketplace[0];
    expect(starter.starLevel).toBe('rookie');
    expect(starter.weeklyRate).toBe(100);
  });

  it('starter rider has experience of 0', () => {
    const marketplace = generateRiderMarketplace(6);
    const starter = marketplace[0];
    expect(starter.experience).toBe(0);
  });

  it('starter rider carries no affinity hint', () => {
    const marketplace = generateRiderMarketplace(6);
    const starter = marketplace[0];
    expect(starter).not.toHaveProperty('knownAffinities');
  });

  it('all riders have the required shape', () => {
    const marketplace = generateRiderMarketplace(4);
    marketplace.forEach(rider => {
      expect(rider).toHaveProperty('marketplaceId');
      expect(rider).toHaveProperty('firstName');
      expect(rider).toHaveProperty('starLevel');
      expect(rider).not.toHaveProperty('skillLevel');
      expect(rider).toHaveProperty('weeklyRate');
      expect(rider).toHaveProperty('availability');
      expect(rider).not.toHaveProperty('knownAffinities');
    });
  });

  it('returns array of length 1 for size=1 (only starter)', () => {
    const marketplace = generateRiderMarketplace(1);
    expect(marketplace).toHaveLength(1);
    expect(marketplace[0].starLevel).toBe('rookie');
    expect(marketplace[0].personality).toBe('methodical');
  });
});

// ─── riderMarketplaceNeedsRefresh ─────────────────────────────────────────────

describe('riderMarketplaceNeedsRefresh', () => {
  it('returns true when lastRefresh is null', () => {
    expect(riderMarketplaceNeedsRefresh(null)).toBe(true);
  });

  it('returns true when lastRefresh is undefined', () => {
    expect(riderMarketplaceNeedsRefresh(undefined)).toBe(true);
  });

  it('returns false when lastRefresh is less than 24 hours ago', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
    expect(riderMarketplaceNeedsRefresh(oneHourAgo)).toBe(false);
  });

  it('returns false when lastRefresh is 23 hours ago', () => {
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
    expect(riderMarketplaceNeedsRefresh(twentyThreeHoursAgo)).toBe(false);
  });

  it('returns true when lastRefresh is more than 24 hours ago', () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(riderMarketplaceNeedsRefresh(twentyFiveHoursAgo)).toBe(true);
  });

  it('returns true when lastRefresh is a week ago', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(riderMarketplaceNeedsRefresh(sevenDaysAgo)).toBe(true);
  });

  it('accepts a date string as lastRefresh', () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(riderMarketplaceNeedsRefresh(recentDate)).toBe(false);

    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(riderMarketplaceNeedsRefresh(oldDate)).toBe(true);
  });
});

// ─── getRiderRefreshCost ──────────────────────────────────────────────────────

describe('getRiderRefreshCost', () => {
  it('returns 0 when refresh is needed (null lastRefresh)', () => {
    expect(getRiderRefreshCost(null)).toBe(0);
  });

  it('returns 0 when refresh is needed (old date)', () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    expect(getRiderRefreshCost(oldDate)).toBe(0);
  });

  it('returns PREMIUM_REFRESH_COST when refresh is not yet needed', () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000);
    expect(getRiderRefreshCost(recentDate)).toBe(RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);
  });

  it('PREMIUM_REFRESH_COST matches config (50)', () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000);
    expect(getRiderRefreshCost(recentDate)).toBe(50);
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Statistical distribution sweep, bio-content, multi-iteration rate sweep,
// non-negative experience, and config range/positivity invariants not covered above.
describe('riderMarketplace — distribution, bio & config invariants (merged from legacy backend/tests, Equoria-wvuin)', () => {
  it('weekly rate is the star level price (50-run sweep)', () => {
    for (let i = 0; i < 50; i++) {
      const rider = generateRandomRider();
      expect(rider.weeklyRate).toBe(staffLevelFee(rider.starLevel));
    }
  });

  it('experience is always non-negative (30-run sweep)', () => {
    for (let i = 0; i < 30; i++) {
      expect(generateRandomRider().experience).toBeGreaterThanOrEqual(0);
    }
  });

  it('bios include the rider first name and are reasonably long', () => {
    for (let i = 0; i < 20; i++) {
      const rider = generateRandomRider();
      expect(rider.bio).toContain(rider.firstName);
      expect(rider.bio.length).toBeGreaterThan(20);
    }
  });

  // Old contract: a 45/40/15 rookie/developing/experienced spread (retired, q282).
  it('a large (1000) sample is all Rookies with no old skill word', () => {
    const sample = generateRiderMarketplace(1000);
    expect(sample.every(r => r.starLevel === 'rookie' && !('skillLevel' in r))).toBe(true);
  });

  it('weekly prices run 100 to 500 by star level', () => {
    expect(staffLevels.map(staffLevelFee)).toEqual([100, 200, 300, 400, 500]);
  });

  it('config marketplace size and premium cost are positive', () => {
    expect(RIDER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBeGreaterThan(0);
    expect(RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST).toBeGreaterThan(0);
  });
});
