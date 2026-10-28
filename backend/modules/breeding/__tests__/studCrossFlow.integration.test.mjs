/**
 * Cross-flow stud hardening (Equoria-e7tgc.8): the races and money invariants
 * no single stud endpoint owns.
 *   C4      a private approval and a public booking of the SAME mare race;
 *   audit   one full lifecycle across three players conserves money, pairs
 *           every ledger row and leaves no orphan request;
 *   hammer  approve + public booking + unlist on overlapping rows, repeated,
 *           never surface a deadlock, a 5xx or a broken invariant.
 *
 * Owner rulings (Stacey): 2026-10-02/10-12 the stallion owner sets the fee and
 * it moves from the mare owner to him; cooldowns are for mares only.
 * 2026-10-15 S6 a private request pins its fee; money moves at approval.
 * 2026-10-16 S-Q2 unlisting / switching Private -> Public declines pending
 * requests; S-Q4 a mare with a pending request cannot be bred elsewhere;
 * cooldown is 7 days, stamped as the Eastern game date.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures. The C4 orders are
 * pinned with a test-held row lock (holdRowLockUntil), never a sleep. The
 * hammer runs real concurrency and asserts invariants that hold in every
 * order.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { pendingRequestMessage } from '../../horses/index.mjs';
import {
  sharedBreed,
  makePlayer,
  makeHorse,
  bookStud,
  moneyOf,
  holdRowLockUntil,
  disconnectLockClient,
  registerCleanup,
  requestPrivateStud,
  actOnRequest,
  listAtStud,
  unlistAtStud,
} from './helpers/studBookingFixtures.mjs';

// The answer to any action on a request that is no longer pending. Matched
// by its message: the stud codes still await the camelCase conversion
// (Equoria-pjvp8), and a new file may not add snake-case names.
const notPendingMessage = 'This request has already been answered or withdrawn.';
const prefix = 'TestFixture-e7tgc8-crossflow';
const hammerRounds = 6;

describe('stud cross-flow hardening (Equoria-e7tgc.8)', () => {
  const cleanup = createCleanupTracker();
  let breed;
  const userIds = [];
  const horseIds = [];

  async function player(role, money) {
    const p = await makePlayer(prefix, role, money);
    userIds.push(p.user.id);
    return p;
  }

  async function horse(spec) {
    const h = await makeHorse(prefix, { breedId: breed.id, ...spec });
    horseIds.push(h.id);
    return h;
  }

  async function sendRequest(owner, sire, dam, fee) {
    const res = await requestPrivateStud(owner.token, sire.id, { damId: dam.id, expectedStudFee: fee });
    expect(res.status).toBe(201);
    return res.body.data.requestId;
  }

  const horseRow = id => prisma.horse.findUnique({ where: { id } });
  const recordOf = id => prisma.breedingRecord.findUnique({ where: { id } });

  /** Each debit row has exactly one credit sibling: same amount and metadata, counterparties crossed. */
  async function expectLedgerPairs(ids) {
    const rows = await prisma.userTransaction.findMany({ where: { userId: { in: ids } } });
    const debits = rows.filter(r => r.type === 'debit');
    const credits = rows.filter(r => r.type === 'credit');
    expect(debits).toHaveLength(credits.length);
    const unmatched = [...credits];
    for (const debit of debits) {
      const { counterpartyId: payee, ...shared } = debit.metadata;
      const index = unmatched.findIndex(credit => {
        const { counterpartyId: payer, ...creditShared } = credit.metadata;
        return (
          credit.userId === payee &&
          payer === debit.userId &&
          credit.amount === debit.amount &&
          JSON.stringify(creditShared) === JSON.stringify(shared)
        );
      });
      expect(index).toBeGreaterThanOrEqual(0);
      unmatched.splice(index, 1);
    }
    expect(unmatched).toEqual([]);
    return rows;
  }

  beforeEach(async () => {
    userIds.length = 0;
    horseIds.length = 0;
    breed = await sharedBreed();
    registerCleanup(cleanup, { userIds, horseIds });
  });

  afterEach(async () => {
    await cleanup.run();
  });

  afterAll(async () => {
    await disconnectLockClient();
  });

  describe('C4: a private approval and a public booking of the same mare race', () => {
    const privateFee = 400;
    const publicFee = 250;
    let mareOwner;
    let privateOwner;
    let publicOwner;
    let privateStud;
    let publicStud;
    let mare;
    let requestId;

    beforeEach(async () => {
      mareOwner = await player('mareOwner', 5000);
      privateOwner = await player('privateOwner', 0);
      publicOwner = await player('publicOwner', 0);
      privateStud = await horse({
        ownerId: privateOwner.user.id,
        sex: 'Stallion',
        studStatus: 'At Private Stud',
        studFee: privateFee,
      });
      publicStud = await horse({
        ownerId: publicOwner.user.id,
        sex: 'Stallion',
        studStatus: 'At Public Stud',
        studFee: publicFee,
      });
      mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });
      requestId = await sendRequest(mareOwner, privateStud, mare, privateFee);
    });

    const approve = () => actOnRequest(privateOwner.token, requestId, 'approve');
    const book = () => bookStud(mareOwner.token, publicStud.id, { damId: mare.id, expectedStudFee: publicFee });

    /** Exactly one pregnancy (the approved stallion's) and exactly one fee moved. */
    async function expectApprovalAloneTookEffect() {
      expect(await moneyOf(mareOwner.user.id)).toBe(5000 - privateFee);
      expect(await moneyOf(privateOwner.user.id)).toBe(privateFee);
      expect(await moneyOf(publicOwner.user.id)).toBe(0);
      expect(await prisma.userTransaction.count({ where: { userId: { in: userIds } } })).toBe(2);
      expect(await prisma.userTransaction.count({ where: { userId: publicOwner.user.id } })).toBe(0);
      expect((await horseRow(mare.id)).pregnancySireId).toBe(privateStud.id);
      expect(await recordOf(requestId)).toMatchObject({ status: 'COMPLETED' });
      expect(await prisma.breedingRecord.count({ where: { damId: mare.id, sireId: publicStud.id } })).toBe(0);
      expect(await prisma.notification.count({ where: { userId: publicOwner.user.id } })).toBe(0);
    }

    it('the approval reaches the mare first: it completes; the booking then loses the dam claim and its fee rolls back', async () => {
      let bookPromise;

      const approved = await holdRowLockUntil(
        tx => tx.horse.update({ where: { id: mare.id }, data: { name: mare.name } }),
        approve,
        {
          whileBlocked: async ({ waitForBlocked }) => {
            bookPromise = book();
            await waitForBlocked(2, bookPromise);
          },
        },
      );
      const booked = await bookPromise;

      expect(approved.status).toBe(200);
      expect(booked.status).toBe(400);
      expect(booked.body.message).toBe(`${mare.name} is already in foal.`);
      await expectApprovalAloneTookEffect();
    });

    it('the booking reaches the mare first: S-Q4 refuses it on the pending request; the approval then completes', async () => {
      let approvePromise;

      const booked = await holdRowLockUntil(
        tx => tx.horse.update({ where: { id: mare.id }, data: { name: mare.name } }),
        book,
        {
          whileBlocked: async ({ waitForBlocked }) => {
            approvePromise = approve();
            await waitForBlocked(2, approvePromise);
          },
        },
      );
      const approved = await approvePromise;

      expect(booked.status).toBe(409);
      expect(booked.body).toMatchObject({ success: false, message: pendingRequestMessage(mare.name) });
      expect(approved.status).toBe(200);
      await expectApprovalAloneTookEffect();
    });
  });

  it('full lifecycle audit: list, request, cancel, re-request, approve, go public, book, unlist conserve money and pair every ledger row', async () => {
    const privateFee = 320;
    const publicFee = 180;
    const studOwner = await player('studOwner', 1000);
    const firstMareOwner = await player('firstMareOwner', 2000);
    const secondMareOwner = await player('secondMareOwner', 3000);
    const participants = [studOwner, firstMareOwner, secondMareOwner].map(p => p.user.id);
    const stud = await horse({ ownerId: studOwner.user.id, sex: 'Stallion' });
    const firstMare = await horse({ ownerId: firstMareOwner.user.id, sex: 'Mare' });
    const secondMare = await horse({ ownerId: secondMareOwner.user.id, sex: 'Mare' });
    const startTotal = (await Promise.all(participants.map(moneyOf))).reduce((a, b) => a + b, 0);
    const before = new Date();

    expect((await listAtStud(studOwner.token, stud.id, { studFee: privateFee, mode: 'private' })).status).toBe(200);
    const cancelledId = await sendRequest(firstMareOwner, stud, firstMare, privateFee);
    expect((await actOnRequest(firstMareOwner.token, cancelledId, 'cancel')).status).toBe(200);
    const approvedId = await sendRequest(firstMareOwner, stud, firstMare, privateFee);
    expect((await actOnRequest(studOwner.token, approvedId, 'approve')).status).toBe(200);
    expect((await listAtStud(studOwner.token, stud.id, { studFee: publicFee, mode: 'public' })).status).toBe(200);
    const booked = await bookStud(secondMareOwner.token, stud.id, { damId: secondMare.id, expectedStudFee: publicFee });
    expect(booked.status).toBe(200);
    expect((await unlistAtStud(studOwner.token, stud.id)).status).toBe(200);
    const after = new Date();

    // Money: transfers only, so the total is unchanged and each player moved by exactly one fee.
    const endTotal = (await Promise.all(participants.map(moneyOf))).reduce((a, b) => a + b, 0);
    expect(endTotal).toBe(startTotal);
    expect(await moneyOf(firstMareOwner.user.id)).toBe(2000 - privateFee);
    expect(await moneyOf(secondMareOwner.user.id)).toBe(3000 - publicFee);
    expect(await moneyOf(studOwner.user.id)).toBe(1000 + privateFee + publicFee);

    // Ledger: exactly the two fees, each debit paired with its credit.
    const rows = await expectLedgerPairs(participants);
    expect(rows.map(r => [r.userId, r.type, r.amount, r.category]).sort()).toEqual(
      [
        [firstMareOwner.user.id, 'debit', privateFee, 'studFeePaid'],
        [studOwner.user.id, 'credit', privateFee, 'studFeeReceived'],
        [secondMareOwner.user.id, 'debit', publicFee, 'studFeePaid'],
        [studOwner.user.id, 'credit', publicFee, 'studFeeReceived'],
      ].sort(),
    );

    // Requests: no orphan PENDING; each closed the way it ended.
    expect(await prisma.breedingRecord.count({ where: { sireId: stud.id, status: 'PENDING' } })).toBe(0);
    expect(await recordOf(cancelledId)).toMatchObject({ status: 'CANCELLED' });
    expect(await recordOf(approvedId)).toMatchObject({ status: 'COMPLETED', fee: privateFee });
    expect(
      await prisma.breedingRecord.count({
        where: { sireId: stud.id, damId: secondMare.id, status: 'COMPLETED', fee: publicFee },
      }),
    ).toBe(1);

    // Pregnancies and cooldown stamps: both mares, stamped with the Eastern
    // game date of the breeding; the stallion carries no cooldown.
    const stampDays = [gameCalendarDate(before).getTime(), gameCalendarDate(after).getTime()];
    for (const dam of [firstMare, secondMare]) {
      const row = await horseRow(dam.id);
      expect(row.pregnancySireId).toBe(stud.id);
      expect(row.inFoalSinceDate).not.toBeNull();
      expect(stampDays).toContain(row.lastBredDate.getTime());
    }
    expect(await horseRow(stud.id)).toMatchObject({ lastBredDate: null, studStatus: 'Not at Stud', studFee: 0 });
  });

  it(`hammer: approve + public booking + unlist on overlapping rows, ${hammerRounds} rounds, never deadlock or break an invariant`, async () => {
    const privateFee = 210;
    const publicFee = 130;
    const mareOwner = await player('mareOwner', 50000);
    const studOwner = await player('studOwner', 0);
    const pair = [mareOwner.user.id, studOwner.user.id];
    const startTotal = (await Promise.all(pair.map(moneyOf))).reduce((a, b) => a + b, 0);
    let expectedFees = 0;

    for (let round = 0; round < hammerRounds; round += 1) {
      // Both money flows run between the same two User rows; even rounds also
      // race the unlist against the approval's stallion, odd rounds against
      // the booking's.
      const privateStud = await horse({
        ownerId: studOwner.user.id,
        sex: 'Stallion',
        studStatus: 'At Private Stud',
        studFee: privateFee,
      });
      const publicStud = await horse({
        ownerId: studOwner.user.id,
        sex: 'Stallion',
        studStatus: 'At Public Stud',
        studFee: publicFee,
      });
      const requestedMare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });
      const bookedMare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });
      const requestId = await sendRequest(mareOwner, privateStud, requestedMare, privateFee);
      const unlistTarget = round % 2 === 0 ? privateStud : publicStud;

      const [approved, booked, unlisted] = await Promise.all([
        actOnRequest(studOwner.token, requestId, 'approve'),
        bookStud(mareOwner.token, publicStud.id, { damId: bookedMare.id, expectedStudFee: publicFee }),
        unlistAtStud(studOwner.token, unlistTarget.id),
      ]);
      const label = `round ${round}: approve ${approved.status} ${approved.body.code ?? ''}, book ${booked.status}, unlist ${unlisted.status}`;

      expect({ label, unlist: unlisted.status }).toEqual({ label, unlist: 200 });
      if (unlistTarget === privateStud) {
        expect({ label, booked: booked.status }).toEqual({ label, booked: 200 });
        expect({ label, approved: approved.status === 200 || approved.body.message === notPendingMessage }).toEqual({
          label,
          approved: true,
        });
      } else {
        expect({ label, approved: approved.status }).toEqual({ label, approved: 200 });
        expect({ label, booked: booked.status === 200 || booked.status === 404 }).toEqual({ label, booked: true });
      }
      const approveWon = approved.status === 200;
      const bookWon = booked.status === 200;
      expectedFees += (approveWon ? privateFee : 0) + (bookWon ? publicFee : 0);

      expect((await horseRow(requestedMare.id)).pregnancySireId ?? null).toBe(approveWon ? privateStud.id : null);
      expect((await horseRow(bookedMare.id)).pregnancySireId ?? null).toBe(bookWon ? publicStud.id : null);
      expect(await recordOf(requestId)).toMatchObject({ status: approveWon ? 'COMPLETED' : 'DECLINED' });
      expect(await moneyOf(mareOwner.user.id)).toBe(50000 - expectedFees);
      expect(await moneyOf(studOwner.user.id)).toBe(expectedFees);
    }

    expect((await Promise.all(pair.map(moneyOf))).reduce((a, b) => a + b, 0)).toBe(startTotal);
    expect(await prisma.breedingRecord.count({ where: { mareOwnerId: mareOwner.user.id, status: 'PENDING' } })).toBe(0);
    const rows = await expectLedgerPairs(pair);
    expect(rows.filter(r => r.type === 'debit').reduce((sum, r) => sum + r.amount, 0)).toBe(expectedFees);
  });
});
