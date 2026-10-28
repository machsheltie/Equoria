/**
 * GET /api/v1/competition?level=N — players find shows by level (Equoria-i33ow).
 *
 * Owner request 2026-10-28: competitions are searchable by level. A show's
 * level is its advertised bracket (levelMin..levelMax; a hosted show runs one
 * level, so levelMin == levelMax). Horse levels run 1 to 20 (levelForScore), so
 * the filter takes a whole level 1 to 20 and lists the open shows whose bracket
 * holds it. Without the filter the list is unchanged.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const tag = randomBytes(4).toString('hex');
const cleanup = createCleanupTracker();

let token;
let user;
let levelThree;
let levelSeven;
let openBracket;

const get = query =>
  request(app).get(`/api/v1/competition${query}`).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

/** Every listed show id for a query, walking the pages (the shared DB may hold other open shows). */
async function listedIds(query) {
  const ids = new Set();
  for (let page = 1; page <= 200; page += 1) {
    const res = await get(`?${query}&limit=100&page=${page}`);
    expect(res.status).toBe(200);
    res.body.data.forEach(item => ids.add(item.id));
    if (!res.body.pagination.hasNextPage) {
      break;
    }
  }
  return ids;
}

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `levelfilter-${tag}@test.com`,
      username: `levelfilter${tag}`,
      password: 'irrelevant-hash',
      firstName: 'Level',
      lastName: 'Filter',
      money: 0,
    },
  });
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  const runDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const base = { discipline: 'Dressage', status: 'open', runDate, prize: 0, entryFee: 0 };
  levelThree = await prisma.show.create({
    data: { ...base, name: `TestFixture-LevelThree-${tag}`, levelMin: 3, levelMax: 3 },
  });
  levelSeven = await prisma.show.create({
    data: { ...base, name: `TestFixture-LevelSeven-${tag}`, levelMin: 7, levelMax: 7 },
  });
  openBracket = await prisma.show.create({
    data: { ...base, name: `TestFixture-OpenBracket-${tag}`, levelMin: 1, levelMax: 999 },
  });
  cleanup.add(
    () => prisma.show.deleteMany({ where: { id: { in: [levelThree.id, levelSeven.id, openBracket.id] } } }),
    'shows',
  );
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('GET /api/v1/competition?level=', () => {
  it('lists only the open shows whose level bracket holds the chosen level', async () => {
    const ids = await listedIds('level=3');

    expect(ids.has(levelThree.id)).toBe(true);
    expect(ids.has(openBracket.id)).toBe(true);
    expect(ids.has(levelSeven.id)).toBe(false);
  });

  it('every listed show holds the chosen level', async () => {
    const res = await get('?level=7&limit=100&page=1');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach(item => {
      expect(item.levelMin).toBeLessThanOrEqual(7);
      expect(item.levelMax).toBeGreaterThanOrEqual(7);
    });
  });

  it('without a level the list still holds every open show', async () => {
    const ids = await listedIds('');

    expect(ids.has(levelThree.id)).toBe(true);
    expect(ids.has(levelSeven.id)).toBe(true);
    expect(ids.has(openBracket.id)).toBe(true);
  });

  it.each(['0', '21', '2.5', 'high'])('refuses level=%s: levels are whole numbers 1 to 20', async level => {
    const res = await get(`?level=${level}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
