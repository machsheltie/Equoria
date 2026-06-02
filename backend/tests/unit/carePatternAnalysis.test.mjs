/**
 * Care Pattern Analysis Tests
 *
 * Tests the real analyzeCarePatterns function end-to-end against the real DB.
 * No mocks of any kind.
 *
 * Fixtures:
 *   - One shared Groom (TestFixture-CarePattern-Groom)
 *   - Horses created per-test (TestFixture-CarePattern-*)
 *   - GroomInteractions created per-test with explicit createdAt values
 *
 * Cleanup: horse.delete cascades to groomInteractions (foalId FK).
 */

import { describe, test, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import prisma from '../../../packages/database/prismaClient.mjs';
import { analyzeCarePatterns } from '../../utils/carePatternAnalysis.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped per-test cleanup. Replaces the prior
// `rmHorse(...)`-in-finally that used a silent no-op catch arm — a swallowed
// horse delete would leak a fixture into the canonical DB (CLAUDE.md §2).
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';

const PREFIX = 'TestFixture-CarePattern-';
const USER_ID = 'test-user-care-pattern';

let groomId;
// Per-test horse cleanup queue; drained (fail-loud) in afterEach.
const cleanup = createCleanupTracker();

// ─── date helpers ─────────────────────────────────────────────────────────────

const daysAgo = n => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const hoursAgo = n => new Date(Date.now() - n * 60 * 60 * 1000);
const yearsAgo = n => new Date(Date.now() - n * 365.25 * 24 * 60 * 60 * 1000);

// Equoria-z183: epigenetic eligibility is gated on canonical GAME-years
// (1 game-week = 1 game-year, floor(ageDays / 7)), not calendar years. A
// horse is eligible only while < 3 game-years old, i.e. born < 21 real
// days ago. Before the fix, carePatternAnalysis divided by 365.25
// (calendar years) so even a 150-real-day-old horse (5-months default
// fixture = 21 game-years) wrongly read ageInYears ≈ 0.41 < 3 and passed
// the gate. Use a deliberately game-young default DOB (14 real days →
// floor(14/7) = 2 game-years → eligible) so pattern fixtures exercise the
// real eligible path. Interaction fixtures reach back to daysAgo(11)
// inside windows scoped by an explicit evaluationDate, which remain valid.
const ELIGIBLE_DOB = () => daysAgo(14);

// ─── fixtures ─────────────────────────────────────────────────────────────────

async function mkHorse(suffix, opts = {}) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}${suffix}`,
      sex: 'Colt',
      dateOfBirth: opts.dateOfBirth ?? ELIGIBLE_DOB(),
      bondScore: opts.bondScore ?? 50,
      stressLevel: opts.stressLevel ?? 20,
    },
  });
  // Equoria-1ohys: register a scoped, fail-loud cleanup (drained in afterEach).
  // horse.delete cascades to groomInteractions (foalId FK onDelete: Cascade).
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), `horse#${horse.id}`);
  return horse;
}

async function mkInteraction(foalId, opts = {}) {
  return prisma.groomInteraction.create({
    data: {
      foalId,
      groomId,
      interactionType: opts.interactionType ?? 'daily_care',
      duration: 30,
      bondingChange: opts.bondingChange ?? 3,
      stressChange: opts.stressChange ?? 0,
      quality: opts.quality ?? 'good',
      notes: opts.notes ?? null,
      createdAt: opts.createdAt ?? new Date(),
    },
  });
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.groom.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });

  await prisma.user.create({
    data: {
      id: USER_ID,
      username: 'carePatternUser',
      email: 'carepattern@example.com',
      password: 'TestPassword123!',
      firstName: 'Care',
      lastName: 'Pattern',
      money: 5000,
    },
  });

  const groom = await prisma.groom.create({
    data: {
      name: `${PREFIX}Groom`,
      speciality: 'foalCare',
      personality: 'calm',
    },
  });
  groomId = groom.id;
});

// Equoria-1ohys: drain the per-test horse-delete queue fail-loud after every
// test. A failed scoped delete now fails the test instead of being swallowed.
afterEach(() => cleanup.run());

afterAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.groom.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
});

// ─── analyzeCarePatterns ──────────────────────────────────────────────────────

