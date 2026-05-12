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

// ── DB-fixture paths — with interactions (Equoria-jkht) ───────────────────────
// Creates a horse with 7 groomInteractions + 1 assignment to cover:
//  - analyzeCarePatterns: non-zero-interaction paths in all 6 sub-functions
//  - calculateAdvancedConsistencyScore: ≥2 interactions → all 5 consistency calculators
//  - detectCareQualityTrends: ≥3 interactions → trend analysis + projectedOutcome
//  - analyzeGroomEffectiveness: ≥1 interaction → calculateGroomStats path
//  - calculateCareRiskScore: ≥1 interaction → all risk sub-functions

describe('carePatternAnalyzer — with interactions (Equoria-jkht)', () => {
  let caUser;
  let caGroom;
  let caHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    caUser = await prisma.user.create({
      data: {
        email: `cp-inter-${ts}-${rand()}@test.com`,
        username: `cpinter${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'CP',
        lastName: 'Inter',
        money: 1000,
      },
    });

    caGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-CP-Groom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: caUser.id,
        isActive: true,
      },
    });

    caHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-CP-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: caUser.id,
      },
    });

    await prisma.groomAssignment.create({
      data: {
        foalId: caHorse.id,
        groomId: caGroom.id,
        userId: caUser.id,
        priority: 1,
        isActive: true,
      },
    });

    // 7 interactions with rising bondingChange + rising quality (triggers 'improving' trends)
    const rows = [
      { bondingChange: 0, stressChange: 0, quality: 'good', taskType: 'grooming', duration: 20 },
      { bondingChange: 1, stressChange: 0, quality: 'good', taskType: 'feeding', duration: 25 },
      { bondingChange: 1, stressChange: 0, quality: 'good', taskType: 'grooming', duration: 30 },
      { bondingChange: 2, stressChange: 0, quality: 'good', taskType: 'grooming', duration: 30 },
      { bondingChange: 3, stressChange: 0, quality: 'excellent', taskType: 'feeding', duration: 35 },
      { bondingChange: 4, stressChange: 0, quality: 'excellent', taskType: 'grooming', duration: 35 },
      { bondingChange: 5, stressChange: 0, quality: 'excellent', taskType: 'grooming', duration: 40 },
    ];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      await prisma.groomInteraction.create({
        data: {
          foalId: caHorse.id,
          groomId: caGroom.id,
          interactionType: 'daily_care',
          duration: r.duration,
          bondingChange: r.bondingChange,
          stressChange: r.stressChange,
          quality: r.quality,
          taskType: r.taskType,
          createdAt: new Date(ts - (rows.length - i) * 60000),
          timestamp: new Date(ts - (rows.length - i) * 60000),
        },
      });
    }
  }, 60000);

  afterAll(async () => {
    await prisma.groomInteraction.deleteMany({ where: { foalId: caHorse.id } }).catch(() => {});
    await prisma.groomAssignment.deleteMany({ where: { foalId: caHorse.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: caHorse.id } }).catch(() => {});
    await prisma.groom.delete({ where: { id: caGroom.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: caUser.id } }).catch(() => {});
  }, 30000);

  it('analyzeCarePatterns returns totalInteractions=7 and bond/stress/task analysis when horse has interactions', async () => {
    const result = await analyzeCarePatterns(caHorse.id);
    expect(result.totalInteractions).toBe(7);
    expect(typeof result.consistency.consistencyScore).toBe('number');
    expect(typeof result.bondTrends.trend).toBe('string');
    expect(typeof result.stressPatterns.pattern).toBe('string');
    expect(result.taskDiversity.taskTypes.length).toBeGreaterThan(0);
    expect(result.groomConsistency.currentAssignments).toBeGreaterThan(0);
  });

  it('calculateAdvancedConsistencyScore returns non-zero overallScore with 7 interactions', async () => {
    const result = await calculateAdvancedConsistencyScore(caHorse.id);
    expect(result.dataPoints).toBe(7);
    expect(typeof result.overallScore).toBe('number');
    expect(result.overallScore).toBeGreaterThan(0);
    expect(typeof result.components.frequencyConsistency).toBe('number');
    expect(typeof result.components.qualityConsistency).toBe('number');
    expect(typeof result.components.durationConsistency).toBe('number');
    expect(typeof result.components.groomConsistency).toBe('number');
    expect(typeof result.components.timingConsistency).toBe('number');
  });

  it('detectCareQualityTrends returns improving bondTrend and positive projectedOutcome', async () => {
    const result = await detectCareQualityTrends(caHorse.id);
    expect(result.dataPoints).toBe(7);
    expect(result.bondTrend).toBe('improving');
    expect(result.projectedOutcome).toBe('positive');
    expect(typeof result.trendStrength).toBe('number');
    expect(result.trendStrength).toBeGreaterThan(0);
  });

  it('analyzeGroomEffectiveness returns non-null mostEffective when horse has interactions', async () => {
    const result = await analyzeGroomEffectiveness(caHorse.id);
    expect(result.totalInteractions).toBe(7);
    expect(Array.isArray(result.groomStats)).toBe(true);
    expect(result.groomStats.length).toBeGreaterThan(0);
    expect(result.mostEffective).not.toBeNull();
    expect(typeof result.overallEffectiveness).toBe('number');
  });

  it('calculateCareRiskScore returns a risk level string with 7 interactions', async () => {
    const result = await calculateCareRiskScore(caHorse.id);
    expect(result.dataPoints).toBe(7);
    expect(typeof result.riskLevel).toBe('string');
    expect(['critical', 'high', 'moderate', 'low']).toContain(result.riskLevel);
    expect(typeof result.overallRisk).toBe('number');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});
