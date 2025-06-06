/**
 * 🧪 UNIT TEST: Apply Epigenetic Traits At Birth Task 8 - Deterministic Breeding Analysis
 *
 * This test validates the epigenetic trait application system with deterministic
 * testing using controlled randomness to ensure consistent and predictable results.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Positive trait conditions: Low stress + premium feed → hardy, well_bred, premium_care
 * - Negative trait conditions: High stress + poor feed → weak_constitution, stressed_lineage, poor_nutrition
 * - Inbreeding detection: Common ancestors → inbred trait with proper analysis
 * - Discipline specialization: 3+ ancestors same discipline → specialized_lineage trait
 * - Deterministic testing: Controlled Math.random() for consistent test results
 * - Threshold validation: Exact probability thresholds and edge cases
 * - Breeding analysis: Complete lineage, inbreeding, and condition evaluation
 * - Error handling: Missing data, empty lineage, no competition history
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. applyEpigeneticTraitsAtBirth() - Complete trait application with controlled randomness
 * 2. Positive trait application: hardy (25%), well_bred (20%), premium_care (15%)
 * 3. Negative trait application: weak_constitution (35%), stressed_lineage (25%), poor_nutrition (40%)
 * 4. Inbreeding detection: Common ancestor identification and trait application
 * 5. Discipline specialization: Racing lineage analysis and specialized_lineage trait
 * 6. Deterministic testing: Math.random() mocking for consistent results
 * 7. Threshold testing: Exact probability boundaries and edge cases
 * 8. Breeding analysis validation: Complete data structure and analysis results
 * 9. Edge cases: No specialization, no inbreeding, empty competition history
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete trait calculation algorithms, breeding analysis, condition evaluation
 * ✅ REAL: Inbreeding detection, discipline specialization, probability calculations
 * 🔧 MOCK: Database operations (Prisma), Math.random() for deterministic testing, logger
 *
 * 💡 TEST STRATEGY: Unit testing with controlled randomness to validate
 *    breeding trait application with predictable and consistent results
 *
 * ⚠️  NOTE: This represents EXCELLENT deterministic testing - mocks randomness and
 *    database while testing real breeding logic with controlled, predictable outcomes.
 */

