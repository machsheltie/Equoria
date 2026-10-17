/**
 * Sale browse (GET /api/v1/marketplace) query hardening — Equoria-dnpe4.
 *
 * The same three defects the stud search had (Equoria-q4uem.9 slice 5):
 *   - ordering had no tiebreaker, so skip/take over tied rows could repeat or
 *     drop listings between pages: every sort now ends on id asc;
 *   - sort/filter tables were looked up with inherited keys (`__proto__`,
 *     `constructor`);
 *   - out-of-range ints (beyond int4), age bounds that make birthDateForAge an
 *     invalid date, non-numeric age/price bounds and repeated params (arrays)
 *     reached Prisma and returned 500: each is now a 400 with the standard body.
 *
 * Inputs the page sends keep working as before: a non-numeric breedId is still
 * ignored (pinned in browseListingsFilters), and a decimal or negative
 * number-input value still parses with parseInt.
 *
 * Real DB, real HTTP. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

const PREFIX = 'TestFixture-dnpe4-salebrowse';

function tag() {
  return randomBytes(6).toString('hex');
}

describe('sale browse query hardening (Equoria-dnpe4)', () => {
  const cleanup = createCleanupTracker();
  const userIds = [];
  const horseIds = [];
  let viewerToken;
  let seller;
  let run;

  async function player(role) {
    const suffix = tag();
    const user = await prisma.user.create({
      data: {
        username: `${PREFIX}-${role}-${suffix}`,
        email: `${PREFIX}-${role}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Sale',
        lastName: role,
      },
    });
    userIds.push(user.id);
    return user;
  }

  async function listing(overrides = {}) {
    const h = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${PREFIX}-${run}-${tag()}`,
        sex: 'Mare',
        dateOfBirth: gameCalendarDate(new Date(), -5 * 365),
        age: 5,
        userId: seller.id,
        forSale: true,
        salePrice: 500,
        ...overrides,
      },
    });
    horseIds.push(h.id);
    return h;
  }

  function browse(query) {
    return request(app).get(`/api/v1/marketplace?name=${run}${query}`).set('Authorization', `Bearer ${viewerToken}`);
  }

  beforeEach(async () => {
    userIds.length = 0;
    horseIds.length = 0;
    run = tag();
    const viewer = await player('viewer');
    viewerToken = generateTestToken({ id: viewer.id, email: viewer.email, role: 'user' });
    seller = await player('seller');
    const ids = horseIds;
    const users = userIds;
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: users } } }), 'users');
  });

  afterEach(async () => {
    await cleanup.run();
  });

  it.each(['newest', 'price_asc', 'price_desc', 'youngest'])(
    'pagination (%s): with tied prices and ages, walking every page yields each listing exactly once, ties in id order',
    async sort => {
      const created = [];
      for (let i = 0; i < 5; i += 1) {
        created.push(await listing());
      }
      // Rewrite the first two rows so their tuples move behind the others on
      // disk: without a tiebreaker, tied rows come back in physical order.
      for (const h of created.slice(0, 2)) {
        await prisma.horse.update({ where: { id: h.id }, data: { salePrice: 500 } });
      }

      const seen = [];
      for (let page = 1; page <= 3; page += 1) {
        const res = await browse(`&limit=2&page=${page}&sort=${sort}`);
        expect(res.status).toBe(200);
        seen.push(...res.body.data.listings.map(l => l.id));
      }

      const ids = created.map(h => h.id).sort((a, b) => a - b);
      if (sort === 'newest') {
        // createdAt differs per row; only the walk's completeness is pinned.
        expect([...seen].sort((a, b) => a - b)).toEqual(ids);
      } else {
        expect(seen).toEqual(ids);
      }
    },
  );

  it.each([
    ['sort=__proto__'],
    ['sort=constructor'],
    ['sort=toString'],
    ['breedId=99999999999'],
    ['minPrice=99999999999'],
    ['maxPrice=-99999999999'],
    ['minPrice=abc'],
    ['minAge=99999999'],
    ['maxAge=abc'],
    ['page=99999999999'],
    ['name=a&name=b'],
    ['breed=a&breed=b'],
    ['sort=newest&sort=youngest'],
    ['minPrice=1&minPrice=2'],
  ])('rejects %s with 400 and the standard body', async query => {
    const res = await request(app).get(`/api/v1/marketplace?${query}`).set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.message).toBe('string');
  });

  it('still accepts what the page sends: decimal and negative number inputs parse as before', async () => {
    const cheap = await listing({ salePrice: 100 });
    await listing({ salePrice: 900 });

    const res = await browse('&minPrice=-5&maxPrice=150.7&minAge=4.5&sort=price_asc');

    expect(res.status).toBe(200);
    expect(res.body.data.listings.map(l => l.id)).toEqual([cheap.id]);
  });
});
