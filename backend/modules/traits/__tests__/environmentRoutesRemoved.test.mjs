/**
 * There is no weather and there are no seasons in Equoria (owner ruling
 * 2026-10-16; Equoria-aq9ya). The /api/v1/environment routes that served
 * weather, comfort zones and an environmental history are gone: every one now
 * answers 404 to a signed-in player. Real app, real auth, real database.
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
const cleanup = createCleanupTracker();
let user;
let token;

beforeAll(async () => {
  const tag = randomBytes(6).toString('hex');
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `noweather-${tag}@test.com`,
      username: `noweather${tag}`,
      password: 'irrelevant-hash',
      firstName: 'No',
      lastName: 'Weather',
      money: 0,
    },
  });
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('/api/v1/environment is gone', () => {
  it.each(['current', 'history', 'forecast', 'comfort-zone/1'])(
    'GET /api/v1/environment/%s answers 404',
    async suffix => {
      const res = await request(app)
        .get(`/api/v1/environment/${suffix}`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    },
  );

  it('POST /api/v1/environment/calculate-impact answers 404', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/environment/calculate-impact')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [1] });
    expect(res.status).toBe(404);
  });
});