import { jest, describe, beforeEach, afterEach, expect, it } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock dependencies
const mockPrisma = {
  horse: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  competitionResult: {
    findMany: jest.fn(),
  },
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock the imports
jest.unstable_mockModule(join(__dirname, '../db/index.mjs'), () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule(join(__dirname, '../utils/logger.mjs'), () => ({
  default: mockLogger,
}));

// Import the function after mocking
const { applyEpigeneticTraitsAtBirth } = await import(join(__dirname, '../utils/atBirthTraits.js'));

describe('🧬 UNIT: Apply Epigenetic Traits At Birth Task 8 - Deterministic Breeding Analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Low-stress, premium-fed mare produces positive traits', () => {
    beforeEach(() => {
      // Mock mare with excellent conditions
      mockPrisma.horse.findUnique.mockResolvedValue({
        stressLevel: 15,
        bondScore: 85,
        healthStatus: 'Excellent',
        totalEarnings: 100000,
      });

      // Mock empty lineage (no specialization or inbreeding)
      mockPrisma.horse.findMany.mockResolvedValue([]);
      mockPrisma.competitionResult.findMany.mockResolvedValue([]);
    });

    it('should produce hardy trait with low stress and premium feed', async () => {
      // Force trait application with low random value
      jest.spyOn(Math, 'random').mockReturnValueOnce(0.01); // Below 0.25 probability

      const breedingData = {
        sireId: 1,
        damId: 2,
        mareStress: 15,
        feedQuality: 85,
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      expect(result.traits.positive).toContain('hardy');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Applied positive trait: hardy'),
      );
    });

    it('should produce well_bred trait with optimal conditions and no inbreeding', async () => {
      // Force trait application
      jest.spyOn(Math, 'random').mockReturnValueOnce(0.1); // Below 0.20 probability

      const breedingData = {
        sireId: 1,
        damId: 2,
        mareStress: 25,
        feedQuality: 75,
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      expect(result.traits.positive).toContain('well_bred');
      expect(result.breedingAnalysis.inbreeding.inbreedingDetected).toBe(false);
    });

    it('should produce premium_care trait with exceptional conditions', async () => {
      // Force trait application for ALL random calls (multiple traits may be evaluated)
      jest.spyOn(Math, 'random').mockReturnValue(0.05); // Below all thresholds

      const breedingData = {
        sireId: 1,
        damId: 2,
        mareStress: 8, // Must be <= 10 for premium_care
        feedQuality: 95, // Must be >= 90 for premium_care
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      // Should contain premium_care (conditions: mareStress <= 10, feedQuality >= 90, probability 0.15)
      expect(result.traits.positive).toContain('premium_care');
    });

    it('should NOT produce positive traits with high stress', async () => {
      // Even with low random value, high stress should prevent positive traits
      jest.spyOn(Math, 'random').mockReturnValue(0.01);

      const breedingData = {
        sireId: 1,
        damId: 2,
        mareStress: 60, // High stress
        feedQuality: 90,
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      expect(result.traits.positive).not.toContain('hardy');
      expect(result.traits.positive).not.toContain('well_bred');
      expect(result.traits.positive).not.toContain('premium_care');
    });

    it('should NOT produce positive traits with poor feed quality', async () => {
      // Even with low random value, poor feed should prevent positive traits
      jest.spyOn(Math, 'random').mockReturnValue(0.01);

      const breedingData = {
        sireId: 1,
        damId: 2,
        mareStress: 15,
        feedQuality: 50, // Poor feed quality
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      expect(result.traits.positive).not.toContain('hardy');
      expect(result.traits.positive).not.toContain('well_bred');
      expect(result.traits.positive).not.toContain('premium_care');
    });
  });

  describe('Inbreeding detection triggers negative traits', () => {
    beforeEach(() => {
      // Mock mare
      mockPrisma.horse.findUnique.mockResolvedValue({
        stressLevel: 30,
        bondScore: 70,
        healthStatus: 'Good',
      });

      // Mock no competition results
      mockPrisma.competitionResult.findMany.mockResolvedValue([]);
    });

    it('should produce inbred trait when duplicate ancestors detected', async () => {
      // Force trait application
      jest.spyOn(Math, 'random').mockReturnValueOnce(0.3); // Below 0.60 probability

      // Mock inbreeding scenario - common ancestor appears in both lineages
      const commonAncestor = { id: 100, name: 'CommonAncestor', sireId: null, damId: null };

      // Mock the getAncestors calls for detectInbreeding
      mockPrisma.horse.findMany
        // First call: get sire (id: 1) for sire lineage
        .mockResolvedValueOnce([{ id: 1, name: 'Sire', sireId: 100, damId: 101 }])
        // Second call: get sire's parents
        .mockResolvedValueOnce([
          commonAncestor,
          { id: 101, name: 'SireGrandma', sireId: null, damId: null },
        ])
        // Third call: no further sire ancestors
        .mockResolvedValueOnce([])
        // Fourth call: get dam (id: 2) for dam lineage
        .mockResolvedValueOnce([{ id: 2, name: 'Dam', sireId: 100, damId: 102 }])
        // Fifth call: get dam's parents (includes same common ancestor)
        .mockResolvedValueOnce([
          commonAncestor,
          { id: 102, name: 'DamGrandma', sireId: null, damId: null },
        ])
        // Sixth call: no further dam ancestors
        .mockResolvedValueOnce([])
        // Seventh call: for lineage analysis - get both parents
        .mockResolvedValueOnce([
          { id: 1, name: 'Sire', sireId: 100, damId: 101 },
          { id: 2, name: 'Dam', sireId: 100, damId: 102 },
        ])
        // Eighth call: get all ancestors for lineage analysis
        .mockResolvedValueOnce([
          commonAncestor,
          { id: 101, name: 'SireGrandma' },
          { id: 102, name: 'DamGrandma' },
        ])
        // Ninth call: no further ancestors
        .mockResolvedValueOnce([]);

      const breedingData = {
        sireId: 1,
        damId: 2,
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      expect(result.traits.negative).toContain('inbred');
      expect(result.breedingAnalysis.inbreeding.inbreedingDetected).toBe(true);
      expect(result.breedingAnalysis.inbreeding.commonAncestors.length).toBeGreaterThan(0);
      // Should include the common ancestor with ID 100
      const commonAncestorIds = result.breedingAnalysis.inbreeding.commonAncestors.map(a => a.id);
      expect(commonAncestorIds).toContain(100);
    });

    it('should NOT produce inbred trait without common ancestors', async () => {
      // Mock no inbreeding scenario
      mockPrisma.horse.findMany
        // Sire lineage
        .mockResolvedValueOnce([{ id: 1, name: 'Sire', sireId: 10, damId: 11 }])
        .mockResolvedValueOnce([
          { id: 10, name: 'SireGrandpa' },
          { id: 11, name: 'SireGrandma' },
        ])
        .mockResolvedValueOnce([])
        // Dam lineage
        .mockResolvedValueOnce([{ id: 2, name: 'Dam', sireId: 20, damId: 21 }])
        .mockResolvedValueOnce([
          { id: 20, name: 'DamGrandpa' },
          { id: 21, name: 'DamGrandma' },
        ])
        .mockResolvedValueOnce([]);

      const breedingData = {
        sireId: 1,
        damId: 2,
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      expect(result.traits.negative).not.toContain('inbred');
      expect(result.breedingAnalysis.inbreeding.inbreedingDetected).toBe(false);
      expect(result.breedingAnalysis.inbreeding.commonAncestors).toHaveLength(0);
    });
  });

  describe('Poor breeding conditions trigger negative traits', () => {
    beforeEach(() => {
      // Mock mare with poor conditions
      mockPrisma.horse.findUnique.mockResolvedValue({
        stressLevel: 80,
        bondScore: 30,
        healthStatus: 'Poor',
        totalEarnings: 1000,
      });

      // Mock empty lineage
      mockPrisma.horse.findMany.mockResolvedValue([]);
      mockPrisma.competitionResult.findMany.mockResolvedValue([]);
    });

    it('should produce weak_constitution trait with high stress and poor feed', async () => {
      // Force trait application
      jest.spyOn(Math, 'random').mockReturnValueOnce(0.2); // Below 0.35 probability

      const breedingData = {
        sireId: 1,
        damId: 2,
        mareStress: 75,
        feedQuality: 35,
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      expect(result.traits.negative).toContain('weak_constitution');
    });

    it('should produce stressed_lineage trait with high mare stress', async () => {
      // Force trait application
      jest.spyOn(Math, 'random').mockReturnValueOnce(0.15); // Below 0.25 probability

      const breedingData = {
        sireId: 1,
        damId: 2,
        mareStress: 65, // Must be >= 60 for stressed_lineage
        feedQuality: 50, // Neutral feed quality
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      expect(result.traits.negative).toContain('stressed_lineage');
    });

    it('should produce poor_nutrition trait with very poor feed quality', async () => {
      // Force trait application
      jest.spyOn(Math, 'random').mockReturnValueOnce(0.25); // Below 0.40 probability

      const breedingData = {
        sireId: 1,
        damId: 2,
        mareStress: 40, // Moderate stress
        feedQuality: 25, // Must be <= 30 for poor_nutrition
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      expect(result.traits.negative).toContain('poor_nutrition');
    });
  });

  describe('Discipline specialization produces legacy traits', () => {
    beforeEach(() => {
      // Mock mare with moderate conditions
      mockPrisma.horse.findUnique.mockResolvedValue({
        stressLevel: 35,
        bondScore: 70,
        healthStatus: 'Good',
      });
    });

    it('should produce specialized_lineage trait with 3+ ancestors in same discipline', async () => {
      // Force trait application
      jest.spyOn(Math, 'random').mockReturnValueOnce(0.2); // Below 0.30 probability

      // Mock ancestors with Racing specialization
      const racingAncestors = [
        { id: 10, name: 'Ancestor1' },
        { id: 11, name: 'Ancestor2' },
        { id: 12, name: 'Ancestor3' },
        { id: 13, name: 'Ancestor4' },
      ];

      const racingResults = [
        { discipline: 'Racing', placement: '1st' },
        { discipline: 'Racing', placement: '2nd' },
        { discipline: 'Racing', placement: '1st' },
        { discipline: 'Racing', placement: '3rd' },
        { discipline: 'Dressage', placement: '2nd' }, // Only 1 non-racing result
      ];

      mockPrisma.horse.findMany
        .mockResolvedValueOnce([{ id: 1, sireId: 10, damId: 11 }])
        .mockResolvedValueOnce(racingAncestors)
        .mockResolvedValueOnce([]);

      // Mock competition results showing Racing specialization (80% of competitions)
      mockPrisma.competitionResult.findMany.mockResolvedValue(racingResults);

      const breedingData = {
        sireId: 1,
        damId: 2,
        mareStress: 35,
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      expect(result.traits.positive).toContain('specialized_lineage');
      expect(result.breedingAnalysis.lineage.disciplineSpecialization).toBe(true);
      expect(result.breedingAnalysis.lineage.specializedDiscipline).toBe('Racing');
      expect(result.breedingAnalysis.lineage.specializationStrength).toBeGreaterThan(0.6);
    });

    it('should NOT produce specialized_lineage trait without sufficient specialization', async () => {
      // Mock diverse competition history (no single discipline >60%)
      const diverseResults = [
        { discipline: 'Racing', placement: '1st' },
        { discipline: 'Racing', placement: '2nd' },
        { discipline: 'Dressage', placement: '1st' },
        { discipline: 'Dressage', placement: '3rd' },
        { discipline: 'Show Jumping', placement: '2nd' },
        { discipline: 'Show Jumping', placement: '1st' },
      ];

      mockPrisma.horse.findMany
        .mockResolvedValueOnce([{ id: 1, sireId: 10, damId: 11 }])
        .mockResolvedValueOnce([
          { id: 10, name: 'Ancestor1' },
          { id: 11, name: 'Ancestor2' },
        ])
        .mockResolvedValueOnce([]);

      mockPrisma.competitionResult.findMany.mockResolvedValue(diverseResults);

      const breedingData = {
        sireId: 1,
        damId: 2,
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      expect(result.traits.positive).not.toContain('specialized_lineage');
      expect(result.breedingAnalysis.lineage.disciplineSpecialization).toBe(false);
      expect(result.breedingAnalysis.lineage.specializedDiscipline).toBeNull();
    });

    it('should handle no competition history gracefully', async () => {
      mockPrisma.horse.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockPrisma.competitionResult.findMany.mockResolvedValue([]);

      const breedingData = {
        sireId: 1,
        damId: 2,
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      expect(result.traits.positive).not.toContain('specialized_lineage');
      expect(result.breedingAnalysis.lineage.disciplineSpecialization).toBe(false);
      expect(result.breedingAnalysis.lineage.totalCompetitions).toBe(0);
    });
  });

  describe('Deterministic testing with Math.random mocking', () => {
    beforeEach(() => {
      // Mock optimal mare conditions
      mockPrisma.horse.findUnique.mockResolvedValue({
        stressLevel: 10,
        bondScore: 90,
        healthStatus: 'Excellent',
        totalEarnings: 200000,
      });

      // Mock empty lineage
      mockPrisma.horse.findMany.mockResolvedValue([]);
      mockPrisma.competitionResult.findMany.mockResolvedValue([]);
    });

    it('should consistently apply traits when random value is below threshold', async () => {
      // Test deterministic trait application with controlled randomness
      jest.spyOn(Math, 'random').mockReturnValue(0.01); // Very low value, below all thresholds

      const breedingData = {
        sireId: 1,
        damId: 2,
        mareStress: 8, // Meets all stress requirements
        feedQuality: 95, // Meets all feed requirements
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      // With very low random values, should apply multiple positive traits
      expect(result.traits.positive.length).toBeGreaterThan(0);

      // Should contain at least one of the expected traits based on conditions
      const expectedTraits = ['hardy', 'well_bred', 'premium_care'];
      const hasExpectedTrait = expectedTraits.some(trait => result.traits.positive.includes(trait));
      expect(hasExpectedTrait).toBe(true);

      // Verify breeding analysis is working
      expect(result.breedingAnalysis).toHaveProperty('lineage');
      expect(result.breedingAnalysis).toHaveProperty('inbreeding');
      expect(result.breedingAnalysis).toHaveProperty('conditions');
    });

    it('should consistently NOT apply traits when random value is above threshold', async () => {
      // Test trait rejection with controlled randomness
      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.3) // Above hardy threshold (0.25)
        .mockReturnValueOnce(0.25) // Above well bred threshold (0.20)
        .mockReturnValueOnce(0.2); // Above premium care threshold (0.15)

      const breedingData = {
        sireId: 1,
        damId: 2,
        mareStress: 8,
        feedQuality: 95,
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      // Should not apply any traits due to random values being above thresholds
      expect(result.traits.positive).not.toContain('hardy');
      expect(result.traits.positive).not.toContain('well_bred');
      expect(result.traits.positive).not.toContain('premium_care');
    });

    it('should handle edge case random values at exact thresholds', async () => {
      // Test exact threshold values
      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.25) // Exactly at hardy threshold (should not apply)
        .mockReturnValueOnce(0.2) // Exactly at well bred threshold (should not apply)
        .mockReturnValueOnce(0.15); // Exactly at premium care threshold (should not apply)

      const breedingData = {
        sireId: 1,
        damId: 2,
        mareStress: 8,
        feedQuality: 95,
      };

      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      // Random values equal to threshold should not trigger trait application
      expect(result.traits.positive).not.toContain('hardy');
      expect(result.traits.positive).not.toContain('well_bred');
      expect(result.traits.positive).not.toContain('premium_care');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should throw error when sireId is missing', async () => {
      const breedingData = { damId: 2 };

      await expect(applyEpigeneticTraitsAtBirth(breedingData)).rejects.toThrow(
        'Both sireId and damId are required',
      );
    });

    it('should throw error when damId is missing', async () => {
      const breedingData = { sireId: 1 };

      await expect(applyEpigeneticTraitsAtBirth(breedingData)).rejects.toThrow(
        'Both sireId and damId are required',
      );
    });

    it('should throw error when mare is not found', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(null);

      const breedingData = {
        sireId: 1,
        damId: 999,
      };

      await expect(applyEpigeneticTraitsAtBirth(breedingData)).rejects.toThrow(
        'Mare with ID 999 not found',
      );
    });

    it('should handle database errors gracefully in lineage analysis', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue({
        stressLevel: 30,
        bondScore: 70,
        healthStatus: 'Good',
      });

      // Mock database error in lineage analysis
      mockPrisma.horse.findMany.mockRejectedValue(new Error('Database connection failed'));

      const breedingData = {
        sireId: 1,
        damId: 2,
      };

      // Should not throw, but continue with default analysis
      const result = await applyEpigeneticTraitsAtBirth(breedingData);

      expect(result).toHaveProperty('traits');
      expect(result.breedingAnalysis.lineage.disciplineSpecialization).toBe(false);
      expect(result.breedingAnalysis.inbreeding.inbreedingDetected).toBe(false);
    });
  });
});
