/**
 * Private stud request queue (Equoria-q4uem.9, slice 3).
 *
 * Owner rulings (Stacey): 2026-10-15 — Private Stud: the mare owner requests,
 * the stallion owner approves or rejects. S1 the confirm-time fee is a
 * contract. S6 a request pins the fee the mare owner saw; money moves only on
 * approval; if she cannot pay at approval, the approval fails, the request is
 * declined and both are notified. S7 one pending request per mare; eligibility
 * re-checked at approval. S8 requests never expire; the mare owner may cancel
 * any time. S10 notify the stallion owner of each request and the mare owner on
 * approve/reject. 2026-10-16 — S-Q3 a non-money ineligibility at approval
 * declines and notifies both; S-Q5 notify the stallion owner on cancel.
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
  breedOwnPair,
  moneyOf,
  holdRowLockUntil,
  disconnectLockClient,
  registerCleanup,
  requestPrivateStud,
  actOnRequest,
  listStudRequests,
} from './helpers/studBookingFixtures.mjs';

const PREFIX = 'TestFixture-q4uem9-privstud';
const FEE = 700;
// Every 404 these endpoints send carries the AppError body shape (status: 'fail'),
// identical across causes so ids cannot be probed.
const UNAVAILABLE_404 = { success: false, message: 'Stallion not available at stud', status: 'fail' };

describe('private stud requests: request, approve, reject, cancel (Equoria-q4uem.9)', () => {
  const cleanup = createCleanupTracker();
  let breed;
  let mareOwner;
  let studOwner;
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

  async function request() {
    const res = await requestPrivateStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });
    expect(res.status).toBe(201);
    return res.body.data.requestId;
  }

  function recordOf(id) {
    return prisma.breedingRecord.findUnique({ where: { id } });
  }

  function notesOf(userId, type) {
    return prisma.notification.findMany({ where: { userId, type } });
  }

  beforeEach(async () => {
    userIds.length = 0;
    horseIds.length = 0;
    breed = await sharedBreed();
    mareOwner = await player('mareOwner', 5000);
    studOwner = await player('studOwner', 100);
    stud = await horse({
      ownerId: studOwner.user.id,
      sex: 'Stallion',
      studStatus: 'At Private Stud',
      studFee: FEE,
    });
    mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });
    registerCleanup(cleanup, { userIds, horseIds });
  });

  afterEach(async () => {
    await cleanup.run();
  });

  afterAll(async () => {
    await disconnectLockClient();
  });

  describe('request', () => {
    it('S6/S10: writes a PENDING request with the pinned fee, moves no money, and notifies the stallion owner', async () => {
      const res = await requestPrivateStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ status: 'PENDING', fee: FEE, sireId: stud.id, damId: mare.id });
      expect(await recordOf(res.body.data.requestId)).toMatchObject({
        kind: 'PRIVATE_STUD',
        status: 'PENDING',
        fee: FEE,
        mareOwnerId: mareOwner.user.id,
        stallionOwnerId: studOwner.user.id,
      });
      expect(await moneyOf(mareOwner.user.id)).toBe(5000);
      expect(await moneyOf(studOwner.user.id)).toBe(100);
      expect((await prisma.horse.findUnique({ where: { id: mare.id } })).inFoalSinceDate).toBeNull();
      expect(await notesOf(studOwner.user.id, 'studRequestReceived')).toHaveLength(1);
    });

    it('S7: a second request for the same mare is refused with 409 mareHasPendingRequest', async () => {
      await request();
      const otherOwner = await player('otherStudOwner', 0);
      const otherStud = await horse({
        ownerId: otherOwner.user.id,
        sex: 'Stallion',
        studStatus: 'At Private Stud',
        studFee: 5,
      });

      const res = await requestPrivateStud(mareOwner.token, otherStud.id, { damId: mare.id, expectedStudFee: 5 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('mareHasPendingRequest');
      expect(await prisma.breedingRecord.count({ where: { damId: mare.id } })).toBe(1);
    });

    it('refuses an ineligible mare (cooldown), an own stallion, a public-stud stallion and a stale fee, writing nothing', async () => {
      const ownStud = await horse({
        ownerId: mareOwner.user.id,
        sex: 'Stallion',
        studStatus: 'At Private Stud',
        studFee: 1,
      });
      const publicStud = await horse({
        ownerId: studOwner.user.id,
        sex: 'Stallion',
        studStatus: 'At Public Stud',
        studFee: FEE,
      });

      const own = await requestPrivateStud(mareOwner.token, ownStud.id, { damId: mare.id, expectedStudFee: 1 });
      const pub = await requestPrivateStud(mareOwner.token, publicStud.id, { damId: mare.id, expectedStudFee: FEE });
      const stale = await requestPrivateStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE - 1 });
      await prisma.horse.update({ where: { id: mare.id }, data: { lastBredDate: new Date() } });
      const cooling = await requestPrivateStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });

      expect(own.status).toBe(400);
      expect(own.body.code).toBe('ownStallion');
      expect(pub.status).toBe(404);
      expect(pub.body).toEqual(UNAVAILABLE_404);
      expect(stale.status).toBe(409);
      expect(stale.body).toMatchObject({ code: 'studFeeChanged', data: { studFee: FEE } });
      expect(cooling.status).toBe(400);
      expect(cooling.body.message).toMatch(/breeding cooldown/);
      expect(await prisma.breedingRecord.count({ where: { damId: mare.id } })).toBe(0);
    });

    describe('I-2: the horses change while the request waits on their rows (no request survives)', () => {
      const send = () => requestPrivateStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });

      it('stallion unlisted: 404, no request', async () => {
        const res = await holdRowLockUntil(
          tx => tx.horse.update({ where: { id: stud.id }, data: { studStatus: 'Not at Stud', studFee: 0 } }),
          send,
        );
        expect(res.status).toBe(404);
        expect(res.body).toEqual(UNAVAILABLE_404);
        expect(await prisma.breedingRecord.count({ where: { damId: mare.id } })).toBe(0);
      });

      it('stallion repriced: 409 studFeeChanged with the new fee, no request', async () => {
        const res = await holdRowLockUntil(
          tx => tx.horse.update({ where: { id: stud.id }, data: { studFee: FEE + 50 } }),
          send,
        );
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: 'studFeeChanged', data: { studFee: FEE + 50 } });
        expect(await prisma.breedingRecord.count({ where: { damId: mare.id } })).toBe(0);
      });

      it('mare sold: 404 Mare not found, and the old owner holds no S7 slot', async () => {
        const buyer = await player('mareBuyer', 0);
        const res = await holdRowLockUntil(
          tx => tx.horse.update({ where: { id: mare.id }, data: { userId: buyer.user.id } }),
          send,
        );
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ success: false, message: 'Mare not found', status: 'fail' });
        expect(await prisma.breedingRecord.count({ where: { damId: mare.id } })).toBe(0);
      });

      it('mare conceived meanwhile: 400 already in foal, no request', async () => {
        const res = await holdRowLockUntil(
          tx => tx.horse.update({ where: { id: mare.id }, data: { inFoalSinceDate: new Date() } }),
          send,
        );
        expect(res.status).toBe(400);
        expect(res.body.message).toBe(`${mare.name} is already in foal.`);
        expect(await prisma.breedingRecord.count({ where: { damId: mare.id } })).toBe(0);
      });
    });
  });

  describe('approve', () => {
    it('S6: charges the PINNED fee even after the stallion owner raised it, starts the pregnancy and notifies the mare owner', async () => {
      const requestId = await request();
      await prisma.horse.update({ where: { id: stud.id }, data: { studFee: FEE * 3 } });

      const res = await actOnRequest(studOwner.token, requestId, 'approve');

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'COMPLETED', fee: FEE, newBalance: 100 + FEE });
      expect(await moneyOf(mareOwner.user.id)).toBe(5000 - FEE);
      expect(await moneyOf(studOwner.user.id)).toBe(100 + FEE);
      expect(await recordOf(requestId)).toMatchObject({ status: 'COMPLETED', fee: FEE });
      const dam = await prisma.horse.findUnique({ where: { id: mare.id } });
      expect(dam.pregnancySireId).toBe(stud.id);
      expect(
        await prisma.userTransaction.count({ where: { userId: mareOwner.user.id, category: 'studFeePaid' } }),
      ).toBe(1);
      expect(
        await prisma.userTransaction.count({ where: { userId: studOwner.user.id, category: 'studFeeReceived' } }),
      ).toBe(1);
      expect(await notesOf(mareOwner.user.id, 'studRequestApproved')).toHaveLength(1);
    });

    it('S6: the mare owner cannot pay at approval: DECLINED insufficientFunds, nothing moves, both notified', async () => {
      const requestId = await request();
      await prisma.user.update({ where: { id: mareOwner.user.id }, data: { money: FEE - 1 } });

      const res = await actOnRequest(studOwner.token, requestId, 'approve');

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'requestDeclined', data: { declineReason: 'insufficientFunds' } });
      expect(await recordOf(requestId)).toMatchObject({ status: 'DECLINED', declineReason: 'insufficientFunds' });
      expect(await moneyOf(mareOwner.user.id)).toBe(FEE - 1);
      expect(await moneyOf(studOwner.user.id)).toBe(100);
      expect((await prisma.horse.findUnique({ where: { id: mare.id } })).inFoalSinceDate).toBeNull();
      expect(await notesOf(mareOwner.user.id, 'studRequestDeclined')).toHaveLength(1);
      expect(await notesOf(studOwner.user.id, 'studRequestDeclined')).toHaveLength(1);
    });

    it('S-Q3: a mare on cooldown at approval is DECLINED mareIneligible and both are notified', async () => {
      const requestId = await request();
      await prisma.horse.update({ where: { id: mare.id }, data: { lastBredDate: new Date() } });

      const res = await actOnRequest(studOwner.token, requestId, 'approve');

      expect(res.status).toBe(409);
      expect(res.body.data.declineReason).toBe('mareIneligible');
      expect(await recordOf(requestId)).toMatchObject({ status: 'DECLINED', declineReason: 'mareIneligible' });
      expect(await moneyOf(mareOwner.user.id)).toBe(5000);
      expect(await notesOf(mareOwner.user.id, 'studRequestDeclined')).toHaveLength(1);
      expect(await notesOf(studOwner.user.id, 'studRequestDeclined')).toHaveLength(1);
    });

    it('a stallion no longer at private stud at approval: DECLINED stallionUnavailable', async () => {
      const requestId = await request();
      await prisma.horse.update({ where: { id: stud.id }, data: { studStatus: 'Not at Stud' } });

      const res = await actOnRequest(studOwner.token, requestId, 'approve');

      expect(res.status).toBe(409);
      expect(res.body.data.declineReason).toBe('stallionUnavailable');
      expect(await moneyOf(mareOwner.user.id)).toBe(5000);
    });

    it('M-2: the stallion owner who now owns the mare cannot approve; the request is DECLINED ownStallion and the slot frees', async () => {
      const requestId = await request();
      await prisma.horse.update({ where: { id: mare.id }, data: { userId: studOwner.user.id } });

      const res = await actOnRequest(studOwner.token, requestId, 'approve');

      expect(res.status).toBe(409);
      expect(res.body.data.declineReason).toBe('ownStallion');
      expect(await recordOf(requestId)).toMatchObject({ status: 'DECLINED', declineReason: 'ownStallion' });
      expect(await moneyOf(studOwner.user.id)).toBe(100);
      expect(await prisma.breedingRecord.count({ where: { damId: mare.id, status: 'PENDING' } })).toBe(0);
    });

    it('double approve held at the mare row: one completes, the other answers requestNotPending, money moves once', async () => {
      const requestId = await request();

      const results = await holdRowLockUntil(
        tx => tx.horse.update({ where: { id: mare.id }, data: { name: mare.name } }),
        () =>
          Promise.all([
            actOnRequest(studOwner.token, requestId, 'approve'),
            actOnRequest(studOwner.token, requestId, 'approve'),
          ]),
        { blockedSessions: 2 },
      );

      expect(results.map(r => r.status).sort()).toEqual([200, 409]);
      expect(results.find(r => r.status === 409).body.code).toBe('requestNotPending');
      expect(await moneyOf(mareOwner.user.id)).toBe(5000 - FEE);
      expect(await moneyOf(studOwner.user.id)).toBe(100 + FEE);
      expect(await prisma.userTransaction.count({ where: { userId: mareOwner.user.id } })).toBe(1);
      expect(await recordOf(requestId)).toMatchObject({ status: 'COMPLETED' });
    });

    it('design test 19, approve racing a reject: the reject lands while the approval waits on the mare; only the reject takes effect', async () => {
      const requestId = await request();
      let rejected;

      const approved = await holdRowLockUntil(
        tx => tx.horse.update({ where: { id: mare.id }, data: { name: mare.name } }),
        () => actOnRequest(studOwner.token, requestId, 'approve'),
        {
          whileBlocked: async () => {
            rejected = await actOnRequest(studOwner.token, requestId, 'reject');
          },
        },
      );

      expect(rejected.status).toBe(200);
      expect(approved.status).toBe(409);
      expect(approved.body.code).toBe('requestNotPending');
      expect(await recordOf(requestId)).toMatchObject({ status: 'DECLINED', declineReason: 'rejected' });
      expect(await moneyOf(mareOwner.user.id)).toBe(5000);
      expect(await moneyOf(studOwner.user.id)).toBe(100);
      expect(await prisma.userTransaction.count({ where: { userId: { in: userIds } } })).toBe(0);
      expect((await prisma.horse.findUnique({ where: { id: mare.id } })).inFoalSinceDate).toBeNull();
      expect(await notesOf(mareOwner.user.id, 'studRequestApproved')).toHaveLength(0);
      expect(await notesOf(mareOwner.user.id, 'studRequestDeclined')).toHaveLength(1);
    });

    it('approve racing a cancel: the cancel lands while the approval waits on the mare; the approval rolls back', async () => {
      const requestId = await request();
      let cancelled;

      const approved = await holdRowLockUntil(
        tx => tx.horse.update({ where: { id: mare.id }, data: { name: mare.name } }),
        () => actOnRequest(studOwner.token, requestId, 'approve'),
        {
          whileBlocked: async () => {
            cancelled = await actOnRequest(mareOwner.token, requestId, 'cancel');
          },
        },
      );

      expect(cancelled.status).toBe(200);
      expect(approved.status).toBe(409);
      expect(approved.body.code).toBe('requestNotPending');
      expect(await recordOf(requestId)).toMatchObject({ status: 'CANCELLED' });
      expect(await moneyOf(mareOwner.user.id)).toBe(5000);
      expect(await moneyOf(studOwner.user.id)).toBe(100);
      expect((await prisma.horse.findUnique({ where: { id: mare.id } })).inFoalSinceDate).toBeNull();
    });
  });

  describe('reject, cancel, authorization, queues', () => {
    it('S10: reject declines (rejected) and notifies the mare owner', async () => {
      const requestId = await request();

      const res = await actOnRequest(studOwner.token, requestId, 'reject');

      expect(res.status).toBe(200);
      expect(await recordOf(requestId)).toMatchObject({ status: 'DECLINED', declineReason: 'rejected' });
      expect(await notesOf(mareOwner.user.id, 'studRequestDeclined')).toHaveLength(1);
    });

    it('S8/S-Q5: the mare owner cancels any time; the stallion owner is notified; the mare can then be bred elsewhere', async () => {
      const requestId = await request();
      const ownStallion = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion' });
      const blocked = await breedOwnPair(mareOwner.token, ownStallion.id, mare.id);
      expect(blocked.status).toBe(409);

      const res = await actOnRequest(mareOwner.token, requestId, 'cancel');

      expect(res.status).toBe(200);
      expect(await recordOf(requestId)).toMatchObject({ status: 'CANCELLED', declineReason: 'cancelledByOwner' });
      expect(await notesOf(studOwner.user.id, 'studRequestCancelled')).toHaveLength(1);
      expect((await breedOwnPair(mareOwner.token, ownStallion.id, mare.id)).status).toBe(200);
      expect((await actOnRequest(mareOwner.token, requestId, 'cancel')).status).toBe(409);
    });

    it('only the stallion owner approves or rejects and only the mare owner cancels; anyone else gets 404', async () => {
      const requestId = await request();
      const stranger = await player('stranger', 0);

      const results = await Promise.all([
        actOnRequest(mareOwner.token, requestId, 'approve'),
        actOnRequest(mareOwner.token, requestId, 'reject'),
        actOnRequest(studOwner.token, requestId, 'cancel'),
        actOnRequest(stranger.token, requestId, 'approve'),
        actOnRequest(stranger.token, requestId, 'cancel'),
      ]);

      for (const r of results) {
        expect(r.status).toBe(404);
        expect(r.body).toEqual({ success: false, message: 'Request not found', status: 'fail' });
      }
      expect(await recordOf(requestId)).toMatchObject({ status: 'PENDING' });
    });

    it('queues: the stallion owner sees it incoming, the mare owner outgoing, a stranger sees nothing', async () => {
      const requestId = await request();
      const stranger = await player('stranger', 0);

      const incoming = await listStudRequests(studOwner.token, { role: 'incoming', status: 'PENDING' });
      const outgoing = await listStudRequests(mareOwner.token, { role: 'outgoing' });
      const none = await listStudRequests(stranger.token, { role: 'incoming' });

      expect(incoming.status).toBe(200);
      expect(incoming.body.data.requests).toEqual([
        expect.objectContaining({
          id: requestId,
          status: 'PENDING',
          kind: 'PRIVATE_STUD',
          fee: FEE,
          sire: { id: stud.id, name: stud.name },
          dam: { id: mare.id, name: mare.name },
          counterparty: { username: mareOwner.user.username },
        }),
      ]);
      expect(outgoing.body.data.requests.map(r => r.id)).toEqual([requestId]);
      expect(outgoing.body.data.requests[0].counterparty).toEqual({ username: studOwner.user.username });
      expect(none.body.data.requests).toEqual([]);
    });
  });
});
