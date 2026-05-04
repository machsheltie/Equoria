// Unit and integration tests for temperament training modifiers (Story 31D-2) — real DB
//
// NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted from
// jest.unstable_mockModule of 8 modules (db, logger, trainingModel, horseModel,
// userModel, xpLogModel, traitEffects, competitionLogic) to a real-DB
// integration test against the equoria_test database.
//
// Sections:
//   1. Pure unit tests for getTemperamentTrainingModifiers (no DB).
//   2. Real-DB integration tests for trainHorse() exercising temperament
//      modifier application end-to-end. jest.spyOn(Math, 'random') is used
//      to make stat-gain deterministic — that's a Node global intercept,
//      not module mocking.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../db/index.mjs';
import {
  getTemperamentTrainingModifiers,
  TEMPERAMENT_TRAINING_MODIFIERS,
} from '../modules/horses/services/temperamentService.mjs';
import { TEMPERAMENT_TYPES } from '../modules/horses/data/breedGeneticProfiles.mjs';
import { trainHorse } from '../modules/training/controllers/trainingController.mjs';

const SUITE_PREFIX = 'tmod';

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Tmod',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
      money: 1000,
      level: 1,
      xp: 0,
    },
  });
}

async function createBreed() {
  return prisma.breed.create({
    data: { name: `${SUITE_PREFIX}-breed-${randomBytes(4).toString('hex')}` },
  });
}

