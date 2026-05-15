/**
 * GET /api/v1/horses — ageYears exposure on horse responses (Equoria-lvjy)
 *
 * Frontend reads `horse.ageYears ?? horse.age` in HorseCard, StableView,
 * MyStablePage, and BreedingPairSelection. Backend must surface ageYears
 * computed from dateOfBirth at response time (not from the cached
 * horse.age column) so the frontend gets the correct game-year value.
 *
 * This test asserts:
 *  - GET /api/v1/horses (list) returns ageYears on each row.
 *  - GET /api/v1/horses/:id (single) returns ageYears.
 *  - GET /api/v1/horses/:id/overview returns ageYears.
 *  - ageYears is computed from dateOfBirth using the 1-week = 1-game-year
 *    convention. A horse with dateOfBirth = today - 21 days reports
 *    ageYears === 3 regardless of the cached horse.age column value.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

const FIXTURE_PREFIX = 'TestFixture-ageYears-lvjy';
const MS_PER_DAY = 1000 * 60 * 60 * 24;

let owner;
let token;
let horse21d;
let horse7d;

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');

  const a = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
  });
  owner = a.user;
  token = a.token;

  // dateOfBirth = today - 21 days → ageYears === 3 (lvjy AC literal)
  horse21d = await createTestHorse({
    name: `${FIXTURE_PREFIX}-21d-${tag}`,
    userId: owner.id,
    age: 99, // deliberately wrong cached age — proves ageYears comes from dob, not cache
    dateOfBirth: new Date(Date.now() - 21 * MS_PER_DAY),
  });

  // dateOfBirth = today - 7 days → ageYears === 1
  horse7d = await createTestHorse({
    name: `${FIXTURE_PREFIX}-7d-${tag}`,
    userId: owner.id,
    age: 0, // deliberately wrong cached age
    dateOfBirth: new Date(Date.now() - 7 * MS_PER_DAY),
  });
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

describe('GET /api/v1/horses — ageYears exposure', () => {
  it('returns ageYears computed from dateOfBirth on the list endpoint', async () => {
    const res = await request(app)
      .get(`/api/v1/horses?userId=${owner.id}&limit=200`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const h21 = res.body.data.find(h => h.id === horse21d.id);
    const h7 = res.body.data.find(h => h.id === horse7d.id);

    expect(h21).toBeTruthy();
    expect(h7).toBeTruthy();

    // AC: dob 21d ago → ageYears === 3, regardless of cached horse.age (99)
    expect(h21.ageYears).toBe(3);
    expect(h7.ageYears).toBe(1);
  });

  it('returns ageYears on the single-horse GET endpoint', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse21d.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ageYears).toBe(3);
  });

  it('returns ageYears on the overview endpoint', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse21d.id}/overview`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ageYears).toBe(3);
    // Transitional: keep the legacy age field too. After lvjy and son6
    // settle, x49d removes the frontend fallback and we can prune this.
    expect(res.body.data.age).toBeDefined();
  });
});
