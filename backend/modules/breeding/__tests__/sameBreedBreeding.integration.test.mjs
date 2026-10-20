/**
 * Same-breed breeding: a mare and a stallion must be the same breed, and the
 * foal is always born that breed (Equoria-5nwwf).
 *
 * Owner ruling (Stacey, 2026-10-20): sire and dam MUST share a breed; the foal
 * automatically gets it; players never choose or change a breed; there are no
 * grade horses. Authorised crossbreeds are a later owner design, so nothing
 * here (or in the code) leaves a hook for them. Gaited is inherited only
 * through the breed, so this rule also keeps Gaited inside its breed.
 *
 * Every way a pregnancy can begin is covered: an own pair, a public stud
 * booking, a private stud request, and the stallion owner's approval of a
 * private stud request. Then the foal: whatever breed a client sends, and
 * whatever a pre-ruling pregnancy still carries in `pendingFoalBreedId`, the
 * foal is born its parents' breed.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  sharedBreed,
  makePlayer,
  makeHorse,
  bookStud,
  breedOwnPair,
  requestPrivateStud,
  actOnRequest,
  seedPendingRequest,
  sendJson,
  moneyOf,
  disconnectLockClient,
  registerCleanup,
} from './helpers/studBookingFixtures.mjs';

const PREFIX = 'TestFixture-5nwwf-samebreed';
const FEE = 400;
const NOT_THE_SAME_BREED = /must be the same breed to breed/;

async function otherBreed() {
  // 'Abaga' has a real entry in backend/data/breedProfiles.json, as foaling needs.
  return prisma.breed.upsert({
    where: { name: 'Abaga' },
    update: {},
    create: { name: 'Abaga', description: 'Shared test breed' },
  });
}

describe('sire and dam must be the same breed; the foal is born that breed (Equoria-5nwwf)', () => {
  const cleanup = createCleanupTracker();
  let breed; // Thoroughbred
  let otherBreedRow; // Abaga
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

  const dam = id => prisma.horse.findUnique({ where: { id } });

  async function expectNotPregnant(mare) {
    const row = await dam(mare.id);
    expect(row.inFoalSinceDate).toBeNull();
    expect(row.pregnancySireId).toBeNull();
    expect(row.lastBredDate).toBeNull();
    expect(await prisma.breedingRecord.count({ where: { damId: mare.id } })).toBe(0);
  }

  beforeEach(async () => {
    userIds.length = 0;
    horseIds.length = 0;
    breed = await sharedBreed();
    otherBreedRow = await otherBreed();
    mareOwner = await player('mareOwner', 5000);
    studOwner = await player('studOwner', 100);
    // Foals the suite makes, found by their dam, go before the horses they reference.
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

  describe('every way to start a pregnancy refuses a pair of two breeds', () => {
    it('own pair: POST /horses/foals answers 400 in plain words and starts nothing', async () => {
      const sire = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion', breedId: otherBreedRow.id });
      const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

      const res = await breedOwnPair(mareOwner.token, sire.id, mare.id);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(NOT_THE_SAME_BREED);
      await expectNotPregnant(mare);
    });

    it('own pair: a breedId in the request cannot make two breeds a pair', async () => {
      const sire = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion', breedId: otherBreedRow.id });
      const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

      for (const breedId of [breed.id, otherBreedRow.id]) {
        const res = await sendJson('post', '/api/v1/horses/foals', mareOwner.token, {
          sireId: sire.id,
          damId: mare.id,
          breedId,
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(NOT_THE_SAME_BREED);
      }
      await expectNotPregnant(mare);
    });

    it("own pair: a stallion with no breed on record is not the mare's breed", async () => {
      const sire = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion', breedId: null });
      const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

      const res = await breedOwnPair(mareOwner.token, sire.id, mare.id);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(NOT_THE_SAME_BREED);
      await expectNotPregnant(mare);
    });

    it('public stud: the booking answers 400, charges nothing and starts nothing', async () => {
      const stud = await horse({
        ownerId: studOwner.user.id,
        sex: 'Stallion',
        breedId: otherBreedRow.id,
        studStatus: 'At Public Stud',
        studFee: FEE,
      });
      const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

      const res = await bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(NOT_THE_SAME_BREED);
      expect(await moneyOf(mareOwner.user.id)).toBe(5000);
      expect(await moneyOf(studOwner.user.id)).toBe(100);
      await expectNotPregnant(mare);
    });

    it('private stud: the request answers 400 and no request is made', async () => {
      const stud = await horse({
        ownerId: studOwner.user.id,
        sex: 'Stallion',
        breedId: otherBreedRow.id,
        studStatus: 'At Private Stud',
        studFee: FEE,
      });
      const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

      const res = await requestPrivateStud(mareOwner.token, stud.id, {
        damId: mare.id,
        expectedStudFee: FEE,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(NOT_THE_SAME_BREED);
      await expectNotPregnant(mare);
    });

    it('private stud approval: a request made before the ruling is declined, charges nothing and starts nothing', async () => {
      const stud = await horse({
        ownerId: studOwner.user.id,
        sex: 'Stallion',
        breedId: otherBreedRow.id,
        studStatus: 'At Private Stud',
        studFee: FEE,
      });
      const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });
      const pending = await seedPendingRequest({
        sire: stud,
        dam: mare,
        mareOwner: mareOwner.user,
        stallionOwner: studOwner.user,
        fee: FEE,
      });

      const res = await actOnRequest(studOwner.token, pending.id, 'approve');

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('REQUEST_DECLINED');
      expect(res.body.message).toMatch(NOT_THE_SAME_BREED);
      const record = await prisma.breedingRecord.findUnique({ where: { id: pending.id } });
      expect(record.status).toBe('DECLINED');
      expect(await moneyOf(mareOwner.user.id)).toBe(5000);
      expect(await moneyOf(studOwner.user.id)).toBe(100);
      const row = await dam(mare.id);
      expect(row.inFoalSinceDate).toBeNull();
      expect(row.pregnancySireId).toBeNull();
    });

    it('a same-breed pair still breeds (the rule refuses only two breeds)', async () => {
      const sire = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion', breedId: otherBreedRow.id });
      const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare', breedId: otherBreedRow.id });

      const res = await breedOwnPair(mareOwner.token, sire.id, mare.id);

      expect(res.status).toBe(200);
      expect((await dam(mare.id)).pregnancySireId).toBe(sire.id);
    });
  });

  describe("the foal is born its parents' breed", () => {
    // Foaling goes through POST /horses/:id/foal-now (a test-harness route that runs
    // the same createFoalFromPregnancy the nightly job runs).
    const foalNow = mare => sendJson('post', `/api/v1/horses/${mare.id}/foal-now`, mareOwner.token, {});

    it("ignores a breedId sent with the request: the pregnancy stores no foal breed and the foal is the parents' breed", async () => {
      const sire = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion' });
      const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

      const res = await sendJson('post', '/api/v1/horses/foals', mareOwner.token, {
        sireId: sire.id,
        damId: mare.id,
        breedId: otherBreedRow.id,
      });

      expect(res.status).toBe(200);
      expect((await dam(mare.id)).pendingFoalBreedId).toBeNull();

      const foaled = await foalNow(mare);
      expect(foaled.status).toBe(201);
      const foal = await prisma.horse.findUnique({ where: { id: foaled.body.data.foalId } });
      expect(foal.breedId).toBe(breed.id);
      expect(foal.sireId).toBe(sire.id);
      expect(foal.damId).toBe(mare.id);
    });

    it('ignores a foal breed left on a mare by a pregnancy that began before the ruling', async () => {
      const sire = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion' });
      const mare = await horse({
        ownerId: mareOwner.user.id,
        sex: 'Mare',
        inFoalSinceDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        pregnancySireId: sire.id,
        pendingFoalBreedId: otherBreedRow.id,
      });

      const foaled = await foalNow(mare);

      expect(foaled.status).toBe(201);
      const foal = await prisma.horse.findUnique({ where: { id: foaled.body.data.foalId } });
      expect(foal.breedId).toBe(breed.id);
      expect((await dam(mare.id)).pendingFoalBreedId).toBeNull();
    });
  });

  describe("no surface chooses a foal's breed", () => {
    it("the colour prediction for a pair uses the dam's breed whatever foalBreedId is sent", async () => {
      const sire = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion' });
      const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

      const plain = await sendJson('post', '/api/v1/horses/breeding/color-prediction', mareOwner.token, {
        sireId: sire.id,
        damId: mare.id,
      });
      const withBreed = await sendJson('post', '/api/v1/horses/breeding/color-prediction', mareOwner.token, {
        sireId: sire.id,
        damId: mare.id,
        foalBreedId: otherBreedRow.id,
      });

      // A foalBreedId is neither read nor validated any more.
      const nonsense = await sendJson('post', '/api/v1/horses/breeding/color-prediction', mareOwner.token, {
        sireId: sire.id,
        damId: mare.id,
        foalBreedId: -5,
      });

      expect(plain.status).toBe(200);
      expect(withBreed.status).toBe(200);
      expect(withBreed.body.data).toEqual(plain.body.data);
      expect(nonsense.status).toBe(200);
    });
  });
});
