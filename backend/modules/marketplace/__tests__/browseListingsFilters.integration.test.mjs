/**
 * browseListings filter params — name / sex / breedId (Equoria-cvsfk).
 *
 * The marketplace Browse tab gained three server-side filters ported (as
 * parameters, not code) from the retired Story 3-6 stable surface:
 *   - name    — case-insensitive substring on horse name (buyers previously
 *               could not find a specific horse at all)
 *   - sex     — case-insensitive exact match (Mare / Stallion)
 *   - breedId — exact FK match (the UI breed Select sends the id; the legacy
 *               `breed` name-substring param remains for compat)
 *
 * Real DB, real Express app, no mocks (CLAUDE.md §3). Fixtures are scoped by
 * a per-run unique name prefix so canonical-DB listings can never collide
 * with the assertions; every assertion first narrows the response to rows
 * bearing that prefix. Browse excludes the requester's own horses, so the
 * for-sale fixtures belong to a second (seller) user and the buyer queries.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

const runId = randomBytes(4).toString('hex');
const PREFIX = `TestFixture-MPBrowse-${runId}`;

function uniqueEmail(tag) {
  return `mpbrowse-${tag}-${runId}-${randomBytes(4).toString('hex')}@test.com`;
}
function uniqueUsername(tag) {
  return `mpbrowse${tag}${runId}${randomBytes(3).toString('hex')}`;
}

describe('browseListings filters — name/sex/breedId (Equoria-cvsfk)', () => {
  let buyer;
  let buyerToken;
  let seller;
  let breedA;
  let breedB;
  const createdHorseIds = [];
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    // Two distinct real breeds anchor the breedId assertions.
    const breeds = await prisma.breed.findMany({ take: 2, select: { id: true, name: true } });
    expect(breeds.length).toBeGreaterThanOrEqual(2);
    [breedA, breedB] = breeds;

    buyer = await prisma.user.create({
      data: {
        email: uniqueEmail('buyer'),
        username: uniqueUsername('b'),
        password: 'irrelevant-hash',
        firstName: 'MP',
        lastName: 'Buyer',
        money: 5000,
        settings: {},
      },
    });
    seller = await prisma.user.create({
      data: {
        email: uniqueEmail('seller'),
        username: uniqueUsername('s'),
        password: 'irrelevant-hash',
        firstName: 'MP',
        lastName: 'Seller',
        money: 5000,
        settings: {},
      },
    });
    buyerToken = generateTestToken({ id: buyer.id, email: buyer.email, role: 'user' });

    const mk = (name, sex, breedId) =>
      prisma.horse.create({
        data: {
          ...fixtureColor(),
          name,
          sex,
          dateOfBirth: new Date('2020-01-01'),
          age: 5,
          userId: seller.id,
          breedId,
          forSale: true,
          salePrice: 500,
        },
      });

    const alpha = await mk(`${PREFIX}-Alpha`, 'Mare', breedA.id);
    const beta = await mk(`${PREFIX}-Beta`, 'Stallion', breedA.id);
    const gamma = await mk(`${PREFIX}-Gamma`, 'Mare', breedB.id);
    createdHorseIds.push(alpha.id, beta.id, gamma.id);

    // Scoped, fail-loud cleanup: horses (FK) before users.
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horsesById');
    cleanup.add(() => prisma.user.delete({ where: { id: seller.id } }), 'seller');
    cleanup.add(() => prisma.user.delete({ where: { id: buyer.id } }), 'buyer');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  const browse = qs =>
    request(app).get(`/api/v1/marketplace?${qs}`).set('Origin', ORIGIN).set('Authorization', `Bearer ${buyerToken}`);

  const fixtureRows = res => res.body.data.listings.filter(l => l.name.startsWith(PREFIX));

  it('name filter returns only the matching listing (case-insensitive substring)', async () => {
    const res = await browse(`name=${PREFIX}-alpha`);
    expect(res.status).toBe(200);
    const rows = fixtureRows(res);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe(`${PREFIX}-Alpha`);
  });

  it('sex filter narrows to mares only', async () => {
    const res = await browse(`name=${PREFIX}&sex=Mare`);
    expect(res.status).toBe(200);
    const names = fixtureRows(res)
      .map(l => l.name)
      .sort();
    expect(names).toEqual([`${PREFIX}-Alpha`, `${PREFIX}-Gamma`]);
  });

  it('sex filter is case-insensitive', async () => {
    const res = await browse(`name=${PREFIX}&sex=stallion`);
    expect(res.status).toBe(200);
    const names = fixtureRows(res).map(l => l.name);
    expect(names).toEqual([`${PREFIX}-Beta`]);
  });

  it('breedId filter narrows to the exact breed', async () => {
    const res = await browse(`name=${PREFIX}&breedId=${breedB.id}`);
    expect(res.status).toBe(200);
    const names = fixtureRows(res).map(l => l.name);
    expect(names).toEqual([`${PREFIX}-Gamma`]);
  });

  it('filters compose: sex + breedId', async () => {
    const res = await browse(`name=${PREFIX}&sex=Mare&breedId=${breedA.id}`);
    expect(res.status).toBe(200);
    const names = fixtureRows(res).map(l => l.name);
    expect(names).toEqual([`${PREFIX}-Alpha`]);
  });

  it('non-numeric breedId is ignored rather than erroring', async () => {
    const res = await browse(`name=${PREFIX}&breedId=not-a-number`);
    expect(res.status).toBe(200);
    expect(fixtureRows(res)).toHaveLength(3);
  });
});
