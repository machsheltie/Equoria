/**
 * INTEGRATION TEST: weekly training adds a FLAT +5 (Equoria-576c0.1)
 *
 * OWNER RULING 2026-10-23: weekly training adds a FLAT +5 to the trained
 * discipline. There is no trainer bonus and no trait scaling of the gain
 * (supersedes the 2026-10-19 trainer +5/+10 for the training gain).
 *
 * Old contract (Equoria-oey96.7, user-ratified 2026-07-07): the gain was
 *   max(1, round(5 * (1 + trait trainingXpModifier) * (1 + trainerNet)))
 * so a matched expert trainer gained 6, an `intelligent` horse with that
 * trainer gained 8, and the response surfaced a `trainerModifier` breakdown
 * and a `traitEffects.scoreModifier` delta. Those assertions are replaced
 * here by the ruling; the trainer-fit pure function (computeTrainerModifiers)
 * is unchanged and keeps its unit matrix in the second describe block.
 *
 * This suite drives the REAL train path against the REAL DB (no mocks).
 * Fixtures are scoped (TestFixture- name prefix + id-collector cleanup).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { assignTestTrainer, cleanupTestTrainers } from '../../../tests/helpers/assignTrainer.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';

afterAll(() => cleanupTestTrainers(), 60000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env.test') });

const { default: prisma } = await import(join(__dirname, '../../../../packages/database/prismaClient.mjs'));
const { createTestHorse, cleanupTestHorses } = await import(
  join(__dirname, '../../../__tests__/helpers/createTestHorse.mjs')
);
const { trainHorse, trainRouteHandler } = await import(join(__dirname, '../controllers/trainingController.mjs'));
const { computeTrainerModifiers, TRAINER_BONUS_CAP, TRAINER_PENALTY_CAP, TRAINER_CANONICAL_TEMPERAMENTS } =
  await import(join(__dirname, '../../trainers/index.mjs'));
// Cross-module barrel import (allowed in tests) — the horses module OWNS the
// canonical temperament list; the trainer service duplicates it locally to stay
// a leaf, and this sentinel proves the two never drift.
const { TEMPERAMENT_TYPES } = await import(join(__dirname, '../../horses/index.mjs'));

const SUFFIX = randomBytes(6).toString('hex');

function createRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

describe('🏋️ INTEGRATION: trainer training modifier — real DB (Equoria-oey96.7)', () => {
  const createdHorseIds = [];
  const createdTrainerIds = [];
  let testUser = null;
  let breed = null;

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `testfixture-oey967-${SUFFIX}@example.com`,
        username: `tf967${SUFFIX}`,
        firstName: 'Trainer',
        lastName: 'Modifier',
        password: 'hashedpassword',
        // Owner ruling 2026-10-28 (q226): an Expert trainer charges 500 a session, so the
        // fixture player holds enough for every training this file runs.
        money: 10000,
        level: 1,
        xp: 0,
        settings: { theme: 'light' },
      },
    });

    breed = await prisma.breed.findFirst();
    if (!breed) {
      breed = await prisma.breed.create({
        data: {
          name: `TestFixture-oey967-breed-${SUFFIX}`,
          description: 'Test breed for trainer training modifier',
        },
      });
    }
  });

  afterAll(async () => {
    // FK-ordered, scoped cleanup. Assignments reference trainers + horses;
    // trainingLog + horseXpEvent reference horses. Everything scoped to ids/
    // prefixes this suite created — never a broad deleteMany().
    await prisma.trainerAssignment.deleteMany({
      where: { OR: [{ trainerId: { in: createdTrainerIds } }, { horseId: { in: createdHorseIds } }] },
    });
    await prisma.trainingLog.deleteMany({ where: { horseId: { in: createdHorseIds } } });
    await prisma.horseXpEvent.deleteMany({ where: { horseId: { in: createdHorseIds } } });
    await cleanupTestHorses(prisma, createdHorseIds);
    await prisma.trainer.deleteMany({ where: { id: { in: createdTrainerIds } } });
    await prisma.xpEvent.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
  });

  /**
   * A fresh, training-eligible (5yo, no cooldown) horse with a given
   * temperament and optional epigenetic traits.
   */
  // Equoria-576c0.5: a horse given no temperament gets its breed's (temperament has no training effect).
  async function makeHorse(label, { temperament, positiveTraits = [], fixtureTrainer = true } = {}) {
    const fiveYearsAgo = birthDateForAge(5);
    const horse = await createTestHorse(
      prisma,
      {
        name: `TestFixture-oey967-${label}-${SUFFIX}`,
        age: 5,
        breedId: breed.id,
        userId: testUser.id,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        temperament,
        healthStatus: 'Excellent',
        lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
        trainingCooldown: null,
        disciplineScores: {},
        epigeneticModifiers: { positive: positiveTraits, negative: [], hidden: [] },
      },
      createdHorseIds,
    );
    // A trainer is required to train (owner ruling 2026-10-26, Equoria-r8a6h).
    if (fixtureTrainer) {
      await assignTestTrainer(horse);
    }
    return horse;
  }

  /**
   * Create a trainer + an ACTIVE assignment to `horseId`.
   */
  async function assignTrainer(
    horseId,
    { skillLevel, starLevel = 'rookie', speciality, personality, retired = false },
  ) {
    const trainer = await prisma.trainer.create({
      data: {
        firstName: 'TestFixture',
        lastName: `Trainer-${SUFFIX}`,
        personality,
        skillLevel,
        speciality,
        starLevel,
        retired,
        userId: testUser.id,
      },
    });
    createdTrainerIds.push(trainer.id);
    await prisma.trainerAssignment.create({
      data: { trainerId: trainer.id, horseId, userId: testUser.id, isActive: true },
    });
    return trainer;
  }

  // -- T1: the flat +5, whatever the trainer ---------------------------------
  it('T1: a matched expert trainer, a penalised trainer and a plain trainer all give exactly +5 (owner ruling 2026-10-26: a trainer is required, so the control has a plain fixture trainer)', async () => {
    const controlHorse = await makeHorse('t1-control', { temperament: 'Calm' });
    const expertHorse = await makeHorse('t1-expert', { temperament: 'Calm', fixtureTrainer: false });
    const badHireHorse = await makeHorse('t1-badhire', { temperament: 'Nervous', fixtureTrainer: false });
    await assignTrainer(expertHorse.id, {
      skillLevel: 'expert',
      starLevel: 'expert',
      speciality: 'Dressage',
      personality: 'technical',
    });
    await assignTrainer(badHireHorse.id, {
      skillLevel: 'novice',
      speciality: 'Racing',
      personality: 'competitive',
    });

    const control = await trainHorse(controlHorse.id, 'Dressage');
    const expert = await trainHorse(expertHorse.id, 'Dressage');
    const badHire = await trainHorse(badHireHorse.id, 'Dressage');

    for (const result of [control, expert, badHire]) {
      expect(result.success).toBe(true);
      expect(result.disciplineScoreIncrease).toBe(5);
    }
    // The stored score moved by exactly 5 as well, not just the reported number.
    for (const horse of [controlHorse, expertHorse, badHireHorse]) {
      const row = await prisma.horse.findUnique({ where: { id: horse.id }, select: { disciplineScores: true } });
      expect(row.disciplineScores.Dressage).toBe(5);
    }
  });

  // -- T2: traits never scale the gain ----------------------------------------
  it('T2: an `intelligent` horse (trainingXpModifier +0.25) with an expert trainer still gains exactly +5', async () => {
    const horse = await makeHorse('t2-intelligent', {
      temperament: 'Calm',
      positiveTraits: ['intelligent'],
    });
    await assignTrainer(horse.id, {
      skillLevel: 'expert',
      starLevel: 'expert',
      speciality: 'Dressage',
      personality: 'technical',
    });

    const result = await trainHorse(horse.id, 'Dressage');

    expect(result.success).toBe(true);
    expect(result.disciplineScoreIncrease).toBe(5);
    const row = await prisma.horse.findUnique({ where: { id: horse.id }, select: { disciplineScores: true } });
    expect(row.disciplineScores.Dressage).toBe(5);
  });

  // -- T2b: player XP is flat too (owner ruling q31, 2026-10-23) -------------
  it('T2b: the player XP a session awards is a flat 5, whatever the horse’s traits', async () => {
    const horse = await makeHorse('t2b-flat-xp', { positiveTraits: ['intelligent'] });

    const result = await trainHorse(horse.id, 'Dressage');

    expect(result.success).toBe(true);
    expect(result.xpAwarded).toBe(5);
    expect(result.traitEffects.xpModifier).toBe(0);
  });

  // -- T3: the result no longer reports trainer / trait score scaling ---------
  it('T3: trainHorse reports no trainerModifier and no trait score delta', async () => {
    const horse = await makeHorse('t3-payload', { positiveTraits: ['intelligent'] });
    const result = await trainHorse(horse.id, 'Dressage');

    expect(result.success).toBe(true);
    expect(result).not.toHaveProperty('trainerModifier');
    expect(result.traitEffects).not.toHaveProperty('scoreModifier');
    // Owner ruling 2026-10-21: no temperamentEffects in the result either.
    expect(result).not.toHaveProperty('temperamentEffects');
  });

  // -- T4: route surface -------------------------------------------------------
  it('T4: the POST /train response is +5 with no trainerModifier, even with an expert trainer', async () => {
    const horse = await makeHorse('t4-route', { temperament: 'Calm', positiveTraits: ['intelligent'] });
    await assignTrainer(horse.id, {
      skillLevel: 'expert',
      starLevel: 'expert',
      speciality: 'Show Jumping',
      personality: 'technical',
    });

    const req = { body: { horseId: horse.id, discipline: 'Show Jumping' }, user: { id: testUser.id } };
    const res = createRes();
    await trainRouteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.disciplineScoreIncrease).toBe(5);
    expect(res.body.updatedScore).toBe(5);
    expect(res.body).not.toHaveProperty('trainerModifier');
    expect(res.body.traitEffects).not.toHaveProperty('scoreModifier');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Pure-function unit matrix for computeTrainerModifiers (no DB).
// Testing OUR OWN pure logic — not a mock of any service/DB.
// ═════════════════════════════════════════════════════════════════════════════

describe('computeTrainerModifiers — unit (pure) (Equoria-oey96.7)', () => {
  it('null / malformed trainer → { 0, 0 } (no-trainer path)', () => {
    expect(computeTrainerModifiers()).toEqual({ bonusPercent: 0, penaltyPercent: 0 });
    expect(computeTrainerModifiers({ trainer: null, discipline: 'Dressage' })).toEqual({
      bonusPercent: 0,
      penaltyPercent: 0,
    });
    expect(computeTrainerModifiers({ trainer: 'not-an-object', discipline: 'Dressage' })).toEqual({
      bonusPercent: 0,
      penaltyPercent: 0,
    });
  });

  // Owner rulings 2026-10-28: q229 dropped the old 1-10 level column, and q244 says stars
  // give no bonus for now, so every rider/trainer is at the old level 1
  // (staffCareerLevel) and the level term adds nothing.
  // So the best trainer no longer reaches the cap (it used to: 0.235 with level 10).
  it('T4 (cap sentinel): expert matched patient+Stubborn (raw 0.19) stays within the +20% cap', () => {
    const result = computeTrainerModifiers({
      trainer: { skillLevel: 'expert', starLevel: 'expert', level: 10, speciality: 'Dressage', personality: 'patient' },
      discipline: 'Dressage',
      horseTemperament: 'Stubborn',
    });
    // 0.10 + 0.05 + 0.04 = 0.19; neither the stars nor a stray old level add anything.
    expect(result.bonusPercent).toBeCloseTo(0.19, 10);
    expect(result.bonusPercent).toBeLessThanOrEqual(TRAINER_BONUS_CAP);
    expect(result.penaltyPercent).toBe(0);
  });

  it('T5 (canonical-set guard): a typo personality/temperament never leaks a compat value', () => {
    // Typo'd personality ("competetive") + typo'd temperament ("nervouss") on
    // an otherwise-minimal trainer: ONLY the untainted skill term (novice 0.02)
    // survives — the competitive+Nervous −0.04 penalty does NOT leak.
    const guarded = computeTrainerModifiers({
      trainer: { skillLevel: 'novice', speciality: 'Racing', personality: 'competetive' },
      discipline: 'Dressage',
      horseTemperament: 'nervouss',
    });
    expect(guarded.bonusPercent).toBeCloseTo(0.02, 10);
    expect(guarded.penaltyPercent).toBe(0);

    // SENTINEL-POSITIVE: the SAME fixture with correct spellings DOES apply the
    // −0.04 penalty — proving the guard above is load-bearing, not vacuous.
    const unguarded = computeTrainerModifiers({
      trainer: { skillLevel: 'novice', speciality: 'Racing', personality: 'competitive' },
      discipline: 'Dressage',
      horseTemperament: 'Nervous',
    });
    expect(unguarded.bonusPercent).toBeCloseTo(0.02, 10);
    expect(unguarded.penaltyPercent).toBeCloseTo(0.04, 10);
  });

  // Owner ruling 2026-10-21: Driven keeps Playful's trainer fit (focused +0.03,
  // encouraging +0.02); Willing fits encouraging (+0.04) and technical (+0.03).
  // A novice, unmatched trainer is +0.02, so the compat is the rest.
  it.each([
    ['focused', 'Driven', 0.05],
    ['encouraging', 'Driven', 0.04],
    ['encouraging', 'Willing', 0.06],
    ['technical', 'Willing', 0.05],
    ['competitive', 'Willing', 0.02],
    // A leftover 'Playful' value is no longer a temperament: base +0.02 only.
    ['focused', 'Playful', 0.02],
  ])('trainer fit: %s trainer + %s horse → bonus %d', (personality, temperament, bonus) => {
    const result = computeTrainerModifiers({
      trainer: { skillLevel: 'novice', speciality: 'Racing', personality },
      discipline: 'Dressage',
      horseTemperament: temperament,
    });
    expect(result.bonusPercent).toBeCloseTo(bonus, 10);
    expect(result.penaltyPercent).toBe(0);
  });

  it('T6 (retired defensive): retired trainer → { 0, penalty cap }, never net-positive', () => {
    const result = computeTrainerModifiers({
      // Even an otherwise-elite matched trainer is a dead-end once retired.
      trainer: {
        skillLevel: 'expert',
        starLevel: 'expert',
        speciality: 'Dressage',
        personality: 'patient',
        retired: true,
      },
      discipline: 'Dressage',
      horseTemperament: 'Stubborn',
    });
    expect(result.bonusPercent).toBe(0);
    expect(result.penaltyPercent).toBeCloseTo(TRAINER_PENALTY_CAP, 10);
    expect(result.bonusPercent - result.penaltyPercent).toBeLessThan(0);
  });

  it('a valid-but-unlisted personality×temperament pair legitimately contributes 0 compat', () => {
    // patient has no Bold entry → compat 0 (not a typo, just no synergy). Skill
    // + match still apply; the level term adds nothing (q229/q244).
    const result = computeTrainerModifiers({
      trainer: { skillLevel: 'developing', starLevel: 'novice', speciality: 'Dressage', personality: 'patient' },
      discipline: 'Dressage',
      horseTemperament: 'Bold',
    });
    // 0.05 + 0.05 + 0 = 0.10
    expect(result.bonusPercent).toBeCloseTo(0.1, 10);
    expect(result.penaltyPercent).toBe(0);
  });

  it('drift sentinel: trainer-local canonical temperaments === horses TEMPERAMENT_TYPES', () => {
    // The compat guard duplicates the 12-temperament list to keep the trainer
    // service a leaf (no heavyweight horses-barrel import). If the horses module
    // ever adds/renames a temperament, this fails so the duplicate is updated.
    expect([...TRAINER_CANONICAL_TEMPERAMENTS].sort()).toEqual([...TEMPERAMENT_TYPES].sort());
  });
});
