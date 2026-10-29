/**
 * GET /api/v1/marketplace/search — the Marketplace all-horses search
 * (Equoria-q4uem.9.1).
 *
 * Owner ruling 2026-10-27 (q104): the search covers all horses; the player ticks
 * "for sale", "at stud" or both; filters are age, breed, gender, color, sale
 * price range, stud price range and Public/Private stud; sort is price high to
 * low or low to high; one horse can be both for sale and at stud; stallions are
 * at stud from age 3 (breeding ages 3-20); only revealed traits are shown.
 *
 * Real DB, real HTTP, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { studStatuses } from '../../../constants/schema.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const PREFIX = 'TestFixture-q4uem91-search';
const SECRET = 'q4uem91SearchSecretTrait';
const REVEALED = 'q4uem91SearchRevealedTrait';

function tag() {
  return randomBytes(6).toString('hex');
}

describe('marketplace all-horses search (Equoria-q4uem.9.1)', () => {
  const cleanup = createCleanupTracker();
  const userIds = [];
  const horseIds = [];
  const breedIds = [];
  let breed;
  let otherBreed;
  let viewer;
  let seller;
  let run;

  async function player(role) {
    const suffix = tag();
    const user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${PREFIX}-${role}-${suffix}`,
        email: `${PREFIX}-${role}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Search',
        lastName: role,
        money: 1000,
      },
    });
    userIds.push(user.id);
    return { user, token: generateTestToken({ id: user.id, email: user.email, role: 'user' }) };
  }

  async function horse({ ownerId = seller.user.id, label, ageYears = 5, ...overrides }) {
    const h = await prisma.horse.create({
      data: await testHorseData(prisma, {
        name: `${PREFIX}-${run}-${label}`,
        sex: 'Stallion',
        dateOfBirth: birthDateForAge(ageYears),
        age: ageYears,
        breedId: breed.id,
        userId: ownerId,
        healthStatus: 'Good',
        lastFedDate: new Date(),
        phenotype: { colorName: 'Standard Bay' },
        ...overrides,
      }),
    });
    horseIds.push(h.id);
    return h;
  }

  const forSale = (salePrice, extra = {}) => ({ forSale: true, salePrice, ...extra });
  const atStud = (studFee, studStatus = studStatuses.public) => ({ studStatus, studFee });

  function search(query = '', token = viewer.token) {
    return request(app)
      .get(`/api/v1/marketplace/search?name=${run}&limit=100${query}`)
      .set('Authorization', `Bearer ${token}`);
  }

  /** Like search, but the caller sets limit and page itself (a repeated limit is a 400). */
  const pagedSearch = (query, token = viewer.token) =>
    request(app)
      .get(`/api/v1/marketplace/search?name=${run}&forSale=true&${query}`)
      .set('Authorization', `Bearer ${token}`);

  const labels = res => res.body.data.horses.map(h => h.name.replace(`${PREFIX}-${run}-`, ''));

  beforeEach(async () => {
    userIds.length = 0;
    horseIds.length = 0;
    breedIds.length = 0;
    run = tag();
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
    cleanup.add(() => prisma.breed.deleteMany({ where: { id: { in: breedIds } } }), 'breeds');
    breed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'Shared test breed' },
    });
    otherBreed = await prisma.breed.create({
      data: { name: `${PREFIX}-breed-${run}`, description: 'search fixture breed' },
    });
    breedIds.push(otherBreed.id);
    viewer = await player('viewer');
    seller = await player('seller');
  });

  afterEach(async () => {
    await cleanup.run();
  });

  it('forSale ticked lists horses for sale, never studs that are not for sale', async () => {
    await horse({ label: 'sale', ...forSale(500) });
    await horse({ label: 'stud', ...atStud(300) });
    await horse({ label: 'plain' });

    const res = await search('&forSale=true');

    expect(res.status).toBe(200);
    expect(labels(res)).toEqual(['sale']);
  });

  it('atStud ticked lists stallions at stud, public and private, never plain horses', async () => {
    await horse({ label: 'sale', ...forSale(500) });
    await horse({ label: 'pub', ...atStud(300) });
    await horse({ label: 'priv', ...atStud(400, studStatuses.private) });

    const res = await search('&atStud=true');

    expect(labels(res).sort()).toEqual(['priv', 'pub']);
  });

  it('both ticked lists the union once, and a horse both for sale and at stud shows both terms', async () => {
    await horse({ label: 'both', ...forSale(900), ...atStud(250) });
    await horse({ label: 'sale', ...forSale(500) });
    await horse({ label: 'stud', ...atStud(300) });
    await horse({ label: 'plain' });

    const res = await search('&forSale=true&atStud=true');

    expect(labels(res).sort()).toEqual(['both', 'sale', 'stud']);
    const both = res.body.data.horses.find(h => h.name.endsWith('-both'));
    expect(both.sale).toEqual({ price: 900 });
    expect(both.stud).toEqual({ mode: 'public', fee: 250 });
    const sale = res.body.data.horses.find(h => h.name.endsWith('-sale'));
    expect(sale.stud).toBeNull();
    const stud = res.body.data.horses.find(h => h.name.endsWith('-stud'));
    expect(stud.sale).toBeNull();
  });

  it('neither ticked is a 400 with a plain sentence', async () => {
    const res = await search('');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("never lists the viewer's own horses", async () => {
    await horse({ label: 'mine', ownerId: viewer.user.id, ...forSale(500) });
    await horse({ label: 'theirs', ...forSale(500) });

    const res = await search('&forSale=true');

    expect(labels(res)).toEqual(['theirs']);
  });

  it('stallions are at stud from 3 to 20: a 2-year-old colt and a 21-year-old are never offered at stud', async () => {
    await horse({ label: 'age3', ageYears: 3, ...atStud(100) });
    await horse({ label: 'age20', ageYears: 20, ...atStud(100) });
    await horse({ label: 'colt2', ageYears: 2, sex: 'Colt', ...atStud(100) });
    await horse({ label: 'old21', ageYears: 21, ...atStud(100) });

    const res = await search('&atStud=true');

    expect(labels(res).sort()).toEqual(['age20', 'age3']);
  });

  it('a mare at "stud" is never offered at stud', async () => {
    await horse({ label: 'mare', sex: 'Mare', ...atStud(100) });

    const res = await search('&atStud=true');

    expect(labels(res)).toEqual([]);
  });

  it('filters by Public or Private stud', async () => {
    await horse({ label: 'pub', ...atStud(300) });
    await horse({ label: 'priv', ...atStud(400, studStatuses.private) });

    expect(labels(await search('&atStud=true&studMode=public'))).toEqual(['pub']);
    expect(labels(await search('&atStud=true&studMode=private'))).toEqual(['priv']);
  });

  it('filters by sale price range and by stud price range, each on its own side', async () => {
    await horse({ label: 's100', ...forSale(100) });
    await horse({ label: 's500', ...forSale(500) });
    await horse({ label: 's900', ...forSale(900) });
    await horse({ label: 'f50', ...atStud(50) });
    await horse({ label: 'f800', ...atStud(800) });

    expect(labels(await search('&forSale=true&minPrice=200&maxPrice=600'))).toEqual(['s500']);
    expect(labels(await search('&atStud=true&minStudFee=100'))).toEqual(['f800']);
    // Both ticked: two searches merged. Each range narrows only its own side.
    const both = await search('&forSale=true&atStud=true&maxPrice=200&minStudFee=100');
    expect(labels(both).sort()).toEqual(['f800', 's100']);
  });

  it('filters by age, breed, gender and color', async () => {
    await horse({ label: 'a4', ageYears: 4, ...forSale(500) });
    await horse({ label: 'a10', ageYears: 10, ...forSale(500) });
    await horse({
      label: 'other',
      ageYears: 4,
      breedId: otherBreed.id,
      sex: 'Mare',
      phenotype: { colorName: 'Steel Grey' },
      ...forSale(500),
    });
    await horse({ label: 'filly', ageYears: 1, sex: 'Filly', ...forSale(500) });

    expect(labels(await search('&forSale=true&minAge=8')).sort()).toEqual(['a10']);
    expect(labels(await search('&forSale=true&maxAge=4&minAge=3')).sort()).toEqual(['a4', 'other']);
    expect(labels(await search(`&forSale=true&breedId=${otherBreed.id}`))).toEqual(['other']);
    expect(labels(await search('&forSale=true&sex=Mare')).sort()).toEqual(['filly', 'other']);
    // Equoria-merxy (owner ruling 2026-10-28, q190): color is a dropdown of every coat
    // color, so it matches one color exactly (any case), never part of a name.
    // Equoria-7woyj: the owner's names (q311 grey; Bay is Standard Bay...).
    expect(labels(await search('&forSale=true&color=steel%20grey'))).toEqual(['other']);
    expect(labels(await search('&forSale=true&color=Dapple%20Grey'))).toEqual([]);
    expect(labels(await search('&forSale=true&color=Standard%20Bay')).sort()).toEqual(['a10', 'a4', 'filly']);
  });

  it('refuses a color that is not a coat color in the game (Equoria-merxy)', async () => {
    const res = await search('&forSale=true&color=grey');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('That color is not a coat color in the game');
  });

  it('GET /marketplace/colors lists every coat color for the dropdown (Equoria-merxy)', async () => {
    const res = await request(app).get('/api/v1/marketplace/colors').set('Authorization', `Bearer ${viewer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const colors = res.body.data;
    expect(colors).toEqual(
      expect.arrayContaining(['Standard Bay', 'Standard Chestnut', 'Steel Grey', 'Cremello', 'Brindle']),
    );
    expect(colors).not.toContain('Unknown');
    expect(colors).not.toContain('Bay');
    expect(colors.some(c => /gray|colour/i.test(c))).toBe(false);
    expect([...colors].sort((a, b) => a.localeCompare(b, 'en'))).toEqual(colors);
    expect((await request(app).get('/api/v1/marketplace/colors')).status).toBe(401);
  });

  it('sorts by price both ways; both ticked puts horses for sale first, then studs, by their own price', async () => {
    await horse({ label: 's100', ...forSale(100) });
    await horse({ label: 's900', ...forSale(900) });
    await horse({ label: 'f50', ...atStud(50) });
    await horse({ label: 'f800', ...atStud(800) });

    expect(labels(await search('&forSale=true&sort=priceAsc'))).toEqual(['s100', 's900']);
    expect(labels(await search('&forSale=true&sort=priceDesc'))).toEqual(['s900', 's100']);
    expect(labels(await search('&atStud=true&sort=priceAsc'))).toEqual(['f50', 'f800']);
    expect(labels(await search('&atStud=true&sort=priceDesc'))).toEqual(['f800', 'f50']);
    expect(labels(await search('&forSale=true&atStud=true&sort=priceAsc'))).toEqual(['s100', 's900', 'f50', 'f800']);
    expect(labels(await search('&forSale=true&atStud=true&sort=priceDesc'))).toEqual(['s900', 's100', 'f800', 'f50']);
  });

  it('pages by keyset cursor without repeating or skipping a horse', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await horse({ label: `p${i}`, ...forSale(i * 100) });
    }
    const first = await request(app)
      .get(`/api/v1/marketplace/search?name=${run}&forSale=true&sort=priceAsc&limit=2`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(labels(first)).toEqual(['p1', 'p2']);
    expect(first.body.data.pageInfo.hasMore).toBe(true);

    const second = await request(app)
      .get(
        `/api/v1/marketplace/search?name=${run}&forSale=true&sort=priceAsc&limit=2&cursor=${encodeURIComponent(first.body.data.pageInfo.nextCursor)}`,
      )
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(labels(second)).toEqual(['p3', 'p4']);
    const third = await request(app)
      .get(
        `/api/v1/marketplace/search?name=${run}&forSale=true&sort=priceAsc&limit=2&cursor=${encodeURIComponent(second.body.data.pageInfo.nextCursor)}`,
      )
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(labels(third)).toEqual(['p5']);
    expect(third.body.data.pageInfo.hasMore).toBe(false);
  });

  it('shows revealed traits only, never hidden ones, and no owner id or money', async () => {
    await horse({
      label: 'traits',
      ...forSale(500),
      epigeneticModifiers: { positive: [REVEALED], negative: [], hidden: [SECRET] },
    });

    const res = await search('&forSale=true');
    const row = res.body.data.horses[0];

    expect(row.revealedTraits).toEqual({ positive: [REVEALED], negative: [] });
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    expect(row.owner).toEqual({ username: expect.stringContaining(`${PREFIX}-seller`) });
    expect(row.color).toBe('Standard Bay');
    expect(row).not.toHaveProperty('userId');
  });

  it.each([
    ['studMode=bogus'],
    ['sort=bogus'],
    ['minAge=abc'],
    ['minPrice=-1'],
    ['minStudFee=99999999999'],
    ['forSale=maybe'],
    ['color[]=a&color[]=b'],
    ['cursor=not-a-cursor'],
  ])('refuses %s with a 400', async query => {
    const res = await search(`&forSale=true&${query}`);
    expect(res.status).toBe(400);
  });

  it('caps a huge limit and still numbers the pages with a total (carried over from the removed browse routes)', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await horse({ label: `n${i}`, ...forSale(100) });
    }
    const capped = await pagedSearch('limit=5000');
    expect(capped.status).toBe(200);
    expect(capped.body.data.horses.length).toBeLessThanOrEqual(100);

    const first = await pagedSearch('limit=2');
    const second = await pagedSearch('limit=2&page=2');
    expect(first.body.data.pagination).toMatchObject({ total: 5, totalPages: 3 });
    expect(second.body.data.pagination.page).toBe(2);
    expect(labels(second)).not.toEqual(labels(first));
  });

  it('walks tied prices page by page, each horse exactly once, ties in id order', async () => {
    const created = [];
    for (let i = 1; i <= 5; i += 1) {
      created.push(await horse({ label: `t${i}`, ...forSale(500) }));
    }
    const seen = [];
    for (let page = 1; page <= 3; page += 1) {
      const res = await pagedSearch(`sort=priceAsc&limit=2&page=${page}`);
      expect(res.status).toBe(200);
      seen.push(...res.body.data.horses.map(h => h.id));
    }
    expect(seen).toEqual(created.map(h => h.id).sort((a, b) => a - b));
  });
});
