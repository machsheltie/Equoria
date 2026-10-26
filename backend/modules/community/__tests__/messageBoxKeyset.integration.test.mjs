/**
 * GET /api/v1/messages/inbox and /sent on the keyset convention
 * (Equoria-cmw85.20).
 *
 * Messages tied on createdAt used to swap places between requests, and a message
 * written while a player paged through the box shifted every later page. Real
 * backend, real auth, real database; the fixture is 105 messages TIED on the sort
 * key so the walk fails on an unstable order.
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
const TIED = new Date('2026-03-01T12:00:00.000Z');
const TOTAL = 105;
const cleanup = createCleanupTracker();

let player;
let other;
let token;

const mkUser = async tag =>
  prisma.user.create({
    data: {
      email: `msgkeyset-${tag}-${RUN}@test.com`,
      username: `msgkeyset${tag}${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Msg',
      lastName: 'Keyset',
    },
  });

const row = (senderId, recipientId, i) => ({
  senderId,
  recipientId,
  subject: `TestFixture-MsgKeyset-${i}`,
  content: 'TestFixture-MsgKeyset',
  createdAt: TIED,
});

const get = (box, query) =>
  request(app).get(`/api/v1/messages/${box}`).set('Authorization', `Bearer ${token}`).query(query);

beforeAll(async () => {
  player = await mkUser('a');
  other = await mkUser('b');
  token = generateTestToken({ id: player.id, email: player.email, role: 'user' });
  await prisma.directMessage.createMany({
    data: [
      ...Array.from({ length: TOTAL }, (_, i) => row(other.id, player.id, i)),
      ...Array.from({ length: TOTAL }, (_, i) => row(player.id, other.id, i)),
    ],
  });
  cleanup.add(
    () =>
      prisma.directMessage.deleteMany({
        where: { OR: [{ senderId: player.id }, { recipientId: player.id }] },
      }),
    'messages',
  );
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [player.id, other.id] } } }), 'users');
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

describe.each([
  ['inbox', () => other.id, () => player.id],
  ['sent', () => player.id, () => other.id],
])('GET /api/v1/messages/%s keyset pages (Equoria-cmw85.20)', (box, senderOf, recipientOf) => {
  it('caps a huge ?limit at the shared maximum', async () => {
    const res = await get(box, { limit: 5000 });
    expect(res.status).toBe(200);
    expect(res.body.data.messages).toHaveLength(100);
    expect(res.body.data.pageInfo.hasMore).toBe(true);
  }, 60_000);

  it('walks tied messages by cursor: each once, newest-then-highest-id first, even as new ones arrive', async () => {
    const { ids, pages, sizes } = await walkPages({
      fetchPage: async cursor => {
        const res = await get(box, { limit: 40, ...(cursor ? { cursor } : {}) });
        expect(res.status).toBe(200);
        return res.body.data;
      },
      idsOf: data => data.messages.map(m => m.id),
      pageInfoOf: data => data.pageInfo,
      afterFirstPage: () =>
        prisma.directMessage.createMany({
          data: Array.from({ length: 3 }, (_, i) => row(senderOf(), recipientOf(), `late-${i}`)),
        }),
    });
    expect(sizes).toEqual([40, 40, 25]);
    expect(pages).toBe(3);
    expect(new Set(ids).size).toBe(TOTAL);
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
  }, 60_000);

  it('still answers the legacy ?page and reports the box total', async () => {
    const first = await get(box, { limit: 10 });
    const second = await get(box, { limit: 10, page: 2 });
    expect(second.status).toBe(200);
    expect(second.body.data.page).toBe(2);
    expect(second.body.data.total).toBeGreaterThanOrEqual(TOTAL);
    expect(second.body.data.messages[0].id).toBeLessThan(first.body.data.messages.at(-1).id);
  }, 60_000);

  it('answers 400 for a cursor the server did not issue', async () => {
    const res = await get(box, { cursor: 'c1:nonsense' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  }, 60_000);
});
