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
 *  2. statGain is present (a populated { stat, amount } object) when a stat is
 *     actually gained. The 15% stat-gain roll is forced deterministically by
 *     injecting `_randomFn = () => 0` (0 < statGainChance) into the service —
 *     the same injection point the controller already exposes — so the assertion
 *     is not flaky.
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
    const fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
    return createTestHorse(
      prisma,
      {
        name,
        age: 4,
        breedId: breed.id,
        userId: testUser.id,
        sex: 'Mare',
        dateOfBirth: fourYearsAgo,
        healthStatus: 'Excellent',
        disciplineScores: {},
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
      createdHorseIds,
    );
  }

  it('trainHorse() returns statGain { stat, amount } when a stat is gained (forced roll)', async () => {
    const horse = await makeEligibleHorse(`TestFixture-o1x6g-svcgain-${suffix}`);

    // _randomFn = () => 0 forces the 15% stat-gain roll to succeed (0 < chance)
    // and deterministically selects the first relevant stat + a +1 amount.
    const result = await trainHorse(horse.id, 'Dressage', () => 0);

    expect(result.success).toBe(true);
    // The real awarded fields the route previously dropped:
    expect(result.statGain).not.toBeNull();
    expect(typeof result.statGain.stat).toBe('string');
    expect(result.statGain.stat.length).toBeGreaterThan(0);
    expect(result.statGain.amount).toBeGreaterThanOrEqual(1);
    expect(result.xpAwarded).toBeGreaterThanOrEqual(1);
    expect(result.disciplineScoreIncrease).toBeGreaterThanOrEqual(1);
  });

  it('trainRouteHandler emits statGain, xpAwarded, disciplineScoreIncrease (was lossy — Equoria-o1x6g)', async () => {
    const horse = await makeEligibleHorse(`TestFixture-o1x6g-route-${suffix}`);

    const req = {
      body: { horseId: horse.id, discipline: 'Show Jumping' },
      user: { id: testUser.id },
    };
    const res = createRes();

    await trainRouteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // SENTINEL: these three keys must be PRESENT on the route response. On
    // pre-fix master they were absent (the route dropped them), so this block
    // fails there and passes after the fix. `toHaveProperty` asserts presence
    // even when statGain's own value is null (no gain on this unforced roll).
    expect(res.body).toHaveProperty('statGain');
    expect(res.body).toHaveProperty('xpAwarded');
    expect(res.body).toHaveProperty('disciplineScoreIncrease');

    // xpAwarded + disciplineScoreIncrease are the real numeric awards.
    expect(typeof res.body.xpAwarded).toBe('number');
    expect(res.body.xpAwarded).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.disciplineScoreIncrease).toBe('number');
    expect(res.body.disciplineScoreIncrease).toBeGreaterThanOrEqual(1);

    // statGain is either null (no gain) or a populated { stat, amount } — never
    // dropped. When present it must be well-formed.
    if (res.body.statGain !== null) {
      expect(typeof res.body.statGain.stat).toBe('string');
      expect(res.body.statGain.amount).toBeGreaterThanOrEqual(1);
    }

    // Existing fields the frontend already relies on must be preserved.
    expect(res.body).toHaveProperty('updatedScore');
    expect(res.body).toHaveProperty('nextEligibleDate');
    expect(res.body).toHaveProperty('traitEffects');
    expect(res.body).toHaveProperty('temperamentEffects');
  });
});
