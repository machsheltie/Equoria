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
  recordGroomPerformance,
  getGroomPerformanceSummary,
  getTopPerformingGrooms,
} from '../services/groomPerformanceService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup — a cleanup delete that fails must
// turn the suite red so the leaked fixture is fixed at the source, not hidden
// behind a silent no-op catch arm (which leaks rows into the canonical DB).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

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
  // Equoria-1ohys: fail-loud scoped cleanup for this describe's fixtures.
  const gpCleanup = createCleanupTracker();

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

    // Register scoped, FK-ordered cleanup: groom* children (performance records +
    // metrics, scoped to these groom ids) first, then the grooms (Groom.userId
    // Restrict, scoped by the TestFixture-GPS-Groom name prefix), then the owning
    // user last.
    const groomIds = [gpGroom1?.id, gpGroom2?.id, gpGroom3?.id, gpGroom4?.id].filter(Boolean);
    gpCleanup.add(
      () => prisma.groomPerformanceRecord.deleteMany({ where: { groomId: { in: groomIds } } }),
      'gps performance records',
    );
    gpCleanup.add(() => prisma.groomMetrics.deleteMany({ where: { groomId: { in: groomIds } } }), 'gps metrics');
    gpCleanup.add(
      () => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GPS-Groom' } } }),
      'gps grooms',
    );
    gpCleanup.add(() => prisma.user.delete({ where: { id: gpUser.id } }), 'gps user');
  }, 60000);

  afterAll(() => gpCleanup.run(), 30000);

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

// ── recordGroomPerformance branch coverage (Equoria-rr7) ─────────────────────
// Covers lines 52-90 (recordGroomPerformance body), 96-130 (updateGroomMetrics),
// 137-187 (calculatePerformanceMetrics), 194-201 (calculateVariance).
// Branch at line 162: ratingsRecords.length > 0 (TRUE with playerRating, FALSE without).

describe('groomPerformanceService — recordGroomPerformance branch coverage (Equoria-rr7)', () => {
  let rgrUser;
  let rgrGroom;
  let rgrHorse;
  // Equoria-1ohys: fail-loud scoped cleanup for this describe's fixtures.
  const rgrCleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    rgrUser = await prisma.user.create({
      data: {
        email: `rgr-${ts}-${rand()}@test.com`,
        username: `rgr${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'RGR',
        lastName: 'Tester',
        money: 1000,
      },
    });

    rgrGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-RGR-Groom-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        userId: rgrUser.id,
      },
    });

    rgrHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-RGR-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: rgrUser.id,
      },
    });

    // Register scoped, FK-ordered cleanup: groom* children (performance records +
    // metrics) first, then groom + horse (Restrict on Groom.userId/Horse.userId,
    // scoped by the TestFixture-RGR- name prefix), then the owning user last.
    if (rgrGroom?.id) {
      rgrCleanup.add(
        () => prisma.groomPerformanceRecord.deleteMany({ where: { groomId: rgrGroom.id } }),
        'rgr performance records',
      );
      rgrCleanup.add(() => prisma.groomMetrics.deleteMany({ where: { groomId: rgrGroom.id } }), 'rgr metrics');
    }
    rgrCleanup.add(
      () => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-RGR-' } } }),
      'rgr grooms',
    );
    rgrCleanup.add(
      () => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-RGR-' } } }),
      'rgr horses',
    );
    rgrCleanup.add(() => prisma.user.delete({ where: { id: rgrUser?.id } }), 'rgr user');
  }, 60000);

  afterAll(() => rgrCleanup.run(), 30000);

  it('recordGroomPerformance: no playerRating → creates record, triggers metrics update (lines 52-201, line 162 FALSE)', async () => {
    const record = await recordGroomPerformance(rgrGroom.id, rgrUser.id, 'grooming', {
      horseId: rgrHorse.id,
      bondGain: 3,
      taskSuccess: true,
      wellbeingImpact: 1,
      duration: 30,
    });
    expect(record.id).toBeDefined();
    expect(record.groomId).toBe(rgrGroom.id);
    expect(record.interactionType).toBe('grooming');
    expect(record.bondGain).toBe(3);
    expect(record.playerRating).toBeNull();

    // Verify updateGroomMetrics ran — GroomMetrics record created
    const metrics = await prisma.groomMetrics.findUnique({ where: { groomId: rgrGroom.id } });
    expect(metrics).not.toBeNull();
    expect(metrics.totalInteractions).toBe(1);
    // null playerRating → ratingsRecords.length=0 → playerSatisfaction default=75
    expect(metrics.playerSatisfaction).toBe(75);
  });

  it('recordGroomPerformance: with playerRating=4 → line 162 TRUE (ratingsRecords.length > 0)', async () => {
    const record = await recordGroomPerformance(rgrGroom.id, rgrUser.id, 'grooming', {
      horseId: rgrHorse.id,
      bondGain: 5,
      taskSuccess: true,
      wellbeingImpact: 2,
      duration: 45,
      playerRating: 4,
    });
    expect(record.playerRating).toBe(4);

    // updateGroomMetrics runs again — now 2 records, one with rating
    const metrics = await prisma.groomMetrics.findUnique({ where: { groomId: rgrGroom.id } });
    expect(metrics.totalInteractions).toBe(2);
    // ratingsRecords has 1 entry with playerRating=4 → playerSatisfaction = (4/1)*20 = 80
    expect(metrics.playerSatisfaction).toBe(80);
  });
});
