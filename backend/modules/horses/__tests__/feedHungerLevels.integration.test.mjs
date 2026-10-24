/**
 * Hunger is a five-level fill bar (owner ruling 2026-10-23, Equoria-qwz60).
 * Real app, real JWT, real CSRF, real database, no mocks.
 *
 *   - One feeding raises hunger ONE level (Bad -> Fair -> Good -> Very Good ->
 *     Excellent). Below Excellent the horse is fed again and again.
 *   - At Excellent, feeding is once per Eastern game day.
 *   - Every feeding still consumes one unit of feed.
 *   - Hunger Fair lowers displayed health one level, hunger Bad two (floor Bad).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { getFeedHealth, getDisplayedHealth } from '../../../utils/horseHealth.mjs';

const fixturePrefix = 'TestFixture-qwz60-hunger';
const origin = 'http://localhost:3000';
const dayMs = 24 * 60 * 60 * 1000;
const startingUnits = 10;
const tag = randomBytes(4).toString('hex');

let owner;
let token;
let csrf;

const performanceInventory = quantity => [
  { id: 'feed-performance', itemId: 'performance', category: 'feed', name: 'Performance Feed', quantity },
];

const feed = horseId =>
  request(app)
    .post(`/api/v1/horses/${horseId}/feed`)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', origin)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({});

const readHorse = id => prisma.horse.findUnique({ where: { id } });

async function readUnits() {
  const user = await prisma.user.findUnique({ where: { id: owner.id }, select: { settings: true } });
  const inventory = Array.isArray(user?.settings?.inventory) ? user.settings.inventory : [];
  return inventory.find(item => item.id === 'feed-performance')?.quantity ?? 0;
}

async function seedHorse(name, extra = {}) {
  await prisma.user.update({
    where: { id: owner.id },
    data: { settings: { inventory: performanceInventory(startingUnits) } },
  });
  return createTestHorse({
    name: `${fixturePrefix}-${name}-${tag}`,
    userId: owner.id,
    age: 5,
    equippedFeedType: 'performance',
    lastVettedDate: gameCalendarDate(),
    ...extra,
  });
}

beforeAll(async () => {
  const created = await createTestUser({
    username: `${fixturePrefix}-${tag}`,
    email: `${fixturePrefix}-${tag}@example.com`,
  });
  owner = created.user;
  token = created.token;
  csrf = await fetchCsrf(app);
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

describe('hunger is a fill bar (Equoria-qwz60)', () => {
  it('raises a Bad horse one level per feeding up to Excellent, then refuses a second feeding the same day', async () => {
    const horse = await seedHorse('walk', { lastFedDate: new Date(Date.now() - 20 * dayMs) });
    expect(getFeedHealth(await readHorse(horse.id))).toBe('Bad');

    const levels = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await feed(horse.id);
      expect(res.status).toBe(200);
      // The response carries the new level so the page can show it at once.
      levels.push(res.body.data.horse.feedHealth);
      expect(getFeedHealth(await readHorse(horse.id))).toBe(res.body.data.horse.feedHealth);
    }
    expect(levels).toEqual(['Fair', 'Good', 'Very Good', 'Excellent']);
    expect(await readUnits()).toBe(startingUnits - 4);

    const again = await feed(horse.id);
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already fed today/i);
    expect(await readUnits()).toBe(startingUnits - 4);
  });

  it('feeds a never-fed horse up from Bad to Fair on the first feeding', async () => {
    const horse = await seedHorse('never', { lastFedDate: null });
    const res = await feed(horse.id);
    expect(res.status).toBe(200);
    expect(res.body.data.horse.feedHealth).toBe('Fair');
  });

  it('feeds an Excellent horse again on a later game day', async () => {
    const horse = await seedHorse('daily', { lastFedDate: new Date(Date.now() - 1 * dayMs) });
    expect(getFeedHealth(await readHorse(horse.id))).toBe('Excellent');
    const res = await feed(horse.id);
    expect(res.status).toBe(200);
    expect(getFeedHealth(await readHorse(horse.id))).toBe('Excellent');
    expect((await feed(horse.id)).status).toBe(400);
  });

  it('lowers displayed health one level for Fair hunger and two for Bad hunger', async () => {
    const fair = await seedHorse('fair-hunger', { lastFedDate: new Date(Date.now() - 7 * dayMs) });
    const bad = await seedHorse('bad-hunger', { lastFedDate: new Date(Date.now() - 12 * dayMs) });
    expect(getDisplayedHealth(await readHorse(fair.id))).toBe('Very Good');
    expect(getDisplayedHealth(await readHorse(bad.id))).toBe('Good');
  });

  it('two concurrent feedings of an Excellent horse not yet fed today: exactly one wins', async () => {
    const horse = await seedHorse('race', { lastFedDate: new Date(Date.now() - dayMs) });
    const responses = await Promise.all([feed(horse.id), feed(horse.id)]);
    const statuses = responses.map(r => r.status).sort();
    expect(statuses.filter(s => s === 200)).toHaveLength(1);
    expect(statuses.filter(s => s !== 200).every(s => s === 400 || s === 409)).toBe(true);
    expect(await readUnits()).toBe(startingUnits - 1);
  });

  it('concurrent feedings of a Bad horse never double-apply: units used and levels raised equal the feedings that succeeded', async () => {
    const horse = await seedHorse('race-bad', { lastFedDate: null });
    const responses = await Promise.all([feed(horse.id), feed(horse.id), feed(horse.id)]);
    const wins = responses.filter(r => r.status === 200).length;
    expect(wins).toBeGreaterThanOrEqual(1);
    expect(responses.filter(r => r.status !== 200).every(r => r.status === 400 || r.status === 409)).toBe(true);
    expect(await readUnits()).toBe(startingUnits - wins);
    // Bad -> Fair -> Good -> Very Good: one level per successful feeding.
    expect(getFeedHealth(await readHorse(horse.id))).toBe(['Bad', 'Fair', 'Good', 'Very Good'][wins]);
  });
});
