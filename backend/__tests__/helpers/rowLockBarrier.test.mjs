/**
 * rowLockBarrier self-test (Equoria-sgkjp).
 *
 * WHY THIS FILE EXISTS. The barrier is the one piece of test infrastructure
 * whose correctness CANNOT be inferred from its consumers being green. If a
 * refactor quietly turned it into a delay (a sleep in place of the
 * pg_blocking_pids poll, a counter that sees any blocked session, a "lock"
 * that holds nothing), every race test built on it would keep passing while
 * reproducing no race at all: a broken barrier makes its consumers GREENER.
 * So the harness proves itself here, on its own terms.
 *
 * THE POSITIVE CONTROL (load-bearing — read before editing). Case 1 plants a
 * deliberately racy read-modify-write (read the balance, write read + amount)
 * and asserts the barrier CATCHES it: exactly one of two increments is lost,
 * every time. The same barrier with the atomic form keeps both. If the barrier
 * stops forcing the interleaving, case 1 stops losing the update and fails.
 * Cases 2 and 3 pin the two properties a sleep-substitute or a sloppy count
 * would break: the wait never resolves when nothing is blocked, and sessions
 * blocked by SOMEONE ELSE are not counted. Case 4 guards the positive control's
 * own side effects, as in rawStatementsStayInTransaction.sentinel's third
 * case: no barrier from this file is left holding a lock or a waiter.
 *
 * Real PostgreSQL, no mocks, no sleeps. The only rows touched are this file's
 * own two fixture users, deleted fail-loud in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from './failLoudCleanup.mjs';
import { blockedSessionPids, createBarrierClient, holdLock, raceBehindLock } from './rowLockBarrier.mjs';

const fixturePrefix = 'TestFixture-sgkjp-barrier';
const barrierClient = createBarrierClient();
// A second, unrelated holder for case 3, on its own pool.
const otherClient = createBarrierClient();

const startingMoney = 1000;
const barrierPids = [];

async function makeUser(label) {
  const tag = randomBytes(6).toString('hex');
  return prisma.user.create({
    data: {
      emailVerified: true,
      email: `${fixturePrefix}-${label}-${tag}@example.com`,
      username: `${fixturePrefix}-${label}-${tag}`.slice(0, 30),
      password: 'irrelevant-not-a-login-test',
      firstName: 'Barrier',
      lastName: label,
      money: startingMoney,
      settings: {},
    },
  });
}

const userRowLock = userId => tx => tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

const readMoney = async userId =>
  (await prisma.user.findUnique({ where: { id: userId }, select: { money: true } })).money;

/** The planted defect: a known-unsafe read-modify-write. */
async function unsafeAdd(userId, amount) {
  const rows = await prisma.$queryRaw`SELECT money FROM "User" WHERE id = ${userId}`;
  const next = Number(rows[0].money) + amount;
  await prisma.$executeRaw`UPDATE "User" SET money = ${next} WHERE id = ${userId}`;
}

/** The safe form: one atomic statement. */
async function atomicAdd(userId, amount) {
  await prisma.$executeRaw`UPDATE "User" SET money = money + ${amount} WHERE id = ${userId}`;
}

/** A NOWAIT probe on the barrier client's pool: does someone hold this row? */
async function rowIsLocked(userId) {
  try {
    await barrierClient.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE NOWAIT`;
    return false;
  } catch (error) {
    if (/could not obtain lock/i.test(error.message)) {
      return true;
    }
    throw error;
  }
}

describe('rowLockBarrier proves itself (Equoria-sgkjp)', () => {
  const cleanup = createCleanupTracker();
  let user;
  let bystander;

  beforeAll(async () => {
    user = await makeUser('racer');
    const userId = user.id;
    cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'racer user');
    bystander = await makeUser('bystander');
    const bystanderId = bystander.id;
    cleanup.add(() => prisma.user.deleteMany({ where: { id: bystanderId } }), 'bystander user');
  }, 60000);

  afterAll(async () => {
    await cleanup.run();
    await barrierClient.$disconnect();
    await otherClient.$disconnect();
  }, 60000);

  it('positive control: catches a planted racy read-modify-write, and keeps the atomic form whole', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { money: startingMoney } });

    const barrier = await holdLock(barrierClient, userRowLock(user.id));
    barrierPids.push(barrier.pid);
    let racers;
    try {
      // While armed the row is really locked: a NOWAIT probe is refused.
      expect(await rowIsLocked(user.id)).toBe(true);
      racers = [unsafeAdd(user.id, 10), unsafeAdd(user.id, 10)];
      await barrier.waitForQueued(2);
    } finally {
      await barrier.release();
    }
    await Promise.all(racers);

    // Both racers read 1000 before either wrote: one increment is lost, exactly.
    expect(await readMoney(user.id)).toBe(startingMoney + 10);

    await prisma.user.update({ where: { id: user.id }, data: { money: startingMoney } });
    await raceBehindLock(barrierClient, userRowLock(user.id), [
      () => atomicAdd(user.id, 10),
      () => atomicAdd(user.id, 10),
    ]);
    expect(await readMoney(user.id)).toBe(startingMoney + 20);
  }, 60000);

  it('never resolves the wait while nothing is blocked (a delay would)', async () => {
    const barrier = await holdLock(barrierClient, userRowLock(user.id));
    barrierPids.push(barrier.pid);
    try {
      await expect(barrier.waitForQueued(1, 400)).rejects.toThrow(/Timed out waiting for 1 session/);
      expect(await blockedSessionPids(barrierClient, barrier.pid)).toEqual([]);
    } finally {
      await barrier.release();
    }
  }, 60000);

  it('counts only sessions blocked by the holder, not by an unrelated lock', async () => {
    const ours = await holdLock(barrierClient, userRowLock(user.id));
    barrierPids.push(ours.pid);
    const theirs = await holdLock(otherClient, userRowLock(bystander.id));
    barrierPids.push(theirs.pid);
    let waiter;
    try {
      waiter = atomicAdd(bystander.id, 1);
      await theirs.waitForQueued(1);
      // One session IS blocked in the database, but not by our holder.
      await expect(ours.waitForQueued(1, 400)).rejects.toThrow(/saw 0/);
      const waiters = await blockedSessionPids(otherClient, theirs.pid);
      expect(waiters).toHaveLength(1);
      expect(await blockedSessionPids(barrierClient, ours.pid)).toEqual([]);
    } finally {
      await theirs.release();
      await ours.release();
    }
    await waiter;
    expect(await readMoney(bystander.id)).toBe(startingMoney + 1);
  }, 60000);

  it('leaves no lock or waiter behind from the cases above', async () => {
    expect(barrierPids).toHaveLength(4);
    const held = await prisma.$queryRaw`
      SELECT count(*)::int AS n FROM pg_locks
      WHERE pid = ANY(${barrierPids}::int[]) AND locktype IN ('tuple', 'transactionid')`;
    expect(held[0].n).toBe(0);
    expect(await rowIsLocked(user.id)).toBe(false);
    expect(await rowIsLocked(bystander.id)).toBe(false);
  }, 60000);
});
