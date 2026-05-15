/**
 * GET /api/v1/horses — phenotype exposure on list endpoint (Equoria-tkyx)
 *
 * HorseCard.tsx reads `horse.phenotype?.colorName` to render the coat-color
 * chip. The list endpoint previously omitted phenotype from its Prisma
 * `select`, so the chip was hidden everywhere.
 *
 * This test asserts:
 *  - phenotype is included in the list payload when set on the DB row.
 *  - the colorName field round-trips intact.
 *  - rows with NULL phenotype return null (not undefined / missing) so the
 *    frontend can render a fallback.
 *  - the heavy colorGenotype JSONB is still excluded (size sentinel).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import {
  createTestUser,
  createTestHorse,
  cleanupTestData,
} from '../../../tests/helpers/testAuth.mjs';

const FIXTURE_PREFIX = 'TestFixture-list-phenotype';

let owner;
let token;
let horseWithPhenotype;
let horseWithoutPhenotype;

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');

  const a = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
  });
  owner = a.user;
  token = a.token;

  horseWithPhenotype = await createTestHorse({
    name: `${FIXTURE_PREFIX}-WithColor-${tag}`,
    userId: owner.id,
    phenotype: {
      colorName: 'Bay',
      shade: 'mahogany',
      markings: { face: 'star' },
    },
  });

  horseWithoutPhenotype = await createTestHorse({
    name: `${FIXTURE_PREFIX}-NoColor-${tag}`,
    userId: owner.id,
    phenotype: null,
  });
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

describe('GET /api/v1/horses — phenotype exposure', () => {
  it('returns phenotype on horses with a populated colorName', async () => {
    const res = await request(app)
      .get(`/api/v1/horses?userId=${owner.id}&limit=200`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const colored = res.body.data.find(h => h.id === horseWithPhenotype.id);
    expect(colored).toBeTruthy();
    // The critical assertion — phenotype.colorName must round-trip.
    expect(colored.phenotype).toBeTruthy();
    expect(colored.phenotype.colorName).toBe('Bay');
  });

  it('returns phenotype: null for horses with no phenotype row', async () => {
    const res = await request(app)
      .get(`/api/v1/horses?userId=${owner.id}&limit=200`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    const uncolored = res.body.data.find(h => h.id === horseWithoutPhenotype.id);
    expect(uncolored).toBeTruthy();
    // Explicit null (not undefined / missing field). Frontend depends on the
    // key existing so the fallback path can render "—" instead of breaking
    // optional-chaining downstream.
    expect(uncolored.phenotype).toBeNull();
  });

  it('does NOT expose the heavy colorGenotype JSONB on the list payload', async () => {
    // Sentinel: AC explicitly excludes colorGenotype (~1KB/row). HorseCard
    // does not need it; full detail page fetches it via the per-horse route.
    const res = await request(app)
      .get(`/api/v1/horses?userId=${owner.id}&limit=200`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    for (const h of res.body.data) {
      expect(h).not.toHaveProperty('colorGenotype');
    }
  });
});
