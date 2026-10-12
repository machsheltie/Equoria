/**
 * Daily feed limit is server-authoritative — Equoria-mwjst (Codex scan
 * 2026-10-02, Finding 1, HIGH).
 *
 * The defect: `POST /api/v1/horses/:id/reset-last-fed` was mounted on the
 * normal authenticated horse router behind nothing but ownership and the
 * mutation rate limiter. It rewound `Horse.lastFedDate` — the exact timestamp
 * `feedHorse()` uses as its once-per-UTC-day authority — by a client-chosen
 * number of days. An owner could feed, rewind, and feed again on the same day
 * for as long as inventory lasted, re-rolling a PERMANENT stat boost each time
 * and, on an in-foal mare, inflating `pregnancyFeedingsByTier` (the foal's
 * epigenetic odds) without waiting out the care window. Ownership and rate
 * limiting only decided who and how fast; neither restored the invariant.
 *
 * The invariant this file locks:
 *   A horse is fed — one unit of inventory consumed, at most one stat roll,
 *   one pregnancy-counter increment — at most once per UTC day, and
 *   `lastFedDate` is written only by the feed claim itself. No HTTP request
 *   can move that timestamp backwards.
 *
 * Why these assertions detect the old defect: under the pre-fix router the
 * owner's rewind returned 200 and moved `lastFedDate` back a day, and the
 * second same-day feed returned 200, consumed a second unit of feed and
 * pushed the pregnancy counter to 2. Every rejection below asserts PERSISTED
 * state (lastFedDate, inventory, the twelve stat columns, the pregnancy
 * counter), not only a status code.
 *
 * Fixture history comes from the TEST DATABASE, never from a route: the last
 * case backdates `lastFedDate` with a direct Prisma write and proves the next
 * legitimate feed is accepted. That is the replacement for the deleted
 * `resetLastFed.integration.test.mjs`, which asserted the rewind route worked.
 *
 * Real app, real JWT, real CSRF, real database. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import horseRoutes from '../routes/horseRoutes.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const FIXTURE_PREFIX = 'TestFixture-mwjst-feed';
const ORIGIN = 'http://localhost:3000';
const STAT_COLUMNS = [
  'precision',
  'strength',
  'speed',
  'agility',
  'endurance',
  'intelligence',
  'stamina',
  'balance',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
];
const STARTING_UNITS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

let owner;
let token;
let csrf;
const tag = randomBytes(4).toString('hex');

function performanceInventory(quantity) {
  return [
    {
      id: 'feed-performance',
      itemId: 'performance',
      category: 'feed',
      name: 'Performance Feed',
      quantity,
    },
  ];
}

function post(path) {
  return request(app)
    .post(path)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ days: 1 });
}

async function readHorse(horseId) {
  return prisma.horse.findUnique({ where: { id: horseId } });
}

async function readPerformanceUnits() {
  const user = await prisma.user.findUnique({ where: { id: owner.id }, select: { settings: true } });
  const inventory = Array.isArray(user?.settings?.inventory) ? user.settings.inventory : [];
  return inventory.find(item => item.id === 'feed-performance')?.quantity ?? 0;
}

function statSum(horse) {
  return STAT_COLUMNS.reduce((sum, column) => sum + (horse[column] ?? 0), 0);
}

async function seedMare(name, extra = {}) {
  return createTestHorse({
    name: `${FIXTURE_PREFIX}-${name}-${tag}`,
    userId: owner.id,
    sex: 'Mare',
    age: 5,
    equippedFeedType: 'performance',
    ...extra,
  });
}

/** Walk an Express router the way the parent app sees it (sub-routers flattened). */
function collectRoutePaths(router) {
  const paths = [];
  for (const layer of router.stack) {
    if (layer.route) {
      paths.push(layer.route.path);
    } else if (layer.handle?.stack) {
      paths.push(...collectRoutePaths(layer.handle));
    }
  }
  return paths;
}

beforeAll(async () => {
  const created = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
  });
  owner = created.user;
  token = created.token;
  csrf = await fetchCsrf(app);
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