async function createHorse(userId, breedId, overrides = {}) {
  return prisma.horse.create({
    data: {
      name: `${SUITE_PREFIX}-h-${randomBytes(4).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      age: overrides.age ?? 5,
      temperament: overrides.temperament ?? null,
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      disciplineScores: overrides.disciplineScores ?? {},
      trainingCooldown: null,
      breed: { connect: { id: breedId } },
      user: { connect: { id: userId } },
    },
  });
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  const horses = await prisma.horse.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const horseIds = horses.map(h => h.id);
  if (horseIds.length > 0) {
    await prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } });
  }
  await prisma.horseXpEvent.deleteMany({ where: { horseId: { in: horseIds } } });
  await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.breed.deleteMany({ where: { name: { startsWith: SUITE_PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Unit Tests: getTemperamentTrainingModifiers (pure function, no DB)
// ═════════════════════════════════════════════════════════════════════════════

describe('getTemperamentTrainingModifiers — unit tests', () => {
  const expected = [
    ['Spirited', { xpModifier: 0.1, scoreModifier: 0.05 }],
    ['Nervous', { xpModifier: -0.1, scoreModifier: -0.05 }],
    ['Calm', { xpModifier: 0.05, scoreModifier: 0.1 }],
    ['Bold', { xpModifier: 0.05, scoreModifier: 0.05 }],
    ['Steady', { xpModifier: 0.05, scoreModifier: 0.1 }],
    ['Independent', { xpModifier: -0.05, scoreModifier: 0.0 }],
    ['Reactive', { xpModifier: 0.0, scoreModifier: -0.05 }],
    ['Stubborn', { xpModifier: -0.15, scoreModifier: -0.1 }],
    ['Playful', { xpModifier: 0.05, scoreModifier: -0.05 }],
    ['Lazy', { xpModifier: -0.2, scoreModifier: -0.15 }],
    ['Aggressive', { xpModifier: -0.1, scoreModifier: -0.05 }],
  ];

  it.each(expected)('%s returns correct xpModifier and scoreModifier', (temperament, mods) => {
    const result = getTemperamentTrainingModifiers(temperament);
    expect(result.xpModifier).toBeCloseTo(mods.xpModifier, 10);
    expect(result.scoreModifier).toBeCloseTo(mods.scoreModifier, 10);
  });

  it('null returns { xpModifier: 0, scoreModifier: 0 }', () => {
    expect(getTemperamentTrainingModifiers(null)).toEqual({ xpModifier: 0, scoreModifier: 0 });
  });

  it('undefined returns { xpModifier: 0, scoreModifier: 0 }', () => {
    expect(getTemperamentTrainingModifiers(undefined)).toEqual({ xpModifier: 0, scoreModifier: 0 });
  });

  it('unknown string returns { xpModifier: 0, scoreModifier: 0 }', () => {
    expect(getTemperamentTrainingModifiers('Fiery')).toEqual({ xpModifier: 0, scoreModifier: 0 });
    expect(getTemperamentTrainingModifiers('')).toEqual({ xpModifier: 0, scoreModifier: 0 });
    expect(getTemperamentTrainingModifiers('CALM')).toEqual({ xpModifier: 0, scoreModifier: 0 });
  });

  it('TEMPERAMENT_TRAINING_MODIFIERS contains exactly the 11 canonical types', () => {
    const constantKeys = Object.keys(TEMPERAMENT_TRAINING_MODIFIERS).sort();
    const canonicalKeys = [...TEMPERAMENT_TYPES].sort();
    expect(constantKeys).toEqual(canonicalKeys);
  });

  it.each(Object.entries(TEMPERAMENT_TRAINING_MODIFIERS))(
    '%s has numeric xpModifier and scoreModifier',
    (_type, mods) => {
      expect(typeof mods.xpModifier).toBe('number');
      expect(typeof mods.scoreModifier).toBe('number');
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. Integration Tests: temperament modifier applied inside trainHorse() — real DB
// ═════════════════════════════════════════════════════════════════════════════

describe('trainHorse() — temperament modifier integration (real DB)', () => {
  let mathRandomSpy;
  let breed;

  beforeAll(async () => {
    await cleanupSuite();
    breed = await createBreed();
  });

  afterAll(cleanupSuite);

  beforeEach(() => {
    // Math.random is a Node global — spying is permitted (not module mock).
    // 0.99 ensures stat-gain branch (random < 0.15) does NOT fire, so XP +
    // score deltas are deterministic and only reflect temperament modifiers.
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('Stubborn horse: XP and score both reduced — deltas verifiable end-to-end', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id, breed.id, { temperament: 'Stubborn', disciplineScores: { Racing: 20 } });
    const userBefore = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } });

    const result = await trainHorse(horse.id, 'Racing');

    expect(result.success).toBe(true);
    expect(result.temperamentEffects).toEqual({
      temperament: 'Stubborn',
      xpModifier: -0.15,
      scoreModifier: -0.1,
    });

    // Verify real DB writes:
    // - Score: base 5, after Stubborn -10%: Math.round(5 * 0.9) = 5 (rounding neutralises at base=5)
    //   Math.max(1, 5) = 5, so disciplineScores.Racing should be 20 + 5 = 25
    const horseAfter = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(horseAfter.disciplineScores.Racing).toBeGreaterThanOrEqual(20); // increased
    // - XP: base 5, after Stubborn -15%: Math.round(5 * 0.85) = Math.round(4.25) = 4
    //   Math.max(1, 4) = 4. user.xp should increment by 4.
    const userAfter = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } });
    expect(userAfter.xp - userBefore.xp).toBe(4);
  });

  it('Calm horse: XP stays 5 (rounding), score increases by 6 (delta from base 5)', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id, breed.id, { temperament: 'Calm', disciplineScores: { Dressage: 0 } });
    const userBefore = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } });

    const result = await trainHorse(horse.id, 'Dressage');

    expect(result.success).toBe(true);
    expect(result.temperamentEffects).toEqual({
      temperament: 'Calm',
      xpModifier: 0.05,
      scoreModifier: 0.1,
    });

    // XP: Math.round(5 * 1.05) = 5. Math.max(1, 5) = 5.
    const userAfter = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } });
    expect(userAfter.xp - userBefore.xp).toBe(5);

    // Score: Math.round(5 * 1.10) = Math.round(5.5) = 6. Math.max(1, 6) = 6.
    const horseAfter = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(horseAfter.disciplineScores.Dressage).toBe(6);
  });

  it('Lazy horse: result is successful and XP + score are each at least 1', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id, breed.id, { temperament: 'Lazy', disciplineScores: { Racing: 0 } });
    const userBefore = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } });

    const result = await trainHorse(horse.id, 'Racing');

    expect(result.success).toBe(true);
    expect(result.temperamentEffects).toEqual({
      temperament: 'Lazy',
      xpModifier: -0.2,
      scoreModifier: -0.15,
    });

    // XP: Math.round(5 * 0.80) = 4. Math.max(1, 4) = 4.
    const userAfter = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } });
    expect(userAfter.xp - userBefore.xp).toBe(4);

    // Score: Math.round(5 * 0.85) = Math.round(4.25) = 4. Math.max(1, 4) = 4.
    const horseAfter = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(horseAfter.disciplineScores.Racing).toBe(4);
  });

  it('null temperament: no modifier applied, temperamentEffects is null', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id, breed.id, { temperament: null, disciplineScores: { Racing: 0 } });
    const userBefore = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } });

    const result = await trainHorse(horse.id, 'Racing');

    expect(result.success).toBe(true);
    expect(result.temperamentEffects).toBeNull();

    // No modifier: XP = 5, score = 5.
    const userAfter = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } });
    expect(userAfter.xp - userBefore.xp).toBe(5);
    const horseAfter = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(horseAfter.disciplineScores.Racing).toBe(5);
  });

  it('Reactive horse: xpModifier=0 guard skips XP branch, temperamentEffects still returned', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id, breed.id, { temperament: 'Reactive', disciplineScores: { Racing: 0 } });
    const userBefore = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } });

    const result = await trainHorse(horse.id, 'Racing');

    expect(result.success).toBe(true);
    expect(result.temperamentEffects).toEqual({
      temperament: 'Reactive',
      xpModifier: 0.0,
      scoreModifier: -0.05,
    });

    // xpModifier=0: XP stays at 5
    const userAfter = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } });
    expect(userAfter.xp - userBefore.xp).toBe(5);

    // scoreModifier=-0.05: Math.round(5 * 0.95) = Math.round(4.75) = 5
    const horseAfter = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(horseAfter.disciplineScores.Racing).toBe(5);
  });

  it('Spirited horse triggers stat gain when Math.random < 0.15 and both paths succeed', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id, breed.id, { temperament: 'Spirited', disciplineScores: { Racing: 0 } });
    mathRandomSpy.mockReturnValue(0.05); // below 0.15 stat-gain threshold

    const result = await trainHorse(horse.id, 'Racing');

    expect(result.success).toBe(true);
    expect(result.statGain).not.toBeNull();
    expect(result.statGain.stat).toBeTruthy();
    expect(result.statGain.amount).toBeGreaterThanOrEqual(1);
    expect(result.statGain.amount).toBeLessThanOrEqual(10);

    expect(result.temperamentEffects).toEqual({
      temperament: 'Spirited',
      xpModifier: 0.1,
      scoreModifier: 0.05,
    });
  });
});
