/**
 * Breeding age window: mares and stallions breed only at 3-20 game-years,
 * inclusive (owner ruling, Stacey 2026-10-23, Equoria-e7tgc.4).
 *
 * The rule lives in the one shared validator (validateBreedingPair), so it is
 * proved here through two real breeding paths: own-pair breeding
 * (POST /horses/foals) at ages 2, 3, 20 and 21 for each sex, and a public stud
 * booking (POST /studs/:sireId/bookings), where a refused retired horse must
 * also leave both balances and the ledger untouched.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import {
  sharedBreed,
  makePlayer,
  makeHorse,
  bookStud,
  breedOwnPair,
  moneyOf,
  disconnectLockClient,
  registerCleanup,
} from './helpers/studBookingFixtures.mjs';

const PREFIX = 'TestFixture-e7tgc4-ages';
const FEE = 300;

describe('mares and stallions breed only at ages 3-20 (Equoria-e7tgc.4)', () => {
  const cleanup = createCleanupTracker();
  let breed;
  const userIds = [];
  const horseIds = [];

  async function player(role, money) {
    const p = await makePlayer(PREFIX, role, money);
    userIds.push(p.user.id);
    return p;
  }

  async function horse(ownerId, sex, ageYears, extra = {}) {
    const h = await makeHorse(PREFIX, {
      ownerId,
      sex,
      breedId: breed.id,
      dateOfBirth: birthDateForAge(ageYears),
      age: ageYears,
      ...extra,
    });
    horseIds.push(h.id);
    return h;
  }

  async function inFoal(horseId) {
    const row = await prisma.horse.findUnique({ where: { id: horseId }, select: { inFoalSinceDate: true } });
    return row.inFoalSinceDate !== null;
  }

  beforeEach(async () => {
    registerCleanup(cleanup, { userIds, horseIds });
    userIds.length = 0;
    horseIds.length = 0;
    breed = await sharedBreed();
  });

  afterEach(async () => {
    await cleanup.run();
  });

  afterAll(async () => {
    await disconnectLockClient();
  });

  describe('own pair (POST /horses/foals)', () => {
    it.each([
      ['Stallion', 2, 400, /too young to breed/],
      ['Stallion', 3, 200, null],
      ['Stallion', 20, 200, null],
      ['Stallion', 21, 400, /is retired and can no longer breed/],
      ['Mare', 2, 400, /too young to breed/],
      ['Mare', 3, 200, null],
      ['Mare', 20, 200, null],
      ['Mare', 21, 400, /is retired and can no longer breed/],
    ])('a %s aged %i -> %i', async (sex, ageYears, status, message) => {
      const owner = await player('owner', 1000);
      const sire = await horse(owner.user.id, 'Stallion', sex === 'Stallion' ? ageYears : 6);
      const dam = await horse(owner.user.id, 'Mare', sex === 'Mare' ? ageYears : 6);

      const res = await breedOwnPair(owner.token, sire.id, dam.id);

      expect(res.status).toBe(status);
      if (status === 200) {
        expect(res.body.data.pregnancyStarted).toBe(true);
        expect(await inFoal(dam.id)).toBe(true);
      } else {
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(message);
        expect(await inFoal(dam.id)).toBe(false);
      }
    });
  });

  describe('public stud booking (POST /studs/:sireId/bookings)', () => {
    it.each([
      ['a 21-year-old stud', 21, 6],
      ['a 21-year-old mare', 6, 21],
    ])('refuses %s and moves no money', async (_label, studAge, mareAge) => {
      const mareOwner = await player('mareOwner', 5000);
      const studOwner = await player('studOwner', 100);
      const stud = await horse(studOwner.user.id, 'Stallion', studAge, {
        studStatus: 'At Public Stud',
        studFee: FEE,
      });
      const mare = await horse(mareOwner.user.id, 'Mare', mareAge);

      const res = await bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/is retired and can no longer breed/);
      expect(await inFoal(mare.id)).toBe(false);
      expect(await moneyOf(mareOwner.user.id)).toBe(5000);
      expect(await moneyOf(studOwner.user.id)).toBe(100);
      expect(await prisma.userTransaction.count({ where: { userId: { in: userIds } } })).toBe(0);
    });

    it('books a 20-year-old stud to a 20-year-old mare and moves the fee once', async () => {
      const mareOwner = await player('mareOwner', 5000);
      const studOwner = await player('studOwner', 100);
      const stud = await horse(studOwner.user.id, 'Stallion', 20, {
        studStatus: 'At Public Stud',
        studFee: FEE,
      });
      const mare = await horse(mareOwner.user.id, 'Mare', 20);

      const res = await bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });

      expect(res.status).toBe(200);
      expect(await inFoal(mare.id)).toBe(true);
      expect(await moneyOf(mareOwner.user.id)).toBe(5000 - FEE);
      expect(await moneyOf(studOwner.user.id)).toBe(100 + FEE);
    });
  });
});
