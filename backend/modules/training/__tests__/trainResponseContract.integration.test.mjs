/**
 * 🧪 INTEGRATION TEST: POST /train response contract (Equoria-o1x6g)
 *
 * The defect: backend/modules/training/controllers/trainingController.mjs#trainRouteHandler
 * built res.json({ success, message, updatedScore, nextEligibleDate, traitEffects,
 * temperamentEffects }) but trainHorse() already computes statGain, the real
 * awarded XP, and the authoritative disciplineScoreIncrease — and the route
 * DROPPED all three. Consequence in the live UI (TrainingTab.tsx): the
 * stat-gain modal was always empty, the XP row was wired to
 * traitEffects.xpModifier (a trait-only delta, not the award), and scoreGain was
 * recomputed client-side and drifted from the server's value.
 *
 * The fix surfaces statGain, xpAwarded, and disciplineScoreIncrease on the route
 * response (ADDED — existing fields preserved). This suite proves the contract
 * against the REAL DB and the REAL controller (no mocks):
 *
 *  1. SENTINEL (the regression this fix exists for): the trainRouteHandler
 *     response includes the keys statGain, xpAwarded, disciplineScoreIncrease.
 *     On pre-fix master these keys are ABSENT → this test FAILS there. After the
 *     fix they are present → it PASSES.
 *  2. Owner rulings 2026-10-19 and 2026-10-21: training never raises a horse
 *     stat, so statGain is no longer part of the contract (old contract: a
 *     15% roll could return { stat, amount }). Neither trainHorse() nor the
 *     route returns it.
 *  3. xpAwarded equals the real awarded XP (≥1) and disciplineScoreIncrease
 *     equals the authoritative score delta (≥1) the service computed.
 *
 * 🔄 MOCKING: none. Real Prisma, real controller, real DB. Fixtures are scoped
 *    (TestFixture- name prefix + id-collector cleanup) per CLAUDE.md §2/§3.
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

// Load test environment (mirrors trainingController-business-logic.test.mjs)
dotenv.config({ path: join(__dirname, '../../../.env.test') });

const { default: prisma } = await import(join(__dirname, '../../../../packages/database/prismaClient.mjs'));
const { createTestHorse, cleanupTestHorses } = await import(
  join(__dirname, '../../../__tests__/helpers/createTestHorse.mjs')
);
const { trainHorse, trainRouteHandler } = await import(join(__dirname, '../controllers/trainingController.mjs'));

/**
 * Minimal Express res double — captures statusCode + json body, same shape the
 * sibling business-logic suite uses to drive trainRouteHandler directly.
 */
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

describe('🏋️ INTEGRATION: POST /train response contract (Equoria-o1x6g)', () => {
  const suffix = randomBytes(6).toString('hex');
  const createdHorseIds = [];
  let testUser = null;
  let breed = null;

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        email: `testfixture-o1x6g-train-contract-${suffix}@example.com`,
        username: `tf${suffix}`,
        firstName: 'Train',
        lastName: 'Contract',
        password: 'hashedpassword',
        money: 1000,
        level: 1,
        xp: 0,
        settings: { theme: 'light' },
      },
    });

    breed = await prisma.breed.findFirst();
    if (!breed) {
      breed = await prisma.breed.create({
        data: {
          name: `TestFixture-o1x6g-breed-${suffix}`,
          description: 'Test breed for train response contract',
        },
      });
    }
  });

  afterAll(async () => {
    // FK-ordered, scoped cleanup: trainingLog + xpEvent BEFORE horse, horse
    // BEFORE user. cleanupTestHorses deletes ONLY the ids this suite created.
    await prisma.trainingLog.deleteMany({ where: { horseId: { in: createdHorseIds } } });
    await cleanupTestHorses(prisma, createdHorseIds);
    await prisma.xpEvent.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
  });

  /**
   * Create a fresh, training-eligible (4yo, no traits, no cooldown) horse.
   */
  async function makeEligibleHorse(name) {
    const fourYearsAgo = birthDateForAge(4);
    const horse = await createTestHorse(
      prisma,
      {
        name,
        age: 4,
        breedId: breed.id,
        userId: testUser.id,
        sex: 'Mare',
        dateOfBirth: fourYearsAgo,
        healthStatus: 'Excellent',
        lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
        disciplineScores: {},
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
      createdHorseIds,
    );
    await assignTestTrainer(horse);
    return horse;
  }

  it('trainHorse() returns the real XP and score awards and no stat gain', async () => {
    const horse = await makeEligibleHorse(`TestFixture-o1x6g-svcgain-${suffix}`);

    const result = await trainHorse(horse.id, 'Dressage');

    expect(result.success).toBe(true);
    expect(result).not.toHaveProperty('statGain');
    expect(result.xpAwarded).toBeGreaterThanOrEqual(1);
    expect(result.disciplineScoreIncrease).toBeGreaterThanOrEqual(1);
  });

  it('trainRouteHandler emits xpAwarded and disciplineScoreIncrease, and no statGain (was lossy — Equoria-o1x6g)', async () => {
    const horse = await makeEligibleHorse(`TestFixture-o1x6g-route-${suffix}`);

    const req = {
      body: { horseId: horse.id, discipline: 'Show Jumping' },
      user: { id: testUser.id },
    };
    const res = createRes();

    await trainRouteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // SENTINEL: these keys must be PRESENT on the route response. On pre-fix
    // master they were absent (the route dropped them). statGain must be
    // ABSENT: training never raises a stat (owner rulings 2026-10-19, 2026-10-21).
    expect(res.body).not.toHaveProperty('statGain');
    expect(res.body).toHaveProperty('xpAwarded');
    expect(res.body).toHaveProperty('disciplineScoreIncrease');

    // xpAwarded + disciplineScoreIncrease are the real numeric awards.
    expect(typeof res.body.xpAwarded).toBe('number');
    expect(res.body.xpAwarded).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.disciplineScoreIncrease).toBe('number');
    expect(res.body.disciplineScoreIncrease).toBeGreaterThanOrEqual(1);

    // Existing fields the frontend already relies on must be preserved.
    expect(res.body).toHaveProperty('updatedScore');
    expect(res.body).toHaveProperty('nextEligibleDate');
    expect(res.body).toHaveProperty('traitEffects');
    // Owner ruling 2026-10-21: temperament has no training modifier, so the
    // response no longer carries temperamentEffects (old contract: present).
    expect(res.body).not.toHaveProperty('temperamentEffects');
  });
});
