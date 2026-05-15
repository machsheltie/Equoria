/**
 * nextActionsController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getNextActions.
 * Route lives under authRouter at /api/next-actions.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `nextact-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `nextact${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'NextAct',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
}, 30000);

afterAll(async () => {
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/next-actions ────────────────────────────────────────────────────

describe('GET /api/next-actions', () => {
  it('returns 200 with an actions array', async () => {
    const res = await request(app)
      .get('/api/next-actions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.actions)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/next-actions').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
