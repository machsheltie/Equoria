/**
 * The two tools that change a horse's age are the Owner's alone (Equoria-a7f1p).
 *
 * Owner ruling q341 (2026-11-03): keep both admin tools that change a horse's
 * age, Owner-only, in the Steward's Office:
 *   POST /api/v1/admin/horses/:id/set-age  (set one horse's age)
 *   POST /api/v1/admin/horses/age          (age every horse now)
 *
 * Old contract: the admin router's requireRole('admin') was their only role
 * gate, so every admin could use them. Ruling: an admin and a moderator are
 * refused with 403 even when checked in with a valid CSRF pair, and the
 * refused set-age leaves the horse untouched; the checked-in owner sets the
 * age. The owner's "age every horse now" is not run here because it ages every
 * horse in the shared database.
 *
 * Real Express app, real JWT, real CSRF, real staff check-in, real DB. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';
import { checkedInDeviceCookie } from '../../../tests/helpers/staffDeviceFixture.mjs';
import { hasCapability } from '../../staff/capabilities.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';

const origin = 'http://localhost:3000';
const fixturePrefix = 'TestFixture-ageOwner';

async function makeAccount(role) {
  const tag = randomBytes(6).toString('hex');
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `${fixturePrefix}-${role}-${tag}@example.com`,
      username: `${fixturePrefix}-${role}-${tag}`.slice(0, 30),
      password: 'irrelevant-not-a-login-test',
      firstName: 'Age',
      lastName: role,
      role,
      money: 0,
      settings: {},
    },
  });
  const token = generateTestToken({ id: user.id, email: user.email, role });
  const device = await checkedInDeviceCookie(user.id);
  return { user, token, device };
}

async function postAsCheckedIn(account, path, body) {
  const csrf = await fetchCsrf(app, {
    origin,
    extraCookies: [`accessToken=${account.token}`, account.device],
  });
  return request(app)
    .post(path)
    .set('Authorization', `Bearer ${account.token}`)
    .set('Origin', origin)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

describe('q341: the horse-age tools are Owner only', () => {
  const cleanup = createCleanupTracker();
  const horseIds = [];
  const accounts = {};
  let horse;
  const startingBirth = birthDateForAge(4);

  beforeAll(async () => {
    for (const role of ['moderator', 'admin', 'owner']) {
      accounts[role] = await makeAccount(role);
    }
    const ids = Object.values(accounts).map(a => a.user.id);
    cleanup.add(() => cleanupTestHorses(prisma, horseIds), 'fixture horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids } } }), 'staff accounts');
    horse = await createTestHorse(
      prisma,
      {
        name: `${fixturePrefix}-horse-${randomBytes(4).toString('hex')}`,
        sex: 'Mare',
        dateOfBirth: startingBirth,
        age: 4,
      },
      horseIds,
    );
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('only the owner holds horses.age.set', () => {
    expect(hasCapability('owner', 'horses.age.set')).toBe(true);
    expect(hasCapability('admin', 'horses.age.set')).toBe(false);
    expect(hasCapability('moderator', 'horses.age.set')).toBe(false);
  });

  it.each([['admin'], ['moderator']])(
    'refuses a checked-in %s on set-age (403) and leaves the horse as it was',
    async role => {
      const res = await postAsCheckedIn(accounts[role], `/api/v1/admin/horses/${horse.id}/set-age`, {
        gameAge: 9,
      });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ success: false, message: 'Insufficient permissions' });
      const row = await prisma.horse.findUnique({ where: { id: horse.id }, select: { dateOfBirth: true } });
      expect(row.dateOfBirth.getTime()).toBe(startingBirth.getTime());
    },
  );

  it.each([['admin'], ['moderator']])('refuses a checked-in %s on age-every-horse (403)', async role => {
    const res = await postAsCheckedIn(accounts[role], '/api/v1/admin/horses/age', {});

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, message: 'Insufficient permissions' });
    expect(res.body.message).not.toMatch(/aging completed/i);
  });

  it('lets the checked-in owner set the horse to age 6', async () => {
    const res = await postAsCheckedIn(accounts.owner, `/api/v1/admin/horses/${horse.id}/set-age`, {
      gameAge: 6,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const row = await prisma.horse.findUnique({ where: { id: horse.id }, select: { age: true } });
    expect(row.age).toBe(6);
  });
});
