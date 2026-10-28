/**
 * Integration test — the foal belongs to whoever owns the mare when it is born
 * (Equoria-x1t7q, audit BRE-10; owner ruling 2026-10-28, q253).
 *
 * Defect: the foaling job read its due mares (with their owner) first and
 * foaled each one later, handing the foal and its foalBorn notification to the
 * owner from that earlier read. A mare sold between the read and the birth
 * foaled to her old owner.
 *
 * The test reproduces the job's call exactly: the dam snapshot (the job's
 * candidate row) is taken, the mare is sold, then the foal is delivered from
 * that snapshot.
 *
 * Real DB. No mocks.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createFoalFromPregnancy, runFoalingJob } from '../services/foalingService.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const dayMs = 24 * 60 * 60 * 1000;
const cleanup = createCleanupTracker();
const createdUserIds = [];

async function createUser(role) {
  const tag = randomBytes(6).toString('hex');
  const user = await prisma.user.create({
    data: {
      username: `bre10${role}_${tag}`,
      email: `bre10${role}_${tag}@test.com`,
      password: 'pwhash',
      firstName: 'Bre',
      lastName: 'Ten',
      money: 0,
      settings: {},
    },
  });
  createdUserIds.push(user.id);
  return user;
}

async function createPregnantMare(userId) {
  const breed = await prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: 'BRE-10 test breed' },
  });
  const fiveYearsAgo = gameCalendarDate(new Date(), -5 * 365);
  const tag = randomBytes(3).toString('hex');
  const sire = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `Bre10Sire_${tag}`,
      sex: 'Stallion',
      dateOfBirth: fiveYearsAgo,
      age: 5,
      breedId: breed.id,
      userId,
      healthStatus: 'Good',
    },
  });
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `Bre10Dam_${tag}`,
      sex: 'Mare',
      dateOfBirth: fiveYearsAgo,
      age: 5,
      breedId: breed.id,
      userId,
      healthStatus: 'Good',
      inFoalSinceDate: new Date(Date.now() - 8 * dayMs),
      pregnancySireId: sire.id,
      pregnancyFeedingsByTier: {},
    },
  });
}

afterEach(async () => {
  const ids = createdUserIds.splice(0);
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: ids }, age: 0 } }), 'foals');
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: ids } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids } } }), 'users');
  await cleanup.run();
});

describe('foal owner at birth (BRE-10, q253)', () => {
  it('a mare sold after the job read her foals to her new owner, who gets the notification', async () => {
    const seller = await createUser('s');
    const buyer = await createUser('b');
    const mare = await createPregnantMare(seller.id);

    // The job's candidate read, taken while the seller still owns her.
    const snapshot = await prisma.horse.findUnique({ where: { id: mare.id } });
    expect(snapshot.userId).toBe(seller.id);

    // The sale commits before the birth.
    await prisma.horse.update({ where: { id: mare.id }, data: { userId: buyer.id } });

    const { foal } = await createFoalFromPregnancy({
      damId: mare.id,
      options: { damSnapshot: snapshot, dueBy: new Date() },
    });

    expect(foal.userId).toBe(buyer.id);
    const buyerNotes = await prisma.notification.count({
      where: { userId: buyer.id, type: 'foalBorn' },
    });
    const sellerNotes = await prisma.notification.count({
      where: { userId: seller.id, type: 'foalBorn' },
    });
    expect(buyerNotes).toBe(1);
    expect(sellerNotes).toBe(0);
  });

  it('the nightly job gives a sold mare her foal to the owner at birth', async () => {
    const seller = await createUser('s');
    const buyer = await createUser('b');
    const mare = await createPregnantMare(seller.id);
    await prisma.horse.update({ where: { id: mare.id }, data: { userId: buyer.id } });

    await runFoalingJob();

    const foals = await prisma.horse.findMany({ where: { damId: mare.id } });
    expect(foals).toHaveLength(1);
    expect(foals[0].userId).toBe(buyer.id);
  });
});
