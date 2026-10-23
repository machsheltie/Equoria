/**
 * A training session records the trained discipline's score before and after
 * the gain on its TrainingLog row (Equoria-ky2ob).
 *
 * Owner ruling 2026-10-22: the horse's training history shows the real
 * per-session change. TrainingLog gained nullable scoreBefore / scoreAfter
 * columns (migration 20261023100000_training_log_score_before_after), written
 * inside the same transaction as the score increment, so the pair always
 * matches the score the horse actually holds afterwards.
 *
 * Real DB, real trainHorse, real training-history service; no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { trainHorse } from '../controllers/trainingController.mjs';
import { trainingAnalyticsService } from '../services/trainingAnalyticsService.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const fixturePrefix = 'TestFixture-ky2ob';
const tag = randomBytes(4).toString('hex');

let testUser;
const createdHorseIds = [];
const cleanup = createCleanupTracker();

async function createHorse(label, extra = {}) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${fixturePrefix}-${label}-${tag}`,
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
  createdHorseIds.push(horse.id);
  return horse;
}

beforeAll(async () => {
  testUser = await prisma.user.create({
    data: {
      email: `${fixturePrefix}-${tag}@test.com`,
      username: `${fixturePrefix}-${tag}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Score',
      lastName: 'History',
      money: 0,
    },
  });
}, 60000);

afterAll(async () => {
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

describe('TrainingLog records the discipline score before and after the session (Equoria-ky2ob)', () => {
  it('writes the score the horse held before and the score it holds after', async () => {
    const horse = await createHorse('existing', { disciplineScores: { Dressage: 20, Racing: 7 } });

    const result = await trainHorse(horse.id, 'Dressage');

    expect(result.success).toBe(true);
    const after = await prisma.horse.findUnique({ where: { id: horse.id }, select: { disciplineScores: true } });
    const logs = await prisma.trainingLog.findMany({ where: { horseId: horse.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      discipline: 'Dressage',
      scoreBefore: 20,
      scoreAfter: 20 + result.disciplineScoreIncrease,
    });
    expect(logs[0].scoreAfter).toBe(after.disciplineScores.Dressage);
  });

  it('a discipline the horse never trained starts from 0', async () => {
    const horse = await createHorse('fresh');

    const result = await trainHorse(horse.id, 'Show Jumping');

    expect(result.success).toBe(true);
    const log = await prisma.trainingLog.findFirst({ where: { horseId: horse.id } });
    expect(log).toMatchObject({ scoreBefore: 0, scoreAfter: result.disciplineScoreIncrease });
  });

  it('the training-history read returns the recorded pair', async () => {
    const horse = await createHorse('history', { disciplineScores: { Racing: 40 } });
    const result = await trainHorse(horse.id, 'Racing');
    expect(result.success).toBe(true);

    const history = await trainingAnalyticsService.getTrainingHistory(horse.id);

    expect(history.trainingHistory).toHaveLength(1);
    expect(history.trainingHistory[0]).toMatchObject({
      discipline: 'Racing',
      scoreBefore: 40,
      scoreAfter: 40 + result.disciplineScoreIncrease,
    });
  });
});
