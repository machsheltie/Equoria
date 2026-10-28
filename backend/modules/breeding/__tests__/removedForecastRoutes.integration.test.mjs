/**
 * Players never see a predicted outcome for their foal: the pair-forecast routes
 * are removed (Equoria-8grnh; owner ruling q91, 2026-10-26).
 *
 * Old contract: these five routes answered a mare's owner with a forecast for the
 * mare plus her own or an at-stud stallion (genetic odds, lineage, inbreeding,
 * compatibility, recommendations):
 *   POST /breeding/genetic-probability
 *   GET  /breeding/lineage-analysis/:stallionId/:mareId
 *   POST /breeding/breeding-recommendations
 *   POST /genetics/inbreeding-analysis
 *   POST /genetics/breeding-compatibility
 * Ruling: "users don't get to see the predicted outcome for their foal". Each now
 * answers the app's JSON "Route not found" 404, for every pair a caller could name
 * (an own pair, a stud pair, a self-cross, a missing horse). On the old code each
 * of these requests reached its handler (200, 400 or a handler-body 404), so the
 * `Route not found` assertion fails there.
 *
 * The herd-level genetics reports are removed too (owner ruling q144, 2026-10-28);
 * their 404s are pinned in removedHerdGeneticsRoutes.integration.test.mjs.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { sharedBreed, makePlayer, makeHorse, sendJson } from './helpers/studBookingFixtures.mjs';

const PREFIX = 'TestFixture-8grnh-forecast';
const missingId = 2_000_111_444;

const REMOVED = [
  [
    'POST /breeding/genetic-probability',
    (token, s, m) =>
      sendJson('post', '/api/v1/breeding/genetic-probability', token, {
        stallionId: s,
        mareId: m,
        includeLineage: true,
      }),
  ],
  [
    'GET /breeding/lineage-analysis/:stallionId/:mareId',
    (token, s, m) => sendJson('get', `/api/v1/breeding/lineage-analysis/${s}/${m}?generations=3`, token),
  ],
  [
    'POST /breeding/breeding-recommendations',
    (token, s, m) => sendJson('post', '/api/v1/breeding/breeding-recommendations', token, { stallionId: s, mareId: m }),
  ],
  [
    'POST /genetics/inbreeding-analysis',
    (token, s, m) => sendJson('post', '/api/v1/genetics/inbreeding-analysis', token, { stallionId: s, mareId: m }),
  ],
  [
    'POST /genetics/breeding-compatibility',
    (token, s, m) => sendJson('post', '/api/v1/genetics/breeding-compatibility', token, { stallionId: s, mareId: m }),
  ],
];

describe('foal-outcome forecast routes are removed (Equoria-8grnh)', () => {
  const cleanup = createCleanupTracker();
  let mareOwner;
  let studOwner;
  let ownStallion;
  let stud;
  let mare;

  beforeEach(async () => {
    const breed = await sharedBreed();
    mareOwner = await makePlayer(PREFIX, 'mareOwner', 1000);
    studOwner = await makePlayer(PREFIX, 'studOwner', 1000);
    const make = spec => makeHorse(PREFIX, { breedId: breed.id, ...spec });
    ownStallion = await make({ ownerId: mareOwner.user.id, sex: 'Stallion' });
    mare = await make({ ownerId: mareOwner.user.id, sex: 'Mare' });
    stud = await make({ ownerId: studOwner.user.id, sex: 'Stallion', studStatus: 'At Public Stud', studFee: 10 });
    const ids = [ownStallion.id, mare.id, stud.id];
    const users = [mareOwner.user.id, studOwner.user.id];
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: users } } }), 'users');
  });

  afterEach(async () => {
    await cleanup.run();
  });

  const pairs = {
    'own pair': () => [ownStallion.id, mare.id],
    'public stud pair': () => [stud.id, mare.id],
    'self-cross': () => [mare.id, mare.id],
    'missing horses': () => [missingId, missingId + 1],
  };

  describe.each(REMOVED)('%s', (_label, call) => {
    it.each(Object.keys(pairs))('answers the JSON route-not-found 404 for the %s', async pairName => {
      const [stallionId, mareId] = pairs[pairName]();
      const res = await call(mareOwner.token, stallionId, mareId);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false, message: 'Route not found' });
    });
  });
});
