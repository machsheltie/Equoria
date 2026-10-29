/**
 * Equoria-pt9dh (ACC-11) — the player's own-account read and write never
 * return the password hash.
 *
 * Old behaviour: GET /api/v1/users/:id spread the whole Prisma User row into
 * the response, and PUT /api/v1/users/:id returned the updated row as-is, so
 * both answered with `password` (bcrypt hash), and then also the MFA secrets. A
 * stolen access token or an XSS read therefore also yielded offline-crackable
 * credential material. (The MFA columns went with authenticator-app sign-in,
 * owner ruling 2026-10-29, q305; the password hash and its stamp remain.)
 *
 * Real database, real HTTP, real auth middleware and per-user CSRF. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const secretKeys = ['password', 'passwordChangedAt'];

const cleanup = createCleanupTracker();
let user;
let token;

beforeAll(async () => {
  const suffix = randomBytes(6).toString('hex');
  user = await prisma.user.create({
    data: {
      email: `testfixture-ownsecrets-${suffix}@test.com`,
      username: `TestFixture-ownsecrets-${suffix}`,
      password: '$2b$12$fixtureHashThatMustNeverLeaveTheServerXXXXXXXXXXXXXXXX',
      passwordChangedAt: new Date(Date.now() - 60 * 60 * 1000),
      firstName: 'Secret',
      lastName: 'Keeper',
      emailVerified: true,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'fixture user');
}, 30_000);

afterAll(() => cleanup.run(), 30_000);

function expectNoSecrets(data) {
  expect(data).toBeTruthy();
  expect(data.id).toBe(user.id);
  for (const key of secretKeys) {
    expect(Object.keys(data)).not.toContain(key);
  }
  const serialized = JSON.stringify(data);
  expect(serialized).not.toContain('fixtureHashThatMustNeverLeaveTheServer');
}

describe('Equoria-pt9dh — own-account responses carry no credential secrets', () => {
  it('GET /api/v1/users/:id omits the password hash', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expectNoSecrets(res.body.data);
    // The non-secret account facts the page uses are still there.
    expect(res.body.data.username).toBe(user.username);
  });

  it('PUT /api/v1/users/:id omits the password hash', async () => {
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .put(`/api/v1/users/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ firstName: 'Renamed' });

    expect(res.status).toBe(200);
    expectNoSecrets(res.body.data);
    expect(res.body.data.firstName).toBe('Renamed');

    // The hash itself was not touched by the write.
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh.password).toBe(user.password);
  });
});
