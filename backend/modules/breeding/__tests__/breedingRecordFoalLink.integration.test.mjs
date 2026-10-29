/**
 * A breeding record names the foal it produced (Equoria-wnlf0, audit BRE-11).
 *
 * Defect: a COMPLETED breeding record (written at conception by an own pair,
 * a public stud booking or an approved private request) was never linked to
 * the foal born seven days later; the foaling transaction persisted nothing
 * about the breeding. Done = every foal born from a conception has a linked
 * record.
 *
 * Conception runs through the real HTTP routes; the birth runs the same
 * createFoalFromPregnancy the nightly foaling job runs.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createFoalFromPregnancy } from '../../horses/index.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  sharedBreed,
  makePlayer,
  makeHorse,
  bookStud,
  breedOwnPair,
  disconnectLockClient,
  registerCleanup,
} from './helpers/studBookingFixtures.mjs';

const PREFIX = 'TestFixture-wnlf0-foallink';
const FEE = 300;

describe('a breeding record is linked to the foal it produced (Equoria-wnlf0)', () => {
  const cleanup = createCleanupTracker();
  let breed;
  let mareOwner;
  let studOwner;
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
    mareOwner = await player('mareOwner', 5000);
    studOwner = await player('studOwner', 100);
    // Foals, found by their dam, go before the horses they reference (records SET NULL).
    cleanup.add(async () => {
      const foals = await prisma.horse.findMany({
        where: { damId: { in: horseIds } },
        select: { id: true },
      });
      const foalIds = foals.map(f => f.id);
      await prisma.foalTrainingHistory.deleteMany({ where: { horseId: { in: foalIds } } });
      await prisma.foalDevelopment.deleteMany({ where: { foalId: { in: foalIds } } });
      await prisma.foalActivity.deleteMany({ where: { foalId: { in: foalIds } } });
      await prisma.groomAssignment.deleteMany({ where: { foalId: { in: foalIds } } });
      await prisma.horse.deleteMany({ where: { id: { in: foalIds } } });
    }, 'foals');
    registerCleanup(cleanup, { userIds, horseIds });
  });

  afterEach(async () => {
    await cleanup.run();
  });

  afterAll(async () => {
    await disconnectLockClient();
  });

  const foalFor = async mare => (await createFoalFromPregnancy({ damId: mare.id })).foal;

  it('own pair: the foal born of the breeding is on its record', async () => {
    const sire = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion' });
    const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

    const res = await breedOwnPair(mareOwner.token, sire.id, mare.id);
    expect(res.status).toBe(200);

    const foal = await foalFor(mare);

    const records = await prisma.breedingRecord.findMany({ where: { damId: mare.id } });
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe('OWN_PAIR');
    expect(records[0].foalId).toBe(foal.id);
  });

  it('public stud: the foal born of the booking is on its record', async () => {
    const stud = await horse({
      ownerId: studOwner.user.id,
      sex: 'Stallion',
      studStatus: 'At Public Stud',
      studFee: FEE,
    });
    const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

    const res = await bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });
    expect(res.status).toBe(200);

    const foal = await foalFor(mare);

    const record = await prisma.breedingRecord.findFirst({ where: { damId: mare.id } });
    expect(record.kind).toBe('PUBLIC_STUD');
    expect(record.foalId).toBe(foal.id);
  });

  it('an earlier breeding of the same pair keeps its own foal; the new foal goes on the new record', async () => {
    const sire = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion' });
    const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });
    const olderFoal = await horse({ ownerId: mareOwner.user.id, sex: 'Filly', age: 1 });
    const older = await prisma.breedingRecord.create({
      data: {
        kind: 'OWN_PAIR',
        status: 'COMPLETED',
        fee: 0,
        sireId: sire.id,
        damId: mare.id,
        mareOwnerId: mareOwner.user.id,
        stallionOwnerId: mareOwner.user.id,
        sireName: sire.name,
        damName: mare.name,
        mareOwnerName: mareOwner.user.username,
        stallionOwnerName: mareOwner.user.username,
        resolvedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        foalId: olderFoal.id,
      },
    });

    const res = await breedOwnPair(mareOwner.token, sire.id, mare.id);
    expect(res.status).toBe(200);
    const foal = await foalFor(mare);

    expect((await prisma.breedingRecord.findUnique({ where: { id: older.id } })).foalId).toBe(olderFoal.id);
    const newer = await prisma.breedingRecord.findFirst({
      where: { damId: mare.id, id: { not: older.id } },
    });
    expect(newer.foalId).toBe(foal.id);
  });
});