describe('analyzeCarePatterns', () => {
  test('returns eligible result with all pattern categories for a young horse', async () => {
    const horse = await mkHorse('Eligible', { bondScore: 50, stressLevel: 20 });
    const result = await analyzeCarePatterns(horse.id, new Date());

    expect(result.eligible).toBe(true);
    expect(result.horseId).toBe(horse.id);
    expect(result.patterns).toHaveProperty('consistentCare');
    expect(result.patterns).toHaveProperty('noveltyExposure');
    expect(result.patterns).toHaveProperty('stressManagement');
    expect(result.patterns).toHaveProperty('bondingPatterns');
    expect(result.patterns).toHaveProperty('neglectPatterns');
    expect(result.patterns).toHaveProperty('environmentalFactors');
  });

  test('returns ineligible for horse older than 3 years', async () => {
    const horse = await mkHorse('TooOld', { dateOfBirth: yearsAgo(4) });
    const result = await analyzeCarePatterns(horse.id, new Date());

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('too old');
  });

  // Equoria-z183 SENTINEL-POSITIVE (OPTIMAL_FIX_DISCIPLINE §2):
  // A 35-real-day-old horse is canonically floor(35 / 7) = 5 game-years
  // old, which is >= the age-3 epigenetic boundary so it must be
  // INELIGIBLE. The pre-fix calendar-year math computed
  // ageInYears = 35 / 365.25 ≈ 0.096 → < 3 → it WRONGLY returned
  // eligible:true with ageInYears ≈ 0.10. This test fails on the old
  // calendar math (eligible would be true, ageInYears ≈ 0.10) and passes
  // on the game-years fix (eligible:false, ageInYears === 5).
  test('SENTINEL: 35-day-old horse is 5 game-years and ineligible (old calendar math gave 0.10 yr → wrongly eligible)', async () => {
    const horse = await mkHorse('Z183Sentinel', { dateOfBirth: daysAgo(35) });
    const result = await analyzeCarePatterns(horse.id, new Date());

    expect(result.eligible).toBe(false);
    // Canonical: floor(35 / 7) = 5 game-years (NOT 0.10 calendar-years)
    expect(result.ageInYears).toBe(5);
    expect(result.ageInYears).toBeGreaterThanOrEqual(3); // new math → ineligible (right)
    expect(result.reason).toContain('too old');
  });

  // Equoria-z183: a horse young in GAME-years (born 14 real days ago →
  // floor(14 / 7) = 2 game-years) is still inside the developmental
  // window and remains eligible. Confirms the gate uses game-years.
  test('14-day-old horse is 2 game-years and eligible', async () => {
    const horse = await mkHorse('Z183Eligible', { dateOfBirth: daysAgo(14) });
    const result = await analyzeCarePatterns(horse.id, new Date());

    expect(result.eligible).toBe(true);
    expect(result.ageInYears).toBe(2);
  });

  test('throws for non-existent horse ID', async () => {
    await expect(analyzeCarePatterns(999999999)).rejects.toThrow('Horse with ID 999999999 not found');
  });
});

// ─── consistentCare pattern ───────────────────────────────────────────────────

describe('consistentCare pattern', () => {
  test('counts grooming, quality interactions and computes averageBondChange', async () => {
    const horse = await mkHorse('ConsistentCare', { bondScore: 60 });
    // 3 interactions on 3 different days: daily_care, grooming, daily_care
    await mkInteraction(horse.id, {
      interactionType: 'daily_care',
      bondingChange: 5,
      stressChange: -2,
      quality: 'good',
      createdAt: daysAgo(3),
    });
    await mkInteraction(horse.id, {
      interactionType: 'grooming',
      bondingChange: 7,
      stressChange: -3,
      quality: 'excellent',
      createdAt: daysAgo(2),
    });
    await mkInteraction(horse.id, {
      interactionType: 'daily_care',
      bondingChange: 4,
      stressChange: -1,
      quality: 'good',
      createdAt: daysAgo(1),
    });

    const result = await analyzeCarePatterns(horse.id, new Date());

    expect(result.patterns.consistentCare.totalInteractions).toBe(3);
    expect(result.patterns.consistentCare.groomingInteractions).toBe(3);
    expect(result.patterns.consistentCare.qualityInteractions).toBe(3);
    expect(result.patterns.consistentCare.averageBondChange).toBeCloseTo(5.33, 1);
  });
});

