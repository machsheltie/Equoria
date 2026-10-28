/**
 * Equoria-nqky1 (ACC-09) — a sign-up whose session step fails still leaves the
 * player a way in.
 *
 * Old behaviour: register committed the account, then issued the session
 * tokens with no recovery. If token issuance threw, the request answered 500
 * ("registration failed") while the account already existed; the player tried
 * again and was told the email/username was taken, with no hint that the
 * account was real and she could simply sign in.
 *
 * Now the account creation is the commitment: a failed session step answers
 * 201 with `sessionIssued: false` and tells her to sign in, and signing in
 * works.
 *
 * The failure is injected at the environment boundary — the refresh-token
 * signing secret is absent for the one request — not by mocking Equoria code.
 *
 * Real app, real Prisma, real CSRF. No mocks.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'StrongP@ssw0rd!23';

const createdEmails = [];
const cleanup = createCleanupTracker();
const ownedUserIds = async () =>
  (await prisma.user.findMany({ where: { email: { in: createdEmails } }, select: { id: true } })).map(u => u.id);
cleanup.add(
  async () => prisma.refreshToken.deleteMany({ where: { userId: { in: await ownedUserIds() } } }),
  'refreshToken',
);
cleanup.add(
  async () => prisma.emailVerificationToken.deleteMany({ where: { userId: { in: await ownedUserIds() } } }),
  'emailVerificationToken',
);
cleanup.add(async () => prisma.horse.deleteMany({ where: { userId: { in: await ownedUserIds() } } }), 'horse');
cleanup.add(() => prisma.user.deleteMany({ where: { email: { in: createdEmails } } }), 'user');

afterAll(() => cleanup.run(), 60_000);

describe('Equoria-nqky1 — a failed session step at sign-up is recoverable', () => {
  it('answers 201 with sessionIssued:false, and the same credentials then sign in', async () => {
    const username = `nqky1${randomBytes(6).toString('hex')}`;
    const email = `${username}@test.com`;
    createdEmails.push(email);

    const { csrfToken, cookieHeader } = await fetchCsrf(app, { origin: ORIGIN });
    const savedSecret = process.env.JWT_REFRESH_SECRET;
    let res;
    try {
      delete process.env.JWT_REFRESH_SECRET;
      res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', ORIGIN)
        .set('Cookie', cookieHeader)
        .set('X-CSRF-Token', csrfToken)
        .send({
          username,
          email,
          password: PASSWORD,
          firstName: 'Recover',
          lastName: 'Able',
          dateOfBirth: '1990-01-01',
        });
    } finally {
      process.env.JWT_REFRESH_SECRET = savedSecret;
    }

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionIssued).toBe(false);
    expect(res.body.message).toMatch(/sign in/i);
    // No half-made session was handed out.
    const setCookies = res.headers['set-cookie'] || [];
    expect(setCookies.some(c => c.startsWith('accessToken=') && !c.startsWith('accessToken=;'))).toBe(false);

    const account = await prisma.user.findUnique({ where: { email } });
    expect(account).not.toBeNull();

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', ORIGIN)
      .send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.user.id).toBe(account.id);
  }, 60_000);

  it('a normal sign-up still issues the session (sessionIssued:true)', async () => {
    const username = `nqky1${randomBytes(6).toString('hex')}`;
    const email = `${username}@test.com`;
    createdEmails.push(email);

    const { csrfToken, cookieHeader } = await fetchCsrf(app, { origin: ORIGIN });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeader)
      .set('X-CSRF-Token', csrfToken)
      .send({
        username,
        email,
        password: PASSWORD,
        firstName: 'Normal',
        lastName: 'Signup',
        dateOfBirth: '1990-01-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.sessionIssued).toBe(true);
    const setCookies = res.headers['set-cookie'] || [];
    expect(setCookies.some(c => c.startsWith('accessToken='))).toBe(true);
  }, 60_000);
});
