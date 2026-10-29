/**
 * Email gate (Equoria-voasj, owner ruling q248 2026-10-28): no play until the
 * player's email is confirmed.
 *
 * Real app, real database, real registration and the real emailed-link route.
 * An unconfirmed account may read its own account, ask for a new link, change a
 * mistyped address and sign out; every other authenticated route answers 403
 * emailNotVerified. Staff and admin accounts follow the same rule. Confirming
 * through the link opens play on the very next request of the same session.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { checkedInDeviceCookie } from '../../../tests/helpers/staffDeviceFixture.mjs';
import { generateVerificationToken, hashVerificationToken } from '../services/emailVerificationService.mjs';

const origin = 'http://localhost:3000';
const prefix = `emailgate${randomBytes(4).toString('hex')}`;

const accessCookieFrom = res => {
  const cookies = [res.headers['set-cookie'] ?? []].flat();
  const match = cookies.find(cookie => cookie.startsWith('accessToken='));
  return match ? match.split(';')[0] : null;
};

describe('email gate: no play until the email is confirmed', () => {
  const cleanup = createCleanupTracker();
  let player;
  let accessCookie;

  const get = path => request(app).get(path).set('Origin', origin).set('Cookie', accessCookie);

  const post = async (path, body = {}) => {
    const csrf = await fetchCsrf(app, { origin, extraCookies: accessCookie });
    return request(app)
      .post(path)
      .set('Origin', origin)
      .set('Cookie', [accessCookie, ...csrf.cookieHeader])
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(body);
  };

  const makeAccount = async (role, emailVerified) => {
    const tag = `${prefix}${role}${emailVerified ? 'v' : 'u'}`;
    const user = await prisma.user.create({
      data: {
        username: tag,
        email: `${tag}@example.com`,
        password: await bcrypt.hash('GateTestPass123!', 1),
        firstName: 'Gate',
        lastName: 'Test',
        role,
        emailVerified,
        emailVerifiedAt: emailVerified ? new Date() : null,
      },
    });
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), `user:${tag}`);
    return { user, token: generateTestToken({ id: user.id, email: user.email, role }) };
  };

  beforeAll(async () => {
    const email = `${prefix}player@example.com`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', origin)
      .send({
        username: `${prefix}player`,
        email,
        password: 'GateTestPass123!',
        firstName: 'Gate',
        lastName: 'Player',
        dateOfBirth: '1990-01-01',
      });
    expect(res.status).toBe(201);
    accessCookie = accessCookieFrom(res);
    expect(accessCookie).toBeTruthy();
    player = await prisma.user.findUnique({ where: { email } });
    expect(player.emailVerified).toBe(false);

    const userId = player.id;
    cleanup.add(() => prisma.emailVerificationToken.deleteMany({ where: { userId } }), 'tokens');
    cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId } }), 'refreshToken');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'user');
  });

  afterAll(async () => {
    await cleanup.run();
  });

  it('refuses a gameplay read and a gameplay action with 403 emailNotVerified', async () => {
    const read = await get('/api/v1/horses');
    expect(read.status).toBe(403);
    expect(read.body.code).toBe('emailNotVerified');
    expect(read.body.success).toBe(false);

    const action = await post('/api/v1/auth/advance-onboarding', {});
    expect(action.status).toBe(403);
    expect(action.body.code).toBe('emailNotVerified');
  });

  it('serves its own account and its verification status', async () => {
    const profile = await get('/api/v1/auth/profile');
    expect(profile.status).toBe(200);
    expect(profile.body.data.user.id).toBe(player.id);
    expect(profile.body.data.user.emailVerified).toBe(false);

    const status = await get('/api/v1/auth/verification-status');
    expect(status.status).toBe(200);
    expect(status.body.data.verified).toBe(false);
  });

  it('opens play on the next request once the emailed link is followed', async () => {
    const rawToken = generateVerificationToken();
    await prisma.emailVerificationToken.create({
      data: {
        tokenHash: hashVerificationToken(rawToken),
        userId: player.id,
        email: player.email,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const link = await request(app).get(`/api/v1/auth/verify-email?token=${rawToken}`).set('Origin', origin);
    expect(link.status).toBe(200);

    const read = await get('/api/v1/horses');
    expect(read.status).toBe(200);
    const profile = await get('/api/v1/auth/profile');
    expect(profile.body.data.user.emailVerified).toBe(true);
  });

  it('lets an unconfirmed account ask for a new link and sign out', async () => {
    const { user } = await makeAccount('user', false);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: user.email, password: 'GateTestPass123!' });
    expect(login.status).toBe(200);
    accessCookie = accessCookieFrom(login);
    cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: user.id } }), 'refreshToken:signout');

    cleanup.add(() => prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }), 'tokens:signout');

    expect((await get('/api/v1/horses')).body.code).toBe('emailNotVerified');
    const resend = await post('/api/v1/auth/resend-verification');
    expect(resend.status).toBe(200);
    expect(resend.body.data.emailSent).toBe(true);

    const logout = await post('/api/v1/auth/logout');
    expect(logout.status).toBe(200);
  });

  it('holds an unconfirmed admin to the same rule, and lets a confirmed one through', async () => {
    const unconfirmed = await makeAccount('admin', false);
    const refused = await request(app)
      .get('/api/v1/admin/cron/status')
      .set('Origin', origin)
      .set('Authorization', `Bearer ${unconfirmed.token}`);
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('emailNotVerified');

    const confirmed = await makeAccount('admin', true);
    // Equoria-n256i (owner ruling q289): admin tools need the emailed staff check-in.
    const device = await checkedInDeviceCookie(confirmed.user.id);
    const served = await request(app)
      .get('/api/v1/admin/cron/status')
      .set('Origin', origin)
      .set('Authorization', `Bearer ${confirmed.token}`)
      .set('Cookie', device);
    expect(served.status).toBe(200);
  });

  it('lets a confirmed player play', async () => {
    const { token } = await makeAccount('user', true);
    const read = await request(app).get('/api/v1/horses').set('Origin', origin).set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);
  });
});
