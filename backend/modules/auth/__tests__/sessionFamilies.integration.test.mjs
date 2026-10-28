/**
 * Equoria-wj4bc (owner ruling q180, 2026-10-28) and Equoria-yrixa (ACC-08).
 *
 * "Allow a few devices at once — up to about 5 logins stay signed in, each
 * safely renewed on its own; your oldest drops off after that."
 *
 * Old behaviour: every login deleted all of the player's refresh tokens, so a
 * second device signed the first out at its next refresh; logout deleted every
 * session but left each 15-minute access token working; and two tabs sharing
 * one cookie jar that refreshed at the same moment got one of them a 401.
 *
 * Now each login is its own session (refresh-token family): rotation and reuse
 * detection stay inside it, at most five stay open, and logout ends only the
 * session it came from — refresh token and access tokens both.
 *
 * Real database, real HTTP through the app, real login, refresh and logout.
 * Nothing is mocked.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../../../__tests__/config/test-helpers.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { hashRefreshToken } from '../../../utils/tokenRotationService.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let cleanup;

beforeEach(async () => {
  cleanup = createCleanupTracker();
  user = await createTestUser();
  const userId = user.id;
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId } }), 'refreshToken(userId)');
  cleanup.add(() => prisma.userPresence.deleteMany({ where: { userId } }), 'userPresence(userId)');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'user(id)');
}, 30_000);

afterEach(async () => {
  await cleanup.run();
}, 30_000);

function cookieValue(setCookies, name) {
  const cookie = (setCookies || []).find(c => c.startsWith(`${name}=`));
  return cookie ? cookie.split(';')[0].slice(name.length + 1) : undefined;
}

/** A device: its own cookie jar, holding one access and one refresh token. */
async function signIn(jar = {}) {
  const req = request(app).post('/api/v1/auth/login').set('Origin', ORIGIN);
  if (jar.refreshToken) {
    req.set('Cookie', [`refreshToken=${jar.refreshToken}`]);
  }
  const res = await req.send({ email: user.email, password: user.plainPassword });
  expect(res.status).toBe(200);
  const device = {
    accessToken: cookieValue(res.headers['set-cookie'], 'accessToken'),
    refreshToken: cookieValue(res.headers['set-cookie'], 'refreshToken'),
  };
  expect(device.accessToken).toBeTruthy();
  expect(device.refreshToken).toBeTruthy();
  return device;
}

const familyOf = token => jwt.decode(token).familyId;

function refreshWith(refreshToken) {
  return request(app)
    .post('/api/v1/auth/refresh-token')
    .set('Origin', ORIGIN)
    .set('Cookie', [`refreshToken=${refreshToken}`]);
}

/** Refresh the device in place, as its browser would; returns the status. */
async function refresh(device) {
  const res = await refreshWith(device.refreshToken);
  if (res.status === 200) {
    device.accessToken = cookieValue(res.headers['set-cookie'], 'accessToken');
    device.refreshToken = cookieValue(res.headers['set-cookie'], 'refreshToken') ?? device.refreshToken;
  }
  return res;
}

