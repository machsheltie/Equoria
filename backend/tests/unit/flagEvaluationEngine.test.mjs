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

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../db/index.mjs';
import { evaluateHorseFlags, batchEvaluateFlags, getEligibleHorses } from '../../utils/flagEvaluationEngine.mjs';

const PREFIX = 'TestFixture-FlagEngine-';
const USER_ID = 'test-user-flag-engine';

let groomId;

// ─── date helpers ─────────────────────────────────────────────────────────────

const daysAgo = n => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const yearsAgo = n => new Date(Date.now() - n * 365.25 * 24 * 60 * 60 * 1000);
const monthsAgo = n => new Date(Date.now() - n * 30 * 24 * 60 * 60 * 1000);

// ─── fixtures ─────────────────────────────────────────────────────────────────

async function mkHorse(suffix, opts = {}) {
  return prisma.horse.create({
    data: {
      name: `${PREFIX}${suffix}`,
      sex: 'Colt',
      dateOfBirth: opts.dateOfBirth ?? monthsAgo(12),
      age: opts.age ?? 1,
      userId: USER_ID,
      bondScore: opts.bondScore ?? 50,
      stressLevel: opts.stressLevel ?? 20,
      epigeneticFlags: opts.epigeneticFlags ?? [],
    },
  });
}

async function rmHorse(id) {
  await prisma.horse.delete({ where: { id } }).catch(() => {});
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

afterAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.groom.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
});

// ─── evaluateHorseFlags ───────────────────────────────────────────────────────

describe('evaluateHorseFlags', () => {
  test('assigns brave and confident flags to eligible horse with qualifying care patterns', async () => {
    const horse = await mkHorse('BraveConfident', { bondScore: 60 });
    try {
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
    } finally {
      await rmHorse(horse.id);
    }
  });

  test('rejects horse outside the 0-3 year evaluation age range', async () => {
    const horse = await mkHorse('TooOld', { dateOfBirth: yearsAgo(4), age: 4 });
    try {
      const result = await evaluateHorseFlags(horse.id);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('outside evaluation range');
      expect(result.newFlags).toHaveLength(0);
    } finally {
      await rmHorse(horse.id);
    }
  });

  test('rejects horse that already has the maximum number of flags (5)', async () => {
    const horse = await mkHorse('MaxFlags', {
      epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient', 'fearful'],
    });
    try {
      const result = await evaluateHorseFlags(horse.id);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('maximum number of flags');
      expect(result.currentFlags).toHaveLength(5);
      expect(result.newFlags).toHaveLength(0);
    } finally {
      await rmHorse(horse.id);
    }
  });

  test('does not assign duplicate flags already present on the horse', async () => {
    const horse = await mkHorse('NoDupes', { epigeneticFlags: ['brave', 'confident'], bondScore: 50 });
    try {
      // No interactions → no new flags should trigger
      const result = await evaluateHorseFlags(horse.id);

      expect(result.success).toBe(true);
      expect(result.currentFlags).toContain('brave');
      expect(result.currentFlags).toContain('confident');
      expect(result.newFlags).not.toContain('brave');
      expect(result.newFlags).not.toContain('confident');
    } finally {
      await rmHorse(horse.id);
    }
  });

  test('respects the 5-flag cap: assigns only 1 flag to a horse at 4 existing flags', async () => {
    const horse = await mkHorse('FlagLimit', {
      epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient'],
      bondScore: 15,
    });
    try {
      await addInsecureInteractions(horse.id);

      const result = await evaluateHorseFlags(horse.id);

      expect(result.success).toBe(true);
      expect(result.totalFlags).toBe(5);
      expect(result.newFlags).toHaveLength(1);
    } finally {
      await rmHorse(horse.id);
    }
  });

  test('returns success with no new flags when horse has no care interactions', async () => {
    const horse = await mkHorse('NoInteractions', { bondScore: 50 });
    try {
      const result = await evaluateHorseFlags(horse.id);

      expect(result.success).toBe(true);
      expect(result.newFlags).toHaveLength(0);
    } finally {
      await rmHorse(horse.id);
    }
  });

  test('throws when horse ID does not exist', async () => {
    await expect(evaluateHorseFlags(999999999)).rejects.toThrow('Horse with ID 999999999 not found');
  });
});

// ─── flag trigger conditions ──────────────────────────────────────────────────

describe('flag trigger conditions', () => {
  test('triggers brave flag: 3 supported novelty interactions and bondScore >= 30', async () => {
    const horse = await mkHorse('BraveOnly', { bondScore: 35 });
    try {
      await addBraveOnlyInteractions(horse.id);

      const result = await evaluateHorseFlags(horse.id);

      expect(result.success).toBe(true);
      expect(result.newFlags).toContain('brave');
    } finally {
      await rmHorse(horse.id);
    }
  });

  test('triggers fearful flag: 3 fear events, bondScore <= 20, no novelty support', async () => {
    const horse = await mkHorse('FearfulFlag', { bondScore: 15, stressLevel: 60 });
    try {
      await addFearfulInteractions(horse.id);

      const result = await evaluateHorseFlags(horse.id);

      expect(result.success).toBe(true);
      expect(result.newFlags).toContain('fearful');
    } finally {
      await rmHorse(horse.id);
    }
  });
});

// ─── batchEvaluateFlags ───────────────────────────────────────────────────────

describe('batchEvaluateFlags', () => {
  test('evaluates multiple horses and returns one result per horse', async () => {
    const h1 = await mkHorse('Batch1');
    const h2 = await mkHorse('Batch2');
    const h3 = await mkHorse('Batch3');
    try {
      const results = await batchEvaluateFlags([h1.id, h2.id, h3.id]);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success === true)).toBe(true);
    } finally {
      await rmHorse(h1.id);
      await rmHorse(h2.id);
      await rmHorse(h3.id);
    }
  });

  test('handles mixed success/failure: existing horse succeeds, non-existent horse fails', async () => {
    const horse = await mkHorse('BatchMixed');
    try {
      const results = await batchEvaluateFlags([horse.id, 999999999]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Horse with ID 999999999 not found');
    } finally {
      await rmHorse(horse.id);
    }
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
    try {
      const ids = await getEligibleHorses();

      expect(ids).toContain(eligible.id); // 1-year-old, 0 flags → eligible
      expect(ids).not.toContain(tooOld.id); // 4-year-old → outside age range
      expect(ids).not.toContain(atMax.id); // 5 flags → filtered out
    } finally {
      await rmHorse(eligible.id);
      await rmHorse(tooOld.id);
      await rmHorse(atMax.id);
    }
  });
});