// ─── noveltyExposure pattern ──────────────────────────────────────────────────

describe('noveltyExposure pattern', () => {
  test('counts novelty events, noveltyWithSupport, and fearEvents', async () => {
    const horse = await mkHorse('NoveltyExposure', { bondScore: 40 });
    // 3 novelty interactions with support + 1 fear event
    await mkInteraction(horse.id, {
      interactionType: 'desensitization',
      bondingChange: 3,
      stressChange: 1,
      quality: 'good',
      createdAt: daysAgo(4),
    });
    await mkInteraction(horse.id, {
      interactionType: 'exploration',
      bondingChange: 5,
      stressChange: 0,
      quality: 'excellent',
      createdAt: daysAgo(3),
    });
    await mkInteraction(horse.id, {
      interactionType: 'showground_exposure',
      bondingChange: 2,
      stressChange: 2,
      quality: 'good',
      createdAt: daysAgo(2),
    });
    await mkInteraction(horse.id, {
      interactionType: 'daily_care',
      bondingChange: -5,
      stressChange: 8,
      quality: 'poor',
      createdAt: daysAgo(1),
    });

    const result = await analyzeCarePatterns(horse.id, new Date());

    expect(result.patterns.noveltyExposure.noveltyEvents).toBe(3);
    expect(result.patterns.noveltyExposure.noveltyWithSupport).toBe(3);
    expect(result.patterns.noveltyExposure.fearEvents).toBe(1);
    expect(result.patterns.noveltyExposure.calmGroomPresent).toBe(true);
    expect(result.patterns.noveltyExposure.meetsBraveThreshold).toBe(true);
  });
});

// ─── stressManagement pattern ─────────────────────────────────────────────────

describe('stressManagement pattern', () => {
  test('counts stress events and recovery-within-24h (stressWithSupport)', async () => {
    const horse = await mkHorse('StressManagement', { stressLevel: 30 });
    // Stress event + recovery pair (within 24h)
    await mkInteraction(horse.id, {
      interactionType: 'daily_care',
      quality: 'poor',
      bondingChange: -2,
      stressChange: 6,
      createdAt: hoursAgo(10),
    });
    await mkInteraction(horse.id, {
      interactionType: 'grooming',
      quality: 'good',
      bondingChange: 3,
      stressChange: -4,
      createdAt: hoursAgo(8),
    });
    // Second stress event + recovery pair (within 24h)
    await mkInteraction(horse.id, {
      interactionType: 'medical_check',
      quality: 'fair',
      bondingChange: 0,
      stressChange: 5,
      createdAt: hoursAgo(5),
    });
    await mkInteraction(horse.id, {
      interactionType: 'grooming',
      quality: 'excellent',
      bondingChange: 5,
      stressChange: -6,
      createdAt: hoursAgo(3),
    });

    const result = await analyzeCarePatterns(horse.id, new Date());

    expect(result.patterns.stressManagement.stressEvents).toBe(2);
    expect(result.patterns.stressManagement.recoveryEvents).toBe(2);
    expect(result.patterns.stressManagement.stressWithSupport).toBe(2);
    expect(result.patterns.stressManagement.meetsResilientThreshold).toBe(false); // Needs 3+
  });
});

// ─── bondingPatterns pattern ──────────────────────────────────────────────────

