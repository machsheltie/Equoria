/**
 * Retired player routes from the old trait systems and advice panels
 * (Equoria-a7f1p). No screen or E2E test called any of them, and each is
 * settled by an owner ruling:
 *
 * - No weather, seasons or environment effects (2026-10-16):
 *     GET  /horses/:id/environmental-triggers
 *     GET  /horses/:id/trigger-thresholds
 * - New 20-trait roster, effects not yet ruled; traits reveal only through the
 *   daily grooming-day ladder (2026-10-27); interaction matrices, stability
 *   scores, the on-demand milestone evaluator and the old discovery-conditions
 *   system belong to the superseded trait systems:
 *     GET  /horses/:id/trait-matrix
 *     GET  /horses/:id/trait-stability
 *     POST /epigenetic-traits/evaluate-milestone/:horseId
 *     GET  /trait-discovery/progress/:horseId
 *     GET  /trait-discovery/conditions
 *     POST /trait-discovery/check-conditions/:horseId
 *     GET  /trait-discovery/discovery-status/:horseId
 * - Only two life milestones exist, ages 3 and 21 (2026-10-07):
 *     GET  /milestones/milestone-status/:horseId
 *     GET  /milestones/milestone-definitions
 * - No advice and no genetics reports for players (2026-10-07, 2026-10-28):
 *     GET  /horses/:id/epigenetic-insights
 *     GET  /epigenetic-traits/breeding-insights/:horseId
 * - All invented ultra-rare traits removed (2026-10-19):
 *     GET  /ultra-rare-traits/definitions
 *     GET  /ultra-rare-traits/horse/:horseId (its only caller, the horse page's
 *          ultra-rare reveal, showed trait rarity, which q112 hides; removed
 *          with it)
 *     GET  /ultra-rare-traits/groom/:groomId/perks
 *     POST /ultra-rare-traits/effects/calculate
 * - Flags are not a separate system; they fold into the one trait system
 *   (2026-10-21):
 *     GET  /flags/analytics
 *
 * Old contract: each route reached its handler (200 for the owner, a handler
 * or ownership 404 otherwise). Ruling: each now answers the app's JSON
 * "Route not found" 404, for the caller's own horse/groom and for another
 * player's. The neighbouring routes that stay are pinned too, so the removal
 * cannot have taken a live route with it.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../tests/helpers/fixtureColor.mjs';
import { birthDateForAge } from '../../utils/horseAge.mjs';

const fixturePrefix = 'TestFixture-a7f1p-retired';
const origin = 'http://localhost:3000';

function tag() {
  return randomBytes(6).toString('hex');
}

async function makePlayer(role, accountRole = 'user') {
  const suffix = tag();
  const user = await prisma.user.create({
    data: {
      username: `${fixturePrefix}-${role}-${suffix}`,
      email: `${fixturePrefix}-${role}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Retired',
      lastName: role,
      money: 1000,
      role: accountRole,
    },
  });
  return { user, token: generateTestToken({ id: user.id, email: user.email, role: accountRole }) };
}

async function makeHorse(ownerId, breedId) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${fixturePrefix}-horse-${tag()}`,
      sex: 'Mare',
      dateOfBirth: birthDateForAge(1),
      age: 1,
      breedId,
      userId: ownerId,
      healthStatus: 'Good',
      lastFedDate: new Date(),
    },
  });
}

async function makeGroom(ownerId) {
  return prisma.groom.create({
    data: {
      name: `${fixturePrefix}-groom-${tag()}`,
      speciality: 'foalCare',
      personality: 'gentle',
      userId: ownerId,
    },
  });
}

async function send(method, path, token, body) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  const agent = request(app);
  const req = agent[method](path)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', origin)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken);
  const res = await (body === undefined ? req : req.send(body));
  return { status: res.status, body: res.body };
}

describe('retired trait and advice routes (Equoria-a7f1p)', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let other;
  let ownHorse;
  let otherHorse;
  let ownGroom;
  let otherGroom;
  // Equoria-oey96.37 (owner ruling 2026-07-07): /compatibility is admin-only, so
  // its routes are called by an admin with her own horse and groom.
  let admin;
  let adminHorse;
  let adminGroom;

  beforeAll(async () => {
    const breed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'Shared test breed' },
    });
    owner = await makePlayer('owner');
    other = await makePlayer('other');
    admin = await makePlayer('admin', 'admin');
    ownHorse = await makeHorse(owner.user.id, breed.id);
    otherHorse = await makeHorse(other.user.id, breed.id);
    adminHorse = await makeHorse(admin.user.id, breed.id);
    const horses = [ownHorse.id, otherHorse.id, adminHorse.id];
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horses } } }), 'horses');
    ownGroom = await makeGroom(owner.user.id);
    otherGroom = await makeGroom(other.user.id);
    adminGroom = await makeGroom(admin.user.id);
    const grooms = [ownGroom.id, otherGroom.id, adminGroom.id];
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: grooms } } }), 'grooms');
    // Users last: horses and grooms reference them (the tracker runs in order).
    const users = [owner.user.id, other.user.id, admin.user.id];
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: users } } }), 'users');
  });

  afterAll(async () => {
    await cleanup.run();
  });

  const whose = {
    'own horse': () => ownHorse.id,
    'another player’s horse': () => otherHorse.id,
  };
  const whoseGroom = {
    'own groom': () => ownGroom.id,
    'another player’s groom': () => otherGroom.id,
  };
  const adminWhose = {
    'admin’s own horse': () => adminHorse.id,
    'another player’s horse': () => otherHorse.id,
  };
  const adminWhoseGroom = {
    'admin’s own groom': () => adminGroom.id,
    'another player’s groom': () => otherGroom.id,
  };

  const horseRoutes = [
    ['get', id => `/api/v1/horses/${id}/environmental-triggers`],
    ['get', id => `/api/v1/horses/${id}/trigger-thresholds`],
    ['get', id => `/api/v1/horses/${id}/trait-matrix`],
    ['get', id => `/api/v1/horses/${id}/trait-stability`],
    ['get', id => `/api/v1/horses/${id}/epigenetic-insights`],
    ['get', id => `/api/v1/epigenetic-traits/breeding-insights/${id}`],
    ['post', id => `/api/v1/epigenetic-traits/evaluate-milestone/${id}`, {}],
    ['get', id => `/api/v1/milestones/milestone-status/${id}`],
    ['get', id => `/api/v1/trait-discovery/progress/${id}`],
    ['post', id => `/api/v1/trait-discovery/check-conditions/${id}`, {}],
    ['get', id => `/api/v1/trait-discovery/discovery-status/${id}`],
    ['get', id => `/api/v1/ultra-rare-traits/horse/${id}`],
    [
      'post',
      () => '/api/v1/ultra-rare-traits/effects/calculate',
      id => ({ horseId: id, effectType: 'competition', baseValue: 50 }),
    ],
  ];

  const cases = [
    ...Object.entries(whose).flatMap(([who, id]) =>
      horseRoutes.map(([method, path, body]) => [
        `${method.toUpperCase()} ${path(':id')}, ${who}`,
        () => send(method, path(id()), owner.token, typeof body === 'function' ? body(id()) : body),
      ]),
    ),
    ...Object.entries(whoseGroom).map(([who, id]) => [
      `GET /ultra-rare-traits/groom/:groomId/perks, ${who}`,
      () => send('get', `/api/v1/ultra-rare-traits/groom/${id()}/perks`, owner.token),
    ]),
    [
      'GET /milestones/milestone-definitions',
      () => send('get', '/api/v1/milestones/milestone-definitions', owner.token),
    ],
    ['GET /trait-discovery/conditions', () => send('get', '/api/v1/trait-discovery/conditions', owner.token)],
    ['GET /ultra-rare-traits/definitions', () => send('get', '/api/v1/ultra-rare-traits/definitions', owner.token)],
    ['GET /flags/analytics', () => send('get', '/api/v1/flags/analytics', owner.token)],
  ];

  it.each(cases)('%s answers the JSON route-not-found 404', async (_label, call) => {
    const res = await call();

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: 'Route not found' });
  });

  // Neighbours that stay: each still reaches its handler for the owner.
  const kept = [
    ['GET /horses/:id/environmental-analysis', id => `/api/v1/horses/${id}/environmental-analysis`],
    ['GET /horses/:id/trait-interactions', id => `/api/v1/horses/${id}/trait-interactions`],
    // GET /epigenetic-traits/history/:horseId was kept here until owner ruling
    // 2026-10-28 (q152) removed the trait reports; removedTraitReportRoutes pins it.
    ['GET /traits/discovery-status/:horseId', id => `/api/v1/traits/discovery-status/${id}`],
    ['GET /flags/horses/:id/flags', id => `/api/v1/flags/horses/${id}/flags`],
    ['GET /flags/definitions', () => '/api/v1/flags/definitions'],
  ];

  it.each(kept)('%s still answers 200 for the owner', async (_label, path) => {
    const res = await send('get', path(ownHorse.id), owner.token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // Groom advice: best-groom recommendations, interaction-outcome predictions and
  // best-handler rankings tell the player what to choose (owner ruling
  // 2026-10-07: the game never gives advice). The compatibility calculate,
  // factors, trends and config routes stay parked with their tables (owner
  // ruling 2026-10-28), and the handler lookups stay pending owner question q154.
  const groomAdvice = [
    ...Object.entries(whose).map(([who, id]) => [
      `GET /groom-handlers/recommendations/:horseId, ${who}`,
      () => send('get', `/api/v1/groom-handlers/recommendations/${id()}`, owner.token),
    ]),
    ...Object.entries(adminWhose).map(([who, id]) => [
      `POST /compatibility/recommendations, admin, ${who}`,
      () =>
        send('post', '/api/v1/compatibility/recommendations', admin.token, {
          horseId: id(),
          context: { taskType: 'desensitization' },
        }),
    ]),
    ...Object.entries(adminWhoseGroom).map(([who, id]) => [
      `POST /compatibility/predict, admin, ${who}`,
      () =>
        send('post', '/api/v1/compatibility/predict', admin.token, {
          groomId: id(),
          horseId: adminHorse.id,
          context: { taskType: 'desensitization' },
        }),
    ]),
  ];

  it.each(groomAdvice)('%s answers the JSON route-not-found 404', async (_label, call) => {
    const res = await call();

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: 'Route not found' });
  });

  it('GET /groom-handlers/config still answers 200 for the owner', async () => {
    const res = await send('get', '/api/v1/groom-handlers/config', owner.token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  const keptCompatibility = [
    ['GET /compatibility/config', () => '/api/v1/compatibility/config'],
    [
      'GET /compatibility/factors/:groomId/:horseId',
      () => `/api/v1/compatibility/factors/${adminGroom.id}/${adminHorse.id}`,
    ],
  ];

  it.each(keptCompatibility)('%s still answers 200 for an admin', async (_label, path) => {
    const res = await send('get', path(), admin.token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /compatibility/config refuses a player with 403 (admin-only, Equoria-oey96.37)', async () => {
    const res = await send('get', '/api/v1/compatibility/config', owner.token);

    expect(res.status).toBe(403);
  });

  it('POST /flags/batch-evaluate stays and still refuses a non-admin with 403', async () => {
    const res = await send('post', '/api/v1/flags/batch-evaluate', owner.token, {
      horseIds: [ownHorse.id],
    });

    expect(res.status).toBe(403);
  });
});
