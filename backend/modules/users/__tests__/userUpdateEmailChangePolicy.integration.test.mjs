/**
 * Finding 5 (Equoria-6p398.5) — `PUT /api/v1/users/:id` is not an alternate
 * path around the recovery-identity policy.
 *
 * The audit noted this sibling route reset `emailVerified`/`emailVerifiedAt`
 * when the address changed, and treated that as the protection. It is not:
 * resetting the flags still lets a stolen session MOVE the recovery address,
 * and `POST /auth/forgot-password` then delivers to the attacker. Both update
 * surfaces now share one policy.
 *
 * Real DB, real JWT, real CSRF, real persisted-state re-reads. No mocks.
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
const PREFIX = 'f5userput';
const uid = () => randomBytes(5).toString('hex');

const cleanup = createCleanupTracker();
let user;
let token;

beforeAll(async () => {
  const suffix = `${uid()}${uid()}`;
  user = await prisma.user.create({
    data: {
      email: `${PREFIX}-${suffix}@test.com`,
      username: `${PREFIX}${suffix}`,
      password: '$2b$12$fixtureHashNeverUsedForLogin.XXXXXXXXXXXXXXXXXXXXXXXX',
      firstName: 'Sibling',
      lastName: 'Path',
      money: 250,
      role: 'user',
      settings: {},
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  cleanup.add(() => prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }), 'verification tokens');
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30_000);

afterAll(() => cleanup.run(), 30_000);

async function doPut(body) {
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
  const res = await request(app)
    .put(`/api/v1/users/${user.id}`)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);

  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      emailVerifiedAt: true,
      firstName: true,
      settings: true,
    },
  });
  return { res, fresh };
}

describe('Finding 5 — PUT /api/v1/users/:id and the recovery identity', () => {
  it('refuses a changed email supplied with only a session, leaving address and verification intact', async () => {
    const before = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, emailVerified: true, emailVerifiedAt: true },
    });

    const { res, fresh } = await doPut({ email: `${PREFIX}-hijack-${uid()}@test.com` });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(String(res.body.message)).toMatch(/confirm/i);

    expect(fresh.email).toBe(before.email);
    expect(fresh.emailVerified).toBe(true);
    expect(fresh.emailVerifiedAt.getTime()).toBe(before.emailVerifiedAt.getTime());
    expect(await prisma.emailVerificationToken.count({ where: { userId: user.id } })).toBe(0);
  });

  it('refuses before any write — a bundled firstName change does not land', async () => {
    const before = await prisma.user.findUnique({
      where: { id: user.id },
      select: { firstName: true },
    });

    const { res, fresh } = await doPut({
      firstName: 'Smuggled',
      email: `${PREFIX}-bundle-${uid()}@test.com`,
    });

    expect(res.status).toBe(403);
    expect(fresh.firstName).toBe(before.firstName);
  });

  it('treats the same address (any casing) as a no-op and does NOT reset verification', async () => {
    const before = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, emailVerifiedAt: true },
    });

    const { res, fresh } = await doPut({
      email: before.email.toUpperCase(),
      firstName: 'Unchanged',
    });

    expect(res.status).toBe(200);
    expect(fresh.email).toBe(before.email);
    expect(fresh.emailVerified).toBe(true);
    expect(fresh.emailVerifiedAt.getTime()).toBe(before.emailVerifiedAt.getTime());
    expect(fresh.firstName).toBe('Unchanged');
  });

  it('leaves ordinary non-identity updates fully usable without any fresh-auth proof', async () => {
    const { res, fresh } = await doPut({
      firstName: 'Ordinary',
      settings: { display: { theme: 'dark' } },
    });

    expect(res.status).toBe(200);
    expect(fresh.firstName).toBe('Ordinary');
    expect(fresh.settings.display.theme).toBe('dark');
  });
});
