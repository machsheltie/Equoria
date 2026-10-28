/**
 * The stable has its own name (Equoria-kgush, STA-06).
 *
 * Owner ruling 2026-10-28 (decisions page q250): each stable has its own name,
 * separate from the player's username, and the stable page and the player page
 * are one page. Saving a stable name must never rename the account.
 *
 * Real route, real database, scoped fail-loud fixtures.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const PREFIX = 'TestFixture-kgush';

async function makePlayer() {
  const suffix = randomBytes(5).toString('hex');
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `kgush_${suffix}`,
      email: `${PREFIX}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Stable',
      lastName: 'Name',
      money: 1000,
    },
  });
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  return { user, token };
}

async function putProfile(token, body) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .put('/api/v1/auth/profile')
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

describe('profile: the stable has its own name (Equoria-kgush)', () => {
  const cleanup = createCleanupTracker();
  afterEach(() => cleanup.run());

  it('saves the stable name without renaming the account, and reads it back', async () => {
    const { user, token } = await makePlayer();
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');

    const res = await putProfile(token, { stableName: "Moonlit Meadow's Barn" });

    expect(res.status).toBe(200);
    expect(res.body.data.user.stableName).toBe("Moonlit Meadow's Barn");
    expect(res.body.data.user.username).toBe(user.username);

    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { username: true },
    });
    expect(row.username).toBe(user.username);

    const read = await request(app).get('/api/v1/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);
    expect(read.body.data.user.stableName).toBe("Moonlit Meadow's Barn");
    expect(read.body.data.user.username).toBe(user.username);
  }, 60000);

  it('reads an unnamed stable as null, not a made-up name', async () => {
    const { user, token } = await makePlayer();
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');

    const read = await request(app).get('/api/v1/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);
    expect(read.body.data.user.stableName).toBeNull();
  }, 60000);

  it('refuses a stable name that is too short or too long, and changes nothing', async () => {
    const { user, token } = await makePlayer();
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');

    const short = await putProfile(token, { stableName: 'ab' });
    expect(short.status).toBe(400);
    const long = await putProfile(token, { stableName: 'x'.repeat(41) });
    expect(long.status).toBe(400);

    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { username: true, settings: true },
    });
    expect(row.username).toBe(user.username);
    expect(row.settings?.stableName).toBeUndefined();
  }, 60000);

  it('strips markup from a stable name', async () => {
    const { user, token } = await makePlayer();
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');

    const res = await putProfile(token, { stableName: 'Starlight <b>Farm</b>' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.stableName).toMatch(/^Starlight/);
    expect(res.body.data.user.stableName).not.toMatch(/[<>]/);
  }, 60000);
});
