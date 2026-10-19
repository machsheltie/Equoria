/**
 * forgot-password gives no status oracle under database overload
 * (Equoria-jeci6, owner ruling J-2 option a, 2026-10-19).
 *
 * Before: only the registered-email branch writes (an UPDATE + INSERT
 * transaction), so only a real account could get the retryable 503 "busy,
 * retry" answer when that transaction failed. An unknown email always got the
 * generic 200. The status code therefore revealed which emails are registered
 * whenever the database was overloaded.
 *
 * Rule: forgot-password always gives the same 200 answer for known and unknown
 * emails. A failure to save the reset token is logged on the server, without
 * the email address, and no reset email is sent (the player retries if no
 * email arrives).
 *
 * How the failure is forced, for real: a second transaction holds a row lock
 * on the account's unused reset-token row for longer than Prisma's 5000 ms
 * interactive-transaction timeout. The handler's UPDATE waits on that lock
 * and its transaction times out (P2028), the retryable "busy" failure. No
 * Prisma, service or controller mock; the logger is only observed.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

const EMAIL_PREFIX = 'testfixture-jeci6busy';
// Longer than Prisma's default 5000 ms interactive-transaction timeout, so the
// handler's transaction gives up while the lock is still held.
const LOCK_HOLD_MS = 7000;

const createdUserIds = [];
let user;

beforeAll(async () => {
  const tag = randomBytes(6).toString('hex');
  user = await prisma.user.create({
    data: {
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

const forgot = email =>
  request(app).post('/api/v1/auth/forgot-password').set('Origin', 'http://localhost:3000').send({ email });

describe('forgot-password under database overload (Equoria-jeci6 J-2)', () => {
  it('a registered email whose token save fails gets the same answer as an unknown email', async () => {
    const unknownRes = await forgot(`${EMAIL_PREFIX}-nobody-${randomBytes(6).toString('hex')}@example.com`);

    const warnSpy = jest.spyOn(logger, 'warn');
    const errorSpy = jest.spyOn(logger, 'error');
    try {
      let lockTaken;
      const locked = new Promise(resolve => {
        lockTaken = resolve;
      });
      const holder = prisma.$transaction(
        async tx => {
          await tx.$queryRaw`
            SELECT id FROM password_reset_tokens
            WHERE "userId" = ${user.id} AND "usedAt" IS NULL
            FOR UPDATE`;
          lockTaken();
          await sleep(LOCK_HOLD_MS);
        },
        { timeout: LOCK_HOLD_MS + 10000 },
      );
      await locked;
      const knownRes = await forgot(user.email);
      await holder;

      // Same status and body as an unknown email: no status oracle.
      expect(unknownRes.status).toBe(200);
      expect({ status: knownRes.status, body: knownRes.body }).toEqual({
        status: unknownRes.status,
        body: unknownRes.body,
      });

      // The failure path really ran: no new token row was saved.
      const rows = await prisma.$queryRaw`
        SELECT id FROM password_reset_tokens WHERE "userId" = ${user.id}`;
      expect(rows.length).toBe(1);

      // The failure was logged on the server, and no warn/error line names the email.
      const failureLogged = errorSpy.mock.calls.some(
        ([msg]) => typeof msg === 'string' && msg.includes('[forgotPassword] reset token not saved'),
      );
      expect(failureLogged).toBe(true);
      const loggedText = JSON.stringify([...warnSpy.mock.calls, ...errorSpy.mock.calls], (_k, v) =>
        v instanceof Error ? { message: v.message, stack: v.stack } : v,
      );
      expect(loggedText).not.toContain(user.email);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  }, 60000);
});
