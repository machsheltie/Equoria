/**
 * showControllerErrorCodes.integration.test.mjs (Equoria-576c0 B9 round 2)
 *
 * showController's server-error responses carry stable codes like every other
 * refusal: 500 -> internalError, 503 (retryable transaction) -> serviceBusy.
 * Old contract: { success: false, message } with no code.
 *
 * The 500 paths are reached through real HTTP with inputs the database itself
 * rejects (an unknown show status in the browse filter; a horse id outside the
 * Int range at entry). The 503 path needs a forced retryable transaction error
 * and is covered by the same response shape in the source.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const rand = () => randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
let user;
let token;
let show;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `b9err-${rand()}@test.local`,
      username: `b9err${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'Error',
      lastName: 'Codes',
      money: 0,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  show = await prisma.show.create({
    data: {
      name: `TestFixture-b9err-${rand()}`,
      discipline: 'Dressage',
      entryFee: 0,
      prize: 0,
      levelMin: 1,
      levelMax: 999,
      runDate: future,
      closeDate: future,
      openDate: new Date(Date.now() - 60 * 1000),
      status: 'open',
      createdByUserId: user.id,
    },
  });
  cleanup.add(() => prisma.show.deleteMany({ where: { id: show.id } }), 'show');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('showController server errors carry stable codes', () => {
  it('GET /api/v1/shows answers a database failure with 500 internalError', async () => {
    const res = await request(app)
      .get('/api/v1/shows?status=not-a-status')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`);
    expect({ status: res.status, code: res.body.code, message: res.body.message }).toEqual({
      status: 500,
      code: 'internalError',
      message: 'Failed to fetch shows',
    });
  });

  it('POST /api/v1/shows/:id/enter answers a database failure with 500 internalError', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/shows/${show.id}/enter`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: 2 ** 40 }); // outside the Int column range
    expect({ status: res.status, code: res.body.code, message: res.body.message }).toEqual({
      status: 500,
      code: 'internalError',
      message: 'Failed to enter show',
    });
  });
});
