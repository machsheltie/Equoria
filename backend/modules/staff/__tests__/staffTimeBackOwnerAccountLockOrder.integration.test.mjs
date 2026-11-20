/**
 * The Owner's own account in the time-back lock order (Equoria-puj1e.5.4).
 *
 * Apply and undo check the Owner's emailed code under her account's row lock.
 * They took that lock before the owed players' accounts, which they lock in
 * ascending id order. A payment between the Owner and an owed player whose id
 * sorts first locks that player, then the Owner (every two-player payment locks
 * in ascending id order). The apply held the Owner while it waited for the
 * player, the payment held the player while it waited for the Owner: Postgres
 * aborted one of them. Both now lock every account in one ascending-id pass.
 *
 * The interleaving is forced, not timed. One barrier holds the job-hold row
 * so the request passes its code check and queues inside its transaction;
 * a second barrier then holds the Owner's account, the first is released, and
 * the request queues on the Owner; the payment, holding the player, queues
 * behind it. Releasing the Owner lets both finish, or deadlocks. Waiters are
 * counted by pg_blocking_pids of the holder only, a fresh statement each poll
 * (equoria-lock-barrier-tests-three-traps).
 *
 * Real app: the Owner's real fresh codes, hold, apply and undo over HTTP; the
 * real player-to-player payment the stud booking makes; real DB. Apply changes
 * every matching row in the shared database, so every time-back is undone.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createBarrierClient, holdLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { transferUserMoneyOrThrow } from '../../economy/index.mjs';
import { gameDayIndex, startOfGameDayIndex, startOfGameWeek } from '../../../utils/gameTime.mjs';
import { checkFreshCode, requestFreshCode } from '../services/staffFreshCodeService.mjs';
import { undoTimeBack } from '../services/timeBackService.mjs';
import {
  checkIn,
  createUserFactory,
  post,
  preparePost,
  staffApi,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';
import {
  actionCodesFor,
  easternWall,
  freshCode,
  gameWideSuiteLock,
  gameWideSuiteWaitMs,
  restoreHold,
  snapshotHold,
} from './helpers/timeBackFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('sttbownr');
const APPLY = `${staffApi}/time-back/apply`;
const day = 86_400_000;
const startingMoney = 1000;
const studFee = 300;

// Whole bank weeks well back, clear of the other time-back suites' windows.
const thisWeek = startOfGameWeek(new Date(), 0);
const weekBack = (from, to) => ({
  start: startOfGameDayIndex(gameDayIndex(thisWeek) - from),
  end: startOfGameDayIndex(gameDayIndex(thisWeek) - to),
});
const applyWeek = weekBack(49, 42);
const undoWeek = weekBack(63, 56);

let holdBefore;
let owner;
let device;
let holdClient;
let ownerClient;

const suiteLock = gameWideSuiteLock();
// First: one game-wide suite at a time (gameWideSuiteLock).
beforeAll(() => suiteLock.take(), gameWideSuiteWaitMs);

beforeAll(async () => {
  holdBefore = await snapshotHold();
  // One barrier client per held lock: each holds its own connection.
  holdClient = createBarrierClient();
  ownerClient = createBarrierClient();
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => holdClient.$disconnect(), 'job-hold barrier client');
  cleanup.add(() => ownerClient.$disconnect(), 'owner barrier client');
  cleanup.add(() => restoreHold(holdBefore), 'job hold');
  // Only undone time-backs: one still applied keeps its record (and fails the
  // owner's deletion loudly) so its changes can still be reversed.
  cleanup.add(async () => {
    const ids = (
      await prisma.timeBack.findMany({
        where: { appliedById: scope(), reversedAt: { not: null } },
        select: { id: true },
      })
    ).map(r => r.id);
    await prisma.timeBackChange.deleteMany({ where: { timeBackId: { in: ids } } });
    await prisma.timeBack.deleteMany({ where: { id: { in: ids } } });
  }, 'time-backs');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: scope() } }), 'ledger rows');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');

  await prisma.gameControl.deleteMany({ where: { id: 1 } });
  startEmailCapture();
  // The Owner's id sorts after every owed player's (they start with 0), and she
  // joined after the outage, so she is owed nothing: only the code check locks her.
  owner = await makeUser('owner', { id: `f${randomUUID().slice(1)}`, money: startingMoney });
  device = await checkIn(owner);
  // Apply needs the nightly jobs held.
  expect((await post(`${staffApi}/jobs/hold`, owner, {}, device)).status).toBe(200);
  stopEmailCapture();
}, 120_000);

// Safety net: never leave a time-back applied in the shared database.
afterAll(async () => {
  const open = await prisma.timeBack.findMany({
    where: { appliedById: { in: createdUserIds }, reversedAt: null },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  startEmailCapture();
  try {
    for (const { id } of open) {
      await requestFreshCode(owner, 'timeBackUndo');
      const proof = await checkFreshCode(owner, 'timeBackUndo', actionCodesFor(owner.email).at(-1));
      await undoTimeBack({ actor: owner, timeBackId: id, proof }).catch(err =>
        console.warn(`[cleanup] undo ${id}: ${err.message}`),
      );
    }
  } finally {
    stopEmailCapture();
  }
  await cleanup.run();
}, 120_000);

// Last: the next game-wide suite may start.
afterAll(() => suiteLock.release());

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

/** Start a promise and capture its outcome instead of throwing. */
function outcomeOf(promise) {
  return promise.then(
    result => ({ result }),
    error => ({ error }),
  );
}

