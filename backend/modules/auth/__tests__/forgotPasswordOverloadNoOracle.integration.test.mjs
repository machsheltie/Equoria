/**
 * forgot-password gives no status or timing oracle under database overload
 * (Equoria-jeci6, owner ruling J-2 option a, 2026-10-19; fix round 1).
 *
 * Before: only the registered-email branch writes (an UPDATE + INSERT
 * transaction), so only a real account could get the retryable 503 "busy,
 * retry" answer when that transaction failed. An unknown email always got the
 * generic 200. The status code therefore revealed which emails are registered
 * whenever the database was overloaded. And because the transaction could
 * wait up to Prisma's default 5000 ms before failing, the response TIME of a
 * contended real account also stood out against the 1 s floor.
 *
 * Rule: forgot-password always gives the same 200 answer for known and unknown
 * emails, at the response floor. The token save is bounded well under the
 * floor, so a contended save fails in time for the floor to cover it. The
 * failure is logged on the server without the raw email address, and no reset
 * email is sent (the player retries if no email arrives).
 *
 * How the failure is forced, for real: a second transaction holds a row lock
 * on the account's unused reset-token row until the request has answered. The
 * handler's UPDATE waits on that lock until its bounded transaction gives up
 * (P2028), the retryable "busy" failure. No Prisma, service or controller
 * mock; the logger is only observed.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import * as passwordController from '../controllers/passwordController.mjs';

const FLOOR_MS = passwordController.FORGOT_PASSWORD_MIN_RESPONSE_MS;
const EMAIL_PREFIX = 'testfixture-jeci6busy';
// The holder releases its lock as soon as the request has answered; this cap
// only bounds the test if the request never answers. It is longer than
// Prisma's default 5000 ms interactive timeout, so an unbounded token save
// would still be holding the request when it fires.
const LOCK_CAP_MS = 8000;
// Upper tolerance for a contended request: the floor plus half of it. Without
// a bounded token save the request waits ~5000 ms; with one it answers at the
// floor. Load only matters if the pre-save work (bcrypt anchor) plus the
// bounded save exceed 1500 ms.
const CONTENDED_UPPER_MS = FLOOR_MS * 1.5;

const createdUserIds = [];
let user;

beforeAll(async () => {
  const tag = randomBytes(6).toString('hex');
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `TestFixture-jeci6busy-${tag}`,
      email: `${EMAIL_PREFIX}-${tag}@example.com`,
      password: await bcrypt.hash('BusyPass123!', 1),
      firstName: 'Busy',
      lastName: 'Sentinel',
      money: 0,
    },
  });
  createdUserIds.push(user.id);
  // An unused token row for the handler's UPDATE to contend on.
  await prisma.$executeRaw`
    INSERT INTO password_reset_tokens ("tokenHash", "userId", email, "expiresAt")
    VALUES (${randomBytes(32).toString('hex')}, ${user.id}, ${user.email}, NOW() + interval '1 hour')`;
}, 60000);

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.$executeRaw`DELETE FROM password_reset_tokens WHERE "userId" = ANY(${createdUserIds}::text[])`;
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
}, 30000);

async function timedForgot(email) {
  const start = process.hrtime.bigint();
  const res = await request(app)
    .post('/api/v1/auth/forgot-password')
    .set('Origin', 'http://localhost:3000')
    .send({ email });
  return { res, ms: Number(process.hrtime.bigint() - start) / 1e6 };
}

/**
 * Hold a FOR UPDATE lock on the user's unused token row until `release()` is
 * called (or the cap passes). Resolves `locked` once the lock is held.
 */
function holdTokenRowLock(userId) {
  let lockTaken;
  let release;
  const locked = new Promise(resolve => {
    lockTaken = resolve;
  });
  const released = new Promise(resolve => {
    release = resolve;
  });
  const done = prisma.$transaction(
    async tx => {
      await tx.$queryRaw`
        SELECT id FROM password_reset_tokens
        WHERE "userId" = ${userId} AND "usedAt" IS NULL
        FOR UPDATE`;
      lockTaken();
      await Promise.race([released, sleep(LOCK_CAP_MS)]);
    },
    { timeout: LOCK_CAP_MS + 10000 },
  );
  return { locked, release, done };
}

describe('forgot-password under database overload (Equoria-jeci6 J-2)', () => {
  it('a registered email whose token save fails gets the same answer as an unknown email, at the floor', async () => {
    const unknown = await timedForgot(`${EMAIL_PREFIX}-nobody-${randomBytes(6).toString('hex')}@example.com`);

    const spies = ['info', 'warn', 'error'].map(level => jest.spyOn(logger, level));
    const holder = holdTokenRowLock(user.id);
    let known;
    let calls;
    try {
      await holder.locked;
      known = await timedForgot(user.email);
    } finally {
      holder.release();
      await holder.done;
      // Read the calls before mockRestore clears them.
      calls = Object.fromEntries(['info', 'warn', 'error'].map((level, i) => [level, [...spies[i].mock.calls]]));
      for (const spy of spies) {
        spy.mockRestore();
      }
    }

    // Same status and body as an unknown email: no status oracle.
    expect(unknown.res.status).toBe(200);
    expect({ status: known.res.status, body: known.res.body }).toEqual({
      status: unknown.res.status,
      body: unknown.res.body,
    });

    // No timing oracle: the contended request also answers at the floor.
    expect(unknown.ms).toBeGreaterThanOrEqual(FLOOR_MS - 1);
    expect(known.ms).toBeGreaterThanOrEqual(FLOOR_MS - 1);
    expect(Math.round(known.ms)).toBeLessThan(CONTENDED_UPPER_MS);

    // The failure path really ran: no new token row was saved.
    const rows = await prisma.$queryRaw`
      SELECT id FROM password_reset_tokens WHERE "userId" = ${user.id}`;
    expect(rows.length).toBe(1);

    // The failure was logged on the server, and no log line names the raw email.
    const failureLogged = calls.error.some(
      ([msg]) => typeof msg === 'string' && msg.includes('[forgotPassword] reset token not saved'),
    );
    expect(failureLogged).toBe(true);
    const loggedText = JSON.stringify([...calls.info, ...calls.warn, ...calls.error], (_k, v) =>
      v instanceof Error ? { message: v.message, stack: v.stack } : v,
    ).toLowerCase();
    expect(loggedText).not.toContain(user.email.toLowerCase());
  }, 60000);
});
