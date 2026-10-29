/**
 * GET /api/v1/forum/threads on the keyset convention (Equoria-cmw85.21).
 *
 * Order: pinned first, then most recently active, then id. 105 threads in one
 * section, five pinned, all TIED on lastActivityAt. Threads move between pages by
 * design (a reply bumps one to the front), so the walk bumps threads between page
 * fetches: none may be shown twice or lost. The numbered-page client (?page, with a
 * total) keeps working. Real backend, real auth, real database.
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
const TIED = new Date('2026-03-04T08:00:00.000Z');
const SECTION = 'venting';
const cleanup = createCleanupTracker();

let author;
let token;
let mine = [];

const get = query =>
  request(app)
    .get('/api/v1/forum/threads')
    .set('Authorization', `Bearer ${token}`)
    .query({ section: SECTION, ...query });

const thread = (i, isPinned) => ({
  section: SECTION,
  title: `TestFixture-ForumKeyset-${i}-${RUN}`,
  authorId: author.id,
  isPinned,
  lastActivityAt: TIED,
  createdAt: TIED,
});

beforeAll(async () => {
  cleanup.add(() => prisma.forumThread.deleteMany({ where: { authorId: author.id } }), 'threads');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: author.id } }), 'author');
  author = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `forumkeyset-${RUN}@test.com`,
      username: `forumkeyset${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Forum',
      lastName: 'Keyset',
    },
  });
  token = generateTestToken({ id: author.id, email: author.email, role: 'user' });
  await prisma.forumThread.createMany({
    data: Array.from({ length: 105 }, (_, i) => thread(i, i < 5)),
  });
  mine = (await prisma.forumThread.findMany({ where: { authorId: author.id }, select: { id: true } })).map(t => t.id);
  mine.sort((a, b) => a - b);
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

describe('GET /api/v1/forum/threads keyset pages (Equoria-cmw85.21)', () => {
  it('caps a huge ?limit at the shared maximum', async () => {
    const res = await get({ limit: 5000 });
    expect(res.status).toBe(200);
    expect(res.body.data.threads).toHaveLength(100);
    expect(res.body.data.pageInfo.hasMore).toBe(true);
  }, 60_000);

  it('walks the section by cursor: every thread once, while threads are bumped and added mid-walk', async () => {
    const bumped = [];
    const { ids } = await walkPages({
      fetchPage: async cursor => {
        const res = await get({ limit: 20, ...(cursor ? { cursor } : {}) });
        expect(res.status).toBe(200);
        return res.body.data;
      },
      idsOf: data => data.threads.map(t => t.id),
      pageInfoOf: data => data.pageInfo,
      maxPages: 100,
      afterFirstPage: async () => {
        // A reply bumps one thread already shown and one not yet reached.
        const [shown, unseen] = [mine[100], mine[10]];
        bumped.push(shown, unseen);
        await prisma.forumThread.updateMany({
          where: { id: { in: bumped } },
          data: { lastActivityAt: new Date() },
        });
        // And a thread tied with the rest arrives.
        await prisma.forumThread.create({ data: thread('late', false) });
      },
    });
    expect(new Set(ids).size).toBe(ids.length);
    const seenMine = ids.filter(id => mine.includes(id));
    // Every original thread appears once, except the bumped one that was not yet
    // reached: it moved ahead of the cursor, which is by design.
    const expected = mine.filter(id => id !== bumped[1]);
    expect([...seenMine].sort((a, b) => a - b)).toEqual([...expected].sort((a, b) => a - b));
  }, 120_000);

  it('lists pinned threads first, then the newest ids among the tied rest', async () => {
    const res = await get({ limit: 100 });
    const rows = res.body.data.threads.filter(t => mine.includes(t.id));
    const pinned = rows.filter(t => t.isPinned);
    expect(rows.slice(0, pinned.length)).toEqual(pinned);
    const rest = rows.slice(pinned.length).filter(t => t.lastActivityAt === TIED.toISOString());
    expect(rest.map(t => t.id)).toEqual([...rest.map(t => t.id)].sort((a, b) => b - a));
  }, 60_000);

  it('keeps the numbered-page client working: ?page returns the section total', async () => {
    const first = await get({});
    const second = await get({ page: 2 });
    expect(first.body.data.total).toBeGreaterThanOrEqual(105);
    expect(second.body.data.page).toBe(2);
    expect(second.body.data.threads).toHaveLength(20);
    expect(second.body.data.threads[0].id).not.toBe(first.body.data.threads[0].id);
  }, 60_000);

  it('answers 400 for a cursor the server did not issue', async () => {
    const res = await get({ cursor: 'c1:nonsense' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  }, 60_000);
});
