/**
 * carePatternAnalysis util unit tests (Equoria-rr7 coverage sprint).
 *
 * Tests the single exported async function analyzeCarePatterns with real DB
 * fixtures. Two code paths exercised:
 *   - newborn foal (age < 3 years) → eligible:true, patterns object
 *   - mature horse (age >= 3 years) → eligible:false, reason string
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import helpers, { analyzeCarePatterns } from '../../../utils/carePatternAnalysis.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { realDateOrReason } from '../../../__tests__/helpers/expectRealDate.mjs';

let user;
let foal;
let matureHorse;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  // Scoped, fail-loud cleanup (Equoria-n7qa3). FK order: both horses (owned by
  // `user`) BEFORE the user — Horse.userId is onDelete:Restrict (schema:282).
  // .deleteMany so an already-gone row is a no-op, not P2025; a real scope/FK
  // failure still reds afterAll.
  cleanup.add(
    () => prisma.horse.deleteMany({ where: { id: { in: [foal?.id, matureHorse?.id].filter(Boolean) } } }),
    'horses',
  );
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');

  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `careanalysis-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `careanalysis${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'CareAnalysis',
      lastName: 'Tester',
      money: 1000,
    },
  });

  foal = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-CareAnalysisFoal-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  matureHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-CareAnalysisMature-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: gameCalendarDate(new Date(), -Math.round(4 * 365.25)),
      age: 4,
      userId: user.id,
    },
  });
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ── analyzeCarePatterns ───────────────────────────────────────────────────────

describe('analyzeCarePatterns', () => {
  it('throws for non-existent horse', async () => {
    await expect(analyzeCarePatterns(999999999)).rejects.toThrow();
  });

  it('returns eligible:true for newborn foal', async () => {
    const result = await analyzeCarePatterns(foal.id);

    expect(result).toBeDefined();
    expect(result.eligible).toBe(true);
    expect(result.horseId).toBe(foal.id);
    expect(typeof result.ageInDays).toBe('number');
    expect(typeof result.ageInYears).toBe('number');
    expect(result.ageInYears).toBeLessThan(3);
    expect(typeof result.currentBondScore).toBe('number');
    expect(result.patterns).toBeDefined();
    expect(realDateOrReason(result.evaluationDate)).toBe('valid date');
  });

  it('returns patterns with expected keys for eligible foal', async () => {
    const result = await analyzeCarePatterns(foal.id);
    const { patterns } = result;

    expect(patterns.consistentCare).toBeDefined();
    expect(patterns.noveltyExposure).toBeDefined();
    expect(patterns.bondingPatterns).toBeDefined();
    expect(patterns.neglectPatterns).toBeDefined();
    expect(patterns.environmentalFactors).toBeDefined();
  });

  it('returns eligible:false for mature horse (>= 3 years)', async () => {
    const result = await analyzeCarePatterns(matureHorse.id);

    expect(result).toBeDefined();
    expect(result.eligible).toBe(false);
    expect(typeof result.reason).toBe('string');
    expect(result.reason).toMatch(/too old/i);
    expect(result.ageInYears).toBeGreaterThanOrEqual(3);
    expect(result.patterns).toBeDefined();
  });

  it('accepts a custom evaluation date', async () => {
    const customDate = new Date();
    const result = await analyzeCarePatterns(foal.id, customDate);
    expect(result.evaluationDate).toEqual(customDate);
  });

  it('consistentCare has totalInteractions of 0 for horse with no groom interactions', async () => {
    const result = await analyzeCarePatterns(foal.id);
    expect(result.patterns.consistentCare.totalInteractions).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Pure-helper && branch coverage (Equoria-jkht)
// Calls private helpers via the default export — no DB needed.
// Each &&-guarded threshold has its left-side-true branch covered here;
// the left-side-false branches are already covered by the zero-interaction
// foal tests above.
// ---------------------------------------------------------------------------

const {
  analyzeConsistentCare,
  analyzeNoveltyExposure,
  analyzeBondingPatterns,
  analyzeNeglectPatterns,
  analyzeEnvironmentalFactors,
} = helpers;

function mkInteraction(daysAgo = 0, overrides = {}) {
  return {
    interactionType: 'dailyCare',
    quality: 'good',
    bondingChange: 2,
    createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    notes: null,
    ...overrides,
  };
}

describe('analyzeConsistentCare — && branch coverage (Equoria-jkht)', () => {
  const sevenDayInteractions = [0, 1, 2, 3, 4, 5, 6].map(d => mkInteraction(d));

  it('meetsConsistentCareThreshold: true when consecutiveDays>=7 and bondScore>=40', () => {
    const r = analyzeConsistentCare(sevenDayInteractions, 50);
    expect(r.meetsConsistentCareThreshold).toBe(true);
    expect(r.consecutiveDaysWithCare).toBeGreaterThanOrEqual(7);
  });

  it('meetsConsistentCareThreshold: false when consecutiveDays>=7 but bondScore<40', () => {
    const r = analyzeConsistentCare(sevenDayInteractions, 30);
    expect(r.meetsConsistentCareThreshold).toBe(false);
  });
});

describe('analyzeNoveltyExposure — && branch coverage (Equoria-jkht)', () => {
  const noveltyInteractions = [1, 2, 3].map(d =>
    mkInteraction(d, { interactionType: 'desensitization', bondingChange: 3, quality: 'excellent' }),
  );

  it('meetsBraveThreshold: true when noveltyWithSupport>=3 and bondScore>=30', () => {
    const r = analyzeNoveltyExposure(noveltyInteractions, 35);
    expect(r.meetsBraveThreshold).toBe(true);
    expect(r.noveltyWithSupport).toBeGreaterThanOrEqual(3);
  });

  it('meetsBraveThreshold: false when noveltyWithSupport>=3 but bondScore<30', () => {
    const r = analyzeNoveltyExposure(noveltyInteractions, 20);
    expect(r.meetsBraveThreshold).toBe(false);
  });
});

describe('analyzeBondingPatterns — && branch coverage (Equoria-jkht)', () => {
  const sevenDayPositive = [0, 1, 2, 3, 4, 5, 6].map(d => mkInteraction(d, { bondingChange: 3 }));
  const tenPositive = Array.from({ length: 10 }, (_, i) => mkInteraction(i, { bondingChange: 3 }));

  it('meetsAffectionateThreshold: true when 7+ days with interaction and bondScore>=50', () => {
    const r = analyzeBondingPatterns(sevenDayPositive, 60);
    expect(r.meetsAffectionateThreshold).toBe(true);
    expect(r.daysWithInteraction).toBeGreaterThanOrEqual(7);
  });

  it('meetsAffectionateThreshold: false when 7+ days but bondScore<50', () => {
    const r = analyzeBondingPatterns(sevenDayPositive, 30);
    expect(r.meetsAffectionateThreshold).toBe(false);
  });

  it('meetsConfidentThreshold: true when positiveInteractions>=10 and bondScore>=40', () => {
    const r = analyzeBondingPatterns(tenPositive, 50);
    expect(r.meetsConfidentThreshold).toBe(true);
    expect(r.positiveInteractions).toBeGreaterThanOrEqual(10);
  });

  it('meetsConfidentThreshold: false when positiveInteractions>=10 but bondScore<40', () => {
    const r = analyzeBondingPatterns(tenPositive, 30);
    expect(r.meetsConfidentThreshold).toBe(false);
  });
});

describe('analyzeNeglectPatterns — && branch coverage (Equoria-jkht)', () => {
  const gapped = [mkInteraction(6), mkInteraction(1)]; // 4-day gap between them

  it('meetsInsecureThreshold: true when daysWithoutCare>=4 and bondScore<=25', () => {
    const r = analyzeNeglectPatterns(gapped, 20);
    expect(r.meetsInsecureThreshold).toBe(true);
    expect(r.maxConsecutiveDaysWithoutCare).toBeGreaterThanOrEqual(4);
  });

  it('meetsInsecureThreshold: false when daysWithoutCare>=4 but bondScore>25', () => {
    const r = analyzeNeglectPatterns(gapped, 40);
    expect(r.meetsInsecureThreshold).toBe(false);
  });

  it('meetsAloofThreshold: true when <3 interactions and bondScore<=30', () => {
    const sparse = [mkInteraction(0), mkInteraction(1)];
    const r = analyzeNeglectPatterns(sparse, 20);
    expect(r.meetsAloofThreshold).toBe(true);
  });

  it('meetsAloofThreshold: false when <3 interactions but bondScore>30', () => {
    const sparse = [mkInteraction(0), mkInteraction(1)];
    const r = analyzeNeglectPatterns(sparse, 40);
    expect(r.meetsAloofThreshold).toBe(false);
  });
});

describe('calculateConsecutiveDays via analyzeConsistentCare — streak-reset branch (Equoria-jkht)', () => {
  it('resets streak when gap > 2 days (covers else-branch at line 293)', () => {
    // Day 10 and day 0 — 10-day gap triggers currentStreak = 1 reset
    const withGap = [mkInteraction(10), mkInteraction(0)];
    const r = analyzeConsistentCare(withGap, 50);
    expect(r.consecutiveDaysWithCare).toBe(1);
    expect(r.meetsConsistentCareThreshold).toBe(false);
  });
});

describe('analyzeEnvironmentalFactors — filter-predicate branch coverage (Equoria-jkht)', () => {
  it('notes===null covers && left-false branch; a feeding interaction is routine', () => {
    const interactions = [
      mkInteraction(0, { notes: null, interactionType: 'exercise' }), // non-routine, no note → no startle
      mkInteraction(1, { interactionType: 'feeding' }), // feeding → || right-branch of routineInteractions filter
    ];
    const r = analyzeEnvironmentalFactors(interactions);
    expect(r.startleEvents).toBe(0);
    expect(r.routineInteractions).toBe(1);
  });

  it('meetsSkittishThreshold: true when 2+ startle events (notes)', () => {
    const interactions = [
      mkInteraction(0, { notes: 'horse startled at loud noise' }),
      mkInteraction(1, { notes: 'startled by a flapping tarp' }),
    ];
    const r = analyzeEnvironmentalFactors(interactions);
    expect(r.meetsSkittishThreshold).toBe(true);
    expect(r.startleEvents).toBe(2);
  });

  it('notes containing "startle" covers && right branch (notes truthy and includes startle)', () => {
    const interactions = [mkInteraction(0, { notes: 'horse startled at loud noise' })];
    const r = analyzeEnvironmentalFactors(interactions);
    expect(r.startleEvents).toBe(1);
  });

  it('hasRoutine: true when 5+ routine interactions (interactionType dailyCare)', () => {
    const interactions = [0, 1, 2, 3, 4].map(d => mkInteraction(d));
    const r = analyzeEnvironmentalFactors(interactions);
    expect(r.hasRoutine).toBe(true);
    expect(r.routineInteractions).toBe(5);
  });
});

describe('analyzeNoveltyExposure — || and && branch coverage (line 131, Equoria-jkht)', () => {
  it('exploration and showgroundExposure types count as novelty (covers || right branches)', () => {
    const exploration = mkInteraction(1, {
      interactionType: 'exploration',
      bondingChange: 2,
      quality: 'good',
    });
    const showground = mkInteraction(2, {
      interactionType: 'showgroundExposure',
      bondingChange: 2,
      quality: 'good',
    });
    const r = analyzeNoveltyExposure([exploration, showground], 35);
    expect(r.noveltyEvents).toBe(2);
  });

  it('bondingChange<0 excludes from noveltyWithSupport (covers && left-false branch)', () => {
    const negBond = mkInteraction(1, {
      interactionType: 'desensitization',
      bondingChange: -2,
      quality: 'poor',
    });
    const r = analyzeNoveltyExposure([negBond], 50);
    expect(r.noveltyWithSupport).toBe(0);
  });
});

describe('groupInteractionsByDay — same-day grouping branch (line 263, Equoria-jkht)', () => {
  it('two interactions on the same day group into one bucket (covers if(!groups[day]) false-branch)', () => {
    // Fixed instants at midday Eastern (game days are Eastern), so the test does not
    // depend on when it runs: "1 h ago" and "2 h ago" straddle Eastern midnight in the
    // evening window and landed in two buckets.
    const sameDay = [
      mkInteraction(0, { createdAt: new Date('2026-06-15T17:00:00Z') }), // 1 pm EDT
      mkInteraction(0, { createdAt: new Date('2026-06-15T16:00:00Z') }), // noon EDT, same game day
    ];
    const r = analyzeConsistentCare(sameDay, 50);
    expect(r.consecutiveDaysWithCare).toBe(1); // both in same day bucket → 1 unique day
    expect(r.totalInteractions).toBe(2);
  });
});

describe('calculateAverageBondChange — || falsy-bondingChange branch (line 330, Equoria-jkht)', () => {
  it('bondingChange===0 covers || right branch (0 is falsy)', () => {
    const zeroBond = [mkInteraction(0, { bondingChange: 0 })];
    const r = analyzeConsistentCare(zeroBond, 50);
    expect(r.averageBondChange).toBe(0);
  });

  it('bondingChange===null covers || right branch (null is falsy)', () => {
    const nullBond = [mkInteraction(0, { bondingChange: null })];
    const r = analyzeConsistentCare(nullBond, 50);
    expect(r.averageBondChange).toBe(0);
  });
});
