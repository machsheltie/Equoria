/**
 * GET /api/v1/horses/:id — pregnancyFeedingsByTier exposure (Equoria-m282)
 *
 * Frontend HorseDetailPage.tsx:589 reads `horse.pregnancyFeedingsByTier`
 * (declared in frontend/src/lib/api-client.ts:266) and passes it to
 * <PregnancyFeedingPanel feedings={...} />. If the GET /api/v1/horses/:id
 * response does not surface this field, the panel silently renders zero
 * counts for every tier — defeating Phase B6's purpose.
 *
 * The B4 service-level increment is already covered by
 * feedHorseService.test.mjs ("pregnancy feeding counter (Phase B4)").
 * That test asserts `feedHorse()` mutates the DB column. It does NOT
 * assert the column is surfaced through the HTTP API. This file closes
 * that gap with two HTTP-chain assertions:
 *
 *  1. After a real feedHorse() on an in-foal mare, GET /api/v1/horses/:id
 *     returns pregnancyFeedingsByTier === { performance: 1 } (correct
 *     counts, not zeros).
 *
 *  2. Sentinel: a fresh in-foal mare with counter {} — the GET response
 *     still includes pregnancyFeedingsByTier as a defined {} object, NOT
 *     undefined. This fails if a future refactor adds a `select` clause
 *     to the /:id ownership query that omits the column (the exact
 *     silent-drop failure mode m282 was filed to prevent).
 *
 * Real DB. Real prisma. Real HTTP chain via supertest. No mocks, no
 * bypass headers.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { feedHorse } from '../services/horseFeedService.mjs';

const FIXTURE_PREFIX = 'TestFixture-pfbt-m282';

let owner;
let token;
let fedMare;
let unfedMare;

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');

  const a = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
  });
  owner = a.user;
  token = a.token;

  // Give the owner a pooled feed inventory so feedHorse() can decrement it.
  await prisma.user.update({
    where: { id: owner.id },
    data: {
      settings: {
        inventory: [
          {
            id: 'feed-performance',
            itemId: 'performance',
            category: 'feed',
            name: 'Performance Feed',
            quantity: 10,
          },
        ],
      },
    },
  });

  // In-foal mare that WILL be fed via the real service.
  fedMare = await createTestHorse({
    name: `${FIXTURE_PREFIX}-fed-${tag}`,
    userId: owner.id,
    sex: 'Mare',
    age: 5,
    equippedFeedType: 'performance',
    inFoalSinceDate: new Date(),
    pregnancyFeedingsByTier: {},
  });

  // In-foal mare that is NEVER fed — counter stays {} (default).
  unfedMare = await createTestHorse({
    name: `${FIXTURE_PREFIX}-unfed-${tag}`,
    userId: owner.id,
    sex: 'Mare',
    age: 5,
    inFoalSinceDate: new Date(),
    pregnancyFeedingsByTier: {},
  });

  // Drive a real feed through the service (same path the POST /feed route
  // uses). rng() => 0.99 suppresses the stat-boost roll so the only state
  // change we assert on is the pregnancy counter.
  await feedHorse({ userId: owner.id, horseId: fedMare.id, rng: () => 0.99 });
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

describe('GET /api/v1/horses/:id — pregnancyFeedingsByTier exposure (Equoria-m282)', () => {
  it('surfaces pregnancyFeedingsByTier with correct counts after a feed', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${fedMare.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // The exact failure m282 guards against: panel would render zeros if
    // this field were absent. It must equal the real post-feed counter.
    expect(res.body.data.pregnancyFeedingsByTier).toEqual({ performance: 1 });
  });

  it('surfaces pregnancyFeedingsByTier as a defined {} (not undefined) for an unfed in-foal mare', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${unfedMare.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Sentinel: the property must be present and an object. If a future
    // refactor adds a `select` clause to the /:id ownership query that
    // omits pregnancyFeedingsByTier, this assertion fails because the
    // field becomes undefined — which is exactly the silent-drop bug
    // m282 was filed to prevent.
    expect(res.body.data).toHaveProperty('pregnancyFeedingsByTier');
    expect(res.body.data.pregnancyFeedingsByTier).toEqual({});
  });
});
