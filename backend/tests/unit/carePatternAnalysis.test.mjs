/**
 * Care Pattern Analysis Tests
 * Unit tests for care pattern analysis and evaluation logic
 *
 * 🧪 TESTING APPROACH: Balanced Mocking
 * - Mock Prisma database calls only
 * - Test real business logic and pattern analysis
 * - Validate care pattern calculations
 * - Test edge cases and boundary conditions
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock Prisma
const mockPrisma = {
  horse: {
    findUnique: jest.fn(),
  },
};

jest.unstable_mockModule('../../db/index.mjs', () => ({
  default: mockPrisma,
}));

// Mock logger
jest.unstable_mockModule('../../utils/logger.mjs', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import after mocking
const { analyzeCarePatterns } = await import('../../utils/carePatternAnalysis.mjs');

describe('Care Pattern Analysis', () => {
  const mockHorse = {
    id: 1,
    name: 'Test Horse',
    dateOfBirth: new Date('2024-01-01'),
    bondScore: 50,
    stressLevel: 20,
    groomInteractions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeCarePatterns', () => {

    test('should analyze patterns for eligible horse', async () => {
      const evaluationDate = new Date('2024-06-01'); // 5 months old
      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);

      const result = await analyzeCarePatterns(1, evaluationDate);

      expect(result.eligible).toBe(true);
      expect(result.horseId).toBe(1);
      expect(result.ageInYears).toBeCloseTo(0.42, 1); // ~5 months
      expect(result.patterns).toHaveProperty('consistentCare');
      expect(result.patterns).toHaveProperty('noveltyExposure');
      expect(result.patterns).toHaveProperty('stressManagement');
      expect(result.patterns).toHaveProperty('bondingPatterns');
      expect(result.patterns).toHaveProperty('neglectPatterns');
      expect(result.patterns).toHaveProperty('environmentalFactors');
    });

    test('should reject horse too old for evaluation', async () => {
      const oldHorse = {
        ...mockHorse,
        dateOfBirth: new Date('2020-01-01'), // 4+ years old
      };
      mockPrisma.horse.findUnique.mockResolvedValue(oldHorse);

      const result = await analyzeCarePatterns(1);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('too old');
    });

    test('should throw error for non-existent horse', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(null);

      await expect(analyzeCarePatterns(999)).rejects.toThrow('Horse with ID 999 not found');
    });

    test('should analyze consistent care patterns', async () => {
      const horseWithConsistentCare = {
        ...mockHorse,
        bondScore: 60,
        groomInteractions: [
          {
            id: 1,
            interactionType: 'daily_care',
            quality: 'good',
            bondingChange: 5,
            stressChange: -2,
            createdAt: new Date('2024-05-25'),
          },
          {
            id: 2,
            interactionType: 'grooming',
            quality: 'excellent',
            bondingChange: 7,
            stressChange: -3,
            createdAt: new Date('2024-05-26'),
          },
          {
            id: 3,
            interactionType: 'daily_care',
            quality: 'good',
            bondingChange: 4,
            stressChange: -1,
            createdAt: new Date('2024-05-27'),
          },
        ],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithConsistentCare);

      const result = await analyzeCarePatterns(1, new Date('2024-05-28'));

      expect(result.patterns.consistentCare.totalInteractions).toBe(3);
      expect(result.patterns.consistentCare.groomingInteractions).toBe(3);
      expect(result.patterns.consistentCare.qualityInteractions).toBe(3);
      expect(result.patterns.consistentCare.averageBondChange).toBeCloseTo(5.33, 1);
    });

    test('should analyze novelty exposure patterns', async () => {
      const horseWithNoveltyExposure = {
        ...mockHorse,
        bondScore: 40,
        groomInteractions: [
          {
            id: 1,
            interactionType: 'desensitization',
            quality: 'good',
            bondingChange: 3,
            stressChange: 1,
            createdAt: new Date('2024-05-25'),
          },
          {
            id: 2,
            interactionType: 'exploration',
            quality: 'excellent',
            bondingChange: 5,
            stressChange: 0,
            createdAt: new Date('2024-05-26'),
          },
          {
            id: 3,
            interactionType: 'showground_exposure',
            quality: 'good',
            bondingChange: 2,
            stressChange: 2,
            createdAt: new Date('2024-05-27'),
          },
          {
            id: 4,
            interactionType: 'daily_care',
            quality: 'poor',
            bondingChange: -5,
            stressChange: 8,
            createdAt: new Date('2024-05-28'),
          },
        ],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithNoveltyExposure);

      const result = await analyzeCarePatterns(1, new Date('2024-05-29'));

      expect(result.patterns.noveltyExposure.noveltyEvents).toBe(3);
      expect(result.patterns.noveltyExposure.noveltyWithSupport).toBe(3);
      expect(result.patterns.noveltyExposure.fearEvents).toBe(1);
      expect(result.patterns.noveltyExposure.calmGroomPresent).toBe(true);
      expect(result.patterns.noveltyExposure.meetsBraveThreshold).toBe(true);
    });

    test('should analyze stress management patterns', async () => {
      const horseWithStressEvents = {
        ...mockHorse,
        stressLevel: 30,
        groomInteractions: [
          {
            id: 1,
            interactionType: 'daily_care',
            quality: 'poor',
            bondingChange: -2,
            stressChange: 6,
            createdAt: new Date('2024-05-25T10:00:00Z'),
          },
          {
            id: 2,
            interactionType: 'grooming',
            quality: 'good',
            bondingChange: 3,
            stressChange: -4,
            createdAt: new Date('2024-05-25T14:00:00Z'), // Recovery within 24h
          },
          {
            id: 3,
            interactionType: 'medical_check',
            quality: 'fair',
            bondingChange: 0,
            stressChange: 5,
            createdAt: new Date('2024-05-26T10:00:00Z'),
          },
          {
            id: 4,
            interactionType: 'grooming',
            quality: 'excellent',
            bondingChange: 5,
            stressChange: -6,
            createdAt: new Date('2024-05-26T16:00:00Z'), // Recovery within 24h
          },
        ],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithStressEvents);

      const result = await analyzeCarePatterns(1, new Date('2024-05-27'));

      expect(result.patterns.stressManagement.stressEvents).toBe(2);
      expect(result.patterns.stressManagement.recoveryEvents).toBe(2);
      expect(result.patterns.stressManagement.stressWithSupport).toBe(2);
      expect(result.patterns.stressManagement.meetsResilientThreshold).toBe(false); // Needs 3+
    });

    test('should analyze bonding patterns', async () => {
      const horseWithBondingPatterns = {
        ...mockHorse,
        bondScore: 70,
        groomInteractions: [
          {
            id: 1,
            interactionType: 'daily_care',
            quality: 'excellent',
            bondingChange: 8,
            stressChange: -2,
            createdAt: new Date('2024-05-20'),
          },
          {
            id: 2,
            interactionType: 'grooming',
            quality: 'good',
            bondingChange: 6,
            stressChange: -1,
            createdAt: new Date('2024-05-21'),
          },
          {
            id: 3,
            interactionType: 'feeding',
            quality: 'excellent',
            bondingChange: 7,
            stressChange: 0,
            createdAt: new Date('2024-05-22'),
          },
        ],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithBondingPatterns);

      const result = await analyzeCarePatterns(1, new Date('2024-05-23'));

      expect(result.patterns.bondingPatterns.positiveInteractions).toBe(3);
      expect(result.patterns.bondingPatterns.highQualityInteractions).toBe(3);
      expect(result.patterns.bondingPatterns.currentBondScore).toBe(70);
      expect(result.patterns.bondingPatterns.averageBondChange).toBeCloseTo(7, 0);
    });

    test('should analyze neglect patterns', async () => {
      const horseWithNeglect = {
        ...mockHorse,
        bondScore: 15,
        groomInteractions: [
          {
            id: 1,
            interactionType: 'daily_care',
            quality: 'poor',
            bondingChange: -3,
            stressChange: 4,
            createdAt: new Date('2024-05-21'),
          },
          {
            id: 2,
            interactionType: 'grooming',
            quality: 'fair',
            bondingChange: -1,
            stressChange: 2,
            createdAt: new Date('2024-05-26'), // 5-day gap
          },
        ],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithNeglect);

      const result = await analyzeCarePatterns(1, new Date('2024-05-26'));

      expect(result.patterns.neglectPatterns.poorQualityInteractions).toBe(2);
      expect(result.patterns.neglectPatterns.negativeInteractions).toBe(2);
      expect(result.patterns.neglectPatterns.currentBondScore).toBe(15);
      expect(result.patterns.neglectPatterns.maxConsecutiveDaysWithoutCare).toBe(4); // May 21-24 = 4 days gap
      expect(result.patterns.neglectPatterns.meetsInsecureThreshold).toBe(true);
    });

    test('should analyze environmental factors', async () => {
      const horseWithEnvironmentalFactors = {
        ...mockHorse,
        groomInteractions: [
          {
            id: 1,
            interactionType: 'daily_care',
            quality: 'good',
            bondingChange: 2,
            stressChange: 7, // High stress = startle event
            notes: 'Horse startled by loud noise',
            createdAt: new Date('2024-05-25'),
          },
          {
            id: 2,
            interactionType: 'feeding',
            quality: 'good',
            bondingChange: 3,
            stressChange: 0,
            createdAt: new Date('2024-05-26'),
          },
          {
            id: 3,
            interactionType: 'daily_care',
            quality: 'good',
            bondingChange: 2,
            stressChange: 6, // Another startle event
            createdAt: new Date('2024-05-27'),
          },
        ],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithEnvironmentalFactors);

      const result = await analyzeCarePatterns(1, new Date('2024-05-28'));

      expect(result.patterns.environmentalFactors.startleEvents).toBe(2);
      expect(result.patterns.environmentalFactors.routineInteractions).toBe(3); // 2 daily_care + 1 feeding
      expect(result.patterns.environmentalFactors.meetsSkittishThreshold).toBe(true);
      expect(result.patterns.environmentalFactors.hasRoutine).toBe(false); // Needs 5+
    });
  });

  describe('Edge Cases', () => {
    test('should handle horse with no interactions', async () => {
      const horseWithNoInteractions = {
        ...mockHorse,
        groomInteractions: [],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithNoInteractions);

      const result = await analyzeCarePatterns(1, new Date('2024-06-01'));

      expect(result.eligible).toBe(true);
      expect(result.patterns.consistentCare.totalInteractions).toBe(0);
      expect(result.patterns.noveltyExposure.noveltyEvents).toBe(0);
      expect(result.patterns.stressManagement.stressEvents).toBe(0);
      expect(result.patterns.bondingPatterns.positiveInteractions).toBe(0);
    });

    test('should handle database errors gracefully', async () => {
      mockPrisma.horse.findUnique.mockRejectedValue(new Error('Database connection failed'));

      await expect(analyzeCarePatterns(1)).rejects.toThrow('Database connection failed');
    });

    test('should handle invalid evaluation date', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);

      const result = await analyzeCarePatterns(1, new Date('invalid'));

      // Should still work with current date
      expect(result.eligible).toBe(true);
    });
  });
});