describe('bondingPatterns pattern', () => {
  test('counts positive interactions, high-quality interactions and averageBondChange', async () => {
    const horse = await mkHorse('BondingPatterns', { bondScore: 70 });
    // 3 interactions on 3 different days, all positive/high-quality
    await mkInteraction(horse.id, {
      interactionType: 'daily_care',
      quality: 'excellent',
      bondingChange: 8,
      stressChange: -2,
      createdAt: daysAgo(6),
    });
    await mkInteraction(horse.id, {
      interactionType: 'grooming',
      quality: 'good',
      bondingChange: 6,
      stressChange: -1,
      createdAt: daysAgo(5),
    });
    await mkInteraction(horse.id, {
      interactionType: 'feeding',
      quality: 'excellent',
      bondingChange: 7,
      stressChange: 0,
      createdAt: daysAgo(4),
    });

    // evaluationDate = daysAgo(3): window is daysAgo(10) to daysAgo(3); all 3 interactions within
    const result = await analyzeCarePatterns(horse.id, daysAgo(3));

    expect(result.patterns.bondingPatterns.positiveInteractions).toBe(3);
    expect(result.patterns.bondingPatterns.highQualityInteractions).toBe(3);
    expect(result.patterns.bondingPatterns.currentBondScore).toBe(70);
    expect(result.patterns.bondingPatterns.averageBondChange).toBeCloseTo(7, 0);
  });
});

// ─── neglectPatterns pattern ──────────────────────────────────────────────────

describe('neglectPatterns pattern', () => {
  test('computes maxConsecutiveDaysWithoutCare and meetsInsecureThreshold', async () => {
    const horse = await mkHorse('NeglectPatterns', { bondScore: 15 });
    // Two interactions with a 5-day gap between them → maxGap = 4 days
    await mkInteraction(horse.id, {
      interactionType: 'daily_care',
      quality: 'poor',
      bondingChange: -3,
      stressChange: 4,
      createdAt: daysAgo(11),
    });
    await mkInteraction(horse.id, {
      interactionType: 'grooming',
      quality: 'fair',
      bondingChange: -1,
      stressChange: 2,
      createdAt: daysAgo(6),
    });

    // evaluationDate = daysAgo(6): window is daysAgo(13) to daysAgo(6); both in window
    const result = await analyzeCarePatterns(horse.id, daysAgo(6));

    expect(result.patterns.neglectPatterns.poorQualityInteractions).toBe(2);
    expect(result.patterns.neglectPatterns.negativeInteractions).toBe(2);
    expect(result.patterns.neglectPatterns.currentBondScore).toBe(15);
    // Gap between daysAgo(11) and daysAgo(6) = 5 calendar days → dayGap = 5-1 = 4
    expect(result.patterns.neglectPatterns.maxConsecutiveDaysWithoutCare).toBe(4);
    expect(result.patterns.neglectPatterns.meetsInsecureThreshold).toBe(true);
  });
});

// ─── environmentalFactors pattern ────────────────────────────────────────────

describe('environmentalFactors pattern', () => {
  test('counts startleEvents and routineInteractions', async () => {
    const horse = await mkHorse('EnvFactors');
    // stressChange > 5 triggers startle detection
    await mkInteraction(horse.id, {
      interactionType: 'daily_care',
      quality: 'good',
      bondingChange: 2,
      stressChange: 7,
      notes: 'Horse startled by loud noise',
      createdAt: daysAgo(3),
    });
    await mkInteraction(horse.id, {
      interactionType: 'feeding',
      quality: 'good',
      bondingChange: 3,
      stressChange: 0,
      createdAt: daysAgo(2),
    });
    await mkInteraction(horse.id, {
      interactionType: 'daily_care',
      quality: 'good',
      bondingChange: 2,
      stressChange: 6,
      createdAt: daysAgo(1),
    });

    const result = await analyzeCarePatterns(horse.id, new Date());

    expect(result.patterns.environmentalFactors.startleEvents).toBe(2);
    expect(result.patterns.environmentalFactors.routineInteractions).toBe(3); // 2 daily_care + 1 feeding
    expect(result.patterns.environmentalFactors.meetsSkittishThreshold).toBe(true);
    expect(result.patterns.environmentalFactors.hasRoutine).toBe(false); // Needs 5+
  });
});

// ─── edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  test('returns all-zero pattern counts for horse with no interactions', async () => {
    const horse = await mkHorse('NoInteractions');
    const result = await analyzeCarePatterns(horse.id, new Date());

    expect(result.eligible).toBe(true);
    expect(result.patterns.consistentCare.totalInteractions).toBe(0);
    expect(result.patterns.noveltyExposure.noveltyEvents).toBe(0);
    expect(result.patterns.stressManagement.stressEvents).toBe(0);
    expect(result.patterns.bondingPatterns.positiveInteractions).toBe(0);
  });
});
