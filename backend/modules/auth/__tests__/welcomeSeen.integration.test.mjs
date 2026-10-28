/**
 * Integration tests: the one-time welcome note (Equoria-kd2dd)
 *
 * Owner ruling 2026-10-23: the first time a new player enters the game after the
 * three-step signup, a welcome popup greets her once. "Once" is a SERVER flag,
 * `User.settings.welcomeSeen` (the existing settings jsonb; no schema change),
 * so it follows the player across browsers and survives a cleared cache.
 *
 *   GET  /api/v1/auth/profile       -> data.user.welcomeSeen (always a boolean)
 *   POST /api/v1/auth/welcome-seen  -> sets the flag; idempotent; touches no other key
 */

import request from 'supertest';
import { jest as _jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { confirmEmail } from '../../../tests/helpers/confirmEmail.mjs';

_jest.setTimeout(120000);

const ORIGIN = 'http://localhost:3000';
// Short on purpose: a username is 3-30 characters, and the prefix plus the suffix below must fit.
const PREFIX = 'wseen';

const extractAccessCookie = setCookieHeader => {
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  const match = cookies.find(c => c.startsWith('accessToken='));
  return match ? match.split(';')[0] : null;
};

describe('welcome note flag (User.settings.welcomeSeen)', () => {
  let userId;
  let accessCookie;
  let csrf;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const unique = randomBytes(8).toString('hex');
    const email = `${PREFIX}${unique}@test.com`;

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .send({
        email,
        username: `${PREFIX}${unique}`,
        password: 'TestPass123!',
        firstName: 'Welcome',
        lastName: 'Seen',
        dateOfBirth: '1990-01-01',
      });
    expect(res.status).toBe(201);
    // Equoria-voasj: no play until the email is confirmed.
    await confirmEmail(res.body.data.user.id);
    accessCookie = extractAccessCookie(res.headers['set-cookie']);
    expect(accessCookie).toBeTruthy();

    const user = await prisma.user.findUnique({ where: { email } });
    userId = user.id;
    cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId } }), 'refreshToken');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'user');

    csrf = await fetchCsrf(app, { extraCookies: [accessCookie] });
  });

  afterAll(async () => {
    await cleanup.run();
  });

  const getProfile = () => request(app).get('/api/v1/auth/profile').set('Origin', ORIGIN).set('Cookie', accessCookie);

  const postWelcomeSeen = () =>
    request(app)
      .post('/api/v1/auth/welcome-seen')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrf.csrfToken)
      .set('Cookie', csrf.cookieHeader)
      .send({});

  it('a brand-new account has not seen the welcome note', async () => {
    const res = await getProfile().expect(200);
    expect(res.body.data.user.welcomeSeen).toBe(false);
  });

  it('refuses an unauthenticated call', async () => {
    const res = await request(app).post('/api/v1/auth/welcome-seen').set('Origin', ORIGIN).send({});
    expect(res.status).toBe(401);
  });

  it('marks the welcome note seen, keeps every other settings key, and stays seen on a repeat call', async () => {
    // A concurrent writer's keys must survive: the weekly-claim marker is the
    // one a stale whole-document write would erase (Equoria-6p398.1).
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
    await prisma.user.update({
      where: { id: userId },
      data: { settings: { ...before.settings, onboardingStep: 1, lastWeeklyClaimDate: '2026-10-19T00:00:00.000Z' } },
    });

    const first = await postWelcomeSeen();
    expect(first.status).toBe(200);
    expect(first.body.data.welcomeSeen).toBe(true);

    const second = await postWelcomeSeen();
    expect(second.status).toBe(200);

    const profile = await getProfile().expect(200);
    expect(profile.body.data.user.welcomeSeen).toBe(true);
    expect(profile.body.data.user.onboardingStep).toBe(1);

    const after = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
    expect(after.settings.welcomeSeen).toBe(true);
    expect(after.settings.lastWeeklyClaimDate).toBe('2026-10-19T00:00:00.000Z');
    expect(after.settings.inventory).toEqual(before.settings.inventory);
  });
});
