/**
 * trainingLiveAge.integration.test.mjs (Equoria-5b2nj, audit ARCH-07)
 *
 * Defect: the training gates read the stored `Horse.age`, which only the
 * nightly birthday job advances. A horse whose dateOfBirth made it 21 today
 * (retired, owner ruling: horses retire at 21) still trained until that job ran.
 *
 * Contract: every training gate (the train call, the trainable-horses list and
 * the horse page's training verdict) uses the live age: a birthday the nightly
 * job has not recorded yet (dateOfBirth age = stored age + 1) counts at once. A
 * legacy row whose dateOfBirth was never back-dated keeps its stored age.
 *
 * Real DB, real controller and services; id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { canTrain, getTrainableHorses, trainHorse } from '../controllers/trainingController.mjs';
import { getTrainingVerdict } from '../services/trainingVerdict.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { assignTestTrainer, cleanupTestTrainers } from '../../../tests/helpers/assignTrainer.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const rand = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const horseIds = [];
let user;
let breedId;

/** A horse `days` Eastern calendar days old, with the stored age the nightly job last wrote. */
async function makeHorse(days, storedAge) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-5b2nj-${rand()}`,
      dateOfBirth: gameCalendarDate(new Date(), -days),
      age: storedAge,
      sex: 'Mare',
      userId: user.id,
      breedId,
      healthStatus: 'Excellent',
      lastFedDate: new Date(),
    },
  });
  horseIds.push(horse.id);
  await assignTestTrainer(horse);
  return horse;
}

beforeAll(async () => {
  breedId = (await prisma.breed.findUnique({ where: { name: 'Thoroughbred' } })).id;
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `TestFixture-5b2nj-${rand()}`,
      email: `testfixture-5b2nj-${rand()}@test.local`,
      password: 'irrelevant-hash',
      firstName: 'Live',
      lastName: 'Age',
      money: 100000,
    },
  });
  cleanup.add(() => cleanupTestTrainers(), 'trainers');
  cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } }), 'training logs');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.xpEvent.deleteMany({ where: { userId: user.id } }), 'xp events');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('training uses the live age (Equoria-5b2nj)', () => {
  it('a horse that turned 21 today cannot train, before the nightly job ages it', async () => {
    const horse = await makeHorse(21 * 7, 20);

    expect(await canTrain(horse.id, 'Dressage')).toEqual({
      eligible: false,
      reason: 'Horse is too old to train',
    });
    const result = await trainHorse(horse.id, 'Dressage', { actorUserId: user.id });
    expect(result.success).toBe(false);
    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { trainingCooldown: true },
    });
    expect(after.trainingCooldown).toBeNull();

    const listed = (await getTrainableHorses(user.id)).find(h => h.horseId === horse.id);
    expect(listed.canTrain).toBe(false);
    const row = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect((await getTrainingVerdict(row)).canTrainNow).toBe(false);
  });

  it('a horse whose third birthday is today can train at once', async () => {
    const horse = await makeHorse(3 * 7, 2);
    expect(await canTrain(horse.id, 'Dressage')).toMatchObject({ eligible: true });
  });

  it('a legacy horse whose dateOfBirth was never back-dated keeps its stored age', async () => {
    const horse = await makeHorse(0, 6);
    expect(await canTrain(horse.id, 'Dressage')).toMatchObject({ eligible: true });
  });
});
