/**
 * Trainer Marketplace Service Tests
 * Pure unit tests for trainer generation and marketplace mechanics.
 *
 * Test Coverage:
 * - Random trainer generation
 * - Property types and valid values
 * - Skill distribution over large sample
 * - Session rate ranges per skill level
 * - Unique marketplace IDs
 * - Refresh mechanics
 * - Refresh cost calculation
 * - Config validation
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateRandomTrainer,
  generateTrainerMarketplace,
  trainerMarketplaceNeedsRefresh,
  getTrainerRefreshCost,
  TRAINER_MARKETPLACE_CONFIG,
} from '../services/trainerMarketplace.mjs';

describe('🎓 Trainer Marketplace Service', () => {
  describe('Random Trainer Generation', () => {
    it('should generate a valid trainer with all required properties', () => {
      const trainer = generateRandomTrainer();

      // All properties must exist
      expect(trainer).toHaveProperty('marketplaceId');
      expect(trainer).toHaveProperty('firstName');
      expect(trainer).toHaveProperty('lastName');
      expect(trainer).toHaveProperty('skillLevel');
      expect(trainer).toHaveProperty('personality');
      expect(trainer).toHaveProperty('speciality');
      expect(trainer).toHaveProperty('sessionRate');
      expect(trainer).toHaveProperty('bio');
      expect(trainer).toHaveProperty('availability');

      // Types
      expect(typeof trainer.marketplaceId).toBe('string');
      expect(typeof trainer.firstName).toBe('string');
      expect(typeof trainer.lastName).toBe('string');
      expect(typeof trainer.skillLevel).toBe('string');
      expect(typeof trainer.personality).toBe('string');
      expect(typeof trainer.speciality).toBe('string');
      expect(typeof trainer.sessionRate).toBe('number');
      expect(typeof trainer.bio).toBe('string');
      expect(typeof trainer.availability).toBe('boolean');

      // Valid constrained values
      expect(['focused', 'encouraging', 'technical', 'competitive', 'patient']).toContain(trainer.personality);
      expect(['novice', 'developing', 'expert']).toContain(trainer.skillLevel);
      expect(['Dressage', 'Show Jumping', 'Cross-Country', 'Racing', 'Western Pleasure', 'Endurance']).toContain(
        trainer.speciality,
      );
      expect(trainer.availability).toBe(true);
      expect(trainer.marketplaceId).toMatch(/^mkt_trainer_/);
    });

    it('should generate session rates within the correct range for each skill level', () => {
      for (let i = 0; i < 50; i++) {
        const trainer = generateRandomTrainer();
        const range = TRAINER_MARKETPLACE_CONFIG.SESSION_RATE_RANGES[trainer.skillLevel];

        expect(trainer.sessionRate).toBeGreaterThanOrEqual(range.min);
        expect(trainer.sessionRate).toBeLessThanOrEqual(range.max);
      }
    });

    it('should generate unique marketplace IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const trainer = generateRandomTrainer();
        expect(ids.has(trainer.marketplaceId)).toBe(false);
        ids.add(trainer.marketplaceId);
      }
    });

    it('should generate bios that mention the trainer first name', () => {
      for (let i = 0; i < 20; i++) {
        const trainer = generateRandomTrainer();
        expect(trainer.bio).toContain(trainer.firstName);
        expect(trainer.bio.length).toBeGreaterThan(20);
      }
    });

    it('should generate bios appropriate for each skill level', () => {
      // Bios for novice/developing/expert contain skill-relevant text
      for (let i = 0; i < 60; i++) {
        const trainer = generateRandomTrainer();
        const bioLower = trainer.bio.toLowerCase();

        if (trainer.skillLevel === 'expert') {
          // Expert bio should mention something prestigious
          const hasExpertKeyword = ['sought-after', 'renowned', 'champion', 'proven'].some(kw => bioLower.includes(kw));
          expect(hasExpertKeyword).toBe(true);
        }
      }
    });
  });

  describe('Marketplace Generation', () => {
    it('should generate marketplace with default size', () => {
      const marketplace = generateTrainerMarketplace();

      expect(Array.isArray(marketplace)).toBe(true);
      expect(marketplace.length).toBe(TRAINER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE);

      marketplace.forEach(trainer => {
        expect(trainer).toHaveProperty('firstName');
        expect(trainer).toHaveProperty('skillLevel');
        expect(trainer).toHaveProperty('sessionRate');
        expect(trainer).toHaveProperty('marketplaceId');
      });
    });

    it('should generate marketplace with custom size', () => {
      const marketplace = generateTrainerMarketplace(10);
      expect(marketplace.length).toBe(10);
    });

    it('should respect skill level distribution over a large sample', () => {
      const sample = generateTrainerMarketplace(1000);

      const counts = { novice: 0, developing: 0, expert: 0 };
      sample.forEach(t => {
        counts[t.skillLevel]++;
      });

      const expected = TRAINER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION;
      const tolerance = 10; // ±10%

      Object.keys(counts).forEach(skill => {
        const actual = (counts[skill] / 1000) * 100;
        expect(actual).toBeGreaterThanOrEqual(expected[skill] - tolerance);
        expect(actual).toBeLessThanOrEqual(expected[skill] + tolerance);
      });
    });

    it('should generate all unique marketplace IDs within a marketplace', () => {
      const marketplace = generateTrainerMarketplace(6);
      const ids = marketplace.map(t => t.marketplaceId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(marketplace.length);
    });
  });

  describe('Refresh Mechanics', () => {
    it('should need refresh when lastRefresh is null', () => {
      expect(trainerMarketplaceNeedsRefresh(null)).toBe(true);
    });

    it('should need refresh when lastRefresh is undefined', () => {
      expect(trainerMarketplaceNeedsRefresh(undefined)).toBe(true);
    });

    it('should need refresh when interval has elapsed', () => {
      const old = new Date();
      old.setHours(old.getHours() - (TRAINER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS + 1));
      expect(trainerMarketplaceNeedsRefresh(old)).toBe(true);
    });

    it('should not need refresh when interval has not elapsed', () => {
      const recent = new Date();
      recent.setMilliseconds(recent.getMilliseconds() - 1);
      expect(trainerMarketplaceNeedsRefresh(recent)).toBe(false);
    });
  });

  describe('Refresh Cost', () => {
    it('should return 0 cost when refresh is needed (free window)', () => {
      const old = new Date();
      old.setHours(old.getHours() - (TRAINER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS + 1));
      expect(getTrainerRefreshCost(old)).toBe(0);
    });

    it('should return premium cost when refresh is not needed', () => {
      const recent = new Date();
      recent.setMilliseconds(recent.getMilliseconds() - 1);
      expect(getTrainerRefreshCost(recent)).toBe(TRAINER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);
    });

    it('should return 0 cost for null lastRefresh', () => {
      expect(getTrainerRefreshCost(null)).toBe(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should have required config keys', () => {
      expect(TRAINER_MARKETPLACE_CONFIG).toHaveProperty('DEFAULT_MARKETPLACE_SIZE');
      expect(TRAINER_MARKETPLACE_CONFIG).toHaveProperty('REFRESH_INTERVAL_HOURS');
      expect(TRAINER_MARKETPLACE_CONFIG).toHaveProperty('PREMIUM_REFRESH_COST');
      expect(TRAINER_MARKETPLACE_CONFIG).toHaveProperty('SESSION_RATE_RANGES');
      expect(TRAINER_MARKETPLACE_CONFIG).toHaveProperty('SKILL_DISTRIBUTION');
      expect(TRAINER_MARKETPLACE_CONFIG).toHaveProperty('SPECIALTY_DISTRIBUTION');
    });

    it('should have skill distribution that sums to 100', () => {
      const total = Object.values(TRAINER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION).reduce((a, b) => a + b, 0);
      expect(total).toBe(100);
    });

    it('should have specialty distribution that sums to 100', () => {
      const total = Object.values(TRAINER_MARKETPLACE_CONFIG.SPECIALTY_DISTRIBUTION).reduce((a, b) => a + b, 0);
      expect(total).toBe(100);
    });

    it('should have valid session rate ranges', () => {
      Object.entries(TRAINER_MARKETPLACE_CONFIG.SESSION_RATE_RANGES).forEach(([_skill, range]) => {
        expect(range.min).toBeGreaterThan(0);
        expect(range.max).toBeGreaterThan(range.min);
      });
    });

    it('should have positive marketplace size and costs', () => {
      expect(TRAINER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE).toBeGreaterThan(0);
      expect(TRAINER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST).toBeGreaterThan(0);
    });
  });
});
