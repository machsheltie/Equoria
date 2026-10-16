/**
 * Shared real-DB fixtures for the stud-booking suites (Equoria-q4uem.9).
 *
 * Every fixture is scoped by a per-suite prefix and a random tag, created
 * through Prisma against the real test database, and removed by the
 * fail-loud cleanup tracker the suite owns. No mocks.
 *
 * `holdRowLockUntil` is the interleaving tool: instead of a production test
 * seam (capped by owner ruling, .claude/rules/INTERLEAVING_TEST_SEAMS.md), a
 * test-held Postgres transaction writes a row and keeps it uncommitted. A
 * request that later writes the same row BLOCKS on the real row lock; the
 * test sees that wait in pg_stat_activity, then commits, and the request's
 * guarded UPDATE re-evaluates its WHERE against the newly committed row —
 * exactly the production interleaving, with nothing in production code.
 */

import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../../app.mjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';

export const ORIGIN = 'http://localhost:3000';
const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;

export function tag() {
  return randomBytes(6).toString('hex');
}

export async function sharedBreed() {
  return prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: 'Shared test breed' },
  });
}

export async function makePlayer(prefix, role, money) {
  const suffix = tag();
  const user = await prisma.user.create({
    data: {
      username: `${prefix}-${role}-${suffix}`,
      email: `${prefix}-${role}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Stud',
      lastName: role,
      money,
    },
  });
  return { user, token: generateTestToken({ id: user.id, email: user.email, role: 'user' }) };
}

export async function makeHorse(prefix, { ownerId, sex, breedId, ...overrides }) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${prefix}-${sex}-${tag()}`,
      sex,
      dateOfBirth: new Date(Date.now() - FIVE_YEARS_MS),
      age: 5,
      breedId,
      userId: ownerId,
      healthStatus: 'Good',
      lastFedDate: new Date(),
      ...overrides,
    },
  });
}

async function csrfFor(token) {
  return fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
}

/** POST /api/v1/studs/:sireId/bookings (public stud). Settled: never rejects. */
export async function bookStud(token, sireId, body) {
  const csrf = await csrfFor(token);
  return request(app)
    .post(`/api/v1/studs/${sireId}/bookings`)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body)
    .then(
      res => ({ status: res.status, body: res.body }),
      err => ({ status: 0, body: { message: String(err?.message ?? err) } }),
    );
}

/** POST /api/v1/horses/foals (own pair). Settled: never rejects. */
export async function breedOwnPair(token, sireId, damId) {
  const csrf = await csrfFor(token);
  return request(app)
    .post('/api/v1/horses/foals')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ sireId, damId })
    .then(
      res => ({ status: res.status, body: res.body }),
      err => ({ status: 0, body: { message: String(err?.message ?? err) } }),
    );
}

export async function moneyOf(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

/** A PENDING private-stud request on `damId`, written directly (the request endpoint is slice 3). */
export async function seedPendingRequest({ sire, dam, mareOwner, stallionOwner, fee }) {
  return prisma.breedingRecord.create({
    data: {
      kind: 'PRIVATE_STUD',
      status: 'PENDING',
      fee,
      sireId: sire.id,
      damId: dam.id,
      mareOwnerId: mareOwner.id,
      stallionOwnerId: stallionOwner.id,
      sireName: sire.name,
      damName: dam.name,
      mareOwnerName: mareOwner.username,
      stallionOwnerName: stallionOwner.username,
    },
  });
}

const LOCK_WAIT_TIMEOUT_MS = 20000;

/**
 * Run `rowWrite(tx)` in a test-held transaction, start `action()`, wait until
 * some OTHER session is blocked on a row lock (the action reached the guarded
 * write), then commit the held transaction and return the action's result.
 *
 * If the action FINISHES without ever writing the held row (code that does not
 * guard that row at all), the held change is committed afterwards and the
 * action's result is returned as-is, so the test's own assertions report what
 * the unguarded code did instead of a harness timeout.
 *
 * @param {(tx: object) => Promise<unknown>} rowWrite - the uncommitted change
 * @param {() => Promise<T>} action - the request under test
 * @returns {Promise<T>}
 */
export async function holdRowLockUntil(rowWrite, action) {
  let actionPromise;
  await prisma.$transaction(
    async tx => {
      await rowWrite(tx);
      let settled = false;
      actionPromise = action().finally(() => {
        settled = true;
      });
      const ownPid = (await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;
      const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
      for (;;) {
        const waiting = await tx.$queryRaw`
          SELECT count(*)::int AS n
            FROM pg_locks l
           WHERE NOT l.granted
             AND ${ownPid} = ANY(pg_blocking_pids(l.pid))`;
        if (waiting[0].n > 0 || settled) {
          break;
        }
        if (Date.now() > deadline) {
          throw new Error('holdRowLockUntil: the action never blocked on the held row lock');
        }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    },
    { timeout: LOCK_WAIT_TIMEOUT_MS + 10000 },
  );
  return actionPromise;
}

/** Remove every fixture a suite created for these users and horses (records first: SetNull FKs). */
export function registerCleanup(cleanup, { userIds, horseIds }) {
  cleanup.add(
    () =>
      prisma.breedingRecord.deleteMany({
        where: {
          OR: [
            { mareOwnerId: { in: userIds } },
            { stallionOwnerId: { in: userIds } },
            { damId: { in: horseIds } },
            { sireId: { in: horseIds } },
          ],
        },
      }),
    'breedingRecords',
  );
  cleanup.add(
    () => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }),
    'notifications',
  );
  cleanup.add(
    () => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }),
    'userTransactions',
  );
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
}
