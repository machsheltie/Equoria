/**
 * Training cooldown: one source of truth (Equoria-w0qb7).
 *
 * The train call enforces its once-a-week cooldown with an atomic claim on
 * Horse.trainingCooldown (trainingSessionTx). canTrain, the training status,
 * the trainable-horses list and the horse overview used to ask the TrainingLog
 * for the latest session instead, so an out-of-band change to either one (an
 * admin reset of the column, a TrainingLog cleanup) made the displayed
 * train-ability disagree with what the train call would do.
 *
 * Owner rule (2026-10-22, one training per horse per week): the column is the
 * one source. TrainingLog stays as history only. Every reader below must agree
 * with the column, whatever the log says.
 *
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { canTrain, getTrainableHorses, getTrainingStatus, trainHorse } from '../controllers/trainingController.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { assignTestTrainer, cleanupTestTrainers } from '../../../tests/helpers/assignTrainer.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';

afterAll(() => cleanupTestTrainers(), 60000);

const PREFIX = 'TestFixture-w0qb7';
const dayMs = 24 * 60 * 60 * 1000;
const cleanup = createCleanupTracker();
const userIds = [];
const horseIds = [];

cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } }), 'trainingLogs');
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');

afterAll(() => cleanup.run(), 30000);

async function makeUserWithHorse() {
  const tag = randomBytes(4).toString('hex');
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}-${tag}@test.com`,
      username: `${PREFIX}-${tag}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Cooldown',
      lastName: 'Source',
      // The trainer's star-level fee is charged per session (q226); fund it so
      // the session, not the purse, decides each case.
      money: 10000,
    },
  });
  userIds.push(user.id);
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}-horse-${tag}`,
      sex: 'Mare',
      dateOfBirth: birthDateForAge(6),
      age: 6,
      userId: user.id,
      healthStatus: 'Excellent',
      lastFedDate: new Date(),
      trainingCooldown: null,
    },
  });
  await assignTestTrainer(horse);
  horseIds.push(horse.id);
  return { user, horse };
}

const columnOf = async horseId =>
  (await prisma.horse.findUnique({ where: { id: horseId }, select: { trainingCooldown: true } })).trainingCooldown;

const listEntryOf = async (userId, horseId) => (await getTrainableHorses(userId)).find(h => h.id === horseId);

describe('every cooldown reader follows Horse.trainingCooldown (Equoria-w0qb7)', () => {
  it('after a train, status and list report the column value as the next eligible time', async () => {
    const { user, horse } = await makeUserWithHorse();
    const trained = await trainHorse(horse.id, 'Racing');
    expect(trained.success).toBe(true);
    const column = await columnOf(horse.id);
    expect(column).not.toBeNull();

    expect((await canTrain(horse.id, 'Racing')).eligible).toBe(false);
    const status = await getTrainingStatus(horse.id, 'Racing');
    expect(status.cooldown.active).toBe(true);
    expect(status.nextEligibleDate).toBe(column.toISOString());
    const entry = await listEntryOf(user.id, horse.id);
    expect(entry.canTrain).toBe(false);
    expect(entry.nextEligibleAt).toBe(column.toISOString());
  });

  it('a TrainingLog cleanup does not change the displayed train-ability', async () => {
    const { user, horse } = await makeUserWithHorse();
    expect((await trainHorse(horse.id, 'Racing')).success).toBe(true);
    const column = await columnOf(horse.id);

    await prisma.trainingLog.deleteMany({ where: { horseId: horse.id } });

    const verdict = await canTrain(horse.id, 'Racing');
    expect(verdict.eligible).toBe(false);
    expect(verdict.reason).toBe('Training cooldown active for this horse');
    const status = await getTrainingStatus(horse.id, 'Racing');
    expect(status.cooldown.active).toBe(true);
    expect(status.nextEligibleDate).toBe(column.toISOString());
    const entry = await listEntryOf(user.id, horse.id);
    expect(entry.canTrain).toBe(false);
    expect(entry.nextEligibleAt).toBe(column.toISOString());
  });

  it('an admin reset of the column makes every reader say trainable, and the train call agrees', async () => {
    const { user, horse } = await makeUserWithHorse();
    expect((await trainHorse(horse.id, 'Racing')).success).toBe(true);

    await prisma.horse.update({ where: { id: horse.id }, data: { trainingCooldown: null } });

    expect((await canTrain(horse.id, 'Racing')).eligible).toBe(true);
    const status = await getTrainingStatus(horse.id, 'Racing');
    expect(status.eligible).toBe(true);
    expect(status.cooldown?.active ?? false).toBe(false);
    expect(status.nextEligibleDate).toBeNull();
    const entry = await listEntryOf(user.id, horse.id);
    expect(entry.canTrain).toBe(true);
    expect(entry.nextEligibleAt).toBeNull();
    expect((await trainHorse(horse.id, 'Racing')).success).toBe(true);
  });

  it('a cooldown that has run out reads as trainable', async () => {
    const { user, horse } = await makeUserWithHorse();
    await prisma.horse.update({
      where: { id: horse.id },
      data: { trainingCooldown: new Date(Date.now() - dayMs) },
    });
    expect((await canTrain(horse.id, 'Racing')).eligible).toBe(true);
    expect((await listEntryOf(user.id, horse.id)).canTrain).toBe(true);
  });

  it('a session sets the column one week ahead (one training per horse per week)', async () => {
    const { horse } = await makeUserWithHorse();
    const before = Date.now();
    expect((await trainHorse(horse.id, 'Racing')).success).toBe(true);
    const column = await columnOf(horse.id);
    const weekMs = 7 * dayMs;
    expect(column.getTime()).toBeGreaterThanOrEqual(before + weekMs - 5000);
    expect(column.getTime()).toBeLessThanOrEqual(Date.now() + weekMs + 5000);
  });
});
