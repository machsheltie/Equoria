/**
 * POST /api/v1/studs/:sireId/bookings — public stud booking with the stud-fee
 * transfer (Equoria-q4uem.9, slice 2).
 *
 * Owner rulings (Stacey): 2026-10-12 — breeding a mare to ANOTHER player's
 * stallion charges that stallion's player-set studFee, paid by the mare owner
 * to the stallion owner; breeding your own pair is free. 2026-10-15 — Public
 * Stud completes automatically; S1 the fee shown at confirm is a contract
 * (changed fee -> 409 with the new fee); S2 no limit on a stallion; S4 fee 0 is
 * a free stud; S5 notify the stallion owner. 2026-10-16 — S-Q4 a mare with a
 * pending private request may not be bred elsewhere; S-Q7 one BreedingRecord
 * per breeding with the stud fee paid.
 *
 * Money is the core risk: every case asserts both balances, the ledger and the
 * mare's pregnancy state, so a partial commit (a credit without a pregnancy, a
 * debit without a credit) cannot pass.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures. Interleavings use a
 * test-held Postgres row lock (helpers/studBookingFixtures.mjs), not a seam.
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
  moneyOf,
  seedPendingRequest,
  holdRowLockUntil,
  disconnectLockClient,
  registerCleanup,
} from './helpers/studBookingFixtures.mjs';

const PREFIX = 'TestFixture-q4uem9-pubstud';
const FEE = 1234;
// Every 404 these endpoints send carries the AppError body shape (status: 'fail'),
// identical across causes so ids cannot be probed.
const UNAVAILABLE_404 = { success: false, message: 'Stallion not available at stud', status: 'fail' };

describe('public stud booking moves the stud fee atomically with the pregnancy (Equoria-q4uem.9)', () => {
  const cleanup = createCleanupTracker();
  let breed;
  let mareOwner; // A
  let studOwner; // B
  let stud;
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
    mareOwner = await player('mareOwner', 5000);
    studOwner = await player('studOwner', 100);
    stud = await horse({ ownerId: studOwner.user.id, sex: 'Stallion', studStatus: 'At Public Stud', studFee: FEE });
    mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });
    registerCleanup(cleanup, { userIds, horseIds });
  });

  afterEach(async () => {
    await cleanup.run();
  });

  afterAll(async () => {
    await disconnectLockClient();
  });

  it('conserves money: the mare owner pays exactly the stored fee to the stallion owner, once, with the pregnancy', async () => {
    const res = await bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      pregnancyStarted: true,
      damId: mare.id,
      sireId: stud.id,
      studFeePaid: FEE,
      newBalance: 5000 - FEE,
      stallionOwner: { username: studOwner.user.username },
    });
    expect(typeof res.body.data.foalDueDate).toBe('string');
    expect(Number.isInteger(res.body.data.recordId)).toBe(true);

    expect(await moneyOf(mareOwner.user.id)).toBe(5000 - FEE);
    expect(await moneyOf(studOwner.user.id)).toBe(100 + FEE);

    const paid = await prisma.userTransaction.findMany({ where: { userId: mareOwner.user.id } });
    const received = await prisma.userTransaction.findMany({ where: { userId: studOwner.user.id } });
    expect(paid).toHaveLength(1);
    expect(paid[0]).toMatchObject({ type: 'debit', amount: FEE, category: 'studFeePaid' });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: 'credit', amount: FEE, category: 'studFeeReceived' });

    const dam = await prisma.horse.findUnique({ where: { id: mare.id } });
    expect(dam.inFoalSinceDate).not.toBeNull();
    expect(dam.pregnancySireId).toBe(stud.id);
    expect(dam.lastBredDate).not.toBeNull();

    const records = await prisma.breedingRecord.findMany({ where: { damId: mare.id } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: res.body.data.recordId,
      kind: 'PUBLIC_STUD',
      status: 'COMPLETED',
      fee: FEE,
      sireId: stud.id,
      mareOwnerId: mareOwner.user.id,
      stallionOwnerId: studOwner.user.id,
      sireName: stud.name,
      damName: mare.name,
    });

    const notes = await prisma.notification.findMany({ where: { userId: studOwner.user.id, type: 'studBooked' } });
    expect(notes).toHaveLength(1);
  });

  /**
   * Both bookings are held at the mare row (the test owns its lock) until BOTH
   * are blocked: the first on the mare row, the second behind the first's
   * debit. On release the first conceives; the second has already moved money
   * by the time it reaches the dam claim, so only the guarded claim (and the
   * rollback it throws) keeps the mare owner from paying twice.
   */
  async function doubleSubmitHeldAtMare() {
    return holdRowLockUntil(
      tx => tx.horse.update({ where: { id: mare.id }, data: { name: mare.name } }),
      () =>
        Promise.all([
          bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE }),
          bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE }),
        ]),
      { blockedSessions: 2 },
    );
  }

  function expectOneBookingCharged(results, mareOwnerStart) {
    const ok = results.filter(r => r.status === 200);
    const lost = results.filter(r => r.status !== 200);
    expect(ok).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0].status).toBe(400);
    expect(lost[0].body.message).toBe(`${mare.name} is already in foal.`);
    return Promise.all([
      moneyOf(mareOwner.user.id),
      moneyOf(studOwner.user.id),
      prisma.userTransaction.count({ where: { userId: mareOwner.user.id, category: 'studFeePaid' } }),
      prisma.userTransaction.count({ where: { userId: studOwner.user.id, category: 'studFeeReceived' } }),
      prisma.breedingRecord.count({ where: { damId: mare.id } }),
    ]).then(([a, b, paid, received, records]) => {
      expect(a).toBe(mareOwnerStart - FEE);
      expect(b).toBe(100 + FEE);
      expect(paid).toBe(1);
      expect(received).toBe(1);
      expect(records).toBe(1);
    });
  }

  it('double submit held at the mare row: the loser moved money before losing the dam claim, and it all rolls back', async () => {
    const results = await doubleSubmitHeldAtMare();
    await expectOneBookingCharged(results, 5000);
  });

  it('M-d double submit with exactly one fee in the bank: the loser answers "already in foal", not insufficient funds', async () => {
    await prisma.user.update({ where: { id: mareOwner.user.id }, data: { money: FEE } });

    const results = await doubleSubmitHeldAtMare();

    await expectOneBookingCharged(results, FEE);
    expect(results.some(r => r.body.code === 'insufficientFunds')).toBe(false);
  });

  it('the mare is sold while the booking waits on her row: 404 Mare not found, nothing moves', async () => {
    const buyer = await player('mareBuyer', 0);

    const res = await holdRowLockUntil(
      tx => tx.horse.update({ where: { id: mare.id }, data: { userId: buyer.user.id } }),
      () => bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE }),
    );

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Mare not found', status: 'fail' });
    expect(await moneyOf(mareOwner.user.id)).toBe(5000);
    expect(await moneyOf(studOwner.user.id)).toBe(100);
    expect(await prisma.userTransaction.count({ where: { userId: { in: userIds } } })).toBe(0);
    const dam = await prisma.horse.findUnique({ where: { id: mare.id } });
    expect(dam.inFoalSinceDate).toBeNull();
    expect(await prisma.breedingRecord.count({ where: { damId: mare.id } })).toBe(0);
  });

  it("M-b: a mare whose id is lower than the stallion's books too (the dam-first lock branch)", async () => {
    const laterStud = await horse({
      ownerId: studOwner.user.id,
      sex: 'Stallion',
      studStatus: 'At Public Stud',
      studFee: FEE,
    });
    expect(mare.id).toBeLessThan(laterStud.id);

    const res = await bookStud(mareOwner.token, laterStud.id, { damId: mare.id, expectedStudFee: FEE });

    expect(res.status).toBe(200);
    expect(await moneyOf(mareOwner.user.id)).toBe(5000 - FEE);
    expect(await moneyOf(studOwner.user.id)).toBe(100 + FEE);
    expect((await prisma.horse.findUnique({ where: { id: mare.id } })).pregnancySireId).toBe(laterStud.id);
  });

  it('S2: two mare owners book one stallion at once; both succeed and money is conserved', async () => {
    const otherOwner = await player('mareOwner2', 3000);
    const otherMare = await horse({ ownerId: otherOwner.user.id, sex: 'Mare' });
    const before =
      (await moneyOf(mareOwner.user.id)) + (await moneyOf(otherOwner.user.id)) + (await moneyOf(studOwner.user.id));

    const [a, b] = await Promise.all([
      bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE }),
      bookStud(otherOwner.token, stud.id, { damId: otherMare.id, expectedStudFee: FEE }),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await moneyOf(studOwner.user.id)).toBe(100 + 2 * FEE);
    const after =
      (await moneyOf(mareOwner.user.id)) + (await moneyOf(otherOwner.user.id)) + (await moneyOf(studOwner.user.id));
    expect(after).toBe(before);
  });

  it('own pair and a stud booking both held at the mare row: exactly one pregnancy, money only if the booking won', async () => {
    const ownStallion = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion' });

    const [own, booked] = await holdRowLockUntil(
      tx => tx.horse.update({ where: { id: mare.id }, data: { name: mare.name } }),
      () =>
        Promise.all([
          breedOwnPair(mareOwner.token, ownStallion.id, mare.id),
          bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE }),
        ]),
      { blockedSessions: 2 },
    );

    expect([own.status, booked.status].filter(s => s === 200)).toHaveLength(1);
    expect([own.status, booked.status].filter(s => s === 400)).toHaveLength(1);
    const dam = await prisma.horse.findUnique({ where: { id: mare.id } });
    if (booked.status === 200) {
      expect(dam.pregnancySireId).toBe(stud.id);
      expect(await moneyOf(mareOwner.user.id)).toBe(5000 - FEE);
      expect(await moneyOf(studOwner.user.id)).toBe(100 + FEE);
    } else {
      expect(dam.pregnancySireId).toBe(ownStallion.id);
      expect(await moneyOf(mareOwner.user.id)).toBe(5000);
      expect(await moneyOf(studOwner.user.id)).toBe(100);
      expect(await prisma.userTransaction.count({ where: { userId: { in: userIds } } })).toBe(0);
    }
    expect(await prisma.breedingRecord.count({ where: { damId: mare.id } })).toBe(1);
  });

  it('insufficient funds: 400 and nothing changes (no money, no pregnancy, no cooldown, no record)', async () => {
    await prisma.user.update({ where: { id: mareOwner.user.id }, data: { money: FEE - 1 } });

    const res = await bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('insufficientFunds');
    expect(await moneyOf(mareOwner.user.id)).toBe(FEE - 1);
    expect(await moneyOf(studOwner.user.id)).toBe(100);
    const dam = await prisma.horse.findUnique({ where: { id: mare.id } });
    expect(dam.inFoalSinceDate).toBeNull();
    expect(dam.lastBredDate).toBeNull();
    expect(await prisma.breedingRecord.count({ where: { damId: mare.id } })).toBe(0);
    expect(await prisma.userTransaction.count({ where: { userId: { in: userIds } } })).toBe(0);
  });

  it('S1: a stale expectedStudFee is refused with 409 and the current fee, and nothing changes', async () => {
    const res = await bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE - 100 });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'STUD_FEE_CHANGED', data: { studFee: FEE } });
    expect(await moneyOf(mareOwner.user.id)).toBe(5000);
    expect((await prisma.horse.findUnique({ where: { id: mare.id } })).inFoalSinceDate).toBeNull();
  });

  describe('the listing changes after the request read it (I-1: no money survives a failed pin)', () => {
    it('unlisted mid-flow: rolls back the debit and credit and answers the byte-identical unavailable 404', async () => {
      const res = await holdRowLockUntil(
        tx => tx.horse.update({ where: { id: stud.id }, data: { studStatus: 'Not at Stud', studFee: 0 } }),
        () => bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE }),
      );

      expect(res.status).toBe(404);
      expect(res.body).toEqual(UNAVAILABLE_404);
      expect(await moneyOf(mareOwner.user.id)).toBe(5000);
      expect(await moneyOf(studOwner.user.id)).toBe(100);
      expect((await prisma.horse.findUnique({ where: { id: mare.id } })).inFoalSinceDate).toBeNull();
      expect(await prisma.userTransaction.count({ where: { userId: { in: userIds } } })).toBe(0);
    });

    it('repriced mid-flow: rolls back and answers 409 STUD_FEE_CHANGED with the NEW fee', async () => {
      const res = await holdRowLockUntil(
        tx => tx.horse.update({ where: { id: stud.id }, data: { studFee: FEE + 500 } }),
        () => bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE }),
      );

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'STUD_FEE_CHANGED', data: { studFee: FEE + 500 } });
      expect(await moneyOf(mareOwner.user.id)).toBe(5000);
      expect(await moneyOf(studOwner.user.id)).toBe(100);
      expect((await prisma.horse.findUnique({ where: { id: mare.id } })).inFoalSinceDate).toBeNull();
    });

    it('sold mid-flow: the previous owner is never paid and the request answers the unavailable 404', async () => {
      const newOwner = await player('newOwner', 0);
      const res = await holdRowLockUntil(
        tx =>
          tx.horse.update({
            where: { id: stud.id },
            data: { userId: newOwner.user.id, studStatus: 'Not at Stud', studFee: 0 },
          }),
        () => bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE }),
      );

      expect(res.status).toBe(404);
      expect(res.body).toEqual(UNAVAILABLE_404);
      expect(await moneyOf(studOwner.user.id)).toBe(100);
      expect(await moneyOf(newOwner.user.id)).toBe(0);
      expect(await moneyOf(mareOwner.user.id)).toBe(5000);
    });
  });

  it('S4 + legacy null fee: a listed stallion with studFee null books free (no money, no ledger, record fee 0)', async () => {
    await prisma.horse.update({ where: { id: stud.id }, data: { studFee: null } });

    const res = await bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data.studFeePaid).toBe(0);
    expect(await moneyOf(mareOwner.user.id)).toBe(5000);
    expect(await moneyOf(studOwner.user.id)).toBe(100);
    expect(await prisma.userTransaction.count({ where: { userId: { in: userIds } } })).toBe(0);
    const record = await prisma.breedingRecord.findFirst({ where: { damId: mare.id } });
    expect(record).toMatchObject({ kind: 'PUBLIC_STUD', status: 'COMPLETED', fee: 0 });
  });

  it('a stallion that is missing and one that is not at stud answer the same 404', async () => {
    const unlisted = await horse({ ownerId: studOwner.user.id, sex: 'Stallion' });
    const missingId = 2147483000;

    const a = await bookStud(mareOwner.token, unlisted.id, { damId: mare.id, expectedStudFee: 0 });
    const b = await bookStud(mareOwner.token, missingId, { damId: mare.id, expectedStudFee: 0 });

    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(a.body).toEqual(UNAVAILABLE_404);
    expect(b.body).toEqual(a.body);
  });

  it("someone else's mare: 404 Mare not found, no money moves", async () => {
    const res = await bookStud(studOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Mare not found', status: 'fail' });
    expect(await moneyOf(mareOwner.user.id)).toBe(5000);
  });

  it('own stallion on the stud endpoint: 400 OWN_STALLION (own pairs breed free through /horses/foals)', async () => {
    const ownStud = await horse({
      ownerId: mareOwner.user.id,
      sex: 'Stallion',
      studStatus: 'At Public Stud',
      studFee: 50,
    });

    const res = await bookStud(mareOwner.token, ownStud.id, { damId: mare.id, expectedStudFee: 50 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('OWN_STALLION');
    expect(await moneyOf(mareOwner.user.id)).toBe(5000);
  });

  it('eligibility matches /horses/foals: a mare on cooldown is refused with the same message', async () => {
    const lastBredDate = new Date();
    await prisma.horse.update({ where: { id: mare.id }, data: { lastBredDate } });
    const ownStallion = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion' });

    const viaStud = await bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });
    const viaOwn = await breedOwnPair(mareOwner.token, ownStallion.id, mare.id);

    expect(viaStud.status).toBe(400);
    expect(viaOwn.status).toBe(400);
    expect(viaStud.body.message).toBe(viaOwn.body.message);
    expect(viaStud.body.message).toMatch(/breeding cooldown/);
    expect(await moneyOf(mareOwner.user.id)).toBe(5000);
  });

  it('S-Q4: a mare with a pending private request cannot be booked to a public stud (409, no money moves)', async () => {
    const privateOwner = await player('privateOwner', 0);
    const privateStud = await horse({
      ownerId: privateOwner.user.id,
      sex: 'Stallion',
      studStatus: 'At Private Stud',
      studFee: 10,
    });
    await seedPendingRequest({
      sire: privateStud,
      dam: mare,
      mareOwner: mareOwner.user,
      stallionOwner: privateOwner.user,
      fee: 10,
    });

    const res = await bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('MARE_HAS_PENDING_REQUEST');
    expect(await moneyOf(mareOwner.user.id)).toBe(5000);
    expect(await moneyOf(studOwner.user.id)).toBe(100);
    expect((await prisma.horse.findUnique({ where: { id: mare.id } })).inFoalSinceDate).toBeNull();
  });
});
