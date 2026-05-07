/**
 * wyagController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getWhileYouWereGone.
 * Route lives under authRouter at /api/while-you-were-gone.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `wyag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `wyag${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'Wyag',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
}, 30000);

afterAll(async () => {
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/while-you-were-gone ─────────────────────────────────────────────

describe('GET /api/while-you-were-gone', () => {
  it('returns 200 with items and since timestamp', async () => {
    const res = await request(app)
      .get('/api/while-you-were-gone')
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
      .get(`/api/while-you-were-gone?since=${since}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.since).toBeDefined();
  });

  it('returns 400 for an invalid since timestamp', async () => {
    const res = await request(app)
      .get('/api/while-you-were-gone?since=not-a-date')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/while-you-were-gone').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
