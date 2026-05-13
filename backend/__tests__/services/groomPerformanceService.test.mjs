/**
 * groomPerformanceService branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * Pure-path tests (no fixture):
 *   getGroomPerformanceSummary — groom not found → throws
 *   getTopPerformingGrooms — non-existent user → []
 *
 * DB-fixture branch coverage:
 *   getGroomPerformanceSummary with groom+EXCELLENT metrics → hasReliableReputation, EXCELLENT tier, insufficient_data trend
 *   getGroomPerformanceSummary with groom + 3 records → stable trend (olderBondGains.length=0 branch)
 *   getGroomPerformanceSummary with groom + 10 improving records → improving trend
 *   getGroomPerformanceSummary with groom + 10 declining records → declining trend
 *   getTopPerformingGrooms with real grooms → hits EXCELLENT and AVERAGE reputation tiers
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  PERFORMANCE_CONFIG,
  getGroomPerformanceSummary,
  getTopPerformingGrooms,
} from '../../services/groomPerformanceService.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

// ── Pure-path tests (no DB fixture needed) ────────────────────────────────────

describe('getGroomPerformanceSummary — groom not found (Equoria-jkht)', () => {
  it('throws "Groom not found" for non-existent groomId', async () => {
    await expect(getGroomPerformanceSummary(999999999)).rejects.toThrow('Groom not found');
  });
});

describe('getTopPerformingGrooms — non-existent user (Equoria-jkht)', () => {
  it('returns empty array for user with no grooms', async () => {
    const result = await getTopPerformingGrooms('00000000-0000-0000-0000-000000000099');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

// ── DB fixture branch coverage ────────────────────────────────────────────────

describe('groomPerformanceService — DB fixture branch coverage (Equoria-jkht)', () => {
  let gpUser;
  let gpGroom1; // has GroomMetrics(score=90) + no performance records
  let gpGroom2; // 3 records all bondGain=3 → stable + olderBondGains.length=0 branch
  let gpGroom3; // 10 records: recent bondGain=5, older bondGain=0 → improving
  let gpGroom4; // 10 records: recent bondGain=0, older bondGain=5 → declining

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    gpUser = await prisma.user.create({
      data: {
        email: `gps-${ts}-${rand()}@test.com`,
        username: `gps${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GPS',
        lastName: 'Tester',
        money: 1000,
      },
    });

    gpGroom1 = await prisma.groom.create({
      data: {
        name: `TestFixture-GPS-Groom1-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        userId: gpUser.id,
      },
    });
    gpGroom2 = await prisma.groom.create({
      data: {
        name: `TestFixture-GPS-Groom2-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        userId: gpUser.id,
      },
    });
    gpGroom3 = await prisma.groom.create({
      data: {
        name: `TestFixture-GPS-Groom3-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        userId: gpUser.id,
      },
    });
    gpGroom4 = await prisma.groom.create({
      data: {
        name: `TestFixture-GPS-Groom4-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        userId: gpUser.id,
      },
    });

    // groom1: create GroomMetrics with EXCELLENT score + enough interactions
    await prisma.groomMetrics.create({
      data: {
        groomId: gpGroom1.id,
        reputationScore: 90,
        totalInteractions: 15, // >= MIN_INTERACTIONS_FOR_REPUTATION (10)
      },
    });

    // groom2: 3 records all bondGain=3 (stable trend, olderBondGains empty)
    for (let i = 0; i < 3; i++) {
      await prisma.groomPerformanceRecord.create({
        data: {
          groomId: gpGroom2.id,
          userId: gpUser.id,
          interactionType: 'grooming',
          bondGain: 3,
          recordedAt: new Date(ts - i * 60000),
        },
      });
    }

    // groom3: 10 records ordered by recordedAt desc
    // i=0 (most recent) → bondGain=5; i>=5 (older) → bondGain=0
    // Slice(0,5) = recent=[5,5,5,5,5] avg=5; slice(5,10) = older=[0,0,0,0,0] avg=0 → improving
    for (let i = 0; i < 10; i++) {
      await prisma.groomPerformanceRecord.create({
        data: {
          groomId: gpGroom3.id,
          userId: gpUser.id,
          interactionType: 'grooming',
          bondGain: i < 5 ? 5 : 0,
          recordedAt: new Date(ts - i * 60000),
        },
      });
    }

    // groom4: 10 records — recent bondGain=0, older bondGain=5 → declining
    // Slice(0,5) = recent=[0,0,0,0,0] avg=0; slice(5,10) = older=[5,5,5,5,5] avg=5 → improving=-5 → declining
    for (let i = 0; i < 10; i++) {
      await prisma.groomPerformanceRecord.create({
        data: {
          groomId: gpGroom4.id,
          userId: gpUser.id,
          interactionType: 'grooming',
          bondGain: i < 5 ? 0 : 5,
          recordedAt: new Date(ts - i * 60000),
        },
      });
    }
  }, 60000);

  afterAll(async () => {
    const groomIds = [gpGroom1?.id, gpGroom2?.id, gpGroom3?.id, gpGroom4?.id].filter(Boolean);
    await prisma.groomPerformanceRecord.deleteMany({ where: { groomId: { in: groomIds } } }).catch(() => {});
    await prisma.groomMetrics.deleteMany({ where: { groomId: { in: groomIds } } }).catch(() => {});
    await prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GPS-Groom' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: gpUser.id } }).catch(() => {});
  }, 30000);

  it('groom1 (EXCELLENT metrics, no records): EXCELLENT tier, hasReliableReputation=true, insufficient_data trend', async () => {
    const summary = await getGroomPerformanceSummary(gpGroom1.id);
    expect(summary.groom.id).toBe(gpGroom1.id);
    expect(summary.reputationTier.tier).toBe('EXCELLENT');
    expect(summary.hasReliableReputation).toBe(true);
    // No performance records → calculatePerformanceTrends gets [] → insufficient_data
    expect(summary.trends.trend).toBe('insufficient_data');
    expect(summary.trends.direction).toBe('stable');
  });

  it('groom2 (3 records, all bondGain=3): trend=calculated, direction=stable, olderBondGains empty', async () => {
    const summary = await getGroomPerformanceSummary(gpGroom2.id);
    // No GroomMetrics → metrics=null → getDefaultMetrics() called → reputationScore=50 → AVERAGE
    expect(summary.reputationTier.tier).toBe('AVERAGE');
    expect(summary.hasReliableReputation).toBe(false); // totalInteractions=0 < 10
    // 3 records < 5 → olderBondGains = slice(5,10) = [] → olderAvg = recentAvg → improvement=0 → stable
    expect(summary.trends.trend).toBe('calculated');
    expect(summary.trends.direction).toBe('stable');
  });

  it('groom3 (10 records, recent=high): trend=calculated, direction=improving', async () => {
    const summary = await getGroomPerformanceSummary(gpGroom3.id);
    // recent avg=5, older avg=0, improvement=5 > 0.5 → improving
    expect(summary.trends.trend).toBe('calculated');
    expect(summary.trends.direction).toBe('improving');
    expect(summary.trends.improvement).toBe(5);
  });

  it('groom4 (10 records, recent=low): trend=calculated, direction=declining', async () => {
    const summary = await getGroomPerformanceSummary(gpGroom4.id);
    // recent avg=0, older avg=5, improvement=-5 < -0.5 → declining
    expect(summary.trends.trend).toBe('calculated');
    expect(summary.trends.direction).toBe('declining');
    expect(summary.trends.improvement).toBe(-5);
  });

  it('getTopPerformingGrooms: groom1 maps to EXCELLENT tier (reputationScore=90)', async () => {
    const results = await getTopPerformingGrooms(gpUser.id);
    expect(results.length).toBeGreaterThan(0);
    const g1 = results.find(r => r.id === gpGroom1.id);
    expect(g1).toBeDefined();
    expect(g1.reputationScore).toBe(90);
    expect(g1.reputationTier.tier).toBe('EXCELLENT');
    expect(typeof g1.totalInteractions).toBe('number');
  });

  it('getTopPerformingGrooms: groom without GroomMetrics defaults to score=50 → AVERAGE tier', async () => {
    const results = await getTopPerformingGrooms(gpUser.id);
    const g2 = results.find(r => r.id === gpGroom2.id);
    expect(g2).toBeDefined();
    // No GroomMetrics → groomMetrics?.reputationScore || 50 = 50 → AVERAGE
    expect(g2.reputationScore).toBe(50);
    expect(g2.reputationTier.tier).toBe('AVERAGE');
  });

  it('PERFORMANCE_CONFIG constants are correctly structured', () => {
    expect(PERFORMANCE_CONFIG.MIN_INTERACTIONS_FOR_REPUTATION).toBe(10);
    expect(PERFORMANCE_CONFIG.REPUTATION_RANGES.EXCELLENT.min).toBe(81);
    expect(PERFORMANCE_CONFIG.REPUTATION_RANGES.TERRIBLE.max).toBe(20);
    expect(typeof PERFORMANCE_CONFIG.METRIC_WEIGHTS.bondingEffectiveness).toBe('number');
  });
});
