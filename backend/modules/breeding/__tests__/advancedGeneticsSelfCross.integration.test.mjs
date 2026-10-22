/**
 * Equoria-1aoqa: every two-parent advanced-genetics endpoint refuses a
 * self-cross (stallionId === mareId) with 400, before any database work.
 *
 * CONTRIBUTING.md: breeding or two-parent operations reject the same horse as
 * both parents before database work. These five endpoints accepted it: four
 * looked both ids up and answered the same-id pair with the pair 404 (after
 * the database read), and breeding-recommendations queried the duplicate id
 * list. The proof that the refusal comes before the database is the missing
 * id: a same-id pair naming a horse that does not exist must still be a 400,
 * not the 404 a lookup would produce.
 *
 * Real app, real DB, real auth and CSRF; scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';
const MISSING_ID = 2_000_111_333;

describe('advanced genetics two-parent endpoints refuse a self-cross (Equoria-1aoqa)', () => {
  let token;
  let stallion;
  let mare;

  beforeAll(async () => {
    const ts = Date.now();
    const owner = await createTestUser({
      username: `TestFixture-1aoqa-${ts}`,
      email: `testfixture-1aoqa-${ts}@test.com`,
    });
    token = owner.token;
    stallion = await createTestHorse({
      name: `TestFixture-1aoqa-stallion-${ts}`,
      userId: owner.user.id,
      sex: 'Stallion',
    });
    mare = await createTestHorse({ name: `TestFixture-1aoqa-mare-${ts}`, userId: owner.user.id, sex: 'Mare' });
  }, 120000);

  afterAll(() => cleanupTestData(), 120000);

  async function call(endpoint, stallionId, mareId) {
    if (endpoint.method === 'get') {
      return request(app)
        .get(`/api/v1${endpoint.path}/${stallionId}/${mareId}`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);
    }
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
    return request(app)
      .post(`/api/v1${endpoint.path}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ stallionId, mareId });
  }

  const endpoints = [
    { method: 'post', path: '/breeding/genetic-probability' },
    { method: 'get', path: '/breeding/lineage-analysis' },
    { method: 'post', path: '/breeding/breeding-recommendations' },
    { method: 'post', path: '/genetics/inbreeding-analysis' },
    { method: 'post', path: '/genetics/breeding-compatibility' },
  ];

  it.each(endpoints.map(e => [`${e.method.toUpperCase()} ${e.path}`, e]))(
    '%s: the same owned horse as both parents is a 400',
    async (_label, endpoint) => {
      const res = await call(endpoint, stallion.id, stallion.id);
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/same horse/i);
    },
    60000,
  );

  it.each(endpoints.map(e => [`${e.method.toUpperCase()} ${e.path}`, e]))(
    '%s: a same-id pair is refused before any lookup (missing id is 400, not 404)',
    async (_label, endpoint) => {
      const res = await call(endpoint, MISSING_ID, MISSING_ID);
      expect(res.status).toBe(400);
    },
    60000,
  );

  it.each(endpoints.map(e => [`${e.method.toUpperCase()} ${e.path}`, e]))(
    '%s: a real pair is not refused as a self-cross',
    async (_label, endpoint) => {
      const res = await call(endpoint, stallion.id, mare.id);
      expect(res.status).toBe(200);
    },
    60000,
  );
});
