/**
 * trainHorse — one atomic unit of work (Equoria-bvddn.17, covers Equoria-bvddn.26).
 *
 * Before this fix a training session was four independent autocommit writes:
 * the cooldown claim, the TrainingLog insert, a read-then-write of the
 * discipline-score JSONB, and a read-then-write of the gained stat. So:
 *   (1) a failure at the score update left the week's cooldown spent and a
 *       TrainingLog row written, with no gain;
 *   (2) a concurrent stat write from another writer (e.g. a show payout)
 *       landing between training's SELECT and UPDATE was overwritten by
 *       training's stale absolute value;
 *   (3) a string horseId reached `prisma.horse.findUnique({ where: { id } })`
 *       un-parsed, the stat update threw, and the error was swallowed — the
 *       response claimed success with no stat gain (Equoria-bvddn.26).
 *
 * Owner rulings 2026-10-19 and 2026-10-21: training never raises a horse stat,
 * in any discipline, so (2) no longer has a training write to race; the stat
 * tests below now pin that no stat moves at all.
 *
 * Real DB, real trainHorse, no mocks. Failure (1) is injected with a real
 * Postgres CHECK constraint scoped to the fixture horse.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma, { Prisma } from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { trainHorse } from '../controllers/trainingController.mjs';
import { DISCIPLINE_VALUES, HORSE_STAT_VALUES } from '../../../constants/schema.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { assignTestTrainer, cleanupTestTrainers } from '../../../tests/helpers/assignTrainer.mjs';

afterAll(() => cleanupTestTrainers(), 60000);

const FIXTURE_PREFIX = 'TestFixture-bvddn17';
const tag = randomBytes(4).toString('hex');
const constraintName = `tf_bvddn17_block_score_${tag}`;

let testUser;
const createdHorseIds = [];
const cleanup = createCleanupTracker();

async function createHorse(label, extra = {}) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-${label}-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: testUser.id,
      healthStatus: 'Excellent',
      lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
      trainingCooldown: null,
      ...extra,
    },
  });
  await assignTestTrainer(horse);
  createdHorseIds.push(horse.id);
  return horse;
}

beforeAll(async () => {
  testUser = await prisma.user.create({
    data: {
      email: `${FIXTURE_PREFIX}-${tag}@test.com`,
      username: `${FIXTURE_PREFIX}-${tag}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Atomic',
      lastName: 'Training',
      // The trainer's star-level fee is charged per session (q226); fund it so
      // the session, not the purse, decides each case.
      money: 10000,
    },
  });
}, 60000);

afterAll(async () => {
  cleanup.add(
    () => prisma.$executeRaw(Prisma.sql`ALTER TABLE horses DROP CONSTRAINT IF EXISTS ${Prisma.raw(constraintName)}`),
    'check constraint',
  );
  if (createdHorseIds.length) {
    cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horseId: { in: createdHorseIds } } }), 'trainingLogs');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horses');
  }
  if (testUser) {
    cleanup.add(() => prisma.xpEvent.deleteMany({ where: { userId: testUser.id } }), 'xpEvents');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: testUser.id } }), 'users');
  }
  await cleanup.run();
}, 30000);

describe('trainHorse — all training writes commit or roll back together (Equoria-bvddn.17)', () => {
  it('a real DB failure at the discipline-score write leaves the cooldown unclaimed, no log, no XP', async () => {
    const horse = await createHorse('scorefail');
    const xpBefore = (await prisma.user.findUnique({ where: { id: testUser.id }, select: { xp: true } })).xp;

    // Genuine DB-level failure at the score step only: this row may never hold
    // a Dressage score. The cooldown claim (same row, no Dressage key yet)
    // still satisfies it; the score write that adds the key violates it.
    await prisma.$executeRaw(
      Prisma.sql`ALTER TABLE horses ADD CONSTRAINT ${Prisma.raw(constraintName)} CHECK (id <> ${Prisma.raw(
        String(horse.id),
      )} OR NOT ("disciplineScores" ? 'Dressage')) NOT VALID`,
    );
    let outcome;
    try {
      outcome = await trainHorse(horse.id, 'Dressage').then(
        value => ({ threw: false, value }),
        error => ({ threw: true, error }),
      );
    } finally {
      await prisma.$executeRaw(Prisma.sql`ALTER TABLE horses DROP CONSTRAINT IF EXISTS ${Prisma.raw(constraintName)}`);
    }

    expect(outcome.threw).toBe(true);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { trainingCooldown: true, disciplineScores: true },
    });
    expect(after.trainingCooldown).toBeNull();
    expect(after.disciplineScores?.Dressage).toBeUndefined();
    expect(await prisma.trainingLog.count({ where: { horseId: horse.id } })).toBe(0);
    const xpAfter = (await prisma.user.findUnique({ where: { id: testUser.id }, select: { xp: true } })).xp;
    expect(xpAfter).toBe(xpBefore);
  });

  // Old contract: a 15% roll could raise one of the discipline's stats. New
  // contract (owner rulings 2026-10-19, 2026-10-21): training only adds +5 to
  // the trained discipline's score, in every discipline. Gaited is left out
  // only because its own gate refuses a non-gaited fixture horse.
  it('training in every discipline adds +5 to that discipline and moves no stat', async () => {
    const statSelect = Object.fromEntries(HORSE_STAT_VALUES.map(stat => [stat, true]));
    const disciplines = DISCIPLINE_VALUES.filter(d => d !== 'Gaited');
    expect(disciplines).toContain('Pleasure Driving');

    for (const discipline of disciplines) {
      const horse = await createHorse(`nostat-${discipline.replace(/\s+/g, '')}`);
      const before = await prisma.horse.findUnique({ where: { id: horse.id }, select: statSelect });

      const result = await trainHorse(horse.id, discipline);

      expect([discipline, result.success]).toEqual([discipline, true]);
      expect(result).not.toHaveProperty('statGain');
      const after = await prisma.horse.findUnique({
        where: { id: horse.id },
        select: { ...statSelect, disciplineScores: true },
      });
      const { disciplineScores, ...stats } = after;
      expect([discipline, stats]).toEqual([discipline, before]);
      expect([discipline, disciplineScores]).toEqual([discipline, { [discipline]: 5 }]);
    }
  }, 120000);

  it('a numeric-string horseId trains and adds the discipline score (Equoria-bvddn.26)', async () => {
    const horse = await createHorse('stringid');

    const result = await trainHorse(String(horse.id), 'Racing');

    expect(result.success).toBe(true);
    const after = await prisma.horse.findUnique({ where: { id: horse.id }, select: { disciplineScores: true } });
    expect(after.disciplineScores).toEqual({ Racing: 5 });
  });
});
