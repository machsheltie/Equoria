/**
 * A stallion cannot stand at stud before he is 3 (owner ruling, Stacey
 * 2026-10-23, Equoria-e7tgc.2).
 *
 *   - POST /horses/:id/stud-listing refuses a stallion under 3 with a 400 and
 *     a code, for a first listing and for a mode or fee change alike, and
 *     leaves the horse exactly as it was; at 3 the listing goes through.
 *   - GET /marketplace/studs never offers a stallion under 3, even one whose
 *     listing was written before the guard existed (no data migration).
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import {
  ORIGIN,
  sharedBreed,
  makePlayer,
  makeHorse,
  disconnectLockClient,
  registerCleanup,
} from './helpers/studBookingFixtures.mjs';

const PREFIX = 'TestFixture-e7tgc2-studage';

async function listAtStud(token, horseId, body) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post(`/api/v1/horses/${horseId}/stud-listing`)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

describe('a stallion stands at stud only from age 3 (Equoria-e7tgc.2)', () => {
  const cleanup = createCleanupTracker();
  let breed;
  let owner;
  const userIds = [];
  const horseIds = [];

  async function stallion(ageYears, extra = {}) {
    const h = await makeHorse(PREFIX, {
      ownerId: owner.user.id,
      sex: 'Stallion',
      breedId: breed.id,
      dateOfBirth: birthDateForAge(ageYears),
      age: ageYears,
      ...extra,
    });
    horseIds.push(h.id);
    return h;
  }

  async function listingOf(horseId) {
    return prisma.horse.findUnique({ where: { id: horseId }, select: { studStatus: true, studFee: true } });
  }

  beforeEach(async () => {
    userIds.length = 0;
    horseIds.length = 0;
    breed = await sharedBreed();
    owner = await makePlayer(PREFIX, 'owner', 1000);
    userIds.push(owner.user.id);
    registerCleanup(cleanup, { userIds, horseIds });
  });

  afterEach(async () => {
    await cleanup.run();
  });

  afterAll(async () => {
    await disconnectLockClient();
  });

  it.each([
    ['a first public listing', {}, { studFee: 500, mode: 'public' }],
    ['a first private listing', {}, { studFee: 500, mode: 'private' }],
    [
      'a fee change on a listing made before the guard',
      { studStatus: 'At Public Stud', studFee: 100 },
      { studFee: 900 },
    ],
  ])('refuses %s for a 2-year-old and changes nothing', async (_label, existing, body) => {
    const colt = await stallion(2, existing);
    const before = await listingOf(colt.id);

    const res = await listAtStud(owner.token, colt.id, body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      code: 'stallionTooYoungForStud',
      message: `${colt.name} cannot stand at stud until he is 3 years old.`,
    });
    expect(await listingOf(colt.id)).toEqual(before);
  });

  it('lists a 3-year-old', async () => {
    const young = await stallion(3);

    const res = await listAtStud(owner.token, young.id, { studFee: 500, mode: 'public' });

    expect(res.status).toBe(200);
    expect(await listingOf(young.id)).toEqual({ studStatus: 'At Public Stud', studFee: 500 });
  });

  it('the stud search never offers a stallion under 3, even one listed before the guard', async () => {
    const viewer = await makePlayer(PREFIX, 'viewer', 1000);
    userIds.push(viewer.user.id);
    const tooYoung = await stallion(2, { studStatus: 'At Public Stud', studFee: 100 });
    const oldEnough = await stallion(3, { studStatus: 'At Private Stud', studFee: 100 });

    const res = await request(app)
      .get(`/api/v1/marketplace/studs?name=${encodeURIComponent(PREFIX)}&limit=100`)
      .set('Authorization', `Bearer ${viewer.token}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.studs.map(stud => stud.id);
    expect(ids).toContain(oldEnough.id);
    expect(ids).not.toContain(tooYoung.id);
  });
});
