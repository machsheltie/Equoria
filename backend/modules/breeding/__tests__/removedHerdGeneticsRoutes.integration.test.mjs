/**
 * Players get no herd genetics reports: the four herd-level genetics routes are
 * removed (Equoria-8grnh; owner ruling q144, 2026-10-28: "No genetics reports for
 * players").
 *
 * Old contract: these routes answered a player with a genetics report over their
 * own horses (diversity metrics, population health grade, trends, suggested
 * breeding pairs):
 *   POST /genetics/population-analysis
 *   POST /genetics/optimal-breeding
 *   GET  /genetics/diversity-report/:userId
 *   GET  /genetics/population-health/:userId
 * Ruling: each now answers the app's JSON "Route not found" 404, for the caller's
 * own herd, a herd that includes another player's stud stallion, the caller's own
 * user id and another player's user id. On the old code each request reached its
 * handler (200, 403 or a handler-body 404), so the `Route not found` assertion
 * fails there.
 *
 * The pair-forecast routes removed earlier are pinned in
 * removedForecastRoutes.integration.test.mjs.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { sharedBreed, makePlayer, makeHorse, sendJson } from './helpers/studBookingFixtures.mjs';

const PREFIX = 'TestFixture-8grnh-herd';

describe('herd genetics report routes are removed (Equoria-8grnh, q144)', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let other;
  let stallion;
  let mare;
  let stud;

  beforeEach(async () => {
    const breed = await sharedBreed();
    const ids = () => [stallion?.id, mare?.id, stud?.id].filter(Boolean);
    const users = () => [owner?.user.id, other?.user.id].filter(Boolean);
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids() } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: users() } } }), 'users');
    owner = await makePlayer(PREFIX, 'owner', 1000);
    other = await makePlayer(PREFIX, 'other', 1000);
    const make = spec => makeHorse(PREFIX, { breedId: breed.id, ...spec });
    stallion = await make({ ownerId: owner.user.id, sex: 'Stallion' });
    mare = await make({ ownerId: owner.user.id, sex: 'Mare' });
    stud = await make({ ownerId: other.user.id, sex: 'Stallion', studStatus: 'At Public Stud', studFee: 10 });
  });

  afterEach(async () => {
    await cleanup.run();
  });

  const herds = {
    'own herd': () => [stallion.id, mare.id],
    'herd with another player’s stud stallion': () => [stud.id, mare.id],
  };
  const users = {
    'own user id': () => owner.user.id,
    'another player’s user id': () => other.user.id,
  };

  const cases = [
    ...Object.entries(herds).flatMap(([herdName, ids]) => [
      [
        `POST /genetics/population-analysis, ${herdName}`,
        () => sendJson('post', '/api/v1/genetics/population-analysis', owner.token, { horseIds: ids() }),
      ],
      [
        `POST /genetics/optimal-breeding, ${herdName}`,
        () => sendJson('post', '/api/v1/genetics/optimal-breeding', owner.token, { horseIds: ids() }),
      ],
    ]),
    ...Object.entries(users).flatMap(([userName, id]) => [
      [
        `GET /genetics/diversity-report/:userId, ${userName}`,
        () => sendJson('get', `/api/v1/genetics/diversity-report/${id()}`, owner.token),
      ],
      [
        `GET /genetics/population-health/:userId, ${userName}`,
        () => sendJson('get', `/api/v1/genetics/population-health/${id()}`, owner.token),
      ],
    ]),
  ];

  it.each(cases)('%s answers the JSON route-not-found 404', async (_label, call) => {
    const res = await call();

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: 'Route not found' });
  });
});
