/**
 * Same-key nested-merge lost updates in player settings (Equoria-6p398.15).
 *
 * Finding 1 (Equoria-6p398.1) moved every settings writer to path updates, so
 * one route can no longer erase ANOTHER key. But three routes still merge a
 * nested key (`preferences`, `notifications`, `display`) in JS from an earlier
 * read and write the whole key back: two concurrent writes to the SAME key
 * that change different fields lose one of them.
 *
 *   PATCH /auth/profile/preferences  -> settings.preferences
 *   PUT   /auth/profile              -> settings.notifications / display
 *   PUT   /users/:id                 -> settings.preferences / notifications / display
 *
 * The interleaving is forced with a real row lock (rowLockBarrier): both
 * requests read the pre-write settings, then queue on the User-row UPDATE.
 * Releasing commits them one after the other. Real routes, auth and CSRF.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';
import { createBarrierClient, openRowLockBarrier, waitForBlockedSessions } from '../helpers/rowLockBarrier.mjs';

const origin = 'http://localhost:3000';
const fixturePrefix = 'TestFixture-6p398-15-settings';

const barrierClient = createBarrierClient();

async function send(method, endpoint, jwt, body) {
  const csrf = await fetchCsrf(app, { origin, extraCookies: [`accessToken=${jwt}`] });
  const agent = request(app);
  return agent[method](endpoint)
    .set('Authorization', `Bearer ${jwt}`)
    .set('Origin', origin)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

describe('settings: concurrent writes to the same nested key both survive (Equoria-6p398.15)', () => {
  const cleanup = createCleanupTracker();
  let user;
  let token;

  beforeEach(async () => {
    const tag = randomBytes(6).toString('hex');
    user = await prisma.user.create({
      data: {
        email: `${fixturePrefix}-${tag}@example.com`,
        username: `${fixturePrefix}-${tag}`.slice(0, 30),
        password: 'irrelevant-hash',
        firstName: 'Same',
        lastName: 'Key',
        money: 0,
        settings: {
          preferences: { soundEnabled: false },
          notifications: { emailSystem: false },
          display: { theme: 'night' },
          lastWeeklyClaimDate: '2026-10-19T00:00:00.000Z',
        },
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const userId = user.id;
    cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'user');
  }, 60000);

  afterEach(() => cleanup.run(), 60000);
  afterAll(() => barrierClient.$disconnect());

  /** Both requests read, then queue on the User row; release; return both responses. */
  async function race(first, second) {
    const barrier = await openRowLockBarrier(
      barrierClient,
      tx => tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`,
    );
    let a;
    let b;
    try {
      a = first().then(r => r);
      await waitForBlockedSessions(barrierClient, barrier.pid, 1);
      b = second().then(r => r);
      await waitForBlockedSessions(barrierClient, barrier.pid, 2);
    } finally {
      await barrier.release();
    }
    return Promise.all([a, b]);
  }

  const readSettings = async () =>
    (await prisma.user.findUnique({ where: { id: user.id }, select: { settings: true } })).settings;

  it('PATCH /auth/profile/preferences: two toggles of different preferences both persist', async () => {
    const responses = await race(
      () => send('patch', '/api/v1/auth/profile/preferences', token, { reducedMotion: true }),
      () => send('patch', '/api/v1/auth/profile/preferences', token, { highContrast: true }),
    );
    expect(responses.map(r => r.status)).toEqual([200, 200]);

    const settings = await readSettings();
    expect(settings.preferences).toEqual({
      soundEnabled: false,
      reducedMotion: true,
      highContrast: true,
    });
    expect(settings.lastWeeklyClaimDate).toBe('2026-10-19T00:00:00.000Z');
    // Each response reports the preferences as committed by its own write.
    expect(responses[1].body.data.preferences).toEqual(settings.preferences);
  }, 60000);

  it('PUT /auth/profile: two notification changes both persist', async () => {
    const responses = await race(
      () => send('put', '/api/v1/auth/profile', token, { notifications: { emailBreeding: true } }),
      () => send('put', '/api/v1/auth/profile', token, { notifications: { emailCompetition: true } }),
    );
    expect(responses.map(r => r.status)).toEqual([200, 200]);

    expect((await readSettings()).notifications).toEqual({
      emailSystem: false,
      emailBreeding: true,
      emailCompetition: true,
    });
  }, 60000);

  it('PUT /users/:id: two display changes both persist', async () => {
    const responses = await race(
      () => send('put', `/api/v1/users/${user.id}`, token, { settings: { display: { compact: true } } }),
      () => send('put', `/api/v1/users/${user.id}`, token, { settings: { display: { cardSize: 'large' } } }),
    );
    expect(responses.map(r => r.status)).toEqual([200, 200]);

    expect((await readSettings()).display).toEqual({
      theme: 'night',
      compact: true,
      cardSize: 'large',
    });
  }, 60000);
});
