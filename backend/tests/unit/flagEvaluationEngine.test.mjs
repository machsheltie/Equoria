/**
 * Flag Evaluation Engine Tests
 *
 * Tests the real flag evaluation logic end-to-end with real carePatternAnalysis.
 * carePatternAnalysis is NOT mocked — it runs its real pattern analysis code.
 *
 * Permitted mocks:
 * - db/index.mjs (prisma client — infrastructure boundary)
 * - logger (permitted infrastructure)
 *
 * Both flagEvaluationEngine and carePatternAnalysis import from ../db/index.mjs,
 * so mocking that single module covers both. Each evaluateHorseFlags call results
 * in TWO horse.findUnique calls:
 *   1. Engine call (select fields only, no groomInteractions)
 *   2. carePatternAnalysis call (include groomInteractions)
 *
 * Design note on interaction data:
 * - brave triggers when: noveltyWithSupport >= 3 AND bondScore >= 30 AND calmGroomPresent
 * - confident triggers when: consecutiveDays >= 7 AND bondScore >= 40 AND positiveInteractions >= 10 AND bondScore >= 40
 * - fearful triggers when: fearEvents >= 2 AND bondScore <= 20 AND noveltyWithSupport === 0
 * - insecure triggers when: (daysWithoutCare >= 4 AND bondScore <= 25) OR poorQualityInteractions >= 3
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';

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

await jest.unstable_mockModule('../../db/index.mjs', () => ({
  default: mockPrisma,
}));
await jest.unstable_mockModule('../../utils/logger.mjs', () => ({
  default: mockLogger,
}));

// carePatternAnalysis is NOT mocked — real analysis runs against mockPrisma

const { evaluateHorseFlags, batchEvaluateFlags, getEligibleHorses } = await import(
  '../../utils/flagEvaluationEngine.mjs'
);

// ─── date helpers ────────────────────────────────────────────────────────────

const daysAgo = n => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const yearsAgo = n => new Date(Date.now() - n * 365.25 * 24 * 60 * 60 * 1000);
const monthsAgo = n => new Date(Date.now() - n * 30 * 24 * 60 * 60 * 1000);

// ─── interaction factories ────────────────────────────────────────────────────

/**
 * Desensitization interaction: counts toward noveltyExposure.
 * With bondingChange >= 0 and quality 'good'/'excellent', counts as noveltyWithSupport.
 */
const desensitization = (daysAgoN, opts = {}) => ({
  interactionType: 'desensitization',
  bondingChange: opts.bondingChange ?? 3,
  quality: opts.quality ?? 'good',
  stressChange: opts.stressChange ?? 0,
  notes: opts.notes ?? null,
  createdAt: daysAgo(daysAgoN),
});

/**
 * Daily care interaction: counts toward consistentCare (groomingInteractions).
 */
const dailyCare = (daysAgoN, opts = {}) => ({
  interactionType: 'daily_care',
  bondingChange: opts.bondingChange ?? 3,
  quality: opts.quality ?? 'good',
  stressChange: opts.stressChange ?? 0,
  notes: opts.notes ?? null,
  createdAt: daysAgo(daysAgoN),
});

// ─── mock horse builders ──────────────────────────────────────────────────────

/**
 * Horse record for the engine's select query (no groomInteractions).
 */
const engineHorse = (overrides = {}) => ({
  id: 1,
  name: 'Test Horse',
  dateOfBirth: yearsAgo(1),
  epigeneticFlags: [],
  bondScore: 50,
  stressLevel: 20,
  ...overrides,
});

/**
 * Horse record for carePatternAnalysis's include query (with groomInteractions).
 */
const careHorse = (dateOfBirth, bondScore, stressLevel, groomInteractions) => ({
  id: 1,
  name: 'Test Horse',
  dateOfBirth,
  bondScore,
  stressLevel,
  groomInteractions,
});

// ─── interaction sets ─────────────────────────────────────────────────────────

