/**
 * GET /api/v1/horses/:id/overview — pregnancy-field parity (Equoria-1adr)
 *
 * Adjacent-location finding from Equoria-m282: getHorseOverview() builds
 * overviewData as an explicit object literal and (before this fix) did NOT
 * include inFoalSinceDate / pregnancySireId / pregnancyFeedingsByTier. The
 * full GET /:id route surfaces all three. Any future consumer of /overview
 * that needed pregnancy state would silently get nothing.
 *
 * Resolution chosen: option (a) — add the three pregnancy fields to
 * overviewData so /overview has parity with GET /:id.
 *
 * These HTTP-chain assertions are the sentinel: if a future refactor drops
 * the fields from the `select` clause or the response literal, these fail.
 *
 * Real DB. Real prisma. Real HTTP via supertest. No mocks, no bypass headers.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

const FIXTURE_PREFIX = 'TestFixture-overview-1adr';

let owner;
let token;
let inFoalMare;
let notPregnantHorse;
let sireId;

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');

  const a = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
  });
  owner = a.user;
  token = a.token;

  const sire = await createTestHorse({
    name: `${FIXTURE_PREFIX}-sire-${tag}`,
    userId: owner.id,
    sex: 'Stallion',
    age: 6,
  });
  sireId = sire.id;

  inFoalMare = await createTestHorse({
    name: `${FIXTURE_PREFIX}-mare-${tag}`,
    userId: owner.id,
    sex: 'Mare',
    age: 5,
    inFoalSinceDate: new Date('2026-05-01T00:00:00Z'),
    pregnancySireId: sireId,
    pregnancyFeedingsByTier: { performance: 2 },
  });

  notPregnantHorse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-open-${tag}`,
    userId: owner.id,
    sex: 'Mare',
    age: 5,
  });
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

describe('GET /api/v1/horses/:id/overview — pregnancy-field parity (Equoria-1adr)', () => {
  it('includes inFoalSinceDate, pregnancySireId and pregnancyFeedingsByTier for an in-foal mare', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${inFoalMare.id}/overview`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Parity with GET /:id — these three fields must be present on /overview.
    expect(res.body.data).toHaveProperty('inFoalSinceDate');
    expect(res.body.data).toHaveProperty('pregnancySireId');
    expect(res.body.data).toHaveProperty('pregnancyFeedingsByTier');

    expect(res.body.data.inFoalSinceDate).toBe('2026-05-01T00:00:00.000Z');
    expect(res.body.data.pregnancySireId).toBe(sireId);
    expect(res.body.data.pregnancyFeedingsByTier).toEqual({ performance: 2 });
  });

  it('returns null pregnancy fields and {} feedings for a non-pregnant horse (defined, not undefined)', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${notPregnantHorse.id}/overview`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Sentinel: the keys must exist even when the horse isn't pregnant.
    // If a future refactor drops them from the select/response literal,
    // these become undefined and the assertions fail — the exact
    // silent-drop failure 1adr was filed to prevent.
    expect(res.body.data).toHaveProperty('inFoalSinceDate');
    expect(res.body.data).toHaveProperty('pregnancySireId');
    expect(res.body.data).toHaveProperty('pregnancyFeedingsByTier');
    expect(res.body.data.inFoalSinceDate).toBeNull();
    expect(res.body.data.pregnancySireId).toBeNull();
    expect(res.body.data.pregnancyFeedingsByTier).toEqual({});
  });
});
