/**
 * Trait history on the keyset convention (Equoria-cmw85.20).
 *
 * GET /api/v1/epigenetic-traits/history/:id took a write per game action and
 * paged by OFFSET on a timestamp with no tiebreak. (GET /api/v1/horses/:id/xp-history
 * was pinned here too until the owner removed the points history, Equoria-fly7a.) 105 rows TIED on the timestamp; a batch is inserted between page
 * fetches. Real backend, real auth, real database.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { walkPages } from '../../../__tests__/helpers/keysetWalk.mjs';

const RUN = randomBytes(5).toString('hex');
const TIED = new Date('2026-03-03T10:00:00.000Z');
const TOTAL = 105;
const cleanup = createCleanupTracker();

let user;
let horse;
let token;

const traitRow = i => ({
  horseId: horse.id,
  traitName: `TestFixture-Trait-${i}`,
  sourceType: 'groom',
  ageInDays: 10,
  timestamp: TIED,
});

const auth = req => req.set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `histkeyset-${RUN}@test.com`,
      username: `histkeyset${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Hist',
      lastName: 'Keyset',
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-HistKeyset-${RUN}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 5,
      userId: user.id,
    },
  });
  await prisma.traitHistoryLog.createMany({
    data: Array.from({ length: TOTAL }, (_, i) => traitRow(i)),
  });
  cleanup.add(() => prisma.traitHistoryLog.deleteMany({ where: { horseId: horse.id } }), 'trait logs');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

describe('GET /api/v1/epigenetic-traits/history/:id keyset pages (Equoria-cmw85.20)', () => {
  const get = query => auth(request(app).get(`/api/v1/epigenetic-traits/history/${horse.id}`).query(query));

  it('reports the real number of entries, not the page length', async () => {
    const res = await get({ limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body.data.history).toHaveLength(10);
    expect(res.body.data.totalEntries).toBeGreaterThanOrEqual(TOTAL);
  }, 60_000);

  it('walks tied entries by cursor: each once, newest-then-highest-id first, even as new ones arrive', async () => {
    const { ids, sizes } = await walkPages({
      fetchPage: async cursor => {
        const res = await get({ limit: 40, ...(cursor ? { cursor } : {}) });
        expect(res.status).toBe(200);
        return res.body.data;
      },
      idsOf: data => data.history.map(e => e.id),
      pageInfoOf: data => data.pageInfo,
      afterFirstPage: () =>
        prisma.traitHistoryLog.createMany({ data: Array.from({ length: 3 }, (_, i) => traitRow(`late-${i}`)) }),
    });
    expect(sizes).toEqual([40, 40, 25]);
    expect(new Set(ids).size).toBe(TOTAL);
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
  }, 60_000);

  it('still answers the legacy ?offset', async () => {
    const first = await get({ limit: 10 });
    const second = await get({ limit: 10, offset: 10 });
    expect(second.body.data.history[0].id).toBeLessThan(first.body.data.history.at(-1).id);
  }, 60_000);

  it('answers 400 for a cursor the server did not issue', async () => {
    const res = await get({ cursor: 'c1:nonsense' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  }, 60_000);
});
