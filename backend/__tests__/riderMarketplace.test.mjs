/**
 * riderMarketplace — unit tests (Equoria-rr7)
 *
 * Covers all exported functions from backend/modules/riders/services/riderMarketplace.mjs.
 * No database required — all functions are pure random generators or date checks.
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

  it('SKILL_DISTRIBUTION percentages sum to 100', () => {
    const total = Object.values(RIDER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION).reduce((s, v) => s + v, 0);
    expect(total).toBe(100);
  });

  // Owner ruling 2026-10-21: specialties are an even pick across every competition
  // discipline. Old contract: a 6-discipline percentage spread summing to 100.
  it('SPECIALTIES is every competition discipline', () => {
    expect(RIDER_MARKETPLACE_CONFIG.SPECIALTIES).toEqual(DISCIPLINE_VALUES);
  });
});

// ─── generateRandomRider ──────────────────────────────────────────────────────

describe('generateRandomRider', () => {
  it('returns an object with required fields', () => {
    const rider = generateRandomRider();
    expect(rider).toHaveProperty('marketplaceId');
    expect(rider).toHaveProperty('firstName');
    expect(rider).toHaveProperty('lastName');
    expect(rider).toHaveProperty('skillLevel');
    expect(rider).toHaveProperty('personality');
    expect(rider).toHaveProperty('speciality');
    expect(rider).toHaveProperty('weeklyRate');
    expect(rider).toHaveProperty('experience');
    expect(rider).toHaveProperty('bio');
    expect(rider).toHaveProperty('availability');
    expect(rider).not.toHaveProperty('knownAffinities');
  });

  it('marketplaceId starts with mkt_rider_', () => {
    const rider = generateRandomRider();
    expect(rider.marketplaceId).toMatch(/^mkt_rider_/);
  });

  it('skillLevel is one of the defined levels', () => {
    const validLevels = Object.keys(RIDER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION);
    for (let i = 0; i < 20; i++) {
      const rider = generateRandomRider();
      expect(validLevels).toContain(rider.skillLevel);
    }
  });

  it('personality is one of the 4 valid personalities', () => {
    const validPersonalities = ['daring', 'methodical', 'intuitive', 'competitive'];
    for (let i = 0; i < 20; i++) {
      const rider = generateRandomRider();
      expect(validPersonalities).toContain(rider.personality);
    }
  });

  it('speciality is one of the defined disciplines', () => {
    const validSpecialties = RIDER_MARKETPLACE_CONFIG.SPECIALTIES;
    for (let i = 0; i < 20; i++) {
      const rider = generateRandomRider();
      expect(validSpecialties).toContain(rider.speciality);
    }
  });

  // Owner rulings 2026-10-28 (q160/q177, Equoria-xlw03) changed this contract: every new
  // rider is a Rookie, and the old affinity hint (knownAffinities, the specialty shown for
  // experienced riders) is gone — hidden items are revealed only by levelling up.
  it('every new rider is a Rookie, whatever its skill tier', () => {
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

  it('rookie riders have experience of 0', () => {
    // Run many times to eventually get a rookie
    let foundRookie = false;
    for (let i = 0; i < 100; i++) {
      const rider = generateRandomRider();
      if (rider.skillLevel === 'rookie') {
        expect(rider.experience).toBe(0);
        foundRookie = true;
        break;
      }
    }
    // Equoria-ftaqy: removed the 'graceful pass if extremely unlucky'
    // silent-pass branch. Rookies are 45% of the distribution; failing to
    // find one in 100 iterations has probability < 1e-25 — that case is
    // not 'unlucky', it's the RNG being broken. Fail loudly if it happens.
    expect(foundRookie).toBe(true);
  });

  it('developing riders have experience in [0, 49]', () => {
    let foundDeveloping = false;
    for (let i = 0; i < 100; i++) {
      const rider = generateRandomRider();
      if (rider.skillLevel === 'developing') {
        expect(rider.experience).toBeGreaterThanOrEqual(0);
        expect(rider.experience).toBeLessThanOrEqual(49);
        foundDeveloping = true;
        break;
      }
    }
    // Equoria-ftaqy: hard fail if not found — see rookie test above.
    expect(foundDeveloping).toBe(true);
  });

  it('experienced riders have experience in [50, 149]', () => {
    let foundExperienced = false;
    for (let i = 0; i < 100; i++) {
      const rider = generateRandomRider();
      if (rider.skillLevel === 'experienced') {
        expect(rider.experience).toBeGreaterThanOrEqual(50);
        expect(rider.experience).toBeLessThanOrEqual(149);
        foundExperienced = true;
        break;
      }
    }
    // Equoria-ftaqy: hard fail if not found.
    expect(foundExperienced).toBe(true);
  });

  // Owner rulings 2026-10-28 (q160/q177, Equoria-xlw03) changed this contract: every new
  // rider is a Rookie, and the old affinity hint (knownAffinities, the specialty shown for
  // experienced riders) is gone — hidden items are revealed only by levelling up.
  it('no offer carries an affinity hint, experienced riders included', () => {
    let foundExperienced = false;
    for (let i = 0; i < 100; i++) {
      const rider = generateRandomRider();
      expect(rider).not.toHaveProperty('knownAffinities');
      foundExperienced = foundExperienced || rider.skillLevel === 'experienced';
    }
    expect(foundExperienced).toBe(true);
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

  it('first rider is always a starter rider (rookie/methodical/Dressage)', () => {
    const marketplace = generateRiderMarketplace(6);
    const starter = marketplace[0];
    expect(starter.skillLevel).toBe('rookie');
    expect(starter.personality).toBe('methodical');
    expect(starter.speciality).toBe('Dressage');
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
      expect(rider).toHaveProperty('skillLevel');
      expect(rider).toHaveProperty('weeklyRate');
      expect(rider).toHaveProperty('availability');
      expect(rider).not.toHaveProperty('knownAffinities');
    });
  });

  it('returns array of length 1 for size=1 (only starter)', () => {
    const marketplace = generateRiderMarketplace(1);
    expect(marketplace).toHaveLength(1);
    expect(marketplace[0].skillLevel).toBe('rookie');
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

  it('respects skill-level distribution over a large (1000) sample within ±10%', () => {
    const sample = generateRiderMarketplace(1000);
    const counts = { rookie: 0, developing: 0, experienced: 0 };
    sample.forEach(r => {
      counts[r.skillLevel]++;
    });
    const expected = RIDER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION;
    Object.keys(counts).forEach(skill => {
      const actual = (counts[skill] / 1000) * 100;
      expect(actual).toBeGreaterThanOrEqual(expected[skill] - 10);
      expect(actual).toBeLessThanOrEqual(expected[skill] + 10);
    });
  });

  it('weekly prices run 100 to 500 by star level', () => {
    expect(staffLevels.map(staffLevelFee)).toEqual([100, 200, 300, 400, 500]);
  });

  it('config marketplace size and premium cost are positive', () => {
    expect(RIDER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBeGreaterThan(0);
    expect(RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST).toBeGreaterThan(0);
  });
});