async function readOwnAccount(accessToken) {
  const res = await request(app)
    .get(`/api/v1/users/${user.id}`)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${accessToken}`);
  return res.status;
}

async function signOut(device) {
  const cookies = [`accessToken=${device.accessToken}`, `refreshToken=${device.refreshToken}`];
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookies });
  const res = await request(app)
    .post('/api/v1/auth/logout')
    .set('Origin', ORIGIN)
    .set('Cookie', [...cookies, ...(csrf.cookieHeader || [])])
    .set('X-CSRF-Token', csrf.csrfToken);
  expect(res.status).toBe(200);
}

/**
 * Hold a row lock, start the racers one at a time until each is queued behind
 * it, then release them together. A local copy of the staff suites' barrier
 * (modules may not deep-import each other's test helpers); it keeps the three
 * traps in mind: poll on the holder's own tx (pool of 3), clear the stats
 * snapshot, and count only sessions queued behind this holder.
 */
async function raceUnderLock(lock, starters, timeoutMs = 20_000) {
  const tracked = [];
  await prisma.$transaction(
    async tx => {
      await lock(tx);
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
        const settled = tracked.filter(t => t.settled).length;
        if (n + settled >= tracked.length) {
          if (tracked.length === starters.length) {
            return;
          }
          const state = { settled: false };
          state.done = Promise.resolve(starters[tracked.length]()).finally(() => {
            state.settled = true;
          });
          tracked.push(state);
        } else if (Date.now() > deadline) {
          throw new Error(`only ${n} queued and ${settled} settled of ${tracked.length} started`);
        }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    },
    { timeout: timeoutMs + 10_000 },
  );
  return Promise.all(tracked.map(t => t.done));
}

async function liveFamilies() {
  const rows = await prisma.refreshToken.findMany({
    where: { userId: user.id, isActive: true, isInvalidated: false, expiresAt: { gt: new Date() } },
    select: { familyId: true },
  });
  return new Set(rows.map(row => row.familyId));
}

describe('Equoria-wj4bc — a few devices stay signed in at once', () => {
  it('five devices stay signed in, and each one renews on its own', async () => {
    const devices = [];
    for (let i = 0; i < 5; i += 1) {
      devices.push(await signIn());
    }
    expect(new Set(devices.map(d => familyOf(d.refreshToken))).size).toBe(5);

    for (const device of devices) {
      expect((await refresh(device)).status).toBe(200);
      expect(await readOwnAccount(device.accessToken)).toBe(200);
    }
    expect((await liveFamilies()).size).toBe(5);
  });

  it('a sixth login ends the oldest session; the other five keep playing', async () => {
    const devices = [];
    for (let i = 0; i < 5; i += 1) {
      devices.push(await signIn());
    }
    const [oldest] = devices;
    // Read with the oldest device first, so a cached "still open" answer is
    // in place when the sixth login ends it.
    expect(await readOwnAccount(oldest.accessToken)).toBe(200);
    devices.push(await signIn());
    const rest = devices.slice(1);

    expect(await readOwnAccount(oldest.accessToken)).toBe(401);
    expect((await refresh(oldest)).status).toBe(401);

    for (const device of rest) {
      expect((await refresh(device)).status).toBe(200);
      expect(await readOwnAccount(device.accessToken)).toBe(200);
    }
    const live = await liveFamilies();
    expect(live.size).toBe(5);
    expect(live.has(familyOf(oldest.refreshToken))).toBe(false);
  });

  it('a new login never reuses the session of the cookie it replaces, and ends it', async () => {
    const elsewhere = await signIn();
    const browser = await signIn();
    const replaced = { ...browser };

    const again = await signIn(browser);
    expect(familyOf(again.refreshToken)).not.toBe(familyOf(replaced.refreshToken));

    expect((await refresh(replaced)).status).toBe(401);
    expect(await readOwnAccount(replaced.accessToken)).toBe(401);
    expect((await refresh(again)).status).toBe(200);
    expect((await refresh(elsewhere)).status).toBe(200);
  });
});

describe('Equoria-yrixa — logout ends that session only', () => {
  it('logging out on one device ends its refresh and access tokens; the other device keeps working', async () => {
    const phone = await signIn();
    const laptop = await signIn();
    expect(await readOwnAccount(phone.accessToken)).toBe(200);
    expect(await readOwnAccount(laptop.accessToken)).toBe(200);

    await signOut(phone);

    expect(await readOwnAccount(phone.accessToken)).toBe(401);
    expect((await refresh(phone)).status).toBe(401);

    expect(await readOwnAccount(laptop.accessToken)).toBe(200);
    expect((await refresh(laptop)).status).toBe(200);
    expect(await readOwnAccount(laptop.accessToken)).toBe(200);
  });
});

describe('Equoria-wj4bc — rotation and reuse stay inside one session', () => {
  it('reusing an already-rotated refresh token revokes only that session', async () => {
    const stolen = await signIn();
    const other = await signIn();
    const firstToken = stolen.refreshToken;

    expect((await refresh(stolen)).status).toBe(200);
    const replay = await refreshWith(firstToken);
    expect(replay.status).toBe(401);
    expect(replay.body.message).toMatch(/reuse/i);

    expect((await refresh(stolen)).status).toBe(401);
    expect(await readOwnAccount(stolen.accessToken)).toBe(401);

    expect((await refresh(other)).status).toBe(200);
    expect(await readOwnAccount(other.accessToken)).toBe(200);
  });

  it('two tabs sharing one cookie jar that refresh at the same moment both stay signed in', async () => {
    const jar = await signIn();
    const family = familyOf(jar.refreshToken);
    const tokenHash = hashRefreshToken(jar.refreshToken);

    // Both refreshes are held behind a lock on the token row until both have
    // read it as live, so they truly overlap; then they race for it.
    const [tabA, tabB] = await raceUnderLock(
      tx => tx.$queryRaw`SELECT "id" FROM "refresh_tokens" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`,
      [() => refreshWith(jar.refreshToken), () => refreshWith(jar.refreshToken)],
    );

    expect([tabA.status, tabB.status]).toEqual([200, 200]);
    const rotated = [tabA, tabB].map(res => cookieValue(res.headers['set-cookie'], 'refreshToken')).filter(Boolean);
    // One response carries the rotated refresh token into the jar; the other
    // only renews its access token.
    expect(rotated).toHaveLength(1);
    for (const res of [tabA, tabB]) {
      const access = cookieValue(res.headers['set-cookie'], 'accessToken');
      expect(familyOf(access)).toBe(family);
      expect(await readOwnAccount(access)).toBe(200);
    }

    expect(await prisma.refreshToken.count({ where: { userId: user.id, isInvalidated: true } })).toBe(0);
    expect([...(await liveFamilies())]).toEqual([family]);
    jar.refreshToken = rotated[0];
    expect((await refresh(jar)).status).toBe(200);
  });
});
