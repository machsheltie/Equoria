/**
 * Compatibility endpoints reject malformed context element types with 400
 * (Equoria-2hafx).
 *
 * Before: the routes checked that `context.environmentalFactors` was an array but
 * not what was in it, and `/predict` did not check `context.timeOfDay` at all, so
 * `[1, {}, null]` or `"midnight"` were silently ignored and the caller got a score
 * that did not use what they sent. Validation runs before the controller, so these
 * requests are rejected before any groom or horse is read.
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
let csrf;
let taskType;

beforeAll(async () => {
  const tag = `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
  user = await prisma.user.create({
    data: {
      email: `dcompat-types-${tag}@test.com`,
      username: `dctypes${tag}`,
      password: 'irrelevant-hash',
      firstName: 'DCompat',
      lastName: 'Types',
      role: 'admin',
      money: 0,
      xp: 0,
      level: 1,
    },
  });
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
  // Equoria-oey96.37 (owner ruling 2026-07-07): /compatibility is admin-only, so the
  // caller is an admin; ownership checks still apply to her own fixtures.
  token = generateTestToken({ id: user.id, email: user.email, role: 'admin' });
  csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  // A task type the validator accepts, taken from the config endpoint.
  const config = await request(app).get('/api/v1/compatibility/config').set('Authorization', `Bearer ${token}`);
  [taskType] = config.body.data.taskTypes;
}, 60000);

afterAll(() => cleanup.run(), 60000);

function post(path, body) {
  return request(app)
    .post(`/api/v1/compatibility/${path}`)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

// Each case is ONE argument (a whole list), so wrap it for it.each.
const badFactorLists = [[1], [{}], [null], ['quiet', 7]].map(list => [list]);

describe('compatibility context element types', () => {
  describe.each([
    // POST /predict and /recommendations were retired (Equoria-a7f1p, owner ruling
    // 2026-10-07: no advice); their cases went with them (Equoria-ytwl7).
    ['calculate', { groomId: 1, horseId: 1 }],
  ])('POST /%s', (path, ids) => {
    it.each(badFactorLists)('rejects environmentalFactors %j with 400', factors => {
      return post(path, {
        ...ids,
        context: { taskType, environmentalFactors: factors },
      }).then(res => {
        expect(res.status).toBe(400);
      });
    });
  });
});
