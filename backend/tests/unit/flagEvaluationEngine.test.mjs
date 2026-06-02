/**
 * Flag Evaluation Engine Tests
 *
 * Tests the real flag evaluation engine and carePatternAnalysis end-to-end
 * against the real DB. No mocks of any kind.
 *
 * Fixtures:
 *   - One shared Groom (TestFixture-FlagEngine-Groom)
 *   - One User (test-user-flag-engine)
 *   - Horses created per-test (TestFixture-FlagEngine-*)
 *   - GroomInteractions created per-test with explicit createdAt values
 *
 * Cleanup: horse.delete cascades to groomInteractions (foalId FK).
 * Groom is deleted in afterAll. GroomInteractions are gone before groom cleanup.
 *
 * Flag trigger conditions (derived from carePatternAnalysis + flagEvaluationEngine):
 *   brave     — noveltyWithSupport >= 3  AND bondScore >= 30  AND calmGroomPresent
 *   confident — consecutiveDays >= 7    AND bondScore >= 40
 *               AND positiveInteractions >= 10 AND bondScore >= 40
 *   fearful   — fearEvents >= 2         AND bondScore <= 20  AND noveltyWithSupport === 0
 *   insecure  — (daysWithoutCare >= 4 AND bondScore <= 25) OR poorQualityInteractions >= 3
 */

