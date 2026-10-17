/**
 * GET /api/v1/marketplace/studs — stud listings in the Marketplace horse
 * search data (Equoria-q4uem.9 slice 5).
 *
 * Owner rulings (Stacey): 2026-10-15 — the stallion owner chooses Public or
 * Private Stud and sets the fee; players browse studs inside the MARKETPLACE
 * horse search. 2026-10-16 S-Q9 — revealed traits are public, unrevealed
 * hidden traits stay hidden. Design §0 default — other players' competition
 * records are not shown (until the owner rules).
 *
 * Also characterizes the existing sale listing (GET /api/v1/marketplace) so
 * its shape is pinned unchanged.
 *
 * Real DB, real HTTP, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const PREFIX = 'TestFixture-q4uem9-studsearch';
const SECRET = 'q4uem9StudSearchSecret';
const REVEALED = 'q4uem9StudSearchRevealed';
const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;

const STUD_KEYS = [
  'age',
  'alsoForSale',
  'breed',
  'displayedHealth',
  'id',
  'imageUrl',
  'name',
  'owner',
  'salePrice',
  'sex',
  'stats',
  'studFee',
  'studMode',
  'traits',
];
const STAT_KEYS = ['agility', 'boldness', 'intelligence', 'precision', 'speed', 'stamina', 'strength'];

function tag() {
  return randomBytes(6).toString('hex');
}

function get(token, path) {
  return request(app).get(path).set('Authorization', `Bearer ${token}`);
}

describe('marketplace stud listings (Equoria-q4uem.9 slice 5)', () => {
  const cleanup = createCleanupTracker();
  const userIds = [];
  const horseIds = [];
  let breed;
  let viewer;
  let studOwner;
  let run;

  async function player(role) {
    const suffix = tag();
    const user = await prisma.user.create({
      data: {
        username: `${PREFIX}-${role}-${suffix}`,
        email: `${PREFIX}-${role}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Stud',
        lastName: role,
        money: 1000,
      },
    });
    userIds.push(user.id);
    return { user, token: generateTestToken({ id: user.id, email: user.email, role: 'user' }) };
  }

  async function horse({ ownerId, sex = 'Stallion', ...overrides }) {
    const h = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${PREFIX}-${run}-${tag()}`,
        sex,
        dateOfBirth: new Date(Date.now() - FIVE_YEARS_MS),
        age: 5,
        breedId: breed.id,
        userId: ownerId,
        healthStatus: 'Good',
        lastFedDate: new Date(),
        speed: 40,
        ...overrides,
      },
    });
    horseIds.push(h.id);
    return h;
  }

  /** Only this test's rows: the name filter scopes the search to its run tag. */
  function studs(query = '') {
    return get(viewer.token, `/api/v1/marketplace/studs?name=${run}&limit=100${query}`);
  }

  beforeEach(async () => {
    userIds.length = 0;
    horseIds.length = 0;
    run = tag();
    breed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'Shared test breed' },
    });
    viewer = await player('viewer');
    studOwner = await player('studOwner');
    const ids = horseIds;
    const users = userIds;
    cleanup.add(() => prisma.competitionResult.deleteMany({ where: { horseId: { in: ids } } }), 'results');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: users } } }), 'users');
  });

  afterEach(async () => {
    await cleanup.run();
  });

  it('characterization: the sale listing keeps its exact shape (GET /api/v1/marketplace)', async () => {
    await horse({ ownerId: studOwner.user.id, forSale: true, salePrice: 777 });

    const res = await get(viewer.token, `/api/v1/marketplace?name=${run}`);

    expect(res.status).toBe(200);
    expect(res.body.data.listings).toHaveLength(1);
    const listing = res.body.data.listings[0];
    expect(Object.keys(listing).sort()).toEqual(
      ['age', 'breed', 'id', 'imageUrl', 'name', 'salePrice', 'seller', 'sex', 'stats'].sort(),
    );
    expect(Object.keys(listing.stats).sort()).toEqual(STAT_KEYS);
    expect(Object.keys(res.body.data.pagination).sort()).toEqual(['limit', 'page', 'total', 'totalPages']);
  });

  it('lists public AND private stud stallions with mode and fee; excludes unlisted, own, ownerless and non-stallions', async () => {
    const pub = await horse({ ownerId: studOwner.user.id, studStatus: 'At Public Stud', studFee: 300 });
    const priv = await horse({ ownerId: studOwner.user.id, studStatus: 'At Private Stud', studFee: 900 });
    const legacy = await horse({ ownerId: studOwner.user.id, studStatus: 'At Public Stud', studFee: null });
    await horse({ ownerId: studOwner.user.id, studStatus: 'Not at Stud', studFee: 0 });
    await horse({ ownerId: viewer.user.id, studStatus: 'At Public Stud', studFee: 5 });
    await horse({ ownerId: null, studStatus: 'At Public Stud', studFee: 5 });
    await horse({ ownerId: studOwner.user.id, sex: 'Mare', studStatus: 'At Public Stud', studFee: 5 });

    const res = await studs();

    expect(res.status).toBe(200);
    const byId = new Map(res.body.data.studs.map(s => [s.id, s]));
    expect([...byId.keys()].sort()).toEqual([pub.id, priv.id, legacy.id].sort());
    expect(byId.get(pub.id)).toMatchObject({ studMode: 'public', studFee: 300 });
    expect(byId.get(priv.id)).toMatchObject({ studMode: 'private', studFee: 900 });
    expect(byId.get(legacy.id)).toMatchObject({ studMode: 'public', studFee: 0 });
    expect(byId.get(pub.id).owner).toEqual({ username: studOwner.user.username });
  });

  it('each entry carries exactly the listing fields: the sale-listing stat set, no money, ownership or competition internals', async () => {
    const pub = await horse({
      ownerId: studOwner.user.id,
      studStatus: 'At Public Stud',
      studFee: 300,
      forSale: true,
      salePrice: 4000,
      disciplineScores: { Racing: 88 },
    });

    const res = await studs();

    expect(res.status).toBe(200);
    const entry = res.body.data.studs.find(s => s.id === pub.id);
    expect(Object.keys(entry).sort()).toEqual(STUD_KEYS);
    expect(Object.keys(entry.stats).sort()).toEqual(STAT_KEYS);
    expect(entry).toMatchObject({ alsoForSale: true, salePrice: 4000, sex: 'Stallion', breed: 'Thoroughbred' });
    expect(JSON.stringify(entry)).not.toContain('Racing');
  });

  it('S-Q9: revealed traits are shown; an unrevealed hidden trait never is', async () => {
    const pub = await horse({
      ownerId: studOwner.user.id,
      studStatus: 'At Public Stud',
      studFee: 300,
      epigeneticModifiers: { positive: [REVEALED], negative: [], hidden: [SECRET] },
    });

    const res = await studs();

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    const entry = res.body.data.studs.find(s => s.id === pub.id);
    expect(entry.traits).toEqual({ positive: [REVEALED], negative: [], hidden: [] });
  });

  it('filters: mode, fee range, breedId and sort by fee; pagination totals', async () => {
    const cheap = await horse({ ownerId: studOwner.user.id, studStatus: 'At Public Stud', studFee: 100 });
    const mid = await horse({ ownerId: studOwner.user.id, studStatus: 'At Private Stud', studFee: 500 });
    const dear = await horse({ ownerId: studOwner.user.id, studStatus: 'At Public Stud', studFee: 2000 });

    const privateOnly = await studs('&mode=private');
    const feeRange = await studs('&minFee=200&maxFee=1000');
    const sorted = await studs('&sort=fee_desc');
    const otherBreed = await studs('&breedId=2147483000');
    const paged = await get(viewer.token, `/api/v1/marketplace/studs?name=${run}&limit=1&sort=fee_asc`);
    const badMode = await studs('&mode=secret');

    expect(privateOnly.body.data.studs.map(s => s.id)).toEqual([mid.id]);
    expect(feeRange.body.data.studs.map(s => s.id)).toEqual([mid.id]);
    expect(sorted.body.data.studs.map(s => s.id)).toEqual([dear.id, mid.id, cheap.id]);
    expect(otherBreed.body.data.studs).toEqual([]);
    expect(paged.body.data.studs.map(s => s.id)).toEqual([cheap.id]);
    expect(paged.body.data.pagination).toEqual({ page: 1, limit: 1, total: 3, totalPages: 3 });
    expect(badMode.status).toBe(400);
  });
});
