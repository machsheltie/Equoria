/**
 * carePatternAnalyzer service unit tests (Equoria-rr7 coverage sprint).
 *
 * All five exported async functions tested with real DB fixtures.
 * Horse with no interactions exercises the zero-data code paths.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  analyzeCarePatterns,
  calculateAdvancedConsistencyScore,
  detectCareQualityTrends,
  analyzeGroomEffectiveness,
  calculateCareRiskScore,
} from '../../services/carePatternAnalyzer.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `carepattern-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `carepattern${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'CarePattern',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-CarePatternHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── analyzeCarePatterns ──────────────────────────────────────────────────────

describe('analyzeCarePatterns', () => {
  it('returns analysis object with expected shape for a horse with no interactions', async () => {
    const result = await analyzeCarePatterns(horse.id);

    expect(result).toBeDefined();
    expect(result.horseId).toBe(horse.id);
    expect(result.horseName).toBe(horse.name);
    expect(result.analysisWindow).toBeDefined();
    expect(typeof result.totalInteractions).toBe('number');
    expect(result.totalInteractions).toBe(0);
    expect(result.consistency).toBeDefined();
    expect(result.bondTrends).toBeDefined();
    expect(result.stressPatterns).toBeDefined();
    expect(result.taskDiversity).toBeDefined();
    expect(result.groomConsistency).toBeDefined();
    expect(result.neglectPatterns).toBeDefined();
  });

  it('throws for non-existent horse', async () => {
    await expect(analyzeCarePatterns(999999999)).rejects.toThrow();
  });

  it('analysis window has start, end, daysAnalyzed', async () => {
    const result = await analyzeCarePatterns(horse.id);
    const window = result.analysisWindow;

    expect(window.start).toBeInstanceOf(Date);
    expect(window.end).toBeInstanceOf(Date);
    expect(typeof window.daysAnalyzed).toBe('number');
    expect(window.daysAnalyzed).toBeGreaterThanOrEqual(0);
  });
});

// ─── calculateAdvancedConsistencyScore ───────────────────────────────────────

describe('calculateAdvancedConsistencyScore', () => {
  it('returns zero-score object for horse with no interactions', async () => {
    const result = await calculateAdvancedConsistencyScore(horse.id);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result.overallScore).toBe(0);
    expect(result.components).toBeDefined();
    expect(result.dataPoints).toBe(0);
  });

  it('returns zero-score defaults for unknown horseId (no interactions)', async () => {
    const result = await calculateAdvancedConsistencyScore(999999999);

    expect(result).toBeDefined();
    expect(result.overallScore).toBe(0);
    expect(result.dataPoints).toBe(0);
  });
});

// ─── detectCareQualityTrends ──────────────────────────────────────────────────

describe('detectCareQualityTrends', () => {
  it('returns insufficient_data trend for horse with no interactions', async () => {
    const result = await detectCareQualityTrends(horse.id);

    expect(result).toBeDefined();
    expect(result.qualityTrend).toBe('insufficient_data');
    expect(result.bondTrend).toBe('insufficient_data');
    expect(result.stressTrend).toBe('insufficient_data');
    expect(result.dataPoints).toBe(0);
  });

  it('returns insufficient_data for unknown horseId', async () => {
    const result = await detectCareQualityTrends(999999999);

    expect(result).toBeDefined();
    expect(result.qualityTrend).toBe('insufficient_data');
  });
});

// ─── analyzeGroomEffectiveness ────────────────────────────────────────────────

describe('analyzeGroomEffectiveness', () => {
  it('returns effectiveness data for horse with no assignments', async () => {
    const result = await analyzeGroomEffectiveness(horse.id);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('returns without throwing for unknown horseId', async () => {
    const result = await analyzeGroomEffectiveness(999999999);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ─── calculateCareRiskScore ───────────────────────────────────────────────────

describe('calculateCareRiskScore', () => {
  it('returns risk score for horse with no interactions', async () => {
    const result = await calculateCareRiskScore(horse.id);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('returns without throwing for unknown horseId', async () => {
    const result = await calculateCareRiskScore(999999999);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});
