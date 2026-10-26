/**
 * At most four accounts per player: real signups, real DB (Equoria-x5n89,
 * owner ruling 2026-10-23).
 *
 * Rules pinned here:
 *  - a device that has signed in to four accounts in the last 90 days cannot
 *    create a fifth, whatever address the signup comes from; the refusal is an
 *    authored message with a code, and no account is created;
 *  - the four allowed accounts can all be created from one device;
 *  - a shared address alone never blocks: another device behind the same IP
 *    signs up normally;
 *  - sightings older than the 90-day window do not count;
 *  - two signups racing from a device with three accounts: exactly one wins.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import crypto from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestUser } from '../../../tests/helpers/authHelper.mjs';
import { signupDeviceLockKey } from '../services/deviceAccountLimitService.mjs';
import { ORIGIN, createUserFactory, sha256 } from './helpers/staffFixtures.mjs';

const REFUSAL_MESSAGE = 'This device already has four Equoria accounts, which is the most one player may have.';
const DAY_MS = 24 * 60 * 60 * 1000;

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('devlimit');
const scope = () => ({ in: createdUserIds });
cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
cleanup.add(() => prisma.emailVerificationToken.deleteMany({ where: { userId: scope() } }), 'verification tokens');
cleanup.add(() => prisma.horse.deleteMany({ where: { userId: scope() } }), 'starter horses');
// login_sightings go with their users (ON DELETE CASCADE).
cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
afterAll(() => cleanup.run(), 60_000);

const octet = () => crypto.randomInt(1, 254);
const freshIp = () => `198.51.${octet()}.${octet()}`;
const freshDevice = () => crypto.randomBytes(32).toString('hex');

/** A real signup from `device` (a raw equoriaDevice token) and `ip`. */
function signupRequest({ device, ip = freshIp() } = {}) {
  const body = createTestUser({ username: `devlimit${crypto.randomBytes(6).toString('hex')}` });
  const send = () => {
    const req = request(app).post('/api/v1/auth/register').set('Origin', ORIGIN).set('X-Forwarded-For', ip);
    if (device) {
      req.set('Cookie', [`equoriaDevice=${device}`]);
    }
    return req.send(body).then(res => {
      if (res.status === 201) {
        createdUserIds.push(res.body.data.user.id);
      }
      return res;
    });
  };
  return { body, send };
}

const signup = opts => signupRequest(opts).send();

/** Accounts already seen on a device: fixture users with a sighting each. */
async function seedDevice(device, count, { lastSeenAt = new Date() } = {}) {
  for (let i = 0; i < count; i += 1) {
    const user = await makeUser('user');
    await prisma.loginSighting.create({
      data: { userId: user.id, ipAddress: freshIp(), deviceHash: sha256(device), lastSeenAt },
    });
  }
}

const accountsOnDevice = async device =>
  (
    await prisma.loginSighting.findMany({
      where: { deviceHash: sha256(device) },
      distinct: ['userId'],
      select: { userId: true },
    })
  ).length;

function expectRefused(res) {
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('accountLimitReached');
  expect(res.body.message).toBe(REFUSAL_MESSAGE);
}

describe('at most four accounts per device (Equoria-x5n89)', () => {
  it('creates four accounts from one device and refuses the fifth, from any address', async () => {
    const device = freshDevice();
    for (let i = 0; i < 4; i += 1) {
      expect((await signup({ device })).status).toBe(201);
    }
    expect(await accountsOnDevice(device)).toBe(4);

    const fifth = signupRequest({ device });
    expectRefused(await fifth.send());
    expect(await prisma.user.findUnique({ where: { email: fifth.body.email } })).toBeNull();
    expect(await accountsOnDevice(device)).toBe(4);
  }, 60_000);

  it('counts accounts that only signed in on the device', async () => {
    const device = freshDevice();
    await seedDevice(device, 4);
    const res = signupRequest({ device });
    expectRefused(await res.send());
    expect(await prisma.user.findUnique({ where: { email: res.body.email } })).toBeNull();
  });

  it('never blocks another device behind the same address', async () => {
    const full = freshDevice();
    const sharedIp = freshIp();
    await seedDevice(full, 4);
    expectRefused(await signup({ device: full, ip: sharedIp }));

    expect((await signup({ device: freshDevice(), ip: sharedIp })).status).toBe(201);
    // A browser with no device cookie yet is a new device too.
    expect((await signup({ ip: sharedIp })).status).toBe(201);
  }, 30_000);

  it('ignores sightings older than the 90-day window', async () => {
    const device = freshDevice();
    await seedDevice(device, 4, { lastSeenAt: new Date(Date.now() - 91 * DAY_MS) });
    expect((await signup({ device })).status).toBe(201);
  }, 30_000);

  it('lets exactly one of two racing signups take the last place on a device', async () => {
    const device = freshDevice();
    await seedDevice(device, 3);
    const racers = [signupRequest({ device }), signupRequest({ device })];

    const responses = await raceAtDeviceLock(
      sha256(device),
      racers.map(r => r.send),
    );

    expect(responses.map(r => r.status).sort()).toEqual([201, 403]);
    expectRefused(responses.find(r => r.status === 403));
    expect(await accountsOnDevice(device)).toBe(4);
  }, 60_000);
});

/**
 * Hold the device's signup lock in a real transaction, send every signup, and
 * release only once all of them are queued behind it (directly or behind each
 * other), so they reach the count together. Polls inside the holder's own
 * transaction (the test pool has three connections), refreshes the
 * pg_stat_activity snapshot each time, and counts only sessions blocked by this
 * holder. Fails if the signups never queue on the lock.
 */
async function raceAtDeviceLock(deviceHash, starters, timeoutMs = 20_000) {
  let sent = [];
  try {
    await prisma.$transaction(
      async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${signupDeviceLockKey(deviceHash)}::bigint)`;
        sent = starters.map(send => Promise.resolve(send()));
        const deadline = Date.now() + timeoutMs;
        for (;;) {
          await tx.$executeRaw`SELECT pg_stat_clear_snapshot()`;
          const [{ n }] = await tx.$queryRaw`
            WITH RECURSIVE queued(pid) AS (
              SELECT pid FROM pg_stat_activity
              WHERE pg_backend_pid() = ANY(pg_blocking_pids(pid))
              UNION
              SELECT a.pid FROM pg_stat_activity a
              JOIN queued q ON q.pid = ANY(pg_blocking_pids(a.pid))
            )
            SELECT count(*)::int AS n FROM queued`;
          if (n >= starters.length) {
            return;
          }
          if (Date.now() > deadline) {
            throw new Error(`only ${n} of ${starters.length} signups queued at the device lock`);
          }
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      },
      { timeout: timeoutMs + 10_000 },
    );
  } catch (error) {
    await Promise.allSettled(sent);
    throw error;
  }
  return Promise.all(sent);
}
