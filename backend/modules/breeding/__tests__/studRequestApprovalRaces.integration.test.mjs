/**
 * Approval races the first private-stud suites left unproven (Equoria-e7tgc.7,
 * gaps found 2026-10-28):
 *   C5  the stallion is unlisted while an approval is in flight, both orders;
 *   C2  the approval WINS against a cancel (the cancel-wins order lives in
 *       studBookingPrivate.integration.test.mjs);
 *   an approval that finds the mare already in foal, before and during it.
 *
 * Owner rulings (Stacey): 2026-10-15 S6 money moves only on approval, at the
 * pinned fee; S7 eligibility is re-checked at approval. 2026-10-16 S-Q2
 * unlisting declines pending requests; S-Q3 a non-money ineligibility at
 * approval declines and notifies both players.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures. Every interleaving
 * is pinned with a test-held Postgres row lock (holdRowLockUntil), never a
 * sleep: the requests block on the real lock and the test watches the lock
 * queue of its own held transaction.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  sharedBreed,
  makePlayer,
  makeHorse,
  moneyOf,
  holdRowLockUntil,
  disconnectLockClient,
  registerCleanup,
  requestPrivateStud,
  actOnRequest,
  unlistAtStud,
} from './helpers/studBookingFixtures.mjs';

// The answer to any action on a request that is no longer pending. Matched
// by its message: the stud codes still await the camelCase conversion
// (Equoria-pjvp8), and a new file may not add snake-case names.
const notPending = { success: false, message: 'This request has already been answered or withdrawn.' };
const prefix = 'TestFixture-e7tgc7-approveRace';
const fee = 650;
const mareMoney = 5000;
const studMoney = 100;

describe('private stud approval races (Equoria-e7tgc.7)', () => {
  const cleanup = createCleanupTracker();
  let breed;
  let mareOwner;
  let studOwner;
  let stud;
  let mare;
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

  async function pendingRequest() {
    const res = await requestPrivateStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: fee });
    expect(res.status).toBe(201);
    return res.body.data.requestId;
  }

  const recordOf = id => prisma.breedingRecord.findUnique({ where: { id } });
  const mareRow = () => prisma.horse.findUnique({ where: { id: mare.id } });
  const notesOf = (userId, type) => prisma.notification.count({ where: { userId, type } });
  const ledgerRows = () => prisma.userTransaction.count({ where: { userId: { in: userIds } } });

  async function expectNothingMoved() {
    expect(await moneyOf(mareOwner.user.id)).toBe(mareMoney);
    expect(await moneyOf(studOwner.user.id)).toBe(studMoney);
    expect(await ledgerRows()).toBe(0);
    const dam = await mareRow();
    expect(dam.pregnancySireId).not.toBe(stud.id);
    expect(dam.lastBredDate).toBeNull();
  }

  /**
   * S-Q3 decline for a mare in foal: the approval's own decline path answered
   * (the in-foal message is unique to it), the stored reason is the one the
   * players were sent, and both players were told.
   */
  async function expectDeclinedAsInFoal(res, requestId) {
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, message: `${mare.name} is already in foal.` });
    const record = await recordOf(requestId);
    expect(record.status).toBe('DECLINED');
    expect(record.declineReason).toEqual(expect.any(String));
    expect(res.body.data).toEqual({ declineReason: record.declineReason });
    const sent = await prisma.notification.findMany({
      where: { userId: { in: userIds }, type: 'studRequestDeclined' },
    });
    expect(sent.map(n => n.userId).sort()).toEqual([mareOwner.user.id, studOwner.user.id].sort());
    for (const note of sent) {
      expect(note.payload).toMatchObject({ requestId, declineReason: record.declineReason });
    }
    expect(await notesOf(mareOwner.user.id, 'studRequestApproved')).toBe(0);
  }

  async function expectPaidOnce(requestId) {
    expect(await moneyOf(mareOwner.user.id)).toBe(mareMoney - fee);
    expect(await moneyOf(studOwner.user.id)).toBe(studMoney + fee);
    expect(
      await prisma.userTransaction.count({
        where: { userId: mareOwner.user.id, type: 'debit', category: 'studFeePaid', amount: fee },
      }),
    ).toBe(1);
    expect(
      await prisma.userTransaction.count({
        where: { userId: studOwner.user.id, type: 'credit', category: 'studFeeReceived', amount: fee },
      }),
    ).toBe(1);
    expect(await ledgerRows()).toBe(2);
    expect(await recordOf(requestId)).toMatchObject({ status: 'COMPLETED', fee });
    const dam = await mareRow();
    expect(dam.pregnancySireId).toBe(stud.id);
    expect(dam.inFoalSinceDate).not.toBeNull();
  }

  beforeEach(async () => {
    registerCleanup(cleanup, { userIds, horseIds });
    userIds.length = 0;
    horseIds.length = 0;
    breed = await sharedBreed();
    mareOwner = await player('mareOwner', mareMoney);
    studOwner = await player('studOwner', studMoney);
    // The stallion is created first, so his id is lower than the mare's and the
    // approval pins him BEFORE it claims her (sire-first lock branch).
    stud = await horse({
      ownerId: studOwner.user.id,
      sex: 'Stallion',
      studStatus: 'At Private Stud',
      studFee: fee,
    });
    mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });
    expect(stud.id).toBeLessThan(mare.id);
  });

  afterEach(async () => {
    await cleanup.run();
  });

  afterAll(async () => {
    await disconnectLockClient();
  });

  describe('C5: unlisting the stallion races an approval', () => {
    it('the unlist commits while the approval waits on the payer: the request is declined by the unlist and no money moves', async () => {
      const requestId = await pendingRequest();
      let unlisted;

      // The approval has read the request and the stallion (still at private
      // stud) and is parked on the mare owner's User row, its first money
      // write. The unlist touches no User row, so it runs to commit meanwhile.
      const approved = await holdRowLockUntil(
        tx => tx.user.update({ where: { id: mareOwner.user.id }, data: { money: mareMoney } }),
        () => actOnRequest(studOwner.token, requestId, 'approve'),
        {
          whileBlocked: async () => {
            unlisted = await unlistAtStud(studOwner.token, stud.id);
          },
        },
      );

      expect(unlisted.status).toBe(200);
      // The approval lost (it never declined the request itself: that path
      // would answer a decline and notify the stallion owner too).
      expect(approved.status).toBe(409);
      expect(approved.body).toMatchObject(notPending);
      expect(await prisma.horse.findUnique({ where: { id: stud.id } })).toMatchObject({
        studStatus: 'Not at Stud',
        studFee: 0,
      });
      await expectNothingMoved();
      // The unlist's cascade closed it (S-Q2): one notice, to the mare owner,
      // carrying the reason stored on the request.
      const record = await recordOf(requestId);
      expect(record.status).toBe('DECLINED');
      const [notice, ...others] = await prisma.notification.findMany({
        where: { userId: { in: userIds }, type: 'studRequestDeclined' },
      });
      expect(others).toEqual([]);
      expect(notice).toMatchObject({
        userId: mareOwner.user.id,
        payload: { requestId, declineReason: record.declineReason },
      });
      expect(await notesOf(mareOwner.user.id, 'studRequestApproved')).toBe(0);
    });

    it('the approval holds the stallion when the unlist arrives: the approval completes once, then the unlist finds nothing to decline', async () => {
      const requestId = await pendingRequest();
      let unlistPromise;

      // The approval has paid and pinned the stallion, and is parked on the
      // mare row. The unlist then queues behind the approval's stallion lock.
      const approved = await holdRowLockUntil(
        tx => tx.horse.update({ where: { id: mare.id }, data: { name: mare.name } }),
        () => actOnRequest(studOwner.token, requestId, 'approve'),
        {
          whileBlocked: async ({ waitForBlocked }) => {
            unlistPromise = unlistAtStud(studOwner.token, stud.id);
            await waitForBlocked(2, unlistPromise);
          },
        },
      );
      const unlisted = await unlistPromise;

      expect(approved.status).toBe(200);
      expect(approved.body.data).toMatchObject({ status: 'COMPLETED', fee });
      expect(unlisted.status).toBe(200);
      await expectPaidOnce(requestId);
      expect(await prisma.horse.findUnique({ where: { id: stud.id } })).toMatchObject({
        studStatus: 'Not at Stud',
      });
      expect(await notesOf(mareOwner.user.id, 'studRequestApproved')).toBe(1);
      expect(await notesOf(mareOwner.user.id, 'studRequestDeclined')).toBe(0);
    });
  });

  it('C2, approve wins against a cancel: the cancel queues behind the approval on the request row and answers requestNotPending', async () => {
    const requestId = await pendingRequest();
    let cancelPromise;

    // The test holds the request row. The approval pays, pins both horses and
    // queues on that row for its final claim; the cancel then queues behind
    // the approval. Postgres hands the row to the first waiter.
    const approved = await holdRowLockUntil(
      tx => tx.breedingRecord.update({ where: { id: requestId }, data: { fee } }),
      () => actOnRequest(studOwner.token, requestId, 'approve'),
      {
        whileBlocked: async ({ waitForBlocked }) => {
          cancelPromise = actOnRequest(mareOwner.token, requestId, 'cancel');
          await waitForBlocked(2, cancelPromise);
        },
      },
    );
    const cancelled = await cancelPromise;

    expect(approved.status).toBe(200);
    expect(cancelled.status).toBe(409);
    expect(cancelled.body).toMatchObject(notPending);
    await expectPaidOnce(requestId);
    expect(await notesOf(studOwner.user.id, 'studRequestCancelled')).toBe(0);
    expect(await notesOf(mareOwner.user.id, 'studRequestApproved')).toBe(1);
  });

  describe('S-Q3: the approval finds the mare already in foal', () => {
    it('in foal before the approval: DECLINED mareIneligible, both notified, nothing moves', async () => {
      const requestId = await pendingRequest();
      await prisma.horse.update({ where: { id: mare.id }, data: { inFoalSinceDate: new Date() } });

      const res = await actOnRequest(studOwner.token, requestId, 'approve');

      await expectDeclinedAsInFoal(res, requestId);
      await expectNothingMoved();
    });

    it('she conceives while the approval waits on her row: the paid fee rolls back and the request is DECLINED mareIneligible', async () => {
      const requestId = await pendingRequest();

      // The approval read her open, moved the fee inside its transaction and
      // pinned the stallion; its guarded claim then sees the committed
      // pregnancy and the whole transaction, money included, rolls back.
      const res = await holdRowLockUntil(
        tx => tx.horse.update({ where: { id: mare.id }, data: { inFoalSinceDate: new Date() } }),
        () => actOnRequest(studOwner.token, requestId, 'approve'),
      );

      await expectDeclinedAsInFoal(res, requestId);
      await expectNothingMoved();
    });
  });
});
