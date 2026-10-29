/**
 * GET /api/v1/competition — the Arena list sends a scoped DTO (Equoria-fyoca).
 *
 * The client reads `date`, `prizePool`, `currentEntries` and `maxEntries`; the
 * route used to send raw Show rows (runDate, prize, no counts), so every card
 * showed no date, a zero prize and no field size. The list is also paged, so
 * it must honour page and limit and report the real total.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const tag = randomBytes(4).toString('hex');
const cleanup = createCleanupTracker();

let token;
let user;
let horse;
let cappedShow;
let uncappedShow;

const get = query =>
  request(app).get(`/api/v1/competition${query}`).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

/** Walk the pages (100 each) until the show appears; the shared DB may hold other open shows. */
async function findListed(showId) {
  for (let page = 1; page <= 200; page += 1) {
    const res = await get(`?limit=100&page=${page}`);
    expect(res.status).toBe(200);
    const found = res.body.data.find(item => item.id === showId);
    if (found) {
      return found;
    }
    if (!res.body.pagination.hasNextPage) {
      return undefined;
    }
  }
  return undefined;
}

beforeAll(async () => {
  cleanup.add(
    () => prisma.show.deleteMany({ where: { id: { in: [cappedShow?.id, uncappedShow?.id].filter(Boolean) } } }),
    'shows',
  );
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');

  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `listview-${tag}@test.com`,
      username: `listview${tag}`,
      password: 'irrelevant-hash',
      firstName: 'List',
      lastName: 'View',
      money: 50000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ListViewHorse-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date('2021-01-01'),
      age: 4,
      userId: user.id,
    },
  });

  const runDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const base = { discipline: 'Dressage', levelMin: 1, levelMax: 10, status: 'open', runDate };
  cappedShow = await prisma.show.create({
    data: { ...base, name: `TestFixture-ListViewCapped-${tag}`, prize: 4200, entryFee: 150, maxEntries: 8 },
  });
  uncappedShow = await prisma.show.create({
    data: { ...base, name: `TestFixture-ListViewUncapped-${tag}`, prize: 900, entryFee: 0 },
  });
  await prisma.showEntry.create({
    data: { showId: cappedShow.id, horseId: horse.id, userId: user.id, feePaid: 150 },
  });
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('GET /api/v1/competition list DTO', () => {
  it('sends the fields the Arena card reads, with the show real prize, date and entry count', async () => {
    const item = await findListed(cappedShow.id);

    expect(item).toBeDefined();
    expect(item.prizePool).toBe(4200);
    expect(item.entryFee).toBe(150);
    expect(new Date(item.date).getTime()).toBe(cappedShow.runDate.getTime());
    expect(item.currentEntries).toBe(1);
    expect(item.maxEntries).toBe(8);
    expect(item.discipline).toBe('Dressage');
    // Not a raw row: the stored column names are not the wire names.
    expect(item).not.toHaveProperty('prize');
  });

  it('reports no ceiling for a show with no entry cap, and a zero count for an empty field', async () => {
    const item = await findListed(uncappedShow.id);

    expect(item).toBeDefined();
    expect(item.currentEntries).toBe(0);
    expect(item).not.toHaveProperty('maxEntries');
    expect(item.prizePool).toBe(900);
  });

  it('pages honestly: limit and page are honoured and the total is the real count', async () => {
    const first = await get('?limit=1&page=1');
    const second = await get('?limit=1&page=2');

    expect(first.status).toBe(200);
    expect(first.body.data).toHaveLength(1);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.data[0].id).not.toBe(first.body.data[0].id);
    expect(first.body.pagination.totalRecords).toBeGreaterThanOrEqual(2);
    expect(first.body.pagination.hasNextPage).toBe(true);
  });
});
