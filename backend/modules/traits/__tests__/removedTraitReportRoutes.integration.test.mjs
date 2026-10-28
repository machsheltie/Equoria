/**
 * Players get no trait history or trait reports beyond the horse page
 * (Equoria-a7f1p; owner ruling q152, 2026-10-28: "This is NOT a SaaS tax app.
 * We are NOT focused on generating reports and crap for players. We are
 * focused on GAMEPLAY"). The three trait-competition reads go with the rulings
 * that traits do nothing in show scores until the trait rework and that
 * comparisons are advice (2026-10-07, 2026-10-23).
 *
 * Old contract: each route below answered the owner of the horse with a trait
 * report (history, timeline, card, stable report, comparison, export, trends,
 * the trait and flag encyclopedias, or a competition-impact analysis).
 * Ruling: each now answers the app's JSON "Route not found" 404. On the old
 * code each request reached its handler (200 or a handler error), so the
 * `Route not found` assertion fails there.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';

const ORIGIN = 'http://localhost:3000';
const PREFIX = `TestFixture-a7f1p-traitReports-${randomBytes(4).toString('hex')}`;

describe('trait report routes are removed (Equoria-a7f1p, q152)', () => {
  const cleanup = createCleanupTracker();
  let user;
  let token;
  let horse;
  let otherHorse;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        username: `${PREFIX}-owner`,
        email: `${PREFIX}-owner@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Trait',
        lastName: 'Reports',
        money: 1000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const make = name =>
      prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `${PREFIX}-${name}`,
          sex: 'Mare',
          dateOfBirth: birthDateForAge(5),
          age: 5,
          userId: user.id,
          healthStatus: 'Good',
          epigeneticModifiers: { positive: ['brave'], negative: [], hidden: ['heart'] },
        },
      });
    horse = await make('a');
    otherHorse = await make('b');
    const ids = [horse.id, otherHorse.id];
    // FK order: horses before their owner (Horse.userId is onDelete: Restrict).
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
  });

  afterAll(async () => {
    await cleanup.run();
  });

  async function call(method, path, body) {
    let req = request(app)[method](path).set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN);
    if (method !== 'get') {
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
      req = req.set('Cookie', csrf.cookieHeader).set('X-CSRF-Token', csrf.csrfToken).send(body);
    }
    return req;
  }

  const cases = [
    ['GET /horses/:id/enhanced-trait-history', () => call('get', `/api/v1/horses/${horse.id}/enhanced-trait-history`)],
    ['GET /horses/:id/trait-timeline', () => call('get', `/api/v1/horses/${horse.id}/trait-timeline`)],
    ['GET /horses/:id/trait-card', () => call('get', `/api/v1/horses/${horse.id}/trait-card`)],
    ['GET /users/:id/stable-epigenetic-report', () => call('get', `/api/v1/users/${user.id}/stable-epigenetic-report`)],
    [
      'POST /horses/compare-epigenetics',
      () => call('post', '/api/v1/horses/compare-epigenetics', { horseIds: [horse.id, otherHorse.id] }),
    ],
    [
      'GET /horses/:id/epigenetic-report-export',
      () => call('get', `/api/v1/horses/${horse.id}/epigenetic-report-export`),
    ],
    ['GET /epigenetic-traits/definitions', () => call('get', '/api/v1/epigenetic-traits/definitions')],
    ['GET /epigenetic-traits/history/:horseId', () => call('get', `/api/v1/epigenetic-traits/history/${horse.id}`)],
    ['GET /epigenetic-traits/summary/:horseId', () => call('get', `/api/v1/epigenetic-traits/summary/${horse.id}`)],
    ['GET /traits/definitions', () => call('get', '/api/v1/traits/definitions')],
    [
      'GET /traits/competition-impact/:horseId',
      () => call('get', `/api/v1/traits/competition-impact/${horse.id}?discipline=Dressage`),
    ],
    [
      'GET /traits/competition-comparison/:horseId',
      () => call('get', `/api/v1/traits/competition-comparison/${horse.id}`),
    ],
    ['GET /traits/competition-effects', () => call('get', '/api/v1/traits/competition-effects')],
  ];

  it.each(cases)('%s answers the JSON route-not-found 404', async (_label, send) => {
    const res = await send();

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: 'Route not found' });
  });

  // GET /horses/trait-trends: with the route gone the literal segment falls to
  // GET /horses/:id, whose id validator refuses it. Either way no trends are sent.
  it('GET /horses/trait-trends sends no trait trends', async () => {
    const res = await call('get', `/api/v1/horses/trait-trends?userId=${user.id}`);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.data?.trends).toBeUndefined();
  });

  it('the horse page reads still answer (GET /traits/horse/:id)', async () => {
    const res = await call('get', `/api/v1/traits/horse/${horse.id}`);

    expect(res.status).toBe(200);
  });
});
