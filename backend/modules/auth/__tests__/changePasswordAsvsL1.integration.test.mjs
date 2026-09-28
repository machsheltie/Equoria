/**
 * Equoria-bvddn.5 — change-password accepted weaker passwords than
 * register/reset-password (8 chars / 3 classes / no max vs. 12 chars / 4
 * classes / 128 max, OWASP ASVS L1). A logged-in player could downgrade
 * their credential below the floor enforced at signup.
 *
 * Failure scenario (pre-fix): a logged-in player POSTs change-password with
 * newPassword "abcdefg1" (8 chars, lower+digit... actually 3 classes via the
 * old regex lower/upper/digit) and it is ACCEPTED, though the identical
 * string would be REJECTED at /auth/register or /auth/reset-password.
 *
 * Real DB, real auth, real CSRF — no mocked Prisma/controller/route layer.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const PREFIX = 'bvddn5';
const PASSWORD = 'CorrectHorse1!Battery'; // 21 chars, 4 classes — satisfies both old and new policy

const uid = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const createdUserIds = [];

async function makeUser() {
  const suffix = uid();
  const row = await prisma.user.create({
    data: {
      email: `${PREFIX}-${suffix}@test.com`,
      username: `${PREFIX}${suffix}`,
      password: await bcrypt.hash(PASSWORD, 4),
      firstName: 'PwPolicy',
      lastName: 'Change',
      money: 100,
      role: 'user',
      settings: {},
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  createdUserIds.push(row.id);
  return row;
}

async function changePassword(newPassword, actingToken) {
  const csrf = await fetchCsrf(app, {
    origin: ORIGIN,
    extraCookies: [`accessToken=${actingToken}`],
  });
  return request(app)
    .post('/api/v1/auth/change-password')
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${actingToken}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ oldPassword: PASSWORD, newPassword });
}

beforeAll(() => {
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

describe('Equoria-bvddn.5 — change-password enforces the same ASVS L1 policy as register/reset', () => {
  it('SENTINEL: "abcdefg1" (8 chars, 2 classes) is REJECTED with 400 (previously accepted)', async () => {
    const user = await makeUser();
    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const res = await changePassword('abcdefg1', token);

    expect(res.status).toBe(400);

    // Confirm the credential was NOT rotated — the original password still works.
    const loginOld = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: user.email, password: PASSWORD });
    expect(loginOld.status).toBe(200);
  });

  it('a 12-char, 4-class password that would pass register/reset also PASSES change-password', async () => {
    const user = await makeUser();
    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const res = await changePassword('Aa1!Aa1!Aa1!', token);

    expect(res.status).toBe(200);
  });

  it('a 129-char password is REJECTED (matches register/reset max-length cap)', async () => {
    const user = await makeUser();
    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const overLong = `Aa1!${'a'.repeat(125)}`; // 129 chars total, still 4 classes
    expect(overLong.length).toBe(129);

    const res = await changePassword(overLong, token);

    expect(res.status).toBe(400);
  });
});