describe('daily feed limit is server-authoritative (Equoria-mwjst Finding 1)', () => {
  it('registers no reset-last-fed route anywhere on the horse router, in any environment', () => {
    // Structural, environment-independent proof: the handler is absent from
    // the router the production app mounts, not merely refused at runtime.
    const paths = collectRoutePaths(horseRoutes);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter(p => /reset-last|rewind/i.test(p))).toEqual([]);
  });

  it('answers the owner 404 for POST /:id/reset-last-fed and leaves lastFedDate untouched', async () => {
    const fedAt = new Date();
    const horse = await seedMare('rewind-target', { lastFedDate: fedAt });

    const res = await post(`/api/v1/horses/${horse.id}/reset-last-fed`);

    expect(res.status).toBe(404);
    const after = await readHorse(horse.id);
    expect(after.lastFedDate.getTime()).toBe(fedAt.getTime());
  });

  it('feed → attempted rewind → feed again: the second feed is refused and every effect happened exactly once', async () => {
    await prisma.user.update({
      where: { id: owner.id },
      data: { settings: { inventory: performanceInventory(STARTING_UNITS) } },
    });
    const mare = await seedMare('attack', {
      lastFedDate: null,
      inFoalSinceDate: new Date(),
      pregnancyFeedingsByTier: {},
    });
    const before = await readHorse(mare.id);

    const firstFeed = await post(`/api/v1/horses/${mare.id}/feed`);
    expect(firstFeed.status).toBe(200);
    const firstBoost = firstFeed.body.data?.statBoost ? 1 : 0;
    const afterFirst = await readHorse(mare.id);

    const rewind = await post(`/api/v1/horses/${mare.id}/reset-last-fed`);
    expect(rewind.status).toBe(404);

    const secondFeed = await post(`/api/v1/horses/${mare.id}/feed`);
    expect(secondFeed.status).toBe(400);
    expect(secondFeed.body.message).toMatch(/already fed today/i);

    const after = await readHorse(mare.id);
    expect(await readPerformanceUnits()).toBe(STARTING_UNITS - 1);
    expect(after.pregnancyFeedingsByTier).toEqual({ performance: 1 });
    expect(statSum(after)).toBe(statSum(before) + firstBoost);
    expect(after.lastFedDate.getTime()).toBe(afterFirst.lastFedDate.getTime());
  });

  it('two concurrent same-day feeds of one horse consume one unit and bump the pregnancy counter once', async () => {
    await prisma.user.update({
      where: { id: owner.id },
      data: { settings: { inventory: performanceInventory(STARTING_UNITS) } },
    });
    const mare = await seedMare('race', {
      lastFedDate: null,
      inFoalSinceDate: new Date(),
      pregnancyFeedingsByTier: {},
    });
    const before = await readHorse(mare.id);

    const responses = await Promise.all([
      post(`/api/v1/horses/${mare.id}/feed`),
      post(`/api/v1/horses/${mare.id}/feed`),
    ]);

    const statuses = responses.map(r => r.status).sort();
    expect(statuses.filter(s => s === 200)).toHaveLength(1);
    // The loser is refused, never silently double-applied: 400 when it loses
    // the horse claim, 409 if it loses the inventory compare-and-swap.
    expect(statuses.filter(s => s !== 200).every(s => s === 400 || s === 409)).toBe(true);

    const winner = responses.find(r => r.status === 200);
    const after = await readHorse(mare.id);
    expect(await readPerformanceUnits()).toBe(STARTING_UNITS - 1);
    expect(after.pregnancyFeedingsByTier).toEqual({ performance: 1 });
    expect(statSum(after)).toBe(statSum(before) + (winner.body.data?.statBoost ? 1 : 0));
  });

  it('a test fixture backdates lastFedDate in the database (no route) and the next legitimate feed is accepted', async () => {
    await prisma.user.update({
      where: { id: owner.id },
      data: { settings: { inventory: performanceInventory(STARTING_UNITS) } },
    });
    const mare = await seedMare('fixture', { lastFedDate: new Date() });

    const sameDay = await post(`/api/v1/horses/${mare.id}/feed`);
    expect(sameDay.status).toBe(400);
    expect(await readPerformanceUnits()).toBe(STARTING_UNITS);

    // Test-database fixture write — the only sanctioned way to give a horse
    // feeding history. Two full days back is before today's UTC midnight in
    // either time frame the feed guard can compare in (Equoria-7uphu: a
    // non-UTC database session shifts raw-SQL Date binds by its offset).
    const backdated = new Date(Date.now() - 2 * DAY_MS);
    await prisma.horse.update({
      where: { id: mare.id },
      data: { lastFedDate: backdated },
    });

    const nextDay = await post(`/api/v1/horses/${mare.id}/feed`);
    expect(nextDay.status).toBe(200);
    expect(await readPerformanceUnits()).toBe(STARTING_UNITS - 1);
    // The feed claim itself moved lastFedDate forward from the fixture value.
    const after = await readHorse(mare.id);
    expect(after.lastFedDate.getTime()).toBeGreaterThan(backdated.getTime());
  });
});