import { describe, test, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import prisma from '../../../packages/database/prismaClient.mjs';
import { evaluateHorseFlags, batchEvaluateFlags, getEligibleHorses } from '../../utils/flagEvaluationEngine.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped per-test cleanup. Replaces the prior
// `rmHorse(...)`-in-finally that used a silent no-op catch arm — a swallowed
// horse delete would leak a fixture into the canonical DB (CLAUDE.md §2).
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';

const PREFIX = 'TestFixture-FlagEngine-';
const USER_ID = 'test-user-flag-engine';

let groomId;
// Per-test horse cleanup queue; drained (fail-loud) in afterEach.
const cleanup = createCleanupTracker();

// ─── date helpers ─────────────────────────────────────────────────────────────

const daysAgo = n => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const yearsAgo = n => new Date(Date.now() - n * 365.25 * 24 * 60 * 60 * 1000);

// Equoria-wpqr/z183: epigenetic flag evaluation gates on canonical
// GAME-years (1 game-week = 1 game-year, floor(ageDays / 7)). A horse is
// eligible only while < 3 game-years old, i.e. born < 21 real days ago.
// The previous default fixture (monthsAgo(12) ≈ 360 real days = 51
// game-years) was only "eligible" because of the now-fixed calendar-year
// bug. Use a deliberately game-young DOB (14 real days → 2 game-years →
// eligible) so flag-trigger assertions exercise the real eligible path.
// Interaction fixtures reach back to daysAgo(6), still after a 14-day birth.
const ELIGIBLE_DOB = () => daysAgo(14);

// ─── fixtures ─────────────────────────────────────────────────────────────────

async function mkHorse(suffix, opts = {}) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}${suffix}`,
      sex: 'Colt',
      dateOfBirth: opts.dateOfBirth ?? ELIGIBLE_DOB(),
      age: opts.age ?? 1,
      userId: USER_ID,
      bondScore: opts.bondScore ?? 50,
      stressLevel: opts.stressLevel ?? 20,
      epigeneticFlags: opts.epigeneticFlags ?? [],
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

// ─── interaction sets ─────────────────────────────────────────────────────────

async function addBraveAndConfidentInteractions(foalId) {
  // 3 desensitization + 7 daily_care across 7 days → triggers brave + confident + affectionate
  await mkInteraction(foalId, {
    interactionType: 'desensitization',
    bondingChange: 3,
    quality: 'good',
    createdAt: daysAgo(6),
  });
  await mkInteraction(foalId, {
    interactionType: 'desensitization',
    bondingChange: 3,
    quality: 'good',
    createdAt: daysAgo(5),
  });
  await mkInteraction(foalId, {
    interactionType: 'desensitization',
    bondingChange: 3,
    quality: 'good',
    createdAt: daysAgo(4),
  });
  await mkInteraction(foalId, {
    interactionType: 'daily_care',
    bondingChange: 3,
    quality: 'good',
    createdAt: daysAgo(6),
  });
  await mkInteraction(foalId, {
    interactionType: 'daily_care',
    bondingChange: 3,
    quality: 'good',
    createdAt: daysAgo(5),
  });
  await mkInteraction(foalId, {
    interactionType: 'daily_care',
    bondingChange: 3,
    quality: 'good',
    createdAt: daysAgo(4),
  });
  await mkInteraction(foalId, {
    interactionType: 'daily_care',
    bondingChange: 3,
    quality: 'good',
    createdAt: daysAgo(3),
  });
  await mkInteraction(foalId, {
    interactionType: 'daily_care',
    bondingChange: 3,
    quality: 'good',
    createdAt: daysAgo(2),
  });
  await mkInteraction(foalId, {
    interactionType: 'daily_care',
    bondingChange: 3,
    quality: 'good',
    createdAt: daysAgo(1),
  });
  await mkInteraction(foalId, {
    interactionType: 'daily_care',
    bondingChange: 3,
    quality: 'good',
    createdAt: daysAgo(0),
  });
}

async function addBraveOnlyInteractions(foalId) {
  // 3 desensitization across 3 days — brave only (not enough for confident)
  await mkInteraction(foalId, {
    interactionType: 'desensitization',
    bondingChange: 3,
    quality: 'good',
    createdAt: daysAgo(2),
  });
  await mkInteraction(foalId, {
    interactionType: 'desensitization',
    bondingChange: 3,
    quality: 'good',
    createdAt: daysAgo(1),
  });
  await mkInteraction(foalId, {
    interactionType: 'desensitization',
    bondingChange: 3,
    quality: 'good',
    createdAt: daysAgo(0),
  });
}

async function addFearfulInteractions(foalId) {
  // 3 interactions with bondingChange < -3, quality 'good' — triggers fearful
  await mkInteraction(foalId, {
    interactionType: 'daily_care',
    bondingChange: -5,
    quality: 'good',
    stressChange: 0,
    createdAt: daysAgo(2),
  });
  await mkInteraction(foalId, {
    interactionType: 'daily_care',
    bondingChange: -5,
    quality: 'good',
    stressChange: 0,
    createdAt: daysAgo(1),
  });
  await mkInteraction(foalId, {
    interactionType: 'daily_care',
    bondingChange: -5,
    quality: 'good',
    stressChange: 0,
    createdAt: daysAgo(0),
  });
}

async function addInsecureInteractions(foalId) {
  // 3 poor-quality interactions — triggers insecure via poorQualityInteractions >= 3
  await mkInteraction(foalId, {
    interactionType: 'daily_care',
    bondingChange: -1,
    quality: 'poor',
    createdAt: daysAgo(2),
  });
  await mkInteraction(foalId, {
    interactionType: 'daily_care',
    bondingChange: -1,
    quality: 'poor',
    createdAt: daysAgo(1),
  });
  await mkInteraction(foalId, {
    interactionType: 'daily_care',
    bondingChange: -1,
    quality: 'poor',
    createdAt: daysAgo(0),
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
      username: 'flagEngineUser',
      email: 'flagengine@example.com',
      password: 'TestPassword123!',
      firstName: 'Flag',
      lastName: 'Engine',
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

// ─── evaluateHorseFlags ───────────────────────────────────────────────────────

describe('evaluateHorseFlags', () => {
  test('assigns brave and confident flags to eligible horse with qualifying care patterns', async () => {
    const horse = await mkHorse('BraveConfident', { bondScore: 60 });
    await addBraveAndConfidentInteractions(horse.id);

    const result = await evaluateHorseFlags(horse.id);

    expect(result.success).toBe(true);
    expect(result.horseId).toBe(horse.id);
    expect(result.horseName).toBe(horse.name);
    expect(result.newFlags).toContain('brave');
    expect(result.newFlags).toContain('confident');
    expect(result.newFlags.length).toBeGreaterThan(0);

    // Verify the DB was actually updated
    const updated = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { epigeneticFlags: true },
    });
    expect(updated.epigeneticFlags).toEqual(expect.arrayContaining(['brave', 'confident']));
  });

  test('rejects horse outside the 0-3 year evaluation age range', async () => {
    const horse = await mkHorse('TooOld', { dateOfBirth: yearsAgo(4), age: 4 });
    const result = await evaluateHorseFlags(horse.id);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('outside evaluation range');
    expect(result.newFlags).toHaveLength(0);
  });

  // Equoria-wpqr SENTINEL-POSITIVE (OPTIMAL_FIX_DISCIPLINE §2):
  // A 35-real-day-old horse is canonically floor(35 / 7) = 5 game-years
  // old, outside FLAG_EVALUATION_AGE_RANGE (MAX = 3 game-years) → must be
  // rejected. The pre-fix calendar math computed
  // ageInYears = 35 / 365.25 ≈ 0.096 → inside the 0..3 range → it WRONGLY
  // returned success/eligible. Fails on old calendar math, passes on the
  // game-years fix.
  test('SENTINEL: 35-day-old horse is 5 game-years and rejected (old calendar math gave 0.10 yr → wrongly eligible)', async () => {
    const horse = await mkHorse('WpqrSentinel', { dateOfBirth: daysAgo(35), age: 5 });
    const result = await evaluateHorseFlags(horse.id);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('outside evaluation range');
    // Reason reports canonical game-years (5), not calendar 0.10.
    expect(result.reason).toContain('5');
    expect(result.newFlags).toHaveLength(0);
  });

  test('rejects horse that already has the maximum number of flags (5)', async () => {
    const horse = await mkHorse('MaxFlags', {
      epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient', 'fearful'],
    });
    const result = await evaluateHorseFlags(horse.id);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('maximum number of flags');
    expect(result.currentFlags).toHaveLength(5);
    expect(result.newFlags).toHaveLength(0);
  });

  test('does not assign duplicate flags already present on the horse', async () => {
    const horse = await mkHorse('NoDupes', { epigeneticFlags: ['brave', 'confident'], bondScore: 50 });
    // No interactions → no new flags should trigger
    const result = await evaluateHorseFlags(horse.id);

    expect(result.success).toBe(true);
    expect(result.currentFlags).toContain('brave');
    expect(result.currentFlags).toContain('confident');
    expect(result.newFlags).not.toContain('brave');
    expect(result.newFlags).not.toContain('confident');
  });

  test('respects the 5-flag cap: assigns only 1 flag to a horse at 4 existing flags', async () => {
    const horse = await mkHorse('FlagLimit', {
      epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient'],
      bondScore: 15,
    });
    await addInsecureInteractions(horse.id);

    const result = await evaluateHorseFlags(horse.id);

    expect(result.success).toBe(true);
    expect(result.totalFlags).toBe(5);
    expect(result.newFlags).toHaveLength(1);
  });

  test('returns success with no new flags when horse has no care interactions', async () => {
    const horse = await mkHorse('NoInteractions', { bondScore: 50 });
    const result = await evaluateHorseFlags(horse.id);

    expect(result.success).toBe(true);
    expect(result.newFlags).toHaveLength(0);
  });

  test('throws when horse ID does not exist', async () => {
    await expect(evaluateHorseFlags(999999999)).rejects.toThrow('Horse with ID 999999999 not found');
  });
});

// ─── flag trigger conditions ──────────────────────────────────────────────────

describe('flag trigger conditions', () => {
  test('triggers brave flag: 3 supported novelty interactions and bondScore >= 30', async () => {
    const horse = await mkHorse('BraveOnly', { bondScore: 35 });
    await addBraveOnlyInteractions(horse.id);

    const result = await evaluateHorseFlags(horse.id);

    expect(result.success).toBe(true);
    expect(result.newFlags).toContain('brave');
  });

  test('triggers fearful flag: 3 fear events, bondScore <= 20, no novelty support', async () => {
    const horse = await mkHorse('FearfulFlag', { bondScore: 15, stressLevel: 60 });
    await addFearfulInteractions(horse.id);

    const result = await evaluateHorseFlags(horse.id);

    expect(result.success).toBe(true);
    expect(result.newFlags).toContain('fearful');
  });
});

// ─── batchEvaluateFlags ───────────────────────────────────────────────────────

describe('batchEvaluateFlags', () => {
  test('evaluates multiple horses and returns one result per horse', async () => {
    const h1 = await mkHorse('Batch1');
    const h2 = await mkHorse('Batch2');
    const h3 = await mkHorse('Batch3');
    const results = await batchEvaluateFlags([h1.id, h2.id, h3.id]);

    expect(results).toHaveLength(3);
    expect(results.every(r => r.success === true)).toBe(true);
  });

  test('handles mixed success/failure: existing horse succeeds, non-existent horse fails', async () => {
    const horse = await mkHorse('BatchMixed');
    const results = await batchEvaluateFlags([horse.id, 999999999]);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toContain('Horse with ID 999999999 not found');
  });
});

// ─── getEligibleHorses ────────────────────────────────────────────────────────

describe('getEligibleHorses', () => {
  test('includes horses in the 0-3 year age range with fewer than 5 flags', async () => {
    const eligible = await mkHorse('Eligible', { bondScore: 50, epigeneticFlags: [] });
    const tooOld = await mkHorse('EligOld', { dateOfBirth: yearsAgo(4), age: 4, epigeneticFlags: [] });
    const atMax = await mkHorse('EligMax', {
      epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient', 'fearful'],
    });
    const ids = await getEligibleHorses();

    expect(ids).toContain(eligible.id); // 1-year-old, 0 flags → eligible
    expect(ids).not.toContain(tooOld.id); // 4-year-old → outside age range
    expect(ids).not.toContain(atMax.id); // 5 flags → filtered out
  });

  // Equoria-wpqr SENTINEL-POSITIVE for the getEligibleHorses birthdate
  // window (flagEvaluationEngine.mjs :337/:340). The window must be derived
  // from game-years: MAX = 3 game-years = 21 real days, so a horse born 35
  // real days ago (5 game-years) is OUT of window. The pre-fix code built
  // the window with `* 365.25 * 24h` (calendar years): minBirthDate would
  // be ~3 calendar years ago, so a 35-day-old horse fell INSIDE the window
  // and was wrongly returned as eligible. Fails on old math, passes on fix.
  test('SENTINEL: 35-day-old horse (5 game-years) excluded from getEligibleHorses (old calendar window wrongly included it)', async () => {
    const tooOldGameYears = await mkHorse('WpqrEligSentinel', {
      dateOfBirth: daysAgo(35),
      age: 5,
      epigeneticFlags: [],
    });
    const stillEligible = await mkHorse('WpqrEligOk', {
      dateOfBirth: daysAgo(14),
      age: 2,
      epigeneticFlags: [],
    });
    const ids = await getEligibleHorses();

    expect(ids).not.toContain(tooOldGameYears.id); // 5 game-years → out of window
    expect(ids).toContain(stillEligible.id); // 2 game-years → in window
  });
});
