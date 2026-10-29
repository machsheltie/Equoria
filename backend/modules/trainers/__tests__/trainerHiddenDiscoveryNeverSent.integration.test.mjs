/**
 * trainerHiddenDiscoveryNeverSent.integration.test.mjs (Equoria-pzoxz, audit STAFF-10)
 *
 * Defect: once a trainer's Discovery panel had been opened, its six discovery
 * slots (label, description, icon, strength) were stored on the Trainer row, and
 * the owner's roster read sent the whole row, so a player could read every
 * undiscovered trait in the network tab before the trainer revealed any.
 *
 * Contract: no trainer read a player makes carries an undiscovered slot's
 * content. The roster and the assignments list carry no discoverySlots; the
 * discovery read sends an undiscovered slot's index and category only. Every
 * trainer is at career level 1 today (owner ruling 2026-10-28, q244), so all six
 * slots are undiscovered.
 *
 * Real DB, no mocks; controllers driven with a plain req/res.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { getUserTrainers, getTrainerAssignments, getTrainerDiscovery } from '../controllers/trainerController.mjs';

const fixturePrefix = 'TestFixture-pzoxz';
const suffix = randomBytes(6).toString('hex');
// Only the stored slots carry this token, so finding it in a response is a leak.
const secret = `slotSecret${randomBytes(6).toString('hex')}`;

// Six stored slots whose words appear nowhere else, so any leak is findable.
const hiddenSlots = [0, 1, 2, 3, 4, 5].map(slotIndex => ({
  slotIndex,
  category: ['disciplineSpecialization', 'trainingMethod', 'horseCompatibility'][Math.floor(slotIndex / 2)],
  label: `Secret Knack ${slotIndex} ${secret}`,
  description: `Unrevealed detail ${slotIndex} ${secret}`,
  icon: '*',
  strength: 'strong',
}));

function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

async function call(handler, req) {
  const res = fakeRes();
  await handler(req, res);
  return res;
}

const leaks = body => JSON.stringify(body).includes(secret);

describe('a trainer read never sends undiscovered discovery slots (Equoria-pzoxz)', () => {
  let user;
  let trainer;
  let horse;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    cleanup.add(
      () => (trainer ? prisma.trainerAssignment.deleteMany({ where: { trainerId: trainer.id } }) : null),
      'assignment',
    );
    cleanup.add(() => (horse ? prisma.horse.deleteMany({ where: { id: horse.id } }) : null), 'horse');
    cleanup.add(() => (trainer ? prisma.trainer.deleteMany({ where: { id: trainer.id } }) : null), 'trainer');
    cleanup.add(() => (user ? prisma.user.delete({ where: { id: user.id } }) : null), 'user');

    user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${fixturePrefix}-${suffix}`,
        email: `${fixturePrefix}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Hidden',
        lastName: 'Slots',
        money: 1000,
      },
    });
    trainer = await prisma.trainer.create({
      data: {
        firstName: 'Tam',
        lastName: `${fixturePrefix}-${suffix}`,
        personality: 'patient',
        skillLevel: 'expert',
        speciality: 'Dressage',
        discoverySlots: hiddenSlots,
        userId: user.id,
      },
    });
    const breed = await prisma.breed.findUnique({ where: { name: 'Thoroughbred' } });
    if (!breed) {
      throw new Error('Needs the seeded Thoroughbred breed; refusing to skip.');
    }
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${fixturePrefix}-${suffix}-horse`,
        dateOfBirth: gameCalendarDate(new Date(), -42),
        age: 6,
        sex: 'Mare',
        userId: user.id,
        breedId: breed.id,
      },
    });
    await prisma.trainerAssignment.create({
      data: { trainerId: trainer.id, horseId: horse.id, userId: user.id, isActive: true },
    });
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('the roster carries no discovery slots', async () => {
    const res = await call(getUserTrainers, { user: { id: user.id }, params: { userId: user.id } });
    expect(res.statusCode).toBe(200);
    const row = res.body.data.find(t => t.id === trainer.id);
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty('discoverySlots');
    expect(leaks(res.body)).toBe(false);
  });

  it('the assignments list carries no discovery slots', async () => {
    const res = await call(getTrainerAssignments, { user: { id: user.id } });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.some(a => a.trainerId === trainer.id)).toBe(true);
    expect(leaks(res.body)).toBe(false);
  });

  it('the discovery read sends an undiscovered slot as its index and category only', async () => {
    const res = await call(getTrainerDiscovery, {
      user: { id: user.id },
      params: { id: String(trainer.id) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.discoveredCount).toBe(0);
    expect(res.body.data.slots).toHaveLength(6);
    for (const slot of res.body.data.slots) {
      expect(slot.discovered).toBe(false);
      expect(slot.trait).toBeUndefined();
    }
    expect(leaks(res.body)).toBe(false);
  });
});
