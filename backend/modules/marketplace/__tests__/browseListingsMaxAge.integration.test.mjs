/**
 * maxAge filter boundaries on the sale browse and the stud search
 * (Equoria-k724f).
 *
 * A game-year is 7 Eastern calendar days and age is floor(days / 7), so a horse
 * aged 3 game-years is 21 to 27 days old. The filter used to keep only horses
 * born on or after birthDateForAge(maxAge), which is a horse exactly 21 days
 * old: a horse that turned maxAge a day or more ago (22-27 days old) was
 * wrongly excluded although he still reads maxAge. minAge was already correct.
 *
 * Real DB, real HTTP, scoped fail-loud fixtures. Each assertion is narrowed to
 * the rows this run created through a per-run name prefix.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';

const run = randomBytes(4).toString('hex');
const PREFIX = `TestFixture-k724f-${run}`;

// Days old -> game-years: 20 = 2, 21 = 3 (birthday), 27 = 3 (last day), 28 = 4.
const fixtureDaysOld = [20, 21, 27, 28];

function get(token, path) {
  return request(app).get(path).set('Authorization', `Bearer ${token}`);
}

describe('maxAge filter boundaries (Equoria-k724f)', () => {
  const cleanup = createCleanupTracker();
  const horseIds = [];
  let viewer;
  let owner;
  let viewerToken;
  let breed;

  async function user(tagName) {
    const suffix = randomBytes(4).toString('hex');
    return prisma.user.create({
      data: {
        username: `${PREFIX}-${tagName}-${suffix}`,
        email: `${PREFIX}-${tagName}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Age',
        lastName: tagName,
        money: 1000,
      },
    });
  }

  async function horse(sex, days, extra) {
    const created = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${PREFIX}-${sex}-${days}d`,
        sex,
        dateOfBirth: gameCalendarDate(new Date(), -days),
        age: Math.floor(days / 7),
        breedId: breed.id,
        userId: owner.id,
        ...extra,
      },
    });
    horseIds.push(created.id);
    return created;
  }

  beforeAll(async () => {
    breed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'Shared test breed' },
    });
    viewer = await user('viewer');
    owner = await user('owner');
    viewerToken = generateTestToken({ id: viewer.id, email: viewer.email, role: 'user' });
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [viewer.id, owner.id] } } }), 'users');

    for (const days of fixtureDaysOld) {
      await horse('Mare', days, { forSale: true, salePrice: 500 });
      await horse('Stallion', days, { studStatus: 'At Public Stud', studFee: 100 });
    }
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  const names = rows =>
    rows
      .filter(row => row.name.startsWith(PREFIX))
      .map(row => row.name.replace(`${PREFIX}-`, ''))
      .sort();

  it('fixtures read the game-years the comments claim', () => {
    const ages = fixtureDaysOld.map(days => getHorseAgeYears(gameCalendarDate(new Date(), -days)));
    expect(ages).toEqual([2, 3, 3, 4]);
  });

  describe('sale browse', () => {
    const browse = qs => get(viewerToken, `/api/v1/marketplace?name=${PREFIX}&limit=100&${qs}`);

    it('maxAge=3 keeps every horse aged 3, from its birthday to its last day, and drops age 4', async () => {
      const res = await browse('maxAge=3');
      expect(res.status).toBe(200);
      expect(names(res.body.data.listings)).toEqual(['Mare-20d', 'Mare-21d', 'Mare-27d']);
    });

    it('maxAge=2 keeps the 20-day horse and drops everyone aged 3', async () => {
      const res = await browse('maxAge=2');
      expect(res.status).toBe(200);
      expect(names(res.body.data.listings)).toEqual(['Mare-20d']);
    });

    it('minAge=3&maxAge=3 is exactly the horses aged 3', async () => {
      const res = await browse('minAge=3&maxAge=3');
      expect(res.status).toBe(200);
      expect(names(res.body.data.listings)).toEqual(['Mare-21d', 'Mare-27d']);
    });
  });

  describe('stud search', () => {
    const search = qs => get(viewerToken, `/api/v1/marketplace/studs?name=${PREFIX}&limit=100&${qs}`);

    it('maxAge=3 keeps every stallion aged 3, from his birthday to his last day, and drops age 4', async () => {
      const res = await search('maxAge=3');
      expect(res.status).toBe(200);
      expect(names(res.body.data.studs)).toEqual(['Stallion-21d', 'Stallion-27d']);
    });

    it('minAge=3&maxAge=3 is exactly the stallions aged 3', async () => {
      const res = await search('minAge=3&maxAge=3');
      expect(res.status).toBe(200);
      expect(names(res.body.data.studs)).toEqual(['Stallion-21d', 'Stallion-27d']);
    });

    it('maxAge=4 adds the stallion aged 4', async () => {
      const res = await search('maxAge=4');
      expect(res.status).toBe(200);
      expect(names(res.body.data.studs)).toEqual(['Stallion-21d', 'Stallion-27d', 'Stallion-28d']);
    });
  });
});