/**
 * 10 interactions across 7 days: 3 desensitization + 7 daily_care.
 * All positive quality. Triggers: brave + confident (+ affectionate).
 * bondScore must be >= 40 (use 60).
 */
const braveAndConfidentInteractions = [
  desensitization(6),
  desensitization(5),
  desensitization(4),
  dailyCare(6),
  dailyCare(5),
  dailyCare(4),
  dailyCare(3),
  dailyCare(2),
  dailyCare(1),
  dailyCare(0),
];

/**
 * 3 desensitization interactions across 3 days.
 * Triggers: brave only (not confident — only 3 days, 3 positiveInteractions).
 * bondScore must be >= 30 (use 35).
 */
const braveOnlyInteractions = [desensitization(2), desensitization(1), desensitization(0)];

/**
 * 3 daily_care interactions with strong negative bondingChange.
 * bondingChange=-5 counts as fearEvent (< -3).
 * quality='good' prevents poorQualityInteractions from accumulating.
 * interactions.length=3 prevents meetsAloofThreshold (requires < 3).
 * Triggers: fearful only.
 * bondScore must be <= 20 (use 15).
 */
const fearfulOnlyInteractions = [
  dailyCare(2, { bondingChange: -5, quality: 'good' }),
  dailyCare(1, { bondingChange: -5, quality: 'good' }),
  dailyCare(0, { bondingChange: -5, quality: 'good' }),
];

/**
 * 3 poor-quality interactions.
 * Triggers: insecure via poorQualityInteractions >= 3.
 * bondingChange=-1 (not < -3 → no fearEvents).
 * interactions.length=3 prevents meetsAloofThreshold.
 */
const insecureOnlyInteractions = [
  dailyCare(2, { bondingChange: -1, quality: 'poor' }),
  dailyCare(1, { bondingChange: -1, quality: 'poor' }),
  dailyCare(0, { bondingChange: -1, quality: 'poor' }),
];

// ─── tests ────────────────────────────────────────────────────────────────────

