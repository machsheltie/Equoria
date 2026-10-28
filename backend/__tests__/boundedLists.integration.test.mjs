/**
 * The lists that were never paginated, now bounded under the shared cap policy
 * (Equoria-cmw85.22): club, my-club and election lists, a club election's
 * candidates, a player's sale history, and the stable list's size cap.
 *
 * Each list is seeded past the cap with rows TIED on the sort key. Every list
 * must: cap a huge ?limit (and its own default) at 100 (200 for the stable);
 * walk by cursor, each row once and in id order within the tie, even as rows are
 * inserted between page fetches; and answer 400 for a cursor the server did not
 * issue. Real backend, real auth, real database.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { walkPages } from './helpers/keysetWalk.mjs';

const RUN = randomBytes(5).toString('hex');
const TIED = new Date('2026-03-06T06:00:00.000Z');
const ENDS = new Date('2026-04-06T06:00:00.000Z');
const cleanup = createCleanupTracker();
const TOTAL = 105;

let user;
let token;
let clubIds = [];
let candidateUserIds = [];
let saleFixture = null;

const get = (path, query) =>
  request(app)
    .get(path)
    .set('Authorization', `Bearer ${token}`)
    .query(query ?? {});

const clubRow = tag => ({
  name: `TestFixture-Club-${tag}-${RUN}`,
  type: 'discipline',
  category: `cat-${RUN}`,
  description: 'TestFixture club',
  leaderId: user.id,
  createdAt: TIED,
});

const electionRow = (clubId, position) => ({ clubId, position, startsAt: TIED, endsAt: ENDS });

async function expectCapAndWalk({ path, query, rowsOf, pageInfoOf, insertLate }) {
  const capRes = await get(path, { ...query, limit: 5000 });
  expect(capRes.status).toBe(200);
  expect(rowsOf(capRes.body)).toHaveLength(100);
  expect(pageInfoOf(capRes.body).hasMore).toBe(true);

  const { ids, sizes } = await walkPages({
    fetchPage: async cursor => {
      const res = await get(path, { ...query, limit: 40, ...(cursor ? { cursor } : {}) });
      expect(res.status).toBe(200);
      return res.body;
    },
    idsOf: body => rowsOf(body).map(r => r.id),
    pageInfoOf,
    afterFirstPage: insertLate,
  });
  expect(sizes).toEqual([40, 40, 25]);
  expect(new Set(ids).size).toBe(TOTAL);
  expect([...ids].sort((a, b) => b - a)).toEqual(ids);

  const bad = await get(path, { ...query, cursor: 'c1:nonsense' });
  expect(bad.status).toBe(400);
  expect(bad.body.success).toBe(false);
}

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `bounded-${RUN}@test.com`,
      username: `bounded${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Bounded',
      lastName: 'Lists',
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
}, 60_000);

// One ordered cleanup, children before parents (the tracker runs in registration order).
afterAll(() => {
  cleanup.add(
    () => prisma.clubCandidate.deleteMany({ where: { election: { clubId: { in: clubIds } } } }),
    'candidates',
  );
  cleanup.add(() => prisma.clubElection.deleteMany({ where: { clubId: { in: clubIds } } }), 'elections');
  cleanup.add(() => prisma.clubMembership.deleteMany({ where: { clubId: { in: clubIds } } }), 'memberships');
  cleanup.add(() => prisma.club.deleteMany({ where: { leaderId: user.id } }), 'clubs');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: candidateUserIds } } }), 'candidate users');
  cleanup.add(() => prisma.horseSale.deleteMany({ where: { horseId: saleFixture?.horseId ?? -1 } }), 'sales');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: saleFixture?.horseId ?? -1 } }), 'sale horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: saleFixture?.otherId ?? '-' } }), 'sale buyer');
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'stable horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
  return cleanup.run();
}, 120_000);

describe('club lists (Equoria-cmw85.22)', () => {
  beforeAll(async () => {
    await prisma.club.createMany({ data: Array.from({ length: TOTAL }, (_, i) => clubRow(i)) });
    clubIds = (await prisma.club.findMany({ where: { leaderId: user.id }, select: { id: true } })).map(c => c.id);
    await prisma.clubMembership.createMany({
      data: clubIds.map(clubId => ({ clubId, userId: user.id, joinedAt: TIED })),
    });
    await prisma.clubElection.createMany({
      data: Array.from({ length: TOTAL }, (_, i) => electionRow(clubIds[0], `TestFixture-Position-${i}`)),
    });
  }, 120_000);

  it('GET /clubs: capped, walkable by cursor, 400 on a bad cursor', async () => {
    await expectCapAndWalk({
      path: '/api/v1/clubs',
      query: { category: `cat-${RUN}` },
      rowsOf: body => body.data.clubs,
      pageInfoOf: body => body.data.pageInfo,
      insertLate: () => prisma.club.create({ data: clubRow('late') }),
    });
  }, 120_000);

  it('GET /clubs without params answers at most the default of 100', async () => {
    const res = await get('/api/v1/clubs', { category: `cat-${RUN}` });
    expect(res.body.data.clubs.length).toBeLessThanOrEqual(100);
  }, 60_000);

  it('GET /clubs/mine: capped, walkable by cursor, 400 on a bad cursor', async () => {
    await expectCapAndWalk({
      path: '/api/v1/clubs/mine',
      query: {},
      rowsOf: body => body.data.memberships,
      pageInfoOf: body => body.data.pageInfo,
      insertLate: async () => {
        const late = await prisma.club.create({ data: clubRow('late-mine') });
        await prisma.clubMembership.create({
          data: { clubId: late.id, userId: user.id, joinedAt: TIED },
        });
      },
    });
  }, 120_000);

  it('GET /clubs/:id/elections: capped, walkable by cursor, 400 on a bad cursor', async () => {
    await expectCapAndWalk({
      path: `/api/v1/clubs/${clubIds[0]}/elections`,
      query: {},
      rowsOf: body => body.data.elections,
      pageInfoOf: body => body.data.pageInfo,
      insertLate: () => prisma.clubElection.create({ data: electionRow(clubIds[0], 'TestFixture-Position-late') }),
    });
  }, 120_000);

  it('GET /clubs/elections/:id/results: the candidates are capped and tied tallies keep id order', async () => {
    const election = await prisma.clubElection.create({
      data: electionRow(clubIds[0], 'TestFixture-Candidates'),
    });
    await prisma.user.createMany({
      data: Array.from({ length: TOTAL }, (_, i) => ({
        email: `boundedcand${i}-${RUN}@test.com`,
        username: `boundedcand${i}${RUN}`,
        password: 'irrelevant-hash',
        firstName: 'Cand',
        lastName: `${i}`,
      })),
    });
    const candidates = await prisma.user.findMany({
      where: { username: { startsWith: 'boundedcand', endsWith: RUN } },
      select: { id: true },
    });
    candidateUserIds = candidates.map(c => c.id);
    await prisma.clubCandidate.createMany({
      data: candidates.map(c => ({
        electionId: election.id,
        userId: c.id,
        statement: 'TestFixture',
      })),
    });

    const res = await get(`/api/v1/clubs/elections/${election.id}/results`, { limit: 5000 });
    expect(res.status).toBe(200);
    const ids = res.body.data.candidates.map(c => c.id);
    expect(ids).toHaveLength(100);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
    const dflt = await get(`/api/v1/clubs/elections/${election.id}/results`);
    expect(dflt.body.data.candidates).toHaveLength(100);
  }, 120_000);
});

describe('GET /marketplace/history (Equoria-cmw85.22)', () => {
  it('is capped, walkable by cursor and answers 400 for a bad cursor', async () => {
    const other = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `boundedsale-${RUN}@test.com`,
        username: `boundedsale${RUN}`,
        password: 'irrelevant-hash',
        firstName: 'Sale',
        lastName: 'Other',
      },
    });
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-SaleHistory-${RUN}`,
        sex: 'Mare',
        dateOfBirth: new Date('2018-01-01'),
        age: 5,
        userId: other.id,
      },
    });
    const sale = i => ({
      horseId: horse.id,
      sellerId: user.id,
      buyerId: other.id,
      salePrice: 100,
      horseName: `TestFixture-Sale-${i}`,
      soldAt: TIED,
    });
    await prisma.horseSale.createMany({ data: Array.from({ length: TOTAL }, (_, i) => sale(i)) });
    saleFixture = { horseId: horse.id, otherId: other.id };

    await expectCapAndWalk({
      path: '/api/v1/marketplace/history',
      query: {},
      rowsOf: body => body.data,
      pageInfoOf: body => body.pageInfo,
      insertLate: () => prisma.horseSale.create({ data: sale('late') }),
    });
  }, 120_000);
});

describe('GET /horses size cap (Equoria-cmw85.22)', () => {
  it('serves the whole stable by default but never more than 200 horses, however large ?limit is', async () => {
    await prisma.horse.createMany({
      data: Array.from({ length: 205 }, (_, i) => ({
        ...fixtureColor(),
        name: `TestFixture-StableCap-${i}-${RUN}`,
        sex: 'Mare',
        dateOfBirth: new Date('2018-01-01'),
        age: 5,
        userId: user.id,
        createdAt: TIED,
      })),
    });

    const huge = await get('/api/v1/horses', { limit: 100000 });
    expect(huge.status).toBe(200);
    expect(huge.body.data).toHaveLength(200);
    expect(huge.body.pageInfo.hasMore).toBe(true);
    const dflt = await get('/api/v1/horses');
    expect(dflt.body.data).toHaveLength(200);
  }, 120_000);
});
