/**
 * GET /api/v1/horses and GET /api/v1/competition on the keyset convention
 * (Equoria-cmw85.19).
 *
 * Both lists ordered by a non-unique column (horses by createdAt, shows by
 * runDate), so rows tied on it could swap places between requests and be
 * skipped or repeated across pages. They now order with the id as the final
 * key, accept ?cursor, and return `pageInfo` next to the response they always
 * returned.
 *
 * Real backend, real auth, real database. Fixtures are rows TIED on the sort
 * key, so the walk would fail with the old order.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import config from '../../../config/config.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const RUN = randomBytes(5).toString('hex');
const TIED = new Date('2026-04-01T00:00:00.000Z');
const cleanup = createCleanupTracker();

let user;
let token;
const showIds = [];

const auth = req => req.set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');

  user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `TFkeyset-${RUN}`,
      email: `tfkeyset-${RUN}@example.com`,
      password: await bcrypt.hash('TestPassword123!', 1),
      firstName: 'Keyset',
      lastName: 'Lists',
    },
  });
  token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });

  await prisma.horse.createMany({
    data: await Promise.all(
      Array.from({ length: 7 }, (_, i) =>
        testHorseData(prisma, {
          ...fixtureColor(),
          name: `TestFixture-HorseKeyset-${i}-${RUN}`,
          sex: 'Mare',
          dateOfBirth: new Date('2018-01-01'),
          age: 5,
          userId: user.id,
          createdAt: TIED,
        }),
      ),
    ),
  });

  // Open shows all running at the same instant (runDate is the sort key).
  for (let i = 0; i < 7; i++) {
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-ShowKeyset-${i}-${RUN}`,
        discipline: 'Dressage',
        runDate: new Date('2031-04-01T00:00:00.000Z'),
        prize: 100,
        entryFee: 10,
        levelMin: 1,
        levelMax: 10,
        status: 'open',
      },
    });
    showIds.push(show.id);
  }
}, 120_000);

afterAll(() => cleanup.run(), 60_000);

describe('GET /api/v1/horses keyset pages (Equoria-cmw85.19)', () => {
  it('walks tied horses by cursor: every horse once, newest-then-highest-id first', async () => {
    const seen = [];
    let cursor;
    let pages = 0;
    do {
      const res = await auth(
        request(app)
          .get('/api/v1/horses')
          .query({ limit: 3, ...(cursor ? { cursor } : {}) }),
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true); // the shape clients already read
      seen.push(...res.body.data.map(h => h.id));
      cursor = res.body.pageInfo.nextCursor ?? undefined;
      expect(res.body.pageInfo.hasMore).toBe(Boolean(cursor));
      pages += 1;
    } while (cursor && pages < 10);

    expect(pages).toBe(3); // 3 + 3 + 1
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
    expect([...seen].sort((a, b) => b - a)).toEqual(seen);
  }, 60_000);

  it('still answers the legacy ?offset, and the default page is the whole stable', async () => {
    const all = await auth(request(app).get('/api/v1/horses'));
    expect(all.body.data).toHaveLength(7);
    expect(all.body.pageInfo).toEqual({ nextCursor: null, hasMore: false });

    const skipped = await auth(request(app).get('/api/v1/horses').query({ limit: 3, offset: 3 }));
    expect(skipped.body.data.map(h => h.id)).toEqual(all.body.data.slice(3, 6).map(h => h.id));
  }, 60_000);

  it('answers 400 for a cursor that was not issued by the server', async () => {
    const res = await auth(request(app).get('/api/v1/horses').query({ cursor: 'c1:nonsense' }));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  }, 60_000);
});

describe('GET /api/v1/competition keyset pages (Equoria-cmw85.19)', () => {
  async function pageOf(query) {
    const res = await auth(request(app).get('/api/v1/competition').query(query));
    expect(res.status).toBe(200);
    return res;
  }

  it('walks the open shows by cursor with no show skipped or repeated', async () => {
    const mine = new Set(showIds);
    const seen = [];
    let cursor;
    let pages = 0;
    do {
      const res = await pageOf({ limit: 100, ...(cursor ? { cursor } : {}) });
      seen.push(...res.body.data.map(s => s.id));
      cursor = res.body.pageInfo.nextCursor ?? undefined;
      pages += 1;
    } while (cursor && pages < 50);

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.filter(id => mine.has(id))).toEqual([...showIds].sort((a, b) => a - b));
  }, 120_000);

  it('keeps the page/total envelope and reports hasMore without a count', async () => {
    const res = await pageOf({ limit: 2 });
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.totalRecords).toBeGreaterThanOrEqual(7);
    expect(res.body.pagination.currentPage).toBe(1);
    expect(res.body.pageInfo.hasMore).toBe(true);
    expect(typeof res.body.pageInfo.nextCursor).toBe('string');
    const next = await pageOf({ limit: 2, cursor: res.body.pageInfo.nextCursor });
    expect(next.body.data.map(s => s.id)).not.toEqual(res.body.data.map(s => s.id));
  }, 60_000);

  it('answers 400 for a cursor that was not issued by the server', async () => {
    const res = await auth(request(app).get('/api/v1/competition').query({ cursor: 'zzz' }));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  }, 60_000);
});
