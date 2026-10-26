/**
 * horseTemperamentAnalysis service unit tests (Equoria-rr7 coverage sprint).
 *
 * Tests all 6 async exported functions with real DB fixtures.
 * Horse with no interactions exercises zero-data code paths.
 * classifyTemperamentFromFlags is pure (no DB) and tested independently.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  analyzeHorseTemperament,
  classifyTemperamentFromFlags,
  analyzeBehavioralTrends,
  analyzeBondingPreferences,
  detectTemperamentChanges,
} from '../services/horseTemperamentAnalysis.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: a CI-proven colorGenotype+phenotype, so no NULL-phenotype fixture leaks.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

let user;
let horse;
const topCleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `horsetemper-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `horsetemper${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'HorseTemper',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-HorseTempHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-n7qa3). Delete every horse owned by this
  // user (covers `horse` AND the per-test `flaggedHorse`, both userId-scoped)
  // BEFORE the user, since Horse.userId is onDelete:Restrict (schema:282).
  topCleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
  topCleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => topCleanup.run(), 30000);

// ── analyzeHorseTemperament ───────────────────────────────────────────────────

describe('analyzeHorseTemperament', () => {
  it('throws for non-existent horse', async () => {
    await expect(analyzeHorseTemperament(999999999)).rejects.toThrow();
  });

  it('returns analysis shape for horse with no interactions', async () => {
    const result = await analyzeHorseTemperament(horse.id);

    expect(result).toBeDefined();
    expect(result.horseId).toBe(horse.id);
    expect(result.horseName).toBe(horse.name);
    expect(typeof result.primaryTemperament).toBe('string');
    expect(typeof result.confidenceLevel).toBe('number');
    expect(typeof result.socialTendency).toBe('number');
    expect(typeof result.adaptability).toBe('number');
    expect(typeof result.dataSource).toBe('string');
    expect(typeof result.reliabilityScore).toBe('number');
    expect(typeof result.interactionCount).toBe('number');
    expect(typeof result.flagCount).toBe('number');
  });

  it('uses basic_stats data source for horse with no flags and no interactions', async () => {
    const result = await analyzeHorseTemperament(horse.id);
    expect(result.dataSource).toBe('basic_stats');
    expect(result.reliabilityScore).toBe(0.3);
    expect(result.interactionCount).toBe(0);
    expect(result.flagCount).toBe(0);
  });

  it('uses flags_and_stats data source for horse with epigenetic flags', async () => {
    const flaggedHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-HorseTempFlags-${Date.now()}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: user.id,
        epigeneticFlags: ['brave', 'confident'],
      },
    });

    // flaggedHorse is userId-scoped to `user`; the top-level fail-loud afterAll
    // sweeps all horses for this user (Equoria-n7qa3), so no per-test delete is
    // needed here. Routing a delete through finally would mask a test-body
    // assertion failure, so it is intentionally omitted.
    const result = await analyzeHorseTemperament(flaggedHorse.id);
    expect(result.dataSource).toBe('flags_and_stats');
    expect(result.flagCount).toBe(2);
    expect(result.reliabilityScore).toBeGreaterThan(0);
  });
});

// ── classifyTemperamentFromFlags ──────────────────────────────────────────────

describe('classifyTemperamentFromFlags', () => {
  it('returns undetermined for empty flag array', async () => {
    const result = await classifyTemperamentFromFlags([]);
    expect(result.primaryTemperament).toBe('undetermined');
    expect(result.confidence).toBe(0.2);
    expect(typeof result.reasoning).toBe('string');
    expect(Array.isArray(result.temperamentTraits)).toBe(true);
  });

  it('returns undetermined for null flags', async () => {
    const result = await classifyTemperamentFromFlags(null);
    expect(result.primaryTemperament).toBe('undetermined');
  });

  it('returns classification object with required fields for valid flags', async () => {
    const result = await classifyTemperamentFromFlags(['brave', 'confident']);
    expect(result).toBeDefined();
    expect(typeof result.primaryTemperament).toBe('string');
    expect(typeof result.confidence).toBe('number');
    expect(Array.isArray(result.temperamentTraits)).toBe(true);
  });

  it('returns complex temperament for conflicting flags', async () => {
    const result = await classifyTemperamentFromFlags(['brave', 'fearful']);
    expect(result.primaryTemperament).toBe('complex');
  });

  it('returns higher confidence for clear flag set', async () => {
    const empty = await classifyTemperamentFromFlags([]);
    const withFlags = await classifyTemperamentFromFlags(['brave', 'confident']);
    expect(withFlags.confidence).toBeGreaterThanOrEqual(empty.confidence);
  });
});

// ── analyzeBehavioralTrends ───────────────────────────────────────────────────

describe('analyzeBehavioralTrends', () => {
  it('returns insufficient_data for horse with no interactions', async () => {
    const result = await analyzeBehavioralTrends(horse.id);

    expect(result).toBeDefined();
    expect(result.bondingTrend).toBe('insufficient_data');
    expect(result.qualityTrend).toBe('insufficient_data');
    expect(result.overallDirection).toBe('unknown');
    expect(result.trendStrength).toBe(0);
    expect(result.dataPoints).toBe(0);
  });

  it('returns insufficient_data for unknown horseId', async () => {
    const result = await analyzeBehavioralTrends(999999999);
    expect(result.bondingTrend).toBe('insufficient_data');
    expect(result.dataPoints).toBe(0);
  });
});

// ── analyzeBondingPreferences ─────────────────────────────────────────────────

describe('analyzeBondingPreferences', () => {
  it('returns no-data defaults for horse with no interactions', async () => {
    const result = await analyzeBondingPreferences(horse.id);

    expect(result).toBeDefined();
    expect(Array.isArray(result.preferredGroomTypes)).toBe(true);
    expect(result.preferredGroomTypes).toHaveLength(0);
    expect(Array.isArray(result.preferredInteractionTypes)).toBe(true);
    expect(result.preferredInteractionTypes).toHaveLength(0);
    expect(result.bondingSpeed).toBe(0.5);
    expect(result.socialNature).toBe(0.5);
    expect(result.trustLevel).toBe(0.5);
    expect(result.dataAvailable).toBe(false);
  });

  it('returns without throwing for unknown horseId', async () => {
    const result = await analyzeBondingPreferences(999999999);
    expect(result).toBeDefined();
    expect(result.dataAvailable).toBe(false);
  });
});

// ── detectTemperamentChanges ──────────────────────────────────────────────────

describe('detectTemperamentChanges', () => {
  it('returns insufficient_data for horse with no interactions', async () => {
    const result = await detectTemperamentChanges(horse.id);

    expect(result).toBeDefined();
    expect(result.changeDetected).toBe(false);
    expect(result.changeDirection).toBe('insufficient_data');
    expect(result.changeStrength).toBe(0);
    expect(result.timeframe).toBe('unknown');
    expect(Array.isArray(result.contributingFactors)).toBe(true);
    expect(result.dataPoints).toBe(0);
  });

  it('returns insufficient_data for unknown horseId', async () => {
    const result = await detectTemperamentChanges(999999999);
    expect(result.changeDetected).toBe(false);
    expect(result.changeDirection).toBe('insufficient_data');
  });
});

// ── classifyTemperamentFromFlags — high-confidence path (bestScore >= 0.6) ──────

describe('classifyTemperamentFromFlags() — high-confidence path (Equoria-jkht)', () => {
  it('returns confidence=0.8 for a strongly-matched flag set (calm temperament: 3/3 traits)', async () => {
    // 'calm' temperament has traits: ['calm','patient','stable']; 3/3 match → score=1.0 >= 0.6
    const result = await classifyTemperamentFromFlags(['calm', 'patient', 'stable']);
    expect(result.primaryTemperament).toBe('calm');
    expect(result.confidence).toBe(0.8);
  });

  it('returns confidence=0.8 for a 2/3 match on the calm temperament', async () => {
    // 2/3 = 0.667 >= 0.6 → confidence=0.8
    const result = await classifyTemperamentFromFlags(['calm', 'patient']);
    expect(result.primaryTemperament).toBe('calm');
    expect(result.confidence).toBe(0.8);
  });
});

// ── interactions-based paths (lines 143-175, 287-554) ────────────────────────
// DB fixture: user + groom + horse (no flags) + 7 groomInteractions.
// 7 interactions covers: analyzeHorseTemperament interactions≥5 path,
// analyzeBehavioralTrends ≥3 path, detectTemperamentChanges ≥6 path.

describe('horseTemperamentAnalysis — interactions-based paths (Equoria-jkht)', () => {
  let interUser;
  let interGroom;
  let interHorse;
  const interCleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    interUser = await prisma.user.create({
      data: {
        email: `ht-inter-${ts}-${rand()}@test.com`,
        username: `htinter${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'HT',
        lastName: 'Inter',
        money: 1000,
      },
    });

    interGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-HT-Groom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: interUser.id,
        isActive: true,
      },
    });

    interHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-HT-InterHorse-${ts}`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(), -30),
        age: 30,
        userId: interUser.id,
        epigeneticFlags: [],
      },
    });

    // 7 interactions: bondingChange rising [0,1,1,2,3,4,5],
    // quality mix: first 4 'good', last 3 'excellent' (43% excellent > 30% threshold).
    // Spaced 1 min apart so createdAt ordering is deterministic for detectTemperamentChanges.
    const interactionData = [
      { bondingChange: 0, quality: 'good' },
      { bondingChange: 1, quality: 'good' },
      { bondingChange: 1, quality: 'good' },
      { bondingChange: 2, quality: 'good' },
      { bondingChange: 3, quality: 'excellent' },
      { bondingChange: 4, quality: 'excellent' },
      { bondingChange: 5, quality: 'excellent' },
    ];

    for (let i = 0; i < interactionData.length; i++) {
      const d = interactionData[i];
      await prisma.groomInteraction.create({
        data: {
          foalId: interHorse.id,
          groomId: interGroom.id,
          interactionType: 'grooming',
          duration: 30,
          bondingChange: d.bondingChange,
          quality: d.quality,
          timestamp: new Date(ts - (interactionData.length - i) * 60000),
          createdAt: new Date(ts - (interactionData.length - i) * 60000),
        },
      });
    }

    // Scoped, fail-loud cleanup (Equoria-n7qa3). FK order: groomInteractions
    // (foalId -> horse) first, then the horse, then groom, then user (the
    // horse and groom are userId-scoped to interUser; Horse.userId is
    // onDelete:Restrict, schema:282 — horse MUST precede user).
    interCleanup.add(() => prisma.groomInteraction.deleteMany({ where: { foalId: interHorse.id } }), 'interactions');
    interCleanup.add(() => prisma.horse.delete({ where: { id: interHorse.id } }), 'horse');
    interCleanup.add(() => prisma.groom.delete({ where: { id: interGroom.id } }), 'groom');
    interCleanup.add(() => prisma.user.delete({ where: { id: interUser.id } }), 'user');
  }, 60000);

  afterAll(() => interCleanup.run(), 30000);

  it('uses interactions dataSource when horse has ≥5 interactions (line 143)', async () => {
    const result = await analyzeHorseTemperament(interHorse.id);
    expect(result.dataSource).toBe('interactions');
    expect(result.interactionCount).toBeGreaterThanOrEqual(5);
    expect(result.reliabilityScore).toBeGreaterThan(0);
  });

  it('analyzeBehavioralTrends returns overallDirection=positive with rising bondingChange (lines 287-331)', async () => {
    const result = await analyzeBehavioralTrends(interHorse.id);
    expect(result.dataPoints).toBeGreaterThanOrEqual(3);
    expect(result.bondingTrend).toBe('improving');
    expect(result.overallDirection).toBe('positive');
    expect(typeof result.trendStrength).toBe('number');
  });

  it('analyzeBondingPreferences returns dataAvailable=true with interactions (line 428)', async () => {
    const result = await analyzeBondingPreferences(interHorse.id);
    expect(result.dataAvailable).toBe(true);
    expect(result.totalInteractions).toBeGreaterThanOrEqual(7);
    expect(typeof result.bondingSpeed).toBe('number');
    expect(typeof result.socialNature).toBe('number');
    expect(typeof result.trustLevel).toBe('number');
  });

  it('detectTemperamentChanges returns positive changeDirection with ≥6 interactions (lines 529-553)', async () => {
    const result = await detectTemperamentChanges(interHorse.id);
    expect(result.changeDetected).toBe(true);
    expect(result.changeDirection).toBe('positive');
    expect(result.dataPoints).toBeGreaterThanOrEqual(6);
    expect(Array.isArray(result.contributingFactors)).toBe(true);
    expect(result.contributingFactors).toContain('improved_bonding');
  });
});

// ── Remaining branch coverage (Equoria-rr7) ──────────────────────────────────
// Targets:
//   Lines 671, 673, 676-677: confident/nervous/calm in analyzeFromInteractions
//   Lines 678: outgoing condition evaluated (unreachable true, but line executed)
//   Lines 310-311, 313: negative/stable overallDirection in analyzeBehavioralTrends
//   Line 714: declining direction in calculateTrend
//   Lines 549-552: negative/neutral changeDirection

describe('horseTemperamentAnalysis — remaining branch coverage (Equoria-rr7)', () => {
  let rbrUser, rbrGroom;
  let confidentHorse, nervousHorse, negTrendHorse;
  let neutralChangeHorse, worseningHorse;
  const rbrCleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    rbrUser = await prisma.user.create({
      data: {
        email: `hta-rbr-${ts}-${rand()}@test.com`,
        username: `htarbr${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'HTA',
        lastName: 'RBR',
        money: 1000,
      },
    });

    rbrGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-HTA-RBR-Groom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: rbrUser.id,
        isActive: true,
      },
    });

    // ── Horse fixtures ─────────────────────────────────────────────────────────
    // confidentHorse: high bondingChange (+3) →
    //   analyzeFromInteractions: confidenceLevel=0.9>0.7 → 'confident'
    //   analyzeBehavioralTrends: all slopes=0 → 'stable' overallDirection
    confidentHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-HTA-RBR-Confident-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date('2019-01-01'),
        age: 30,
        userId: rbrUser.id,
        epigeneticFlags: [],
      },
    });
    for (let i = 0; i < 5; i++) {
      await prisma.groomInteraction.create({
        data: {
          foalId: confidentHorse.id,
          groomId: rbrGroom.id,
          interactionType: 'grooming',
          duration: 30,
          bondingChange: 3,
          quality: 'good',
        },
      });
    }

    // nervousHorse: negative bondingChange (-1) →
    //   confidenceLevel=0.25<0.4 → 'nervous'
    nervousHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-HTA-RBR-Nervous-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date('2019-01-01'),
        age: 30,
        userId: rbrUser.id,
        epigeneticFlags: [],
      },
    });
    for (let i = 0; i < 5; i++) {
      await prisma.groomInteraction.create({
        data: {
          foalId: nervousHorse.id,
          groomId: rbrGroom.id,
          interactionType: 'grooming',
          duration: 30,
          bondingChange: -1,
          quality: 'good',
        },
      });
    }

    // negTrendHorse: bondingChange decreasing [5,4,3,2,1,0,-1] →
    //   calculateTrend slope=-1 → 'declining' (line 714)
    //   avgTrendScore=-1/2=-0.5<-0.3 → 'negative' overallDirection (line 311)
    negTrendHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-HTA-RBR-NegTrend-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date('2019-01-01'),
        age: 30,
        userId: rbrUser.id,
        epigeneticFlags: [],
      },
    });
    for (let i = 0; i < 7; i++) {
      await prisma.groomInteraction.create({
        data: {
          foalId: negTrendHorse.id,
          groomId: rbrGroom.id,
          interactionType: 'grooming',
          duration: 30,
          bondingChange: 5 - i, // [5,4,3,2,1,0,-1]
          quality: 'good',
          createdAt: new Date(ts - (7 - i) * 60000),
        },
      });
    }

    // neutralChangeHorse: 6 identical interactions →
    //   earlyPeriod == recentPeriod → all changes=0 → 'neutral' changeDirection (line 552)
    neutralChangeHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-HTA-RBR-Neutral-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date('2019-01-01'),
        age: 30,
        userId: rbrUser.id,
        epigeneticFlags: [],
      },
    });
    for (let i = 0; i < 6; i++) {
      await prisma.groomInteraction.create({
        data: {
          foalId: neutralChangeHorse.id,
          groomId: rbrGroom.id,
          interactionType: 'grooming',
          duration: 30,
          bondingChange: 2,
          quality: 'good',
          createdAt: new Date(ts - (6 - i) * 60000),
        },
      });
    }

    // worseningHorse: early 3 excellent with bondingChange=5;
    //   recent 3 poor with bondingChange=1 →
    //   bondingChange metric=-4 (<-0.5) → 'declining_bonding'
    //   overallChange=(-4-3)/2=-3.5<-0.5 → 'negative' changeDirection (line 550)
    worseningHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-HTA-RBR-Worsening-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date('2019-01-01'),
        age: 30,
        userId: rbrUser.id,
        epigeneticFlags: [],
      },
    });
    for (let i = 0; i < 6; i++) {
      const isEarly = i < 3;
      await prisma.groomInteraction.create({
        data: {
          foalId: worseningHorse.id,
          groomId: rbrGroom.id,
          interactionType: 'grooming',
          duration: 30,
          bondingChange: isEarly ? 5 : 1,
          quality: isEarly ? 'excellent' : 'poor',
          createdAt: new Date(ts - (6 - i) * 60000),
        },
      });
    }

    // Scoped, fail-loud cleanup (Equoria-n7qa3). FK order: groomInteractions
    // (foalId -> horse) first, then the horses, then groom, then user. Horses
    // are deleted by their userId (covers every RBR fixture horse, all of which
    // are owned by rbrUser) BEFORE the user, since Horse.userId is
    // onDelete:Restrict (schema:282).
    rbrCleanup.add(
      () =>
        prisma.groomInteraction.deleteMany({
          where: {
            foalId: {
              in: [
                confidentHorse?.id,
                nervousHorse?.id,
                negTrendHorse?.id,
                neutralChangeHorse?.id,
                worseningHorse?.id,
              ].filter(Boolean),
            },
          },
        }),
      'interactions',
    );
    rbrCleanup.add(() => prisma.horse.deleteMany({ where: { userId: rbrUser.id } }), 'horses');
    rbrCleanup.add(() => prisma.groom.delete({ where: { id: rbrGroom.id } }), 'groom');
    rbrCleanup.add(() => prisma.user.delete({ where: { id: rbrUser.id } }), 'user');
  }, 180000);

  afterAll(() => rbrCleanup.run(), 60000);

  // ── analyzeFromInteractions branch paths ──────────────────────────────────────

  it('analyzeFromInteractions: confident temperament (line 671)', async () => {
    const result = await analyzeHorseTemperament(confidentHorse.id);
    expect(result.dataSource).toBe('interactions');
    expect(result.primaryTemperament).toBe('confident');
  });

  it('analyzeFromInteractions: nervous temperament (line 673)', async () => {
    const result = await analyzeHorseTemperament(nervousHorse.id);
    expect(result.dataSource).toBe('interactions');
    expect(result.primaryTemperament).toBe('nervous');
  });

  // ── analyzeBehavioralTrends remaining directions ──────────────────────────────

  it('analyzeBehavioralTrends: stable overallDirection with constant values (line 313)', async () => {
    const result = await analyzeBehavioralTrends(confidentHorse.id);
    expect(result.overallDirection).toBe('stable');
  });

  it('analyzeBehavioralTrends: negative overallDirection + declining bondingTrend (lines 311, 714)', async () => {
    const result = await analyzeBehavioralTrends(negTrendHorse.id);
    expect(result.overallDirection).toBe('negative');
    expect(result.bondingTrend).toBe('declining');
  });

  // ── detectTemperamentChanges remaining directions ─────────────────────────────

  it('detectTemperamentChanges: neutral direction with stable interactions (line 552)', async () => {
    const result = await detectTemperamentChanges(neutralChangeHorse.id);
    expect(result.changeDirection).toBe('neutral');
    expect(result.changeDetected).toBe(false);
  });

  it('detectTemperamentChanges: negative direction + declining_bonding (line 550)', async () => {
    const result = await detectTemperamentChanges(worseningHorse.id);
    expect(result.changeDirection).toBe('negative');
    expect(result.changeDetected).toBe(true);
    expect(result.contributingFactors).toContain('declining_bonding');
  });
});
