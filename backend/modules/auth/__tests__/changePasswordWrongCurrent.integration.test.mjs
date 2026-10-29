/**
 * Equoria-9dtyj — a wrong current password on change-password is not an
 * ended session.
 *
 * Old behaviour: the backend answered a wrong current password with 401. The
 * frontend HTTP client reads every 401 from a protected endpoint as an
 * expired access token, so it refreshed the session and re-sent the request:
 * one mistyped password was checked twice and counted twice against the
 * auth failure limiter (authRateLimiter, skipSuccessfulRequests).
 *
 * New contract: 400 with code `currentPasswordIncorrect`. A 400 is still a
 * failure, so the limiter still counts it, exactly once per request.
 *
 * Real DB, real auth middleware, real CSRF, real limiter — nothing mocked.
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
const PREFIX = 'pw9dtyj';
const PASSWORD = 'CorrectHorse1!Battery';
const newPasswordValue = 'BrandNewPassword9!';

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
      firstName: 'Wrong',
      lastName: 'Current',
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

async function changePassword(user, oldPassword) {
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post('/api/v1/auth/change-password')
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ oldPassword, newPassword: newPasswordValue });
}

beforeAll(() => {
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

describe('Equoria-9dtyj — a wrong current password is a refusal, not an ended session', () => {
  it('answers 400 with code currentPasswordIncorrect and leaves the password unchanged', async () => {
    const user = await makeUser();

    const res = await changePassword(user, 'NotMyPassword1!');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      code: 'currentPasswordIncorrect',
      message: 'Current password is incorrect',
    });
    const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { password: true } });
    expect(await bcrypt.compare(PASSWORD, stored.password)).toBe(true);
  });

  it('counts each wrong attempt exactly once against the auth failure limiter', async () => {
    const user = await makeUser();

    const first = await changePassword(user, 'NotMyPassword1!');
    const second = await changePassword(user, 'NotMyPassword2!');

    expect(first.status).toBe(400);
    expect(second.status).toBe(400);
    const remainingAfterFirst = Number(first.headers['ratelimit-remaining']);
    const remainingAfterSecond = Number(second.headers['ratelimit-remaining']);
    expect(Number.isFinite(remainingAfterFirst)).toBe(true);
    // The limiter is keyed per signed-in user; the first refusal stayed counted.
    expect(remainingAfterSecond).toBe(remainingAfterFirst - 1);
  });

  it('still changes the password when the current one is right', async () => {
    const user = await makeUser();

    const res = await changePassword(user, PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ sessionInvalidated: true });
  });
});
