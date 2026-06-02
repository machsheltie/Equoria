/**
 * wyagController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getWhileYouWereGone.
 * Route lives under authRouter at /api/v1/while-you-were-gone (authRouter is
 * mounted at /api/v1 only — Equoria-myfc5).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `wyag-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `wyag${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Wyag',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  // Scoped, fail-loud cleanup (Equoria-cu3t5) — replaces a swallowed cleanup
  // catch. FK order (Equoria-myfc5): delete any horses owned by this fixture
  // user BEFORE the user row, because Horse.userId is onDelete:Restrict
  // (schema:282) — a user delete would P2003 if a horse referenced it.
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/while-you-were-gone ──────────────────────────────────────────

describe('GET /api/v1/while-you-were-gone', () => {
  it('returns 200 with items and since timestamp', async () => {
    const res = await request(app)
      .get('/api/v1/while-you-were-gone')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.since).toBeDefined();
  });

  it('returns 200 with a valid since query param', async () => {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .get(`/api/v1/while-you-were-gone?since=${since}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.since).toBeDefined();
  });

  it('returns 400 for an invalid since timestamp', async () => {
    const res = await request(app)
      .get('/api/v1/while-you-were-gone?since=not-a-date')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/while-you-were-gone').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
