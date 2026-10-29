/**
 * What happens to pending private-stud requests when the world changes around
 * them (Equoria-q4uem.9, slice 3).
 *
 * Owner rulings (Stacey): 2026-10-15 — Private Stud mode; selling or
 * transferring a stallion clears its listing. 2026-10-16 — S-Q2: unlisting, a
 * sale, or switching Private -> Public auto-declines pending requests (with a
 * notification); a fee change leaves them (S6 pins the fee). S-Q4: a sale
 * cancels the mare's pending request. GDPR erasure must keep the
 * counterparty's record readable and resolve the erased player's requests.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { eraseUserAccount } from '../../users/index.mjs';
import {
  sharedBreed,
  makePlayer,
  makeHorse,
  moneyOf,
  disconnectLockClient,
  registerCleanup,
  requestPrivateStud,
  actOnRequest,
  listAtStud,
  unlistAtStud,
  buyHorseHttp,
} from './helpers/studBookingFixtures.mjs';

const PREFIX = 'TestFixture-q4uem9-studlife';
const FEE = 300;

describe('pending stud requests follow listing changes, sales and erasure (Equoria-q4uem.9)', () => {
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

  async function pendingRequest() {
    const res = await requestPrivateStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });
    expect(res.status).toBe(201);
    return res.body.data.requestId;
  }

  function recordOf(id) {
    return prisma.breedingRecord.findUnique({ where: { id } });
  }

  beforeEach(async () => {
    userIds.length = 0;
    horseIds.length = 0;
    breed = await sharedBreed();
    mareOwner = await player('mareOwner', 5000);
    studOwner = await player('studOwner', 100);
    stud = await horse({ ownerId: studOwner.user.id, sex: 'Stallion' });
    mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });
    registerCleanup(cleanup, { userIds, horseIds });
    const listed = await listAtStud(studOwner.token, stud.id, { studFee: FEE, mode: 'private' });
    expect(listed.status).toBe(200);
    expect(listed.body.data.studStatus).toBe('At Private Stud');
  });

  afterEach(async () => {
    await cleanup.run();
  });

  afterAll(async () => {
    await disconnectLockClient();
  });

  it("listing mode: 'private' / 'public' set the mode; a FIRST listing without mode is Public", async () => {
    const publicListing = await listAtStud(studOwner.token, stud.id, { studFee: FEE, mode: 'public' });
    expect(publicListing.body.data.studStatus).toBe('At Public Stud');
    expect((await unlistAtStud(studOwner.token, stud.id)).status).toBe(200);
    const firstListing = await listAtStud(studOwner.token, stud.id, { studFee: FEE });
    expect(firstListing.body.data.studStatus).toBe('At Public Stud');
    const bad = await listAtStud(studOwner.token, stud.id, { studFee: FEE, mode: 'secret' });
    expect(bad.status).toBe(400);
  });

  it('S-Q2: unlisting declines pending requests (listingChanged) and notifies the mare owner', async () => {
    const requestId = await pendingRequest();

    const res = await unlistAtStud(studOwner.token, stud.id);

    expect(res.status).toBe(200);
    expect(await recordOf(requestId)).toMatchObject({ status: 'DECLINED', declineReason: 'listingChanged' });
    expect(await prisma.notification.count({ where: { userId: mareOwner.user.id, type: 'studRequestDeclined' } })).toBe(
      1,
    );
  });

  it('S-Q2: switching Private -> Public declines pending requests', async () => {
    const requestId = await pendingRequest();

    const res = await listAtStud(studOwner.token, stud.id, { studFee: FEE, mode: 'public' });

    expect(res.status).toBe(200);
    expect(await recordOf(requestId)).toMatchObject({ status: 'DECLINED', declineReason: 'listingChanged' });
  });

  it('S-Q2/S6: a fee change that stays private leaves the request PENDING at its pinned fee', async () => {
    const requestId = await pendingRequest();

    const res = await listAtStud(studOwner.token, stud.id, { studFee: FEE * 5, mode: 'private' });

    expect(res.status).toBe(200);
    expect(await recordOf(requestId)).toMatchObject({ status: 'PENDING', fee: FEE });
  });

  it('review fix: a fee edit that omits mode keeps a Private stallion Private and its requests PENDING', async () => {
    // Today's StudSaleTab sends { studFee } only; a fee edit must not flip the mode.
    const requestId = await pendingRequest();

    const res = await listAtStud(studOwner.token, stud.id, { studFee: FEE * 2 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ studStatus: 'At Private Stud', studFee: FEE * 2 });
    expect(await recordOf(requestId)).toMatchObject({ status: 'PENDING', fee: FEE });
    expect(await prisma.notification.count({ where: { userId: mareOwner.user.id, type: 'studRequestDeclined' } })).toBe(
      0,
    );
  });

  it('a sale of the stallion resets its listing and declines its pending requests (stallionSold)', async () => {
    const requestId = await pendingRequest();
    const buyer = await player('stallionBuyer', 5000);
    await prisma.horse.update({ where: { id: stud.id }, data: { forSale: true, salePrice: 1000 } });

    const sale = await buyHorseHttp(buyer.token, stud.id);

    expect(sale.status).toBe(200);
    const sold = await prisma.horse.findUnique({ where: { id: stud.id } });
    expect(sold).toMatchObject({ userId: buyer.user.id, studStatus: 'Not at Stud', studFee: 0 });
    expect(await recordOf(requestId)).toMatchObject({ status: 'DECLINED', declineReason: 'stallionSold' });
    expect(await prisma.notification.count({ where: { userId: mareOwner.user.id, type: 'studRequestDeclined' } })).toBe(
      1,
    );
  });

  it('S-Q4: a sale of the mare cancels her pending request and tells the stallion owner', async () => {
    const requestId = await pendingRequest();
    const buyer = await player('mareBuyer', 5000);
    await prisma.horse.update({ where: { id: mare.id }, data: { forSale: true, salePrice: 1000 } });

    const sale = await buyHorseHttp(buyer.token, mare.id);

    expect(sale.status).toBe(200);
    expect(await recordOf(requestId)).toMatchObject({ status: 'CANCELLED', declineReason: 'mareTransferred' });
    expect(
      await prisma.notification.count({ where: { userId: studOwner.user.id, type: 'studRequestCancelled' } }),
    ).toBe(1);
    // The new owner is not bound by the old owner's request.
    expect(await prisma.breedingRecord.count({ where: { damId: mare.id, status: 'PENDING' } })).toBe(0);
  });

  it("GDPR: erasing the stallion owner keeps the mare owner's record readable and resolves his pending requests", async () => {
    const completedId = await pendingRequest();
    expect((await actOnRequest(studOwner.token, completedId, 'approve')).status).toBe(200);
    const otherMare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });
    const pending = await requestPrivateStud(mareOwner.token, stud.id, { damId: otherMare.id, expectedStudFee: FEE });
    expect(pending.status).toBe(201);
    // Old contract: the stallion owner's data export listed both records first.
    // Owner ruling 2026-10-28 (q157): the account data download is removed.

    await expect(eraseUserAccount(studOwner.user.id)).resolves.toEqual({ deleted: true });

    const kept = await recordOf(completedId);
    expect(kept).toMatchObject({
      status: 'COMPLETED',
      fee: FEE,
      stallionOwnerId: null,
      stallionOwnerName: '',
      mareOwnerId: mareOwner.user.id,
      mareOwnerName: mareOwner.user.username,
      damName: mare.name,
    });
    expect(await recordOf(pending.body.data.requestId)).toMatchObject({
      status: 'DECLINED',
      declineReason: 'accountClosed',
    });
    expect(await moneyOf(mareOwner.user.id)).toBe(5000 - FEE);
  });
});
