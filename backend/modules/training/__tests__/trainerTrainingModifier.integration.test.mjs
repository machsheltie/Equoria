/**
 * 🧪 INTEGRATION TEST: trainer training modifier (Equoria-oey96.7)
 *
 * THE DEFECT (audit finding P1-6): an assigned trainer has ZERO effect on
 * training outcomes. `trainingController.trainHorse` composes the
 * discipline-score gain from trait effects + horse temperament ONLY; the
 * active TrainerAssignment is loaded solely to award trainer XP. The frontend
 * (`TrainersPage.tsx`) tells players "Trainers ... boost training session
 * effectiveness" — currently untrue (Constitution §2, fake product claim on a
 * beta surface).
 *
 * THE FIX (path (a), user-ratified 2026-07-07 —
 * docs/design/2026-07-07-game-balance-formulas.md §2):
 *   computeTrainerModifiers({ trainer, discipline, horseTemperament })
 *     → { bonusPercent, penaltyPercent }
 *   applied to the discipline-score GAIN only (not user XP, not stat-gain
 *   chance), composed traits → temperament → trainer with a SINGLE terminal
 *   round: gain = max(1, round(5·(1+trait)·(1+temp)·(1+net))).
 *
 * This suite drives the REAL train endpoint against the REAL DB (no mocks) and
 * proves the two-arm contract the issue mandates:
 *   T1 (fail-first): identical horse WITH a matched+compatible expert trainer
 *      gets a HIGHER disciplineScoreIncrease than an identical no-trainer
 *      control. On pre-fix master both arms are identical → this FAILS.
 *   T2: mismatched/incompatible trainer engages the penalty path (net < 0),
 *      surfaced honestly in the payload; the gain never exceeds the control.
 *   T3: composition-order pin — trait × temperament × trainer, single round.
 *   T7: no-trainer control gain is byte-identical to pre-feature behavior.
 *   T8: the response payload surfaces the trainerModifier breakdown.
 *   T9: user XP is unchanged by the trainer (trainer touches score only).
 *
 * The pure-function unit matrix (T4 cap, T5 canonical-set guard, T6 retired)
 * lives in the second describe block and imports computeTrainerModifiers via
 * the trainers module barrel (cross-module public API).
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

dotenv.config({ path: join(__dirname, '../../../.env.test') });

const { default: prisma } = await import(join(__dirname, '../../../../packages/database/prismaClient.mjs'));
const { createTestHorse, cleanupTestHorses } = await import(
  join(__dirname, '../../../__tests__/helpers/createTestHorse.mjs')
);
const { trainHorse, trainRouteHandler } = await import(join(__dirname, '../controllers/trainingController.mjs'));
const { computeTrainerModifiers, TRAINER_BONUS_CAP, TRAINER_PENALTY_CAP } = await import(
  join(__dirname, '../../trainers/index.mjs')
);

const SUFFIX = randomBytes(6).toString('hex');
const noStatGain = () => 0.99; // random ≥ 0.15 → stat-gain roll never fires

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
        email: `testfixture-oey967-${SUFFIX}@example.com`,
        username: `tf967${SUFFIX}`,
        firstName: 'Trainer',
        lastName: 'Modifier',
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
  async function makeHorse(label, { temperament = null, positiveTraits = [] } = {}) {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    return createTestHorse(
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
        trainingCooldown: null,
        disciplineScores: {},
        epigeneticModifiers: { positive: positiveTraits, negative: [], hidden: [] },
      },
      createdHorseIds,
    );
  }

  /**
   * Create a trainer + an ACTIVE assignment to `horseId`.
   */
  async function assignTrainer(horseId, { skillLevel, level, speciality, personality, retired = false }) {
    const trainer = await prisma.trainer.create({
      data: {
        firstName: 'TestFixture',
        lastName: `Trainer-${SUFFIX}`,
        personality,
        skillLevel,
        speciality,
        level,
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

  // ── T1: the mandated two-arm fail-first test ────────────────────────────────
  it('T1: a matched+compatible expert trainer yields a HIGHER gain than the no-trainer control', async () => {
    // Control: Calm horse, no trainer. Trained: identical Calm horse with an
    // expert `technical` trainer specialised in the trained discipline
    // (technical+Calm compat = +0.03 → net clamps to the +0.20 bonus cap).
    const controlHorse = await makeHorse('t1-control', { temperament: 'Calm' });
    const trainedHorse = await makeHorse('t1-trained', { temperament: 'Calm' });
    await assignTrainer(trainedHorse.id, {
      skillLevel: 'expert',
      level: 10,
      speciality: 'Dressage',
      personality: 'technical',
    });

    const control = await trainHorse(controlHorse.id, 'Dressage', noStatGain);
    const trained = await trainHorse(trainedHorse.id, 'Dressage', noStatGain);

    expect(control.success).toBe(true);
    expect(trained.success).toBe(true);

    // Calm scoreModifier +0.10; base 5. Control: round(5·1.10) = 6.
    // Trained: round(5·1.10·1.20) = round(6.6) = 7. 7 > 6.
    expect(control.disciplineScoreIncrease).toBe(6);
    expect(trained.disciplineScoreIncrease).toBe(7);
    expect(trained.disciplineScoreIncrease).toBeGreaterThan(control.disciplineScoreIncrease);

    // T8 (payload honesty): the trainer contribution is surfaced, not folded in.
    expect(trained.trainerModifier).toEqual({
      bonusPercent: TRAINER_BONUS_CAP,
      penaltyPercent: 0,
      net: TRAINER_BONUS_CAP,
    });
    // Control surfaces a zero (no-trainer) breakdown, never undefined.
    expect(control.trainerModifier).toEqual({ bonusPercent: 0, penaltyPercent: 0, net: 0 });

    // T9 (user XP unchanged by the trainer): both arms award identical XP.
    expect(trained.xpAwarded).toBe(control.xpAwarded);
  });

  // ── T2: mismatch / incompatible trainer engages the penalty path ───────────
  it('T2: an incompatible trainer engages the penalty path and never exceeds the control', async () => {
    const controlHorse = await makeHorse('t2-control', { temperament: 'Nervous' });
    const mismatchHorse = await makeHorse('t2-mismatch', { temperament: 'Nervous' });
    // competitive + Nervous = −0.04 (the PRD-06 §3 worked example); novice
    // skill (+0.02), wrong discipline (no match) → net = 0.02 − 0.04 = −0.02.
    await assignTrainer(mismatchHorse.id, {
      skillLevel: 'novice',
      level: 1,
      speciality: 'Racing',
      personality: 'competitive',
    });

    const control = await trainHorse(controlHorse.id, 'Dressage', noStatGain);
    const mismatch = await trainHorse(mismatchHorse.id, 'Dressage', noStatGain);

    expect(control.success).toBe(true);
    expect(mismatch.success).toBe(true);

    // Penalty is live and surfaced honestly.
    expect(mismatch.trainerModifier.penaltyPercent).toBeCloseTo(0.04, 10);
    expect(mismatch.trainerModifier.bonusPercent).toBeCloseTo(0.02, 10);
    expect(mismatch.trainerModifier.net).toBeLessThan(0);

    // A bad hire is never better than no hire. (At base 5 the −2% net is
    // absorbed by rounding — the real cost is the lifetime delta, per §2.2.)
    expect(mismatch.disciplineScoreIncrease).toBeLessThanOrEqual(control.disciplineScoreIncrease);
  });

  // ── T3: composition-order pin (trait × temperament × trainer, single round) ─
  it('T3: composition is trait → temperament → trainer with ONE terminal round', async () => {
    // intelligent trait (trainingXpModifier +0.25) + Calm temperament (+0.10) +
    // technical/expert/L10/Dressage trainer (compat +0.03 → net clamps to +0.20).
    // gain = max(1, round(5 · 1.25 · 1.10 · 1.20)) = round(8.25) = 8.
    const horse = await makeHorse('t3-pin', {
      temperament: 'Calm',
      positiveTraits: ['intelligent'],
    });
    await assignTrainer(horse.id, {
      skillLevel: 'expert',
      level: 10,
      speciality: 'Dressage',
      personality: 'technical',
    });

    const result = await trainHorse(horse.id, 'Dressage', noStatGain);

    expect(result.success).toBe(true);
    expect(result.disciplineScoreIncrease).toBe(8);
    expect(result.trainerModifier.net).toBeCloseTo(TRAINER_BONUS_CAP, 10);
  });

  // ── T7: no-trainer control gain is byte-identical to pre-feature behavior ──
  it('T7: the no-trainer path is unchanged (control invariance)', async () => {
    // No trait, no trainer, null temperament → base gain exactly 5, exactly as
    // pre-feature master produced. This is the no-trainer path sentinel.
    const horse = await makeHorse('t7-plain', { temperament: null });
    const result = await trainHorse(horse.id, 'Dressage', noStatGain);

    expect(result.success).toBe(true);
    expect(result.disciplineScoreIncrease).toBe(5);
    expect(result.trainerModifier).toEqual({ bonusPercent: 0, penaltyPercent: 0, net: 0 });
    expect(result.temperamentEffects).toBeNull();
  });

  // ── T8 (route surface): trainRouteHandler emits the trainerModifier ────────
  it('T8: the POST /train response body surfaces the trainerModifier breakdown', async () => {
    const horse = await makeHorse('t8-route', { temperament: 'Calm' });
    await assignTrainer(horse.id, {
      skillLevel: 'expert',
      level: 10,
      speciality: 'Show Jumping',
      personality: 'technical',
    });

    const req = { body: { horseId: horse.id, discipline: 'Show Jumping' }, user: { id: testUser.id } };
    const res = createRes();
    await trainRouteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('trainerModifier');
    expect(res.body.trainerModifier).toEqual({
      bonusPercent: TRAINER_BONUS_CAP,
      penaltyPercent: 0,
      net: TRAINER_BONUS_CAP,
    });
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

  it('T4 (cap sentinel): expert L10 matched patient+Stubborn (raw 0.235) → net == +20% exactly', () => {
    const result = computeTrainerModifiers({
      trainer: { skillLevel: 'expert', level: 10, speciality: 'Dressage', personality: 'patient' },
      discipline: 'Dressage',
      horseTemperament: 'Stubborn',
    });
    // 0.10 + 0.045 + 0.05 + 0.04 = 0.235 → clamp to the 0.20 cap.
    expect(result.bonusPercent).toBeCloseTo(TRAINER_BONUS_CAP, 10);
    expect(result.penaltyPercent).toBe(0);
    expect(result.bonusPercent - result.penaltyPercent).toBeCloseTo(0.2, 10);
  });

  it('T5 (canonical-set guard): a typo personality/temperament never leaks a compat value', () => {
    // Typo'd personality ("competetive") + typo'd temperament ("nervouss") on
    // an otherwise-minimal trainer: ONLY the untainted skill term (novice 0.02)
    // survives — the competitive+Nervous −0.04 penalty does NOT leak.
    const guarded = computeTrainerModifiers({
      trainer: { skillLevel: 'novice', level: 1, speciality: 'Racing', personality: 'competetive' },
      discipline: 'Dressage',
      horseTemperament: 'nervouss',
    });
    expect(guarded.bonusPercent).toBeCloseTo(0.02, 10);
    expect(guarded.penaltyPercent).toBe(0);

    // SENTINEL-POSITIVE: the SAME fixture with correct spellings DOES apply the
    // −0.04 penalty — proving the guard above is load-bearing, not vacuous.
    const unguarded = computeTrainerModifiers({
      trainer: { skillLevel: 'novice', level: 1, speciality: 'Racing', personality: 'competitive' },
      discipline: 'Dressage',
      horseTemperament: 'Nervous',
    });
    expect(unguarded.bonusPercent).toBeCloseTo(0.02, 10);
    expect(unguarded.penaltyPercent).toBeCloseTo(0.04, 10);
  });

  it('T6 (retired defensive): retired trainer → { 0, penalty cap }, never net-positive', () => {
    const result = computeTrainerModifiers({
      // Even an otherwise-elite matched trainer is a dead-end once retired.
      trainer: {
        skillLevel: 'expert',
        level: 10,
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
    // + level + match still apply.
    const result = computeTrainerModifiers({
      trainer: { skillLevel: 'developing', level: 3, speciality: 'Dressage', personality: 'patient' },
      discipline: 'Dressage',
      horseTemperament: 'Bold',
    });
    // 0.05 + (3-1)*0.005 + 0.05 + 0 = 0.11
    expect(result.bonusPercent).toBeCloseTo(0.11, 10);
    expect(result.penaltyPercent).toBe(0);
  });
});