/** A player since before the outages, who never claimed: owed each lost week. */
async function owedPlayer() {
  const suffix = `${uid()}${uid()}`;
  const row = await prisma.user.create({
    data: {
      id: `0${randomUUID().slice(1)}`,
      email: `sttbownr-${suffix}@test.com`,
      username: `sttbownr${suffix}`,
      password: 'not-a-real-hash',
      firstName: 'Owed',
      lastName: 'Player',
      role: 'user',
      settings: {},
      emailVerified: true,
      emailVerifiedAt: new Date(),
      money: startingMoney,
      createdAt: new Date(undoWeek.start.getTime() - day),
    },
  });
  createdUserIds.push(row.id);
  return row;
}

/** The stud fee a booking pays: the player's mare to the Owner's stallion. */
const payOwner = player => () =>
  prisma.$transaction(tx =>
    transferUserMoneyOrThrow(tx, {
      fromUserId: player.id,
      toUserId: owner.id,
      amount: studFee,
      debitCategory: 'studFeePaid',
      creditCategory: 'studFeeReceived',
      debitDescription: 'Stud fee (time-back owner lock order test)',
      creditDescription: 'Stud fee (time-back owner lock order test)',
    }),
  );

/**
 * Send `request` (past its code check) so it holds the Owner's account in the
 * old order, then start `pay`, which holds the player and needs the Owner.
 * Returns both outcomes once the Owner's account is released.
 */
async function raceOnOwnerAccount(request, pay) {
  const holdRow = await holdLock(
    holdClient,
    tx => tx.$queryRaw`SELECT "id" FROM "game_control" WHERE "id" = 1 FOR UPDATE`,
  );
  let ownerRow = null;
  let requesting;
  let paying;
  try {
    // The request checks its code (locking the Owner briefly, in its own
    // transaction), then queues on the job-hold row inside its transaction.
    requesting = Promise.resolve(request());
    await holdRow.waitForQueued(1);
    ownerRow = await holdLock(
      ownerClient,
      tx => tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${owner.id} FOR UPDATE`,
    );
    await holdRow.release();
    // The request reaches the Owner's account: first in its queue.
    await ownerRow.waitForQueued(1);
    // The payment locks the player (id first), then queues on the Owner.
    paying = outcomeOf(pay());
    await ownerRow.waitForQueued(2);
  } finally {
    await holdRow.release();
    await ownerRow?.release();
  }
  const [response, paid] = await Promise.all([requesting, paying]);
  return { response, paid };
}

describe("The Owner's account takes its place in the id order (Equoria-puj1e.5.4)", () => {
  it('apply: a payment between the Owner and an owed player during it, both finish', async () => {
    const player = await owedPlayer();
    expect(player.id < owner.id).toBe(true);
    const code = await freshCode(owner, device, 'timeBackApply');
    const sendApply = await preparePost(
      APPLY,
      owner,
      { start: easternWall(applyWeek.start), end: easternWall(applyWeek.end), code },
      device,
    );

    const { response, paid } = await raceOnOwnerAccount(sendApply, payOwner(player));

    expect(paid.error).toBeUndefined();
    expect(response.status).toBe(200);
    const timeBackId = response.body.data.id;
    const playerAfter = await prisma.user.findUnique({ where: { id: player.id } });
    expect(playerAfter.settings.owedWeeklyClaims).toEqual([{ timeBackId, weekStart: applyWeek.start.toISOString() }]);
    expect(Number(playerAfter.money)).toBe(startingMoney - studFee);
    const ownerAfter = await prisma.user.findUnique({ where: { id: owner.id } });
    expect(Number(ownerAfter.money)).toBe(startingMoney + studFee);
    // The code was spent with the apply: sent again, it is refused.
    const replay = await post(
      APPLY,
      owner,
      { start: easternWall(undoWeek.start), end: easternWall(undoWeek.end), code },
      device,
    );
    expect(replay.status).toBe(403);
    expect(replay.body.code).toBe('staffFreshCodeInvalid');
  }, 120_000);

  it('undo: a payment between the Owner and an owed player during it, both finish', async () => {
    const player = await owedPlayer();
    expect(player.id < owner.id).toBe(true);
    const applyCode = await freshCode(owner, device, 'timeBackApply');
    const applied = await post(
      APPLY,
      owner,
      { start: easternWall(undoWeek.start), end: easternWall(undoWeek.end), code: applyCode },
      device,
    );
    expect(applied.status).toBe(200);
    const timeBackId = applied.body.data.id;
    const owed = await prisma.user.findUnique({ where: { id: player.id } });
    expect(owed.settings.owedWeeklyClaims).toEqual([{ timeBackId, weekStart: undoWeek.start.toISOString() }]);
    const code = await freshCode(owner, device, 'timeBackUndo');
    const sendUndo = await preparePost(`${staffApi}/time-back/${timeBackId}/undo`, owner, { code }, device);

    const { response, paid } = await raceOnOwnerAccount(sendUndo, payOwner(player));

    expect(paid.error).toBeUndefined();
    expect(response.status).toBe(200);
    const playerAfter = await prisma.user.findUnique({ where: { id: player.id } });
    expect(playerAfter.settings.owedWeeklyClaims ?? []).toEqual([]);
    expect(Number(playerAfter.money)).toBe(startingMoney - studFee);
    expect((await prisma.timeBack.findUnique({ where: { id: timeBackId } })).reversedAt).not.toBeNull();
  }, 120_000);
});
