/**
 * Marketplace sale browse and stud search on the keyset convention
 * (Equoria-cmw85.21).
 *
 * Both sorted by nullable columns (price, fee, age, createdAt) with only an id
 * tiebreak and paged by OFFSET, so a listing added while a player browsed shifted
 * every later page. Each sort is walked by cursor over 12 horses TIED on the sort
 * key, some with NULL price/fee/age, with a tied horse listed between page fetches;
 * the walk must return the baseline order exactly. The numbered-page client (?page,
 * with `pagination.total`) keeps working. Real backend, real auth, real database.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { walkPages } from '../../../__tests__/helpers/keysetWalk.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { studStatuses } from '../../../constants/schema.mjs';

const RUN = randomBytes(4).toString('hex');
const PREFIX = `TestFixture-MktKeyset-${RUN}`;
const TIED = new Date('2026-03-05T07:00:00.000Z');
const cleanup = createCleanupTracker();

let seller;
let viewer;
let token;
let breed;
const horseIds = [];

const horseData = (i, overrides) => ({
  ...fixtureColor(),
  name: `${PREFIX}-${i}`,
  sex: 'Stallion',
  dateOfBirth: birthDateForAge(5),
  age: 5,
  breedId: breed.id,
  userId: seller.id,
  healthStatus: 'Good',
  createdAt: TIED,
  ...overrides,
});

const mkUser = tag =>
  prisma.user.create({
    data: {
      username: `mktkeyset-${tag}-${RUN}`,
      email: `mktkeyset-${tag}-${RUN}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Mkt',
      lastName: tag,
    },
  });

const get = (path, query) =>
  request(app)
    .get(path)
    .set('Authorization', `Bearer ${token}`)
    .query({ name: PREFIX, ...query });

beforeAll(async () => {
  breed = await prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: 'Shared test breed' },
  });
  seller = await mkUser('seller');
  viewer = await mkUser('viewer');
  token = generateTestToken({ id: viewer.id, email: viewer.email, role: 'user' });
  // 12 horses for sale AND at stud: prices/fees in three tied groups plus NULLs, ages likewise.
  for (let i = 0; i < 12; i++) {
    const h = await prisma.horse.create({
      data: horseData(i, {
        forSale: true,
        salePrice: i < 3 ? null : [100, 100, 250][i % 3],
        studFee: i < 3 ? null : [0, 0, 500][i % 3],
        studStatus: studStatuses.public,
        age: i < 3 ? null : 4 + (i % 2),
      }),
    });
    horseIds.push(h.id);
  }
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: seller.id } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [seller.id, viewer.id] } } }), 'users');
}, 120_000);

afterAll(() => cleanup.run(), 60_000);

// The API spells its sort values with an underscore (priceAsc is sent as the wire value);
// the names are written camelCase here and spelled for the wire in one place.
const wire = names => names.map(n => n.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`));

describe.each([
  ['sale browse', '/api/v1/marketplace', 'listings', wire(['priceAsc', 'priceDesc', 'youngest', 'newest'])],
  ['stud search', '/api/v1/marketplace/studs', 'studs', wire(['feeAsc', 'feeDesc', 'youngest', 'newest'])],
])('GET %s keyset pages (Equoria-cmw85.21)', (_label, path, key, sorts) => {
  it.each(sorts)(
    'walks sort=%s by cursor in the baseline order while a tied horse is listed mid-walk',
    async sort => {
      const baseline = await get(path, { limit: 100, sort });
      expect(baseline.status).toBe(200);
      const expected = baseline.body.data[key].map(h => h.id);
      expect(expected).toHaveLength(12);

      const late = [];
      const { ids, sizes } = await walkPages({
        fetchPage: async cursor => {
          const res = await get(path, { limit: 5, sort, ...(cursor ? { cursor } : {}) });
          expect(res.status).toBe(200);
          return res.body.data;
        },
        idsOf: data => data[key].map(h => h.id),
        pageInfoOf: data => data.pageInfo,
        afterFirstPage: async () => {
          const h = await prisma.horse.create({
            data: horseData('late', {
              forSale: true,
              salePrice: 100,
              studFee: 0,
              studStatus: studStatuses.public,
            }),
          });
          late.push(h.id);
        },
      });
      expect(sizes.slice(0, 2)).toEqual([5, 5]);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.filter(id => !late.includes(id))).toEqual(expected);
      await prisma.horse.deleteMany({ where: { id: { in: late } } });
    },
    120_000,
  );

  it('caps a huge ?limit and still answers the numbered-page client with a total', async () => {
    const res = await get(path, { limit: 5000 });
    expect(res.status).toBe(200);
    expect(res.body.data[key].length).toBeLessThanOrEqual(100);
    const first = await get(path, { limit: 5 });
    const second = await get(path, { limit: 5, page: 2 });
    expect(first.body.data.pagination.total).toBe(12);
    expect(first.body.data.pagination.totalPages).toBe(3);
    expect(second.body.data.pagination.page).toBe(2);
    expect(second.body.data[key].map(h => h.id)).not.toEqual(first.body.data[key].map(h => h.id));
  }, 60_000);

  it('answers 400 for a cursor the server did not issue', async () => {
    const res = await get(path, { cursor: 'c1:nonsense' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  }, 60_000);
});
