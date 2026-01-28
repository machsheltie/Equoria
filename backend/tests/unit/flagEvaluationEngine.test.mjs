/**
 * Flag Evaluation Engine Tests
 * Unit tests for flag evaluation logic and assignment
 *
 * 🧪 TESTING APPROACH: Balanced Mocking
 * - Mock Prisma database calls only
 * - Mock care pattern analysis module
 * - Test real flag evaluation logic
 * - Validate business rules and constraints
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock Prisma
const mockPrisma = {
  horse: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Mock care pattern analysis
const mockAnalyzeCarePatterns = jest.fn();
await jest.unstable_mockModule('../../db/index.mjs', () => ({
  default: mockPrisma,
}));
await jest.unstable_mockModule('../../utils/logger.mjs', () => ({
  default: mockLogger,
}));
await jest.unstable_mockModule('../../utils/carePatternAnalysis.mjs', () => ({
  analyzeCarePatterns: mockAnalyzeCarePatterns,
}));

// Import after mocking
const {
  evaluateHorseFlags,
  batchEvaluateFlags,
  getEligibleHorses,
} = await import('../../utils/flagEvaluationEngine.mjs');

describe('Flag Evaluation Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateHorseFlags', () => {
    // Calculate dynamic date for foal (5 months old at evaluation)
    const fiveMonthsAgo = new Date();
    fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);

    const mockHorse = {
      id: 1,
      name: 'Test Horse',
      dateOfBirth: fiveMonthsAgo, // FIXED: Use calculated date for 5-month-old foal
      epigeneticFlags: [],
      bondScore: 50,
      stressLevel: 20,
    };

    const mockCareAnalysis = {
      eligible: true,
      patterns: {
        consistentCare: {
          consecutiveDaysWithCare: 8,
          totalInteractions: 10,
          groomingInteractions: 8,
          qualityInteractions: 7,
          averageBondChange: 5.2,
          meetsConsistentCareThreshold: true,
        },
        noveltyExposure: {
          noveltyEvents: 4,
          noveltyWithSupport: 4,
          fearEvents: 0,
          calmGroomPresent: true,
          meetsBraveThreshold: true,
        },
        stressManagement: {
          stressEvents: 3,
          recoveryEvents: 3,
          stressWithSupport: 3,
          currentStressLevel: 20,
          meetsResilientThreshold: true,
          meetsFragileThreshold: false,
        },
        bondingPatterns: {
          positiveInteractions: 12,
          highQualityInteractions: 10,
          daysWithInteraction: 8,
          currentBondScore: 60,
          averageBondChange: 5.2,
          meetsAffectionateThreshold: true,
          meetsConfidentThreshold: true,
        },
        neglectPatterns: {
          maxConsecutiveDaysWithoutCare: 0,
          poorQualityInteractions: 1,
          negativeInteractions: 0,
          currentBondScore: 60,
          meetsInsecureThreshold: false,
          meetsAloofThreshold: false,
        },
        environmentalFactors: {
          startleEvents: 0,
          routineInteractions: 8,
          environmentalChanges: 0,
          meetsSkittishThreshold: false,
          hasRoutine: true,
        },
      },
    };

    test('should evaluate and assign flags for eligible horse', async () => {
      const evaluationDate = new Date(); // FIXED: Use current date for evaluation (5 months after birth)
      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockAnalyzeCarePatterns.mockResolvedValue(mockCareAnalysis);
      mockPrisma.horse.update.mockResolvedValue({ ...mockHorse, epigeneticFlags: ['brave', 'confident'] });

      const result = await evaluateHorseFlags(1, evaluationDate);

      expect(result.success).toBe(true);
      expect(result.horseId).toBe(1);
      expect(result.horseName).toBe('Test Horse');
      expect(result.newFlags).toContain('brave');
      expect(result.newFlags).toContain('confident');
      expect(result.newFlags.length).toBeGreaterThan(0);
      expect(mockPrisma.horse.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          epigeneticFlags: expect.arrayContaining(['brave', 'confident']),
        },
      });
    });

    test('should reject horse outside age range', async () => {
      // Calculate dynamic date for horse outside evaluation range (4+ years old)
      const fourYearsAgo = new Date();
      fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

      const oldHorse = {
        ...mockHorse,
        dateOfBirth: fourYearsAgo, // FIXED: Use calculated date for 4-year-old horse
      };
      mockPrisma.horse.findUnique.mockResolvedValue(oldHorse);

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('outside evaluation range');
      expect(result.newFlags).toHaveLength(0);
      expect(mockPrisma.horse.update).not.toHaveBeenCalled();
    });

    test('should reject horse with maximum flags', async () => {
      const horseWithMaxFlags = {
        ...mockHorse,
        epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient', 'fearful'],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithMaxFlags);

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('maximum number of flags');
      expect(result.currentFlags).toHaveLength(5);
      expect(result.newFlags).toHaveLength(0);
      expect(mockPrisma.horse.update).not.toHaveBeenCalled();
    });

    test('should not assign duplicate flags', async () => {
      const horseWithExistingFlags = {
        ...mockHorse,
        epigeneticFlags: ['brave', 'confident'],
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseWithExistingFlags);
      mockAnalyzeCarePatterns.mockResolvedValue(mockCareAnalysis);
      mockPrisma.horse.update.mockResolvedValue(horseWithExistingFlags);

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(true);
      expect(result.currentFlags).toContain('brave');
      expect(result.currentFlags).toContain('confident');
      expect(result.newFlags).not.toContain('brave');
      expect(result.newFlags).not.toContain('confident');
    });

    test('should respect flag limit during assignment', async () => {
      const horseNearLimit = {
        ...mockHorse,
        epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient'], // 4 flags
      };
      mockPrisma.horse.findUnique.mockResolvedValue(horseNearLimit);
      mockAnalyzeCarePatterns.mockResolvedValue({
        ...mockCareAnalysis,
        patterns: {
          ...mockCareAnalysis.patterns,
          neglectPatterns: {
            ...mockCareAnalysis.patterns.neglectPatterns,
            meetsInsecureThreshold: true, // Would trigger insecure flag
          },
        },
      });
      mockPrisma.horse.update.mockResolvedValue({
        ...horseNearLimit,
        epigeneticFlags: [...horseNearLimit.epigeneticFlags, 'insecure'],
      });

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(true);
      expect(result.totalFlags).toBe(5); // Should reach exactly 5
      expect(result.newFlags).toHaveLength(1);
    });

    test('should handle care analysis ineligibility', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockAnalyzeCarePatterns.mockResolvedValue({
        eligible: false,
        reason: 'Insufficient interaction data',
      });

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Insufficient interaction data');
      expect(result.newFlags).toHaveLength(0);
      expect(mockPrisma.horse.update).not.toHaveBeenCalled();
    });

    test('should handle non-existent horse', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(null);

      await expect(evaluateHorseFlags(999)).rejects.toThrow('Horse with ID 999 not found');
    });

    test('should handle database errors', async () => {
      mockPrisma.horse.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(evaluateHorseFlags(1)).rejects.toThrow('Database error');
    });
  });

  describe('Flag Trigger Evaluation', () => {
    test('should trigger brave flag with correct conditions', async () => {
      // Calculate dynamic date for young foal (eligible for flag evaluation)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const mockHorse = {
        id: 1,
        name: 'Brave Horse',
        dateOfBirth: oneYearAgo, // FIXED: Use calculated date for 1-year-old foal
        epigeneticFlags: [],
        bondScore: 35,
        stressLevel: 15,
      };

      const bravePatterns = {
        eligible: true,
        patterns: {
          noveltyExposure: {
            meetsBraveThreshold: true,
            calmGroomPresent: true,
            noveltyWithSupport: 4,
          },
          bondingPatterns: {
            currentBondScore: 35,
          },
          consistentCare: { meetsConsistentCareThreshold: false },
          stressManagement: { meetsResilientThreshold: false },
          neglectPatterns: { meetsInsecureThreshold: false, meetsAloofThreshold: false },
          environmentalFactors: { meetsSkittishThreshold: false },
        },
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockAnalyzeCarePatterns.mockResolvedValue(bravePatterns);
      mockPrisma.horse.update.mockResolvedValue({ ...mockHorse, epigeneticFlags: ['brave'] });

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(true);
      expect(result.newFlags).toContain('brave');
    });

    test('should trigger fearful flag with correct conditions', async () => {
      // Calculate dynamic date for young foal (eligible for flag evaluation)
      const oneYearAgoForFearful = new Date();
      oneYearAgoForFearful.setFullYear(oneYearAgoForFearful.getFullYear() - 1);

      const mockHorse = {
        id: 1,
        name: 'Fearful Horse',
        dateOfBirth: oneYearAgoForFearful, // FIXED: Use calculated date for 1-year-old foal
        epigeneticFlags: [],
        bondScore: 15,
        stressLevel: 60,
      };

      const fearfulPatterns = {
        eligible: true,
        patterns: {
          noveltyExposure: {
            fearEvents: 3,
            noveltyWithSupport: 0,
            meetsBraveThreshold: false,
          },
          bondingPatterns: {
            currentBondScore: 15,
            meetsConfidentThreshold: false,
            meetsAffectionateThreshold: false,
          },
          consistentCare: { meetsConsistentCareThreshold: false },
          stressManagement: { meetsResilientThreshold: false, meetsFragileThreshold: false },
          neglectPatterns: { meetsInsecureThreshold: false, meetsAloofThreshold: false },
          environmentalFactors: { meetsSkittishThreshold: false },
        },
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockAnalyzeCarePatterns.mockResolvedValue(fearfulPatterns);
      mockPrisma.horse.update.mockResolvedValue({ ...mockHorse, epigeneticFlags: ['fearful'] });

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(true);
      expect(result.newFlags).toContain('fearful');
    });
  });

  describe('batchEvaluateFlags', () => {
    test('should evaluate multiple horses', async () => {
      const horseIds = [1, 2, 3];

      // Calculate dynamic date for young foals (eligible for flag evaluation)
      const oneYearAgoForBatch = new Date();
      oneYearAgoForBatch.setFullYear(oneYearAgoForBatch.getFullYear() - 1);

      // Mock successful evaluations
      mockPrisma.horse.findUnique
        .mockResolvedValueOnce({ id: 1, name: 'Horse 1', dateOfBirth: oneYearAgoForBatch, epigeneticFlags: [] }) // FIXED: Use calculated date
        .mockResolvedValueOnce({ id: 2, name: 'Horse 2', dateOfBirth: oneYearAgoForBatch, epigeneticFlags: [] }) // FIXED: Use calculated date
        .mockResolvedValueOnce({ id: 3, name: 'Horse 3', dateOfBirth: oneYearAgoForBatch, epigeneticFlags: [] }); // FIXED: Use calculated date

      mockAnalyzeCarePatterns.mockResolvedValue({
        eligible: true,
        patterns: {
          consistentCare: { meetsConsistentCareThreshold: false },
          noveltyExposure: { meetsBraveThreshold: false },
          stressManagement: { meetsResilientThreshold: false, meetsFragileThreshold: false },
          bondingPatterns: { meetsConfidentThreshold: false, meetsAffectionateThreshold: false },
          neglectPatterns: { meetsInsecureThreshold: false, meetsAloofThreshold: false },
          environmentalFactors: { meetsSkittishThreshold: false },
        },
      });

      const results = await batchEvaluateFlags(horseIds);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should handle mixed success/failure in batch', async () => {
      const horseIds = [1, 2];

      // Calculate dynamic date for young foal (eligible for flag evaluation)
      const oneYearAgoForMixed = new Date();
      oneYearAgoForMixed.setFullYear(oneYearAgoForMixed.getFullYear() - 1);

      mockPrisma.horse.findUnique
        .mockResolvedValueOnce({ id: 1, name: 'Horse 1', dateOfBirth: oneYearAgoForMixed, epigeneticFlags: [] }) // FIXED: Use calculated date
        .mockResolvedValueOnce(null); // Horse 2 not found

      mockAnalyzeCarePatterns.mockResolvedValue({
        eligible: true,
        patterns: {
          consistentCare: { meetsConsistentCareThreshold: false },
          noveltyExposure: { meetsBraveThreshold: false },
          stressManagement: { meetsResilientThreshold: false, meetsFragileThreshold: false },
          bondingPatterns: { meetsConfidentThreshold: false, meetsAffectionateThreshold: false },
          neglectPatterns: { meetsInsecureThreshold: false, meetsAloofThreshold: false },
          environmentalFactors: { meetsSkittishThreshold: false },
        },
      });

      const results = await batchEvaluateFlags(horseIds);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Horse with ID 2 not found');
    });
  });

  describe('getEligibleHorses', () => {
    test('should return eligible horses within age range', async () => {
      // Calculate dynamic dates for young horses (eligible for flag evaluation)
      const oneYearAgoForEligible = new Date();
      oneYearAgoForEligible.setFullYear(oneYearAgoForEligible.getFullYear() - 1);

      const eighteenMonthsAgoForEligible = new Date();
      eighteenMonthsAgoForEligible.setMonth(eighteenMonthsAgoForEligible.getMonth() - 18);

      const eligibleHorses = [
        { id: 1, name: 'Young Horse 1', dateOfBirth: oneYearAgoForEligible, epigeneticFlags: [] }, // FIXED: Use calculated date for 1-year-old horse
        { id: 2, name: 'Young Horse 2', dateOfBirth: eighteenMonthsAgoForEligible, epigeneticFlags: ['brave'] }, // FIXED: Use calculated date for 18-month-old horse
      ];

      mockPrisma.horse.findMany.mockResolvedValue(eligibleHorses);

      const result = await getEligibleHorses();

      expect(result).toEqual([1, 2]);
      expect(mockPrisma.horse.findMany).toHaveBeenCalledWith({
        where: {
          dateOfBirth: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        select: {
          id: true,
          name: true,
          dateOfBirth: true,
          epigeneticFlags: true,
        },
      });
    });

    test('should handle database errors in getEligibleHorses', async () => {
      mockPrisma.horse.findMany.mockRejectedValue(new Error('Database error'));

      await expect(getEligibleHorses()).rejects.toThrow('Database error');
    });
  });
});
