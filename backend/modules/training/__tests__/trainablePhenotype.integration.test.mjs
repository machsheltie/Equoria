/**
 * GET /api/v1/training/trainable/:userId — phenotype exposure (Equoria-7l75)
 *
 * Adjacent-locations fix for Equoria-tkyx — HorseCard.tsx reads
 * `horse.phenotype?.colorName` to render the coat-color chip, and the
 * trainable-horses list endpoint previously omitted phenotype from its
 * response shape (it returned name/age/breed/sex but not phenotype).
 *
 * This test asserts:
 *  - phenotype is included in the trainable list payload when set on the DB row
 *  - the colorName field round-trips intact
 *  - rows with NULL phenotype return null (not undefined / missing) so the
 *    frontend can render a fallback
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

const FIXTURE_PREFIX = 'TestFixture-trainable-phenotype';

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
    age: 5, // training-eligible (≥3 game-years)
    phenotype: {
      colorName: 'Chestnut',
      shade: 'flaxen',
      markings: { face: 'blaze' },
    },
  });

  horseWithoutPhenotype = await createTestHorse({
    name: `${FIXTURE_PREFIX}-NoColor-${tag}`,
    userId: owner.id,
    age: 5,
    phenotype: null,
  });
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

describe('GET /api/v1/training/trainable/:userId — phenotype exposure', () => {
  it('returns phenotype on trainable horses with a populated colorName', async () => {
    const res = await request(app)
      .get(`/api/v1/training/trainable/${owner.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const colored = res.body.data.find(h => h.id === horseWithPhenotype.id);
    expect(colored).toBeTruthy();
    // The critical assertion — phenotype.colorName must round-trip on the
    // trainable list, parallel to the /horses list assertion in tkyx.
    expect(colored.phenotype).toBeTruthy();
    expect(colored.phenotype.colorName).toBe('Chestnut');
  });

  it('returns phenotype: null for trainable horses with no phenotype row', async () => {
    const res = await request(app)
      .get(`/api/v1/training/trainable/${owner.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    const uncolored = res.body.data.find(h => h.id === horseWithoutPhenotype.id);
    expect(uncolored).toBeTruthy();
    // Explicit null (not undefined / missing field). Frontend depends on the
    // key existing so the fallback path can render "—".
    expect(uncolored.phenotype).toBeNull();
  });
});
