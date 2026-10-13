/**
 * The player's horse list shows a change as soon as it happens —
 * Equoria-gf4kd, Equoria-3427a and Equoria-de3op.
 *
 * `GET /api/v1/horses` used to cache each player's list for 120s, and any writer
 * that did not clear that cache left a stale stable in front of the player:
 *
 *  - gf4kd: the list is cached under generateCacheKey('horses:list', …), and
 *    generateCacheKey turns the ':' inside that component into '_', so the
 *    real key is 'horses_list:<user>:…'. Every writer cleared
 *    'horses:list:*', which can never match it, so a renamed horse kept its
 *    old name in the stable until the cache expired.
 *  - 3427a: foaling (the nightly job and POST /horses/:id/foal-now share
 *    createFoalFromPregnancy) never cleared the list at all, so a newborn foal
 *    was missing from its owner's stable.
 *  - de3op: purchases, sales, onboarding, listing, feeding, vet, training and
 *    show results never cleared it either. Owner ruling 2026-10-13: remove the
 *    server-side list cache (option 1) — every read is the database.
 *
 * Each test reads the list over real HTTP first (so any cache would be filled),
 * makes the change, then reads the list again and requires the change to be
 * there. Real app, real JWT, real CSRF, real database, no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createFoalFromPregnancy } from '../services/foalingService.mjs';

const FIXTURE_PREFIX = 'TestFixture-gf4kd';
const ORIGIN = 'http://localhost:3000';
const DAY_MS = 24 * 60 * 60 * 1000;
const tag = randomBytes(4).toString('hex');

let csrf;
let seq = 0;
const foalIds = [];
const soldHorseIds = [];

/**
 * A fresh player per test: each player's list is its own cache entry, so a
 * test's first read happens after its own fixtures exist (fixtures are written
 * straight to the database, which — unlike the game's writers — clears nothing).
 */
async function makeOwner() {
  seq += 1;
  return createTestUser({
    username: `${FIXTURE_PREFIX}-${seq}-${tag}`,
    email: `${FIXTURE_PREFIX}-${seq}-${tag}@example.com`,
  });
}

/** A player's stable as the game serves it. */
async function stableNames(token) {
  const res = await request(app).get('/api/v1/horses').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body.data.map(horse => horse.name);
}

beforeAll(async () => {
  csrf = await fetchCsrf(app);
}, 120000);

afterAll(async () => {
  // A sale's history row references the horse (RESTRICT), so it goes first.
  if (soldHorseIds.length > 0) {
    await prisma.horseSale.deleteMany({ where: { horseId: { in: soldHorseIds } } });
  }
  if (foalIds.length > 0) {
    await prisma.horse.deleteMany({ where: { id: { in: foalIds } } });
  }
  await cleanupTestData();
});

describe('the horse list reflects changes immediately (Equoria-gf4kd, Equoria-3427a)', () => {
  it('a renamed horse shows its new name in the stable straight away', async () => {
    const { user: owner, token } = await makeOwner();
    const horse = await createTestHorse({ name: `${FIXTURE_PREFIX}-r-${tag}`, userId: owner.id });
    const oldName = horse.name;
    const newName = `Renamed ${tag}`;
    expect(await stableNames(token)).toContain(oldName);

    const res = await request(app)
      .patch(`/api/v1/horses/${horse.id}/name`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name: newName });
    expect(res.status).toBe(200);

    const names = await stableNames(token);
    expect(names).toContain(newName);
    expect(names).not.toContain(oldName);
  });

  it('a newborn foal appears in its owner’s stable straight away', async () => {
    const { user: owner, token } = await makeOwner();
    const dob = new Date(Date.now() - 5 * 365 * DAY_MS);
    const sire = await createTestHorse({
      name: `${FIXTURE_PREFIX}-sire-${tag}`,
      userId: owner.id,
      sex: 'Stallion',
      dateOfBirth: dob,
      age: 5,
    });
    const dam = await createTestHorse({
      name: `${FIXTURE_PREFIX}-dam-${tag}`,
      userId: owner.id,
      sex: 'Mare',
      dateOfBirth: dob,
      age: 5,
      inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
      pregnancySireId: sire.id,
    });
    const before = await stableNames(token);
    expect(before).toContain(dam.name);

    const { foal } = await createFoalFromPregnancy({ damId: dam.id });
    foalIds.push(foal.id);

    expect(await stableNames(token)).toContain(foal.name);
  });

  // de3op: the list has no cache layer at all, so even a change made by code
  // that knows nothing about the list (here, a direct database write) shows on
  // the very next read.
  it('the list reflects a change made by any code, with nothing to clear', async () => {
    const { user: owner, token } = await makeOwner();
    const horse = await createTestHorse({ name: `${FIXTURE_PREFIX}-d-${tag}`, userId: owner.id });
    expect(await stableNames(token)).toContain(horse.name);

    const newName = `Direct ${tag}`;
    await prisma.horse.update({ where: { id: horse.id }, data: { name: newName } });

    expect(await stableNames(token)).toContain(newName);
  });

  it('a marketplace sale moves the horse between both stables straight away', async () => {
    const seller = await makeOwner();
    const buyer = await createTestUser({
      username: `${FIXTURE_PREFIX}-buyer-${tag}`,
      email: `${FIXTURE_PREFIX}-buyer-${tag}@example.com`,
      money: 5000,
    });
    const horse = await createTestHorse({ name: `${FIXTURE_PREFIX}-s-${tag}`, userId: seller.user.id });
    const post = (path, token) =>
      request(app)
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken);

    const listed = await post('/api/v1/marketplace/list', seller.token).send({ horseId: horse.id, price: 500 });
    expect(listed.status).toBe(200);
    // Both players have looked at their stables before the sale.
    expect(await stableNames(seller.token)).toContain(horse.name);
    expect(await stableNames(buyer.token)).not.toContain(horse.name);

    soldHorseIds.push(horse.id);
    const bought = await post(`/api/v1/marketplace/buy/${horse.id}`, buyer.token).send();
    expect(bought.status).toBe(200);

    expect(await stableNames(buyer.token)).toContain(horse.name);
    expect(await stableNames(seller.token)).not.toContain(horse.name);
  });
});
