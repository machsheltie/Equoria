/**
 * Equoria-bvddn.12 — retired grooms must not count toward MAX_GROOMS_PER_USER.
 *
 * THE DEFECT: all six roster-cap counts (groomMarketplaceController.mjs:297,
 * :365; groomFreeAgentController.mjs:178, :237; groomRosterController.mjs:246,
 * :341) run `prisma.groom.count({ where: { userId } })` with no `retired`
 * filter. Retirement (groomRetirementService.processRetirement) sets
 * `retired: true` but deliberately leaves `userId` pointing at the former
 * employer (schema.prisma: "Retirement deliberately does NOT clear it ... what
 * lets a player still read their retired grooms"). So a retired groom still
 * satisfies `{ userId }` and still counts against the cap forever. Once a
 * player has accumulated MAX_GROOMS_PER_USER (10) grooms total, retired or
 * not, every hire path refuses them even if every retired groom is doing
 * nothing and most of the roster is empty. Riders and trainers already guard
 * against this (riderMarketplaceController.mjs:255,
 * trainerMarketplaceController.mjs:256 both filter `retired: false`); grooms
 * did not.
 *
 * THE FIX: add `retired: false` to all six counts, matching the rider/trainer
 * idiom exactly.
 *
 * THIS SENTINEL asserts, over real HTTP with a real DB (no mocks): a user
 * sitting at 10 total grooms, 6 of them retired (4 active), can still hire —
 * through BOTH the marketplace hire path (groomMarketplaceController) and the
 * direct hire path (groomRosterController). Both are red on the current code
 * (both read the un-filtered count of 10 >= MAX, both refuse with the
 * "maximum limit" 400) and green once `retired: false` is added.
 *
 * Real DB, no mocks, fail-loud scoped cleanup (CLAUDE.md §3).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { SKILL_LEVELS } from '../../../utils/groomSystem.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-bvddn12-groom';
const MAX_GROOMS_PER_USER = 10;
const RETIRED_COUNT = 6;
const ACTIVE_COUNT = MAX_GROOMS_PER_USER - RETIRED_COUNT; // 4 — well under the cap
const SKILL_LEVEL = 'novice';
const DIRECT_HIRE_COST = Math.round(500 * SKILL_LEVELS[SKILL_LEVEL].costModifier);
// The marketplace offer's sessionRate is procedurally generated per-offer
// (groomMarketplace.mjs: base rate 15-60 by skill tier, up to +50% by
// experience within the tier -> worst case master/max-experience is 90,
// hiring cost 90*7=630). This suite is exercising the ROSTER-CAP guard, not
// the wallet, so the buyer gets a flat balance well above that ceiling —
// tying it to an assumed fixed sessionRate (as an earlier revision did)
// under-funded the buyer whenever the RNG rolled a pricier offer, producing
// an intermittent false-negative 400 (insufficient funds) unrelated to the
// cap fix under test.
const MARKETPLACE_BUYER_MONEY = 10000;

const tag = () => randomBytes(6).toString('hex');

async function makeUser(label, money) {
  const suffix = tag();
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${label}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${label}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Bvddn12',
      lastName: label,
      money,
      settings: {},
    },
  });
  return {
    id: user.id,
    token: generateTestToken({ id: user.id, email: user.email, role: 'user' }),
  };
}

// Seeds a roster of MAX_GROOMS_PER_USER grooms for `userId`: RETIRED_COUNT
// retired (userId still set, per the schema's documented "does not clear it"
// behavior) and ACTIVE_COUNT active. Bypasses the hire path entirely — this
// suite exercises the CAP COUNT, not a hire race.
async function seedFullRetiredHeavyRoster(userId) {
  const ids = [];
  for (let i = 0; i < RETIRED_COUNT; i++) {
    const g = await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-retired-${i}-${tag()}`,
        speciality: 'foal_care',
        personality: 'gentle',
        userId,
        retired: true,
        retirementReason: 'age',
        retirementTimestamp: new Date(),
        isActive: false,
      },
    });
    ids.push(g.id);
  }
  for (let i = 0; i < ACTIVE_COUNT; i++) {
    const g = await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-active-${i}-${tag()}`,
        speciality: 'foal_care',
        personality: 'gentle',
        userId,
      },
    });
    ids.push(g.id);
  }
  return ids;
}

function authed(req, token, csrf) {
  return req
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken);
}

describe('Equoria-bvddn.12 — retired grooms excluded from the roster cap', () => {
  let cleanup;

  beforeEach(() => {
    cleanup = createCleanupTracker();
  });

  afterEach(() => cleanup.run(), 60000);

  it('marketplace hire path: 10 total grooms (6 retired, 4 active) still allows a hire', async () => {
    const buyer = await makeUser('mkt', MARKETPLACE_BUYER_MONEY);
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: buyer.id } }), 'grooms');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: buyer.id } }), 'ledger rows');
    cleanup.add(() => prisma.staffMarketplaceState.deleteMany({ where: { userId: buyer.id } }), 'marketplace state');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: buyer.id } }), 'user');

    await seedFullRetiredHeavyRoster(buyer.id);
    expect(await prisma.groom.count({ where: { userId: buyer.id } })).toBe(MAX_GROOMS_PER_USER);
    expect(await prisma.groom.count({ where: { userId: buyer.id, retired: false } })).toBe(ACTIVE_COUNT);

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${buyer.token}`] });

    // Populate the procedural marketplace for this user, then hire the first offer.
    const marketRes = await authed(request(app).get('/api/v1/groom-marketplace'), buyer.token, csrf);
    expect(marketRes.status).toBe(200);
    const [offer] = marketRes.body.data.grooms;
    expect(offer).toBeDefined();

    const hireRes = await authed(request(app).post('/api/v1/groom-marketplace/hire'), buyer.token, csrf).send({
      marketplaceId: offer.marketplaceId,
    });

    // Red on current code: un-filtered count == 10 >= MAX -> 400 "maximum limit".
    // Green once the count excludes retired: active count 4 < MAX -> 201.
    expect(hireRes.status).toBe(201);
    expect(hireRes.body.success).toBe(true);

    expect(await prisma.groom.count({ where: { userId: buyer.id } })).toBe(MAX_GROOMS_PER_USER + 1);
  }, 30000);

  it('direct hire path (groomRosterController): 10 total grooms (6 retired, 4 active) still allows a hire', async () => {
    const buyer = await makeUser('direct', DIRECT_HIRE_COST * 2);
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: buyer.id } }), 'grooms');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: buyer.id } }), 'ledger rows');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: buyer.id } }), 'user');

    await seedFullRetiredHeavyRoster(buyer.id);
    expect(await prisma.groom.count({ where: { userId: buyer.id } })).toBe(MAX_GROOMS_PER_USER);
    expect(await prisma.groom.count({ where: { userId: buyer.id, retired: false } })).toBe(ACTIVE_COUNT);

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${buyer.token}`] });

    const hireRes = await authed(request(app).post('/api/v1/grooms/hire'), buyer.token, csrf).send({
      name: `${FIXTURE_PREFIX}-newhire-${tag()}`,
      speciality: 'foal_care',
      skill_level: SKILL_LEVEL,
      personality: 'gentle',
    });

    // Red on current code: un-filtered count == 10 >= MAX -> 400 "maximum limit".
    // Green once the count excludes retired: active count 4 < MAX -> 201.
    expect(hireRes.status).toBe(201);
    expect(hireRes.body.success).toBe(true);

    expect(await prisma.groom.count({ where: { userId: buyer.id } })).toBe(MAX_GROOMS_PER_USER + 1);
  }, 30000);
});
