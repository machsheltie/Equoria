/**
 * POST /api/v1/horses/foals — own-pair breeding writes its BreedingRecord,
 * pins the sire, and honours the pending-request lock (Equoria-q4uem.9,
 * slice 2).
 *
 * Owner rulings (Stacey): 2026-10-12 — breeding a pair you own is free.
 * 2026-10-16 — S-Q7: one BreedingRecord per breeding records the breeding and
 * the stud fee paid, 0 for an own pair; S-Q4: a mare with a pending private
 * request may NOT be bred elsewhere until her owner cancels it.
 *
 * M-6 (design review): the route checks sire ownership before the claim, but
 * the claim pinned only the dam, so a stallion sold in between still sired a
 * free pregnancy for its previous owner. Reproduced with a test-held row lock
 * on the stallion (helpers/studBookingFixtures.mjs), no production seam.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  sharedBreed,
  makePlayer,
  makeHorse,
  breedOwnPair,
  moneyOf,
  seedPendingRequest,
  holdRowLockUntil,
  disconnectLockClient,
  registerCleanup,
} from './helpers/studBookingFixtures.mjs';

const PREFIX = 'TestFixture-q4uem9-ownpair';

describe('own-pair breeding: free, recorded, sire-pinned, and blocked by a pending request (Equoria-q4uem.9)', () => {
  const cleanup = createCleanupTracker();
  let breed;
  let owner;
  let stallion;
  let mare;
  const userIds = [];
  const horseIds = [];

  async function player(role, money) {
    const p = await makePlayer(PREFIX, role, money);
    userIds.push(p.user.id);
    return p;
  }

  async function horse(spec) {
    const h = await makeHorse(PREFIX, { breedId: breed.id, ...spec });
    horseIds.push(h.id);
    return h;
  }

  beforeEach(async () => {
    userIds.length = 0;
    horseIds.length = 0;
    breed = await sharedBreed();
    owner = await player('owner', 5000);
    stallion = await horse({ ownerId: owner.user.id, sex: 'Stallion' });
    mare = await horse({ ownerId: owner.user.id, sex: 'Mare' });
    registerCleanup(cleanup, { userIds, horseIds });
  });

  afterEach(async () => {
    await cleanup.run();
  });

  afterAll(async () => {
    await disconnectLockClient();
  });

  it('S-Q7: writes one OWN_PAIR COMPLETED record with fee 0; no money and no ledger rows; response shape unchanged', async () => {
    const res = await breedOwnPair(owner.token, stallion.id, mare.id);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['damId', 'foalDueDate', 'pregnancyStarted', 'sireId']);
    expect(res.body.data.pregnancyStarted).toBe(true);

    const records = await prisma.breedingRecord.findMany({ where: { damId: mare.id } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      kind: 'OWN_PAIR',
      status: 'COMPLETED',
      fee: 0,
      sireId: stallion.id,
      mareOwnerId: owner.user.id,
      stallionOwnerId: owner.user.id,
      sireName: stallion.name,
      damName: mare.name,
      mareOwnerName: owner.user.username,
      stallionOwnerName: owner.user.username,
    });
    expect(await moneyOf(owner.user.id)).toBe(5000);
    expect(await prisma.userTransaction.count({ where: { userId: owner.user.id } })).toBe(0);
  });

  it('M-6: a stallion sold after the route ownership check cannot sire the pregnancy (404, mare not in foal, no record)', async () => {
    const buyer = await player('buyer', 0);

    const res = await holdRowLockUntil(
      tx => tx.horse.update({ where: { id: stallion.id }, data: { userId: buyer.user.id } }),
      () => breedOwnPair(owner.token, stallion.id, mare.id),
    );

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Sire not found');
    const dam = await prisma.horse.findUnique({ where: { id: mare.id } });
    expect(dam.inFoalSinceDate).toBeNull();
    expect(dam.lastBredDate).toBeNull();
    expect(await prisma.breedingRecord.count({ where: { damId: mare.id } })).toBe(0);
  });

  it('S-Q4: a mare with a pending private request cannot be bred to her own stallion until the request is gone', async () => {
    const studOwner = await player('studOwner', 0);
    const privateStud = await horse({
      ownerId: studOwner.user.id,
      sex: 'Stallion',
      studStatus: 'At Private Stud',
      studFee: 10,
    });
    const pending = await seedPendingRequest({
      sire: privateStud,
      dam: mare,
      mareOwner: owner.user,
      stallionOwner: studOwner.user,
      fee: 10,
    });

    const blocked = await breedOwnPair(owner.token, stallion.id, mare.id);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('mareHasPendingRequest');
    expect((await prisma.horse.findUnique({ where: { id: mare.id } })).inFoalSinceDate).toBeNull();

    // Her owner cancels (the cancel endpoint is slice 3; the row state is what the lock reads).
    await prisma.breedingRecord.update({
      where: { id: pending.id },
      data: { status: 'CANCELLED', resolvedAt: new Date() },
    });

    const allowed = await breedOwnPair(owner.token, stallion.id, mare.id);
    expect(allowed.status).toBe(200);
  });

  it('S-Q4 race: a pending request committed while the conception waits on the mare row blocks the conception', async () => {
    const studOwner = await player('studOwner', 0);
    const privateStud = await horse({
      ownerId: studOwner.user.id,
      sex: 'Stallion',
      studStatus: 'At Private Stud',
      studFee: 10,
    });

    // The request transaction holds the mare row (its dam pin) and inserts its
    // PENDING row; the conception blocks on the mare row and must see the row
    // once the request commits.
    const res = await holdRowLockUntil(
      async tx => {
        await tx.horse.update({ where: { id: mare.id }, data: { userId: owner.user.id } });
        await tx.breedingRecord.create({
          data: {
            kind: 'PRIVATE_STUD',
            status: 'PENDING',
            fee: 10,
            sireId: privateStud.id,
            damId: mare.id,
            mareOwnerId: owner.user.id,
            stallionOwnerId: studOwner.user.id,
            sireName: privateStud.name,
            damName: mare.name,
            mareOwnerName: owner.user.username,
            stallionOwnerName: studOwner.user.username,
          },
        });
      },
      () => breedOwnPair(owner.token, stallion.id, mare.id),
    );

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('mareHasPendingRequest');
    expect((await prisma.horse.findUnique({ where: { id: mare.id } })).inFoalSinceDate).toBeNull();
  });
});
