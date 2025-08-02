/**
 * Groom Marketplace System Tests
 * Tests for the groom marketplace generation and management system
 *
 * Test Coverage:
 * - Random groom generation
 * - Quality distribution
 * - Marketplace refresh mechanics
 * - Pricing calculations
 * - Bio generation
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateRandomGroom,
  generateMarketplace,
  needsRefresh,
  getRefreshCost,
  MARKETPLACE_CONFIG,
} from '../services/groomMarketplace.mjs';

describe('🏪 Groom Marketplace System', () => {
  describe('Random Groom Generation', () => {
    it('should generate a valid groom with all required properties', () => {
      const groom = generateRandomGroom();

      // Check all required properties exist
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

      // Check property types
      expect(typeof groom.firstName).toBe('string');
      expect(typeof groom.lastName).toBe('string');
      expect(typeof groom.specialty).toBe('string');
      expect(typeof groom.skillLevel).toBe('string');
      expect(typeof groom.personality).toBe('string');
      expect(typeof groom.experience).toBe('number');
      expect(typeof groom.sessionRate).toBe('number');
      expect(typeof groom.bio).toBe('string');
      expect(typeof groom.availability).toBe('boolean');
      expect(typeof groom.marketplaceId).toBe('string');

      // Check valid values
      expect(['general', 'foalCare', 'training', 'medical']).toContain(groom.specialty);
      expect(['novice', 'intermediate', 'expert', 'master']).toContain(groom.skillLevel);
      expect(['gentle', 'energetic', 'patient', 'strict']).toContain(groom.personality);
      expect(groom.experience).toBeGreaterThanOrEqual(1);
      expect(groom.experience).toBeLessThanOrEqual(20);
      expect(groom.sessionRate).toBeGreaterThan(0);
      expect(groom.availability).toBe(true);
      expect(groom.marketplaceId).toMatch(/^mkt_\d+_\d+$/);
    });

    it('should generate experience within skill level ranges', () => {
      // Generate multiple grooms to test ranges
      for (let i = 0; i < 50; i++) {
        const groom = generateRandomGroom();
        const expectedRange = MARKETPLACE_CONFIG.EXPERIENCE_RANGES[groom.skillLevel];

        expect(groom.experience).toBeGreaterThanOrEqual(expectedRange.min);
        expect(groom.experience).toBeLessThanOrEqual(expectedRange.max);
      }
    });

    it('should calculate session rates based on skill level and experience', () => {
      // Test multiple grooms to verify pricing logic
      for (let i = 0; i < 20; i++) {
        const groom = generateRandomGroom();
        const baseRate = MARKETPLACE_CONFIG.BASE_SESSION_RATES[groom.skillLevel];
        const experienceRange = MARKETPLACE_CONFIG.EXPERIENCE_RANGES[groom.skillLevel];

        // Session rate should be at least the base rate
        expect(groom.sessionRate).toBeGreaterThanOrEqual(baseRate);

        // Higher experience should generally mean higher rates within skill level
        if (groom.experience > experienceRange.min) {
          expect(groom.sessionRate).toBeGreaterThan(baseRate);
        }
      }
    });

    it('should generate unique marketplace IDs', () => {
      const ids = new Set();

      for (let i = 0; i < 100; i++) {
        const groom = generateRandomGroom();
        expect(ids.has(groom.marketplaceId)).toBe(false);
        ids.add(groom.marketplaceId);
      }
    });

    it('should generate meaningful bios that include name and specialty', () => {
      const groom = generateRandomGroom();

      expect(groom.bio).toContain(groom.firstName);
      expect(groom.bio.length).toBeGreaterThan(50); // Reasonable bio length

      // Bio should mention specialty in some form
      const specialtyMentions = {
        foalCare: ['foal', 'young', 'developmental'],
        training: ['training', 'exercise', 'competitive'],
        medical: ['health', 'medical', 'care'],
        general: ['general', 'comprehensive', 'all ages'],
      };

      const expectedMentions = specialtyMentions[groom.specialty];
      const bioLower = groom.bio.toLowerCase();
      const hasMention = expectedMentions.some(mention => bioLower.includes(mention));
      expect(hasMention).toBe(true);
    });
  });

  describe('Marketplace Generation', () => {
    it('should generate marketplace with default size', () => {
      const marketplace = generateMarketplace();

      expect(Array.isArray(marketplace)).toBe(true);
      expect(marketplace.length).toBe(MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);

      // All grooms should be valid
      marketplace.forEach(groom => {
        expect(groom).toHaveProperty('firstName');
        expect(groom).toHaveProperty('skillLevel');
        expect(groom).toHaveProperty('sessionRate');
      });
    });

    it('should generate marketplace with custom size', () => {
      const customSize = 8;
      const marketplace = generateMarketplace(customSize);

      expect(marketplace.length).toBe(customSize);
    });

    it('should respect quality distribution over large sample', () => {
      const largeMarketplace = generateMarketplace(1000);

      // Count skill levels
      const skillCounts = {
        novice: 0,
        intermediate: 0,
        expert: 0,
        master: 0,
      };

      largeMarketplace.forEach(groom => {
        skillCounts[groom.skillLevel]++;
      });

      // Check distributions are roughly correct (within 10% tolerance)
      const expectedDistribution = MARKETPLACE_CONFIG.QUALITY_DISTRIBUTION;

      Object.keys(skillCounts).forEach(skill => {
        const actualPercentage = (skillCounts[skill] / 1000) * 100;
        const expectedPercentage = expectedDistribution[skill];
        const tolerance = 10; // 10% tolerance

        expect(actualPercentage).toBeGreaterThanOrEqual(expectedPercentage - tolerance);
        expect(actualPercentage).toBeLessThanOrEqual(expectedPercentage + tolerance);
      });
    });
  });

  describe('Refresh Mechanics', () => {
    it('should need refresh when no last refresh provided', () => {
      expect(needsRefresh(null)).toBe(true);
      expect(needsRefresh(undefined)).toBe(true);
    });

    it('should need refresh when enough time has passed', () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - (MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS + 1));

      expect(needsRefresh(oldDate)).toBe(true);
    });

    it('should not need refresh when not enough time has passed', () => {
      const recentDate = new Date();
      // In test environment, refresh interval is 0.0001 hours, so use a very recent time
      recentDate.setMilliseconds(recentDate.getMilliseconds() - 1); // 1 millisecond ago

      expect(needsRefresh(recentDate)).toBe(false);
    });

    it('should calculate correct refresh cost', () => {
      // Free refresh when needed
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - (MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS + 1));
      expect(getRefreshCost(oldDate)).toBe(0);

      // Paid refresh when not needed
      const recentDate = new Date();
      // In test environment, use a very recent time that doesn't need refresh
      recentDate.setMilliseconds(recentDate.getMilliseconds() - 1);
      expect(getRefreshCost(recentDate)).toBe(MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);

      // Free refresh when no last refresh
      expect(getRefreshCost(null)).toBe(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should have valid marketplace configuration', () => {
      // Check required config properties
      expect(MARKETPLACE_CONFIG).toHaveProperty('DEFAULT_MARKETPLACE_SIZE');
      expect(MARKETPLACE_CONFIG).toHaveProperty('REFRESH_INTERVAL_HOURS');
      expect(MARKETPLACE_CONFIG).toHaveProperty('PREMIUM_REFRESH_COST');
      expect(MARKETPLACE_CONFIG).toHaveProperty('QUALITY_DISTRIBUTION');
      expect(MARKETPLACE_CONFIG).toHaveProperty('SPECIALTY_DISTRIBUTION');
      expect(MARKETPLACE_CONFIG).toHaveProperty('EXPERIENCE_RANGES');
      expect(MARKETPLACE_CONFIG).toHaveProperty('BASE_SESSION_RATES');

      // Check distribution percentages add up to 100
      const qualityTotal = Object.values(MARKETPLACE_CONFIG.QUALITY_DISTRIBUTION).reduce((a, b) => a + b, 0);
      const specialtyTotal = Object.values(MARKETPLACE_CONFIG.SPECIALTY_DISTRIBUTION).reduce((a, b) => a + b, 0);

      expect(qualityTotal).toBe(100);
      expect(specialtyTotal).toBe(100);

      // Check experience ranges are logical
      Object.values(MARKETPLACE_CONFIG.EXPERIENCE_RANGES).forEach(range => {
        expect(range.min).toBeLessThanOrEqual(range.max);
        expect(range.min).toBeGreaterThanOrEqual(1);
        expect(range.max).toBeLessThanOrEqual(20);
      });

      // Check base session rates are positive
      Object.values(MARKETPLACE_CONFIG.BASE_SESSION_RATES).forEach(rate => {
        expect(rate).toBeGreaterThan(0);
      });
    });
  });
});
