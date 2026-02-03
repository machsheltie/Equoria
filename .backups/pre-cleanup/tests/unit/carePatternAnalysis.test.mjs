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

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

await jest.unstable_mockModule('../../db/index.mjs', () => ({
  default: mockPrisma,
}));
await jest.unstable_mockModule('../../utils/logger.mjs', () => ({
  default: mockLogger,
}));

// Import after mocking
const { analyzeCarePatterns } = await import('../../utils/carePatternAnalysis.mjs');

describe('Care Pattern Analysis', () => {
  // Anchor dates to keep age calculations deterministic
  const referenceDate = new Date('2025-06-01T00:00:00Z');

  const fiveMonthsAgo = new Date(referenceDate);
  fiveMonthsAgo.setMonth(referenceDate.getMonth() - 5);

  const fourYearsAgo = new Date(referenceDate);
  fourYearsAgo.setFullYear(referenceDate.getFullYear() - 4);

  const oneMonthAgo = new Date(referenceDate);
  oneMonthAgo.setMonth(referenceDate.getMonth() - 1);

  const threeDaysAgo = new Date(referenceDate);
  threeDaysAgo.setDate(referenceDate.getDate() - 3);

  const twoDaysAgo = new Date(referenceDate);
  twoDaysAgo.setDate(referenceDate.getDate() - 2);

  const yesterday = new Date(referenceDate);
  yesterday.setDate(referenceDate.getDate() - 1);

  const today = new Date(referenceDate);

  // Additional dates for test scenarios (relative to June 1, 2024)
  const twelveDaysAgo = new Date(referenceDate);
  twelveDaysAgo.setDate(referenceDate.getDate() - 12); // May 20

  const elevenDaysAgo = new Date(referenceDate);
  elevenDaysAgo.setDate(referenceDate.getDate() - 11); // May 21

  const tenDaysAgo = new Date(referenceDate);
  tenDaysAgo.setDate(referenceDate.getDate() - 10); // May 22

  const sevenDaysAgo = new Date(referenceDate);
  sevenDaysAgo.setDate(referenceDate.getDate() - 7); // May 25

  const sixDaysAgo = new Date(referenceDate);
  sixDaysAgo.setDate(referenceDate.getDate() - 6); // May 26

  const fiveDaysAgo = new Date(referenceDate);
  fiveDaysAgo.setDate(referenceDate.getDate() - 5); // May 27

  const fourDaysAgo = new Date(referenceDate);
  fourDaysAgo.setDate(referenceDate.getDate() - 4); // May 28

  const nineDaysAgo = new Date(referenceDate);
  nineDaysAgo.setDate(referenceDate.getDate() - 9); // May 23

  const mockHorse = {
    id: 1,
    name: 'Test Horse',
    dateOfBirth: fiveMonthsAgo, // FIXED: Use calculated date for 5-month-old foal
    bondScore: 50,
    stressLevel: 20,
    groomInteractions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeCarePatterns', () => {
    test('should analyze patterns for eligible horse', async () => {
      const evaluationDate = today; // FIXED: Use calculated date for evaluation
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
        dateOfBirth: fourYearsAgo, // 4+ years old
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
            createdAt: sevenDaysAgo,
          },
          {
            id: 2,
            interactionType: 'grooming',
            quality: 'excellent',
            bondingChange: 7,
            stressChange: -3,
            createdAt: sixDaysAgo,
          },
          {
            id: 3,
            interactionType: 'daily_care',
            quality: 'good',
            bondingChange: 4,
            stressChange: -1,
            createdAt: fiveDaysAgo,
          },
        ],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithConsistentCare);

      const result = await analyzeCarePatterns(1, fourDaysAgo);

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
            createdAt: sevenDaysAgo,
          },
          {
            id: 2,
            interactionType: 'exploration',
            quality: 'excellent',
            bondingChange: 5,
            stressChange: 0,
            createdAt: sixDaysAgo,
          },
          {
            id: 3,
            interactionType: 'showground_exposure',
            quality: 'good',
            bondingChange: 2,
            stressChange: 2,
            createdAt: fiveDaysAgo,
          },
          {
            id: 4,
            interactionType: 'daily_care',
            quality: 'poor',
            bondingChange: -5,
            stressChange: 8,
            createdAt: fourDaysAgo,
          },
        ],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithNoveltyExposure);

      const result = await analyzeCarePatterns(1, threeDaysAgo);

      expect(result.patterns.noveltyExposure.noveltyEvents).toBe(3);
      expect(result.patterns.noveltyExposure.noveltyWithSupport).toBe(3);
      expect(result.patterns.noveltyExposure.fearEvents).toBe(1);
      expect(result.patterns.noveltyExposure.calmGroomPresent).toBe(true);
      expect(result.patterns.noveltyExposure.meetsBraveThreshold).toBe(true);
    });

    test('should analyze stress management patterns', async () => {
      const sevenDaysAgo10am = new Date(sevenDaysAgo);
      sevenDaysAgo10am.setHours(10, 0, 0, 0);
      const sevenDaysAgo2pm = new Date(sevenDaysAgo);
      sevenDaysAgo2pm.setHours(14, 0, 0, 0);
      const sixDaysAgo10am = new Date(sixDaysAgo);
      sixDaysAgo10am.setHours(10, 0, 0, 0);
      const sixDaysAgo4pm = new Date(sixDaysAgo);
      sixDaysAgo4pm.setHours(16, 0, 0, 0);

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
            createdAt: sevenDaysAgo10am,
          },
          {
            id: 2,
            interactionType: 'grooming',
            quality: 'good',
            bondingChange: 3,
            stressChange: -4,
            createdAt: sevenDaysAgo2pm, // Recovery within 24h
          },
          {
            id: 3,
            interactionType: 'medical_check',
            quality: 'fair',
            bondingChange: 0,
            stressChange: 5,
            createdAt: sixDaysAgo10am,
          },
          {
            id: 4,
            interactionType: 'grooming',
            quality: 'excellent',
            bondingChange: 5,
            stressChange: -6,
            createdAt: sixDaysAgo4pm, // Recovery within 24h
          },
        ],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithStressEvents);

      const result = await analyzeCarePatterns(1, fiveDaysAgo);

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
            createdAt: twelveDaysAgo,
          },
          {
            id: 2,
            interactionType: 'grooming',
            quality: 'good',
            bondingChange: 6,
            stressChange: -1,
            createdAt: elevenDaysAgo,
          },
          {
            id: 3,
            interactionType: 'feeding',
            quality: 'excellent',
            bondingChange: 7,
            stressChange: 0,
            createdAt: tenDaysAgo,
          },
        ],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithBondingPatterns);

      const result = await analyzeCarePatterns(1, nineDaysAgo);

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
            createdAt: elevenDaysAgo,
          },
          {
            id: 2,
            interactionType: 'grooming',
            quality: 'fair',
            bondingChange: -1,
            stressChange: 2,
            createdAt: sixDaysAgo, // 5-day gap
          },
        ],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithNeglect);

      const result = await analyzeCarePatterns(1, sixDaysAgo);

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
            createdAt: sevenDaysAgo,
          },
          {
            id: 2,
            interactionType: 'feeding',
            quality: 'good',
            bondingChange: 3,
            stressChange: 0,
            createdAt: sixDaysAgo,
          },
          {
            id: 3,
            interactionType: 'daily_care',
            quality: 'good',
            bondingChange: 2,
            stressChange: 6, // Another startle event
            createdAt: fiveDaysAgo,
          },
        ],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithEnvironmentalFactors);

      const result = await analyzeCarePatterns(1, fourDaysAgo);

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

      const result = await analyzeCarePatterns(1, today);

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
