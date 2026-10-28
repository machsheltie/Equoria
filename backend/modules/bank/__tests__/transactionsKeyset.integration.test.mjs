/**
 * GET /api/v1/users/transactions on the keyset convention (Equoria-cmw85.20).
 * The Bank page reads this URL; the same handler's duplicate mount at
 * GET /bank/transactions was removed (Equoria-a7f1p, owner ruling q151).
 *
 * The ledger was already ordered createdAt desc, id desc; what it lacked is the
 * cursor, so a transaction written while the player pages still shifted every
 * later OFFSET page. 105 transactions TIED on createdAt; one batch is inserted
 * between page fetches. Real backend, real auth, real database.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { walkPages } from '../../../__tests__/helpers/keysetWalk.mjs';

const RUN = randomBytes(5).toString('hex');
const TIED = new Date('2026-03-02T09:00:00.000Z');
const TOTAL = 105;
const cleanup = createCleanupTracker();

let user;
let token;

const entry = i => ({
  userId: user.id,
  type: 'credit',
  amount: 10,
  category: 'test',
  description: `TestFixture-TxKeyset-${i}`,
  createdAt: TIED,
});

const get = query =>
  request(app).get('/api/v1/users/transactions').set('Authorization', `Bearer ${token}`).query(query);

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `txkeyset-${RUN}@test.com`,
      username: `txkeyset${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Tx',
      lastName: 'Keyset',
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  await prisma.userTransaction.createMany({ data: Array.from({ length: TOTAL }, (_, i) => entry(i)) });
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: user.id } }), 'transactions');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

describe('GET /api/v1/users/transactions keyset pages (Equoria-cmw85.20)', () => {
  it('caps a huge ?pageSize at the shared maximum', async () => {
    const res = await get({ pageSize: 5000 });
    expect(res.status).toBe(200);
    expect(res.body.data.transactions).toHaveLength(100);
    expect(res.body.data.pageInfo.hasMore).toBe(true);
  }, 60_000);

  it('walks tied transactions by cursor: each once, newest-then-highest-id first, even as new ones arrive', async () => {
    const { ids, sizes } = await walkPages({
      fetchPage: async cursor => {
        const res = await get({ pageSize: 40, ...(cursor ? { cursor } : {}) });
        expect(res.status).toBe(200);
        return res.body.data;
      },
      idsOf: data => data.transactions.map(t => t.id),
      pageInfoOf: data => data.pageInfo,
      afterFirstPage: () =>
        prisma.userTransaction.createMany({
          data: Array.from({ length: 3 }, (_, i) => entry(`late-${i}`)),
        }),
    });
    expect(sizes).toEqual([40, 40, 25]);
    expect(new Set(ids).size).toBe(TOTAL);
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
  }, 60_000);

  it('still answers the legacy ?page with the total', async () => {
    const first = await get({ pageSize: 10 });
    const second = await get({ pageSize: 10, page: 2 });
    expect(second.body.data.page).toBe(2);
    expect(second.body.data.total).toBeGreaterThanOrEqual(TOTAL);
    expect(second.body.data.transactions[0].id).toBeLessThan(first.body.data.transactions.at(-1).id);
  }, 60_000);

  it('answers 400 for a cursor the server did not issue', async () => {
    const res = await get({ cursor: 'c1:nonsense' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  }, 60_000);
});
