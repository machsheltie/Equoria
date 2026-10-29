/**
 * The keyset pagination convention (Equoria-cmw85.19): cursor encoding, the
 * limit clamp, and a real-database walk across rows TIED on the sort key while
 * new tied rows are inserted between page fetches - the exact case OFFSET
 * pagination gets wrong (skipped and repeated rows).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import {
  InvalidCursorError,
  clampLimit,
  decodeCursor,
  encodeCursor,
  findKeysetPage,
  keysetWhere,
} from '../utils/paginationHelper.mjs';
import { testHorseData } from './helpers/createTestHorse.mjs';

describe('clampLimit', () => {
  it('defaults to 20 and caps at 100', () => {
    expect(clampLimit(undefined)).toBe(20);
    expect(clampLimit('abc')).toBe(20);
    expect(clampLimit('0')).toBe(20);
    expect(clampLimit('-5')).toBe(20);
    expect(clampLimit('7')).toBe(7);
    expect(clampLimit('100')).toBe(100);
    expect(clampLimit('101')).toBe(100);
    expect(clampLimit('5000')).toBe(100);
  });

  it('takes the endpoint default and max', () => {
    expect(clampLimit(undefined, { def: 50, max: 200 })).toBe(50);
    expect(clampLimit('500', { def: 50, max: 200 })).toBe(200);
  });
});

describe('cursor encoding', () => {
  it('round-trips every supported type, opaque and prefixed', () => {
    const when = new Date('2026-10-23T12:34:56.789Z');
    const values = [when, 42, 9007199254740993n, 'abc'];
    const cursor = encodeCursor(values);
    expect(cursor.startsWith('c1:')).toBe(true);
    expect(cursor).not.toMatch(/[+/=\s]/); // base64url, URL-safe
    expect(decodeCursor(cursor, ['date', 'int', 'bigint', 'string'])).toEqual(values);
  });

  it('refuses a cursor that was not made by encodeCursor with the same sort', () => {
    const good = encodeCursor([new Date('2026-01-01T00:00:00Z'), 5]);
    const bad = [
      undefined,
      null,
      '',
      'garbage',
      `c2:${good.slice(3)}`, // unknown version
      'c1:!!!not-base64-json',
      `c1:${Buffer.from('{"a":1}').toString('base64url')}`, // not an array
      `c1:${Buffer.from('[1]').toString('base64url')}`, // wrong length
      `c1:${Buffer.from('["2026-01-01T00:00:00Z","x"]').toString('base64url')}`, // id not an int
      `c1:${Buffer.from('["not a date",5]').toString('base64url')}`,
      `c1:${Buffer.from('[1.5,5]').toString('base64url')}`, // date must be a string
    ];
    expect(decodeCursor(good, ['date', 'int'])).toHaveLength(2);
    for (const cursor of bad) {
      expect(() => decodeCursor(cursor, ['date', 'int'])).toThrow(InvalidCursorError);
    }
    expect(new InvalidCursorError().status).toBe(400);
  });
});

describe('keysetWhere', () => {
  it('builds the OR-ladder with each key in its own direction', () => {
    expect(
      keysetWhere(
        [
          { key: 'createdAt', dir: 'desc' },
          { key: 'id', dir: 'asc' },
        ],
        ['T', 7],
      ),
    ).toEqual({ OR: [{ createdAt: { lt: 'T' } }, { createdAt: 'T', id: { gt: 7 } }] });
  });

  it('refuses a sort that does not end with the unique id', async () => {
    await expect(
      findKeysetPage(async () => [], {
        sort: [{ key: 'createdAt', dir: 'desc', type: 'date' }],
        limit: 5,
      }),
    ).rejects.toThrow(/unique id/);
  });
});

describe('findKeysetPage against the real database (Equoria-cmw85.19)', () => {
  const RUN = randomBytes(6).toString('hex');
  const TIED = new Date('2026-03-01T00:00:00.000Z');
  const cleanup = createCleanupTracker();
  let user;
  const horseIds = [];

  async function addTiedHorses(count, label) {
    const data = Array.from({ length: count }, (_, i) => ({
      ...fixtureColor(),
      name: `TestFixture-Keyset-${label}${i}-${RUN}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 5,
      userId: user.id,
      createdAt: TIED,
    }));
    await prisma.horse.createMany({ data: await Promise.all(data.map(row => testHorseData(prisma, row))) });
    const rows = await prisma.horse.findMany({
      where: { userId: user.id, name: { startsWith: `TestFixture-Keyset-${label}` } },
      select: { id: true },
    });
    horseIds.push(...rows.map(r => r.id));
    return rows.map(r => r.id);
  }

  const find = args => prisma.horse.findMany({ ...args, select: { id: true, createdAt: true } });

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `keyset-${RUN}@test.com`,
        username: `keyset${RUN}`,
        password: 'irrelevant-hash',
        firstName: 'Key',
        lastName: 'Set',
        money: 0,
      },
    });
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'keysetHorses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'keysetUser');
  }, 60_000);

  afterAll(() => cleanup.run(), 60_000);

  async function walk(sort, between) {
    const seen = [];
    let cursor = null;
    let pages = 0;
    do {
      const page = await findKeysetPage(find, {
        where: { userId: user.id },
        sort,
        limit: 10,
        cursor,
      });
      seen.push(...page.items.map(r => r.id));
      cursor = page.pageInfo.nextCursor;
      pages += 1;
      if (cursor) {
        expect(page.pageInfo.hasMore).toBe(true);
        expect(page.items).toHaveLength(10);
        await between(pages);
      } else {
        expect(page.pageInfo.hasMore).toBe(false);
      }
    } while (cursor && pages < 20);
    return { seen, pages };
  }

  it('sees every original row exactly once while tied rows are inserted between pages (descending)', async () => {
    const originals = await addTiedHorses(25, 'a');
    const { seen, pages } = await walk(
      [
        { key: 'createdAt', dir: 'desc', type: 'date' },
        { key: 'id', dir: 'desc', type: 'int' },
      ],
      pages => addTiedHorses(3, `ins${pages}x`),
    );
    expect(pages).toBeGreaterThan(2);
    expect(new Set(seen).size).toBe(seen.length); // nothing repeated
    for (const id of originals) {
      expect(seen.filter(x => x === id)).toHaveLength(1); // nothing skipped
    }
    // Strictly descending by id within the tied timestamp.
    expect([...seen].sort((a, b) => b - a)).toEqual(seen);
  }, 120_000);

  it('handles mixed directions (newest first, ties by id ascending) without skips or repeats', async () => {
    const all = (await prisma.horse.findMany({ where: { userId: user.id }, select: { id: true } })).map(r => r.id);
    const { seen } = await walk(
      [
        { key: 'createdAt', dir: 'desc', type: 'date' },
        { key: 'id', dir: 'asc', type: 'int' },
      ],
      async () => {},
    );
    expect(seen).toEqual([...all].sort((a, b) => a - b));
  }, 120_000);

  it('serves the legacy offset when no cursor is given, and refuses a tampered cursor', async () => {
    const sort = [
      { key: 'createdAt', dir: 'desc', type: 'date' },
      { key: 'id', dir: 'desc', type: 'int' },
    ];
    const first = await findKeysetPage(find, { where: { userId: user.id }, sort, limit: 5 });
    const offset = await findKeysetPage(find, {
      where: { userId: user.id },
      sort,
      limit: 5,
      skip: 5,
    });
    const viaCursor = await findKeysetPage(find, {
      where: { userId: user.id },
      sort,
      limit: 5,
      cursor: first.pageInfo.nextCursor,
    });
    expect(offset.items.map(r => r.id)).toEqual(viaCursor.items.map(r => r.id));
    await expect(
      findKeysetPage(find, { where: { userId: user.id }, sort, limit: 5, cursor: 'c1:nope' }),
    ).rejects.toThrow(InvalidCursorError);
  }, 120_000);
});