describe('Flag Evaluation Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: update resolves without issues
    mockPrisma.horse.update.mockResolvedValue({ id: 1 });
  });

  describe('evaluateHorseFlags', () => {
    test('should evaluate and assign flags for eligible horse', async () => {
      const dob = monthsAgo(5);
      const horse = engineHorse({ dateOfBirth: dob, bondScore: 60 });

      mockPrisma.horse.findUnique
        .mockResolvedValueOnce(horse)
        .mockResolvedValueOnce(careHorse(dob, 60, 20, braveAndConfidentInteractions));

      const result = await evaluateHorseFlags(1);

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
      const oldHorse = engineHorse({ dateOfBirth: yearsAgo(4) });
      mockPrisma.horse.findUnique.mockResolvedValueOnce(oldHorse);

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('outside evaluation range');
      expect(result.newFlags).toHaveLength(0);
      expect(mockPrisma.horse.update).not.toHaveBeenCalled();
    });

    test('should reject horse with maximum flags', async () => {
      const horseAtMax = engineHorse({
        epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient', 'fearful'],
      });
      mockPrisma.horse.findUnique.mockResolvedValueOnce(horseAtMax);

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('maximum number of flags');
      expect(result.currentFlags).toHaveLength(5);
      expect(result.newFlags).toHaveLength(0);
      expect(mockPrisma.horse.update).not.toHaveBeenCalled();
    });

    test('should not assign duplicate flags', async () => {
      // Horse already has brave + confident; use empty interactions so no new flags trigger
      const dob = yearsAgo(1);
      const horse = engineHorse({ dateOfBirth: dob, epigeneticFlags: ['brave', 'confident'], bondScore: 50 });

      mockPrisma.horse.findUnique.mockResolvedValueOnce(horse).mockResolvedValueOnce(careHorse(dob, 50, 20, []));

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(true);
      expect(result.currentFlags).toContain('brave');
      expect(result.currentFlags).toContain('confident');
      expect(result.newFlags).not.toContain('brave');
      expect(result.newFlags).not.toContain('confident');
    });

    test('should respect flag limit during assignment', async () => {
      // Horse at 4 flags; insecure triggers via poorQualityInteractions >= 3, reaching limit of 5
      const dob = yearsAgo(1);
      const horse = engineHorse({
        dateOfBirth: dob,
        epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient'],
        bondScore: 15,
      });

      mockPrisma.horse.findUnique
        .mockResolvedValueOnce(horse)
        .mockResolvedValueOnce(careHorse(dob, 15, 20, insecureOnlyInteractions));

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(true);
      expect(result.totalFlags).toBe(5);
      expect(result.newFlags).toHaveLength(1);
    });

    test('should return success with no flags when horse has no care interactions', async () => {
      // Real carePatternAnalysis runs with empty groomInteractions — no thresholds met
      const dob = yearsAgo(1);
      const horse = engineHorse({ dateOfBirth: dob, bondScore: 50 });

      mockPrisma.horse.findUnique.mockResolvedValueOnce(horse).mockResolvedValueOnce(careHorse(dob, 50, 20, []));

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(true);
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
      // 3 supported novelty interactions + bondScore >= 30
      const dob = yearsAgo(1);
      const horse = engineHorse({ name: 'Brave Horse', dateOfBirth: dob, bondScore: 35, stressLevel: 15 });

      mockPrisma.horse.findUnique
        .mockResolvedValueOnce(horse)
        .mockResolvedValueOnce(careHorse(dob, 35, 15, braveOnlyInteractions));

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(true);
      expect(result.newFlags).toContain('brave');
    });

    test('should trigger fearful flag with correct conditions', async () => {
      // 3 negative interactions (bondingChange < -3) + low bondScore
      const dob = yearsAgo(1);
      const horse = engineHorse({ name: 'Fearful Horse', dateOfBirth: dob, bondScore: 15, stressLevel: 60 });

      mockPrisma.horse.findUnique
        .mockResolvedValueOnce(horse)
        .mockResolvedValueOnce(careHorse(dob, 15, 60, fearfulOnlyInteractions));

      const result = await evaluateHorseFlags(1);

      expect(result.success).toBe(true);
      expect(result.newFlags).toContain('fearful');
    });
  });

  describe('batchEvaluateFlags', () => {
    test('should evaluate multiple horses', async () => {
      const dob = yearsAgo(1);
      const emptyHorse = (id, name) => ({
        id,
        name,
        dateOfBirth: dob,
        epigeneticFlags: [],
        bondScore: 50,
        stressLevel: 20,
      });
      const emptyCare = careHorse(dob, 50, 20, []);

      mockPrisma.horse.findUnique
        .mockResolvedValueOnce(emptyHorse(1, 'Horse 1'))
        .mockResolvedValueOnce(emptyCare)
        .mockResolvedValueOnce(emptyHorse(2, 'Horse 2'))
        .mockResolvedValueOnce(emptyCare)
        .mockResolvedValueOnce(emptyHorse(3, 'Horse 3'))
        .mockResolvedValueOnce(emptyCare);

      const results = await batchEvaluateFlags([1, 2, 3]);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should handle mixed success/failure in batch', async () => {
      const dob = yearsAgo(1);

      mockPrisma.horse.findUnique
        .mockResolvedValueOnce({
          id: 1,
          name: 'Horse 1',
          dateOfBirth: dob,
          epigeneticFlags: [],
          bondScore: 50,
          stressLevel: 20,
        })
        .mockResolvedValueOnce(careHorse(dob, 50, 20, []))
        .mockResolvedValueOnce(null); // Horse 2 not found

      const results = await batchEvaluateFlags([1, 2]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Horse with ID 2 not found');
    });
  });

  describe('getEligibleHorses', () => {
    test('should return eligible horses within age range', async () => {
      const eligibleHorses = [
        { id: 1, name: 'Young Horse 1', dateOfBirth: yearsAgo(1), epigeneticFlags: [] },
        { id: 2, name: 'Young Horse 2', dateOfBirth: monthsAgo(18), epigeneticFlags: ['brave'] },
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
