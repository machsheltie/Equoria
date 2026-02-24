/**
 * Rider Marketplace Service Tests
 * Pure unit tests for rider generation and marketplace mechanics.
 *
 * Test Coverage:
 * - Random rider generation
 * - Property types and valid values
 * - Skill distribution over large sample
 * - Weekly rate ranges per skill level
 * - Unique marketplace IDs
 * - Refresh mechanics
 * - Refresh cost calculation
 * - Config validation
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateRandomRider,
  generateRiderMarketplace,
  riderMarketplaceNeedsRefresh,
  getRiderRefreshCost,
  RIDER_MARKETPLACE_CONFIG,
} from '../services/riderMarketplace.mjs';

describe('🏇 Rider Marketplace Service', () => {
  describe('Random Rider Generation', () => {
    it('should generate a valid rider with all required properties', () => {
      const rider = generateRandomRider();

      // All properties must exist
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
      expect(rider).toHaveProperty('knownAffinities');

      // Types
      expect(typeof rider.marketplaceId).toBe('string');
      expect(typeof rider.firstName).toBe('string');
      expect(typeof rider.lastName).toBe('string');
      expect(typeof rider.skillLevel).toBe('string');
      expect(typeof rider.personality).toBe('string');
      expect(typeof rider.speciality).toBe('string');
      expect(typeof rider.weeklyRate).toBe('number');
      expect(typeof rider.experience).toBe('number');
      expect(typeof rider.bio).toBe('string');
      expect(typeof rider.availability).toBe('boolean');
      expect(Array.isArray(rider.knownAffinities)).toBe(true);

      // Valid constrained values
      expect(['daring', 'methodical', 'intuitive', 'competitive']).toContain(rider.personality);
      expect(['rookie', 'developing', 'experienced']).toContain(rider.skillLevel);
      expect(['Dressage', 'Show Jumping', 'Cross-Country', 'Racing', 'Western Pleasure', 'Endurance']).toContain(
        rider.speciality,
      );
      expect(rider.availability).toBe(true);
      expect(rider.marketplaceId).toMatch(/^mkt_rider_/);
    });

    it('should generate weekly rates within the correct range for each skill level', () => {
      for (let i = 0; i < 50; i++) {
        const rider = generateRandomRider();
        const range = RIDER_MARKETPLACE_CONFIG.WEEKLY_RATE_RANGES[rider.skillLevel];

        expect(rider.weeklyRate).toBeGreaterThanOrEqual(range.min);
        expect(rider.weeklyRate).toBeLessThanOrEqual(range.max);
      }
    });

    it('should generate non-negative experience values', () => {
      for (let i = 0; i < 30; i++) {
        const rider = generateRandomRider();
        expect(rider.experience).toBeGreaterThanOrEqual(0);
      }
    });

    it('should give experienced riders at least one known affinity', () => {
      // Generate until we get an experienced rider (15% chance each time)
      let experiencedRider = null;
      for (let i = 0; i < 200; i++) {
        const r = generateRandomRider();
        if (r.skillLevel === 'experienced') {
          experiencedRider = r;
          break;
        }
      }
      expect(experiencedRider).not.toBeNull();
      expect(experiencedRider.knownAffinities.length).toBeGreaterThanOrEqual(1);
    });

    it('should give rookie and developing riders empty knownAffinities', () => {
      for (let i = 0; i < 100; i++) {
        const rider = generateRandomRider();
        if (rider.skillLevel !== 'experienced') {
          expect(rider.knownAffinities).toEqual([]);
        }
      }
    });

    it('should generate unique marketplace IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const rider = generateRandomRider();
        expect(ids.has(rider.marketplaceId)).toBe(false);
        ids.add(rider.marketplaceId);
      }
    });

    it('should generate bios that include the rider first name', () => {
      for (let i = 0; i < 20; i++) {
        const rider = generateRandomRider();
        expect(rider.bio).toContain(rider.firstName);
        expect(rider.bio.length).toBeGreaterThan(20);
      }
    });
  });

  describe('Marketplace Generation', () => {
    it('should generate marketplace with default size', () => {
      const marketplace = generateRiderMarketplace();

      expect(Array.isArray(marketplace)).toBe(true);
      expect(marketplace.length).toBe(RIDER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);

      marketplace.forEach(rider => {
        expect(rider).toHaveProperty('firstName');
        expect(rider).toHaveProperty('skillLevel');
        expect(rider).toHaveProperty('weeklyRate');
        expect(rider).toHaveProperty('marketplaceId');
      });
    });

    it('should generate marketplace with custom size', () => {
      const marketplace = generateRiderMarketplace(10);
      expect(marketplace.length).toBe(10);
    });

    it('should respect skill level distribution over a large sample', () => {
      const sample = generateRiderMarketplace(1000);

      const counts = { rookie: 0, developing: 0, experienced: 0 };
      sample.forEach(r => {
        counts[r.skillLevel]++;
      });

      const expected = RIDER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION;
      const tolerance = 10; // ±10%

      Object.keys(counts).forEach(skill => {
        const actual = (counts[skill] / 1000) * 100;
        expect(actual).toBeGreaterThanOrEqual(expected[skill] - tolerance);
        expect(actual).toBeLessThanOrEqual(expected[skill] + tolerance);
      });
    });

    it('should generate all unique marketplace IDs within a marketplace', () => {
      const marketplace = generateRiderMarketplace(6);
      const ids = marketplace.map(r => r.marketplaceId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(marketplace.length);
    });
  });

  describe('Refresh Mechanics', () => {
    it('should need refresh when lastRefresh is null', () => {
      expect(riderMarketplaceNeedsRefresh(null)).toBe(true);
    });

    it('should need refresh when lastRefresh is undefined', () => {
      expect(riderMarketplaceNeedsRefresh(undefined)).toBe(true);
    });

    it('should need refresh when interval has elapsed', () => {
      const old = new Date();
      old.setHours(old.getHours() - (RIDER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS + 1));
      expect(riderMarketplaceNeedsRefresh(old)).toBe(true);
    });

    it('should not need refresh when interval has not elapsed', () => {
      const recent = new Date();
      recent.setMilliseconds(recent.getMilliseconds() - 1); // 1ms ago
      expect(riderMarketplaceNeedsRefresh(recent)).toBe(false);
    });
  });

  describe('Refresh Cost', () => {
    it('should return 0 cost when refresh is needed (free window)', () => {
      const old = new Date();
      old.setHours(old.getHours() - (RIDER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS + 1));
      expect(getRiderRefreshCost(old)).toBe(0);
    });

    it('should return premium cost when refresh is not needed', () => {
      const recent = new Date();
      recent.setMilliseconds(recent.getMilliseconds() - 1);
      expect(getRiderRefreshCost(recent)).toBe(RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);
    });

    it('should return 0 cost for null lastRefresh', () => {
      expect(getRiderRefreshCost(null)).toBe(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should have required config keys', () => {
      expect(RIDER_MARKETPLACE_CONFIG).toHaveProperty('DEFAULT_MARKETPLACE_SIZE');
      expect(RIDER_MARKETPLACE_CONFIG).toHaveProperty('REFRESH_INTERVAL_HOURS');
      expect(RIDER_MARKETPLACE_CONFIG).toHaveProperty('PREMIUM_REFRESH_COST');
      expect(RIDER_MARKETPLACE_CONFIG).toHaveProperty('WEEKLY_RATE_RANGES');
      expect(RIDER_MARKETPLACE_CONFIG).toHaveProperty('SKILL_DISTRIBUTION');
      expect(RIDER_MARKETPLACE_CONFIG).toHaveProperty('SPECIALTY_DISTRIBUTION');
    });

    it('should have skill distribution that sums to 100', () => {
      const total = Object.values(RIDER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION).reduce((a, b) => a + b, 0);
      expect(total).toBe(100);
    });

    it('should have specialty distribution that sums to 100', () => {
      const total = Object.values(RIDER_MARKETPLACE_CONFIG.SPECIALTY_DISTRIBUTION).reduce((a, b) => a + b, 0);
      expect(total).toBe(100);
    });

    it('should have valid weekly rate ranges', () => {
      Object.entries(RIDER_MARKETPLACE_CONFIG.WEEKLY_RATE_RANGES).forEach(([_skill, range]) => {
        expect(range.min).toBeGreaterThan(0);
        expect(range.max).toBeGreaterThan(range.min);
      });
    });

    it('should have positive marketplace size and costs', () => {
      expect(RIDER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBeGreaterThan(0);
      expect(RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST).toBeGreaterThan(0);
    });
  });
});
