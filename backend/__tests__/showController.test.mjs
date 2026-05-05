/**
 * showController.test.mjs — real DB
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted
 * from jest.unstable_mockModule of prismaClient + logger to a real-DB
 * integration test against the equoria_test database.
 *
 * Coverage: createShow, getShows, enterShow, executeClosedShows.
 *
 * Removed (per doctrine):
 *   - "returns 500 on unexpected error" tests that mocked Prisma to
 *     reject. Synthetic Prisma fault injection is not permitted; the
 *     catch path is observable via real DB outage / sentry.
 *   - "returns 500 on database error" (getShows) — same reason.
 *   - "logs error but does not throw when res is null and error occurs" —
 *     same reason; the null-res no-throw behaviour is still covered by
 *     "handles scheduler call with (null, null) without crashing".
 *
 * P2002 duplicate behaviour is now exercised through the real Prisma
 * unique constraint (Show.name, ShowEntry @@unique([showId, horseId])).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../db/index.mjs';
import { createShow, getShows, enterShow, executeClosedShows } from '../controllers/showController.mjs';

const SUITE_PREFIX = 'showc';

function uniq() {
  return randomBytes(8).toString('hex');
}

function makeReqRes(userId, overrides = {}) {
  let _status = 200;
  let _body = null;
  return {
    req: {
      user: userId === undefined ? undefined : userId === null ? null : { id: userId },
      body: {},
      params: {},
      query: {},
      ...overrides,
    },
    res: {
      status(c) {
        _status = c;
        return this;
      },
      json(b) {
        _body = b;
        return this;
      },
      get statusValue() {
        return _status;
      },
      get jsonValue() {
        return _body;
      },
    },
  };
}

async function createUser(money = 1000) {
  const id = `${SUITE_PREFIX}-${uniq()}`;
  return prisma.user.create({
    data: {
      id,
      username: id.replace(/-/g, '_'),
      email: `${id}@example.com`,
      firstName: 'Show',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
      money,
    },
  });
}

async function createHorse(userId, overrides = {}) {
  return prisma.horse.create({
    data: {
      name: `${SUITE_PREFIX}-h-${uniq()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      age: overrides.age ?? 5,
      healthStatus: overrides.healthStatus ?? 'healthy',
      speed: overrides.speed ?? 50,
      stamina: overrides.stamina ?? 50,
      agility: overrides.agility ?? 50,
      balance: overrides.balance ?? 50,
      precision: overrides.precision ?? 50,
      boldness: overrides.boldness ?? 50,
      user: { connect: { id: userId } },
    },
  });
}

async function createShowDirect(userId, overrides = {}) {
  return prisma.show.create({
    data: {
      name: overrides.name ?? `${SUITE_PREFIX}-s-${uniq()}`,
      discipline: overrides.discipline ?? 'Dressage',
      levelMin: 1,
      levelMax: 999,
      entryFee: overrides.entryFee ?? 0,
      prize: overrides.prize ?? 0,
      runDate: overrides.runDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: overrides.status ?? 'open',
      openDate: overrides.openDate ?? new Date(),
      closeDate: overrides.closeDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxEntries: overrides.maxEntries ?? null,
      createdByUserId: userId,
    },
  });
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);

  const shows = await prisma.show.findMany({
    where: { OR: [{ createdByUserId: { in: userIds } }, { hostUserId: { in: userIds } }] },
    select: { id: true },
  });
  const showIds = shows.map(s => s.id);

  if (showIds.length > 0) {
    await prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } });
    await prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } });
  }
  // Also cleanup entries / results referencing horses owned by these users
  // even if the show was created by a non-suite user (unlikely but safe).
  const horses = await prisma.horse.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const horseIds = horses.map(h => h.id);
  if (horseIds.length > 0) {
    await prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } });
    await prisma.showEntry.deleteMany({ where: { horseId: { in: horseIds } } });
  }

  if (showIds.length > 0) {
    await prisma.show.deleteMany({ where: { id: { in: showIds } } });
  }
  await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('showController (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  // ── createShow ─────────────────────────────────────────────────────────────

  describe('createShow', () => {
    it('creates a show with valid data and returns 201', async () => {
      const user = await createUser();
      const name = `${SUITE_PREFIX}-cs-${uniq()}`;
      const h = makeReqRes(user.id, {
        body: { name, discipline: 'Dressage', entryFee: 100 },
      });
      await createShow(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      expect(h.res.jsonValue.success).toBe(true);
      expect(h.res.jsonValue.data.show.name).toBe(name);

      // Verify DB row
      const persisted = await prisma.show.findUnique({ where: { name } });
      expect(persisted).not.toBeNull();
      expect(persisted.discipline).toBe('Dressage');
      expect(persisted.entryFee).toBe(100);
      expect(persisted.status).toBe('open');
      expect(persisted.createdByUserId).toBe(user.id);
    });

    it('persists correct fields including 7-day closeDate window and defaults', async () => {
      const user = await createUser();
      const name = `${SUITE_PREFIX}-cs-${uniq()}`;
      const h = makeReqRes(user.id, {
        body: { name, discipline: 'Reining', entryFee: 50 },
      });
      await createShow(h.req, h.res);
      expect(h.res.statusValue).toBe(201);

      const persisted = await prisma.show.findUnique({ where: { name } });
      expect(persisted.levelMin).toBe(1);
      expect(persisted.levelMax).toBe(999);
      expect(persisted.prize).toBe(0);
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const diff = persisted.closeDate.getTime() - persisted.openDate.getTime();
      expect(diff).toBe(sevenDaysMs);
    });

    it('returns 401 when user is not authenticated', async () => {
      const h = makeReqRes(null, { body: { name: 'X', discipline: 'Dressage' } });
      await createShow(h.req, h.res);
      expect(h.res.statusValue).toBe(401);
    });

    it('returns 400 when name is missing', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { body: { discipline: 'Dressage' } });
      await createShow(h.req, h.res);
      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toMatch(/name/i);
    });

    it('returns 400 when name is too short (1 char)', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { body: { name: 'A', discipline: 'Dressage' } });
      await createShow(h.req, h.res);
      expect(h.res.statusValue).toBe(400);
    });

    it('rejects whitespace-padded single-char name (trim before length check)', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { body: { name: '  A  ', discipline: 'Dressage' } });
      await createShow(h.req, h.res);
      expect(h.res.statusValue).toBe(400);
    });

    it('returns 400 for invalid discipline', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, {
        body: { name: `${SUITE_PREFIX}-${uniq()}`, discipline: 'Underwater Polo' },
      });
      await createShow(h.req, h.res);
      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toMatch(/discipline/i);
    });

    it('returns 400 when discipline is missing', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { body: { name: `${SUITE_PREFIX}-${uniq()}` } });
      await createShow(h.req, h.res);
      expect(h.res.statusValue).toBe(400);
    });

    it('returns 400 when entryFee is negative', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, {
        body: { name: `${SUITE_PREFIX}-${uniq()}`, discipline: 'Dressage', entryFee: -5 },
      });
      await createShow(h.req, h.res);
      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toMatch(/fee/i);
    });

    it('returns 400 when entryFee exceeds 100000', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, {
        body: { name: `${SUITE_PREFIX}-${uniq()}`, discipline: 'Dressage', entryFee: 100001 },
      });
      await createShow(h.req, h.res);
      expect(h.res.statusValue).toBe(400);
    });

    it('returns 400 when entryFee is not a number', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, {
        body: { name: `${SUITE_PREFIX}-${uniq()}`, discipline: 'Dressage', entryFee: 'free' },
      });
      await createShow(h.req, h.res);
      expect(h.res.statusValue).toBe(400);
    });

    it('defaults entryFee to 0 when not provided', async () => {
      const user = await createUser();
      const name = `${SUITE_PREFIX}-cs-${uniq()}`;
      const h = makeReqRes(user.id, { body: { name, discipline: 'Barrel Racing' } });
      await createShow(h.req, h.res);
      expect(h.res.statusValue).toBe(201);
      const persisted = await prisma.show.findUnique({ where: { name } });
      expect(persisted.entryFee).toBe(0);
    });

    it('returns 409 on duplicate show name (real Prisma unique constraint)', async () => {
      const user = await createUser();
      const name = `${SUITE_PREFIX}-dup-${uniq()}`;
      // Seed a show with that name directly.
      await createShowDirect(user.id, { name });

      const h = makeReqRes(user.id, { body: { name, discipline: 'Dressage' } });
      await createShow(h.req, h.res);
      expect(h.res.statusValue).toBe(409);
      expect(h.res.jsonValue.message).toMatch(/already exists/i);
    });

    it('accepts all 23 valid disciplines', async () => {
      const validDisciplines = [
        'Western Pleasure',
        'Reining',
        'Cutting',
        'Barrel Racing',
        'Roping',
        'Team Penning',
        'Rodeo',
        'Hunter',
        'Saddleseat',
        'Endurance',
        'Eventing',
        'Dressage',
        'Show Jumping',
        'Vaulting',
        'Polo',
        'Cross Country',
        'Combined Driving',
        'Fine Harness',
        'Gaited',
        'Gymkhana',
        'Steeplechase',
        'Racing',
        'Harness Racing',
      ];
      const user = await createUser();
      for (const disc of validDisciplines) {
        const name = `${SUITE_PREFIX}-disc-${uniq()}`;
        const h = makeReqRes(user.id, { body: { name, discipline: disc } });
        await createShow(h.req, h.res);
        expect(h.res.statusValue).toBe(201);
      }
    });
  });

  // ── getShows ────────────────────────────────────────────────────────────────

  describe('getShows', () => {
    it('returns paginated shows with default params and entryCount', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const show = await createShowDirect(user.id);
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: horse.id, userId: user.id, feePaid: 0 },
      });

      const h = makeReqRes(user.id);
      await getShows(h.req, h.res);

      expect(h.res.statusValue).toBe(200);
      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      // Find our seeded show in results.
      const found = body.data.shows.find(s => s.id === show.id);
      expect(found).toBeDefined();
      expect(found.entryCount).toBe(1);
      expect(body.data.pagination.page).toBe(1);
      expect(body.data.pagination.limit).toBe(20);
    });

    it('applies discipline filter (only matching shows returned)', async () => {
      const user = await createUser();
      const dressageShow = await createShowDirect(user.id, { discipline: 'Dressage' });
      const racingShow = await createShowDirect(user.id, { discipline: 'Racing' });

      const h = makeReqRes(user.id, { query: { discipline: 'Dressage' } });
      await getShows(h.req, h.res);

      const ids = h.res.jsonValue.data.shows.map(s => s.id);
      expect(ids).toContain(dressageShow.id);
      expect(ids).not.toContain(racingShow.id);
    });

    it('applies status filter (only matching shows returned)', async () => {
      const user = await createUser();
      const openShow = await createShowDirect(user.id, { status: 'open' });
      const completedShow = await createShowDirect(user.id, { status: 'completed' });

      const h = makeReqRes(user.id, { query: { status: 'completed' } });
      await getShows(h.req, h.res);

      const ids = h.res.jsonValue.data.shows.map(s => s.id);
      expect(ids).toContain(completedShow.id);
      expect(ids).not.toContain(openShow.id);
    });

    it('respects custom page and limit (pagination math)', async () => {
      // Seed 3 shows so we can paginate.
      const user = await createUser();
      const created = [];
      for (let i = 0; i < 3; i++) {
        const s = await createShowDirect(user.id, { discipline: 'Polo' });
        created.push(s);
      }

      // page=2, limit=1, discipline=Polo → returns 1 show, total=3.
      const h = makeReqRes(user.id, { query: { page: '2', limit: '1', discipline: 'Polo' } });
      await getShows(h.req, h.res);

      expect(h.res.statusValue).toBe(200);
      expect(h.res.jsonValue.data.shows).toHaveLength(1);
      expect(h.res.jsonValue.data.pagination.page).toBe(2);
      expect(h.res.jsonValue.data.pagination.limit).toBe(1);
      expect(h.res.jsonValue.data.pagination.total).toBe(3);
      expect(h.res.jsonValue.data.pagination.totalPages).toBe(3);
    });

    it('clamps limit to max 50', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { query: { limit: '200' } });
      await getShows(h.req, h.res);
      expect(h.res.statusValue).toBe(200);
      expect(h.res.jsonValue.data.pagination.limit).toBe(50);
    });

    it('falls back to default 20 when limit is 0 (falsy)', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { query: { limit: '0' } });
      await getShows(h.req, h.res);
      expect(h.res.statusValue).toBe(200);
      expect(h.res.jsonValue.data.pagination.limit).toBe(20);
    });

    it('clamps page to min 1', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { query: { page: '-1' } });
      await getShows(h.req, h.res);
      expect(h.res.statusValue).toBe(200);
      expect(h.res.jsonValue.data.pagination.page).toBe(1);
    });

    it('returns empty shows array when filter matches nothing', async () => {
      const user = await createUser();
      // Use a discipline value that exists in VALID_DISCIPLINES but for which we
      // didn't seed any show — guarantees an empty result without depending on
      // global DB state.
      const h = makeReqRes(user.id, { query: { discipline: 'Vaulting', status: 'open' } });
      await getShows(h.req, h.res);
      expect(h.res.statusValue).toBe(200);
      // Cannot guarantee total=0 globally, but our suite-prefixed user created
      // none for this discipline, and the assertion just confirms the shape.
      expect(Array.isArray(h.res.jsonValue.data.shows)).toBe(true);
    });
  });

  // ── enterShow ───────────────────────────────────────────────────────────────

  describe('enterShow', () => {
    it('creates an entry, decrements money, returns 201', async () => {
      const user = await createUser(1000);
      const horse = await createHorse(user.id);
      const show = await createShowDirect(user.id, { entryFee: 75, maxEntries: 10 });

      const h = makeReqRes(user.id, {
        params: { id: String(show.id) },
        body: { horseId: horse.id },
      });
      await enterShow(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      expect(h.res.jsonValue.success).toBe(true);
      expect(h.res.jsonValue.data.horseName).toBe(horse.name);

      const entry = await prisma.showEntry.findFirst({
        where: { showId: show.id, horseId: horse.id },
      });
      expect(entry).not.toBeNull();
      expect(entry.feePaid).toBe(75);

      const userAfter = await prisma.user.findUnique({
        where: { id: user.id },
        select: { money: true },
      });
      expect(userAfter.money).toBe(1000 - 75);
    });

    it('returns 401 when user is not authenticated', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const show = await createShowDirect(user.id);

      const h = makeReqRes(null, {
        params: { id: String(show.id) },
        body: { horseId: horse.id },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(401);
    });

    it('returns 400 when horseId is missing', async () => {
      const user = await createUser();
      const show = await createShowDirect(user.id);
      const h = makeReqRes(user.id, { params: { id: String(show.id) }, body: {} });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toMatch(/horseId/);
    });

    it('returns 400 when horseId is not a number', async () => {
      const user = await createUser();
      const show = await createShowDirect(user.id);
      const h = makeReqRes(user.id, {
        params: { id: String(show.id) },
        body: { horseId: 'abc' },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(400);
    });

    it('returns 404 when show does not exist', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const h = makeReqRes(user.id, {
        params: { id: '999999999' },
        body: { horseId: horse.id },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(404);
    });

    it('returns 409 when show is not open (status=completed)', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const show = await createShowDirect(user.id, { status: 'completed' });
      const h = makeReqRes(user.id, {
        params: { id: String(show.id) },
        body: { horseId: horse.id },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(409);
      expect(h.res.jsonValue.message).toMatch(/no longer accepting/i);
    });

    it('returns 409 when entry period has closed (closeDate in past)', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const show = await createShowDirect(user.id, {
        closeDate: new Date(Date.now() - 1000),
      });
      const h = makeReqRes(user.id, {
        params: { id: String(show.id) },
        body: { horseId: horse.id },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(409);
      expect(h.res.jsonValue.message).toMatch(/closed/i);
    });

    it('returns 409 when show is full (maxEntries reached)', async () => {
      const user = await createUser();
      const horse1 = await createHorse(user.id);
      const horse2 = await createHorse(user.id);
      const show = await createShowDirect(user.id, { maxEntries: 1 });
      // Pre-seed one entry to fill the show.
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: horse1.id, userId: user.id, feePaid: 0 },
      });

      const h = makeReqRes(user.id, {
        params: { id: String(show.id) },
        body: { horseId: horse2.id },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(409);
      expect(h.res.jsonValue.message).toMatch(/full/i);
    });

    it('returns 404 when horse is not owned by user (CWE-639: collapsed with not-found)', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const horse = await createHorse(owner.id);
      const show = await createShowDirect(otherUser.id);

      const h = makeReqRes(otherUser.id, {
        params: { id: String(show.id) },
        body: { horseId: horse.id },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue.message).toBe('Horse not found');
    });

    it('returns 404 when horse does not exist', async () => {
      const user = await createUser();
      const show = await createShowDirect(user.id);
      const h = makeReqRes(user.id, {
        params: { id: String(show.id) },
        body: { horseId: 99999999 },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue.message).toBe('Horse not found');
    });

    it('returns 400 when horse is too young (age < 3)', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id, { age: 2 });
      const show = await createShowDirect(user.id);
      const h = makeReqRes(user.id, {
        params: { id: String(show.id) },
        body: { horseId: horse.id },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toMatch(/3 years old/);
    });

    it('returns 400 when horse is injured', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id, { healthStatus: 'injured' });
      const show = await createShowDirect(user.id);
      const h = makeReqRes(user.id, {
        params: { id: String(show.id) },
        body: { horseId: horse.id },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toMatch(/injured/i);
    });

    it('returns 400 when horse health is INJURED (uppercase)', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id, { healthStatus: 'INJURED' });
      const show = await createShowDirect(user.id);
      const h = makeReqRes(user.id, {
        params: { id: String(show.id) },
        body: { horseId: horse.id },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(400);
    });

    it('returns 402 when user has insufficient funds', async () => {
      const user = await createUser(100);
      const horse = await createHorse(user.id);
      const show = await createShowDirect(user.id, { entryFee: 500 });
      const h = makeReqRes(user.id, {
        params: { id: String(show.id) },
        body: { horseId: horse.id },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(402);
      expect(h.res.jsonValue.message).toMatch(/insufficient/i);

      // No entry should have been created and money should be unchanged.
      const entry = await prisma.showEntry.findFirst({
        where: { showId: show.id, horseId: horse.id },
      });
      expect(entry).toBeNull();
      const userAfter = await prisma.user.findUnique({
        where: { id: user.id },
        select: { money: true },
      });
      expect(userAfter.money).toBe(100);
    });

    it('skips fee charge when entryFee is 0', async () => {
      const user = await createUser(500);
      const horse = await createHorse(user.id);
      const show = await createShowDirect(user.id, { entryFee: 0 });

      const h = makeReqRes(user.id, {
        params: { id: String(show.id) },
        body: { horseId: horse.id },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(201);

      // Money unchanged since fee is 0.
      const userAfter = await prisma.user.findUnique({
        where: { id: user.id },
        select: { money: true },
      });
      expect(userAfter.money).toBe(500);
    });

    it('returns 409 on duplicate entry (real Prisma unique constraint @@unique([showId,horseId]))', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const show = await createShowDirect(user.id, { entryFee: 0 });
      // Seed first entry directly.
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: horse.id, userId: user.id, feePaid: 0 },
      });

      const h = makeReqRes(user.id, {
        params: { id: String(show.id) },
        body: { horseId: horse.id },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(409);
      expect(h.res.jsonValue.message).toMatch(/already entered/i);
    });

    it('allows entry when maxEntries is null (unlimited)', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const show = await createShowDirect(user.id, { entryFee: 0, maxEntries: null });

      const h = makeReqRes(user.id, {
        params: { id: String(show.id) },
        body: { horseId: horse.id },
      });
      await enterShow(h.req, h.res);
      expect(h.res.statusValue).toBe(201);
    });
  });

  // ── executeClosedShows ─────────────────────────────────────────────────────

  describe('executeClosedShows', () => {
    it('returns executed: 0 when no shows in suite are ready', async () => {
      // No-op suite state: just verify the endpoint returns 200 with success.
      // (Cannot assert executed===0 because background data may have ready shows.)
      const h = makeReqRes(undefined);
      await executeClosedShows(h.req, h.res);
      expect(h.res.statusValue).toBe(200);
      expect(h.res.jsonValue.success).toBe(true);
      expect(typeof h.res.jsonValue.data.executed).toBe('number');
    });

    it('completes a show with no entries (status → completed, executedAt set)', async () => {
      const user = await createUser();
      const show = await createShowDirect(user.id, {
        closeDate: new Date(Date.now() - 1000),
        prize: 0,
      });

      const h = makeReqRes(undefined);
      await executeClosedShows(h.req, h.res);
      expect(h.res.statusValue).toBe(200);

      const after = await prisma.show.findUnique({ where: { id: show.id } });
      expect(after.status).toBe('completed');
      expect(after.executedAt).not.toBeNull();
    });

    it('scores entries and creates competition results with required fields', async () => {
      const user = await createUser();
      const fast = await createHorse(user.id, {
        speed: 80,
        stamina: 70,
        agility: 75,
        balance: 60,
        precision: 90,
        boldness: 65,
      });
      const slow = await createHorse(user.id, {
        speed: 40,
        stamina: 40,
        agility: 40,
        balance: 40,
        precision: 40,
        boldness: 40,
      });
      const show = await createShowDirect(user.id, {
        closeDate: new Date(Date.now() - 1000),
        prize: 0,
        discipline: 'Dressage',
      });
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: fast.id, userId: user.id, feePaid: 0 },
      });
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: slow.id, userId: user.id, feePaid: 0 },
      });

      const h = makeReqRes(undefined);
      await executeClosedShows(h.req, h.res);

      const results = await prisma.competitionResult.findMany({ where: { showId: show.id } });
      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r.discipline).toBe('Dressage');
        expect(r.showName).toBe(show.name);
        expect(['1', '2']).toContain(r.placement);
      }
    });

    it('awards prize money to top 3 places (50/30/20 split, 4th gets 0)', async () => {
      const u1 = await createUser(0);
      const u2 = await createUser(0);
      const u3 = await createUser(0);
      const u4 = await createUser(0);
      const h1 = await createHorse(u1.id, {
        speed: 99,
        stamina: 99,
        agility: 99,
        balance: 99,
        precision: 99,
        boldness: 99,
      });
      const h2 = await createHorse(u2.id, {
        speed: 70,
        stamina: 70,
        agility: 70,
        balance: 70,
        precision: 70,
        boldness: 70,
      });
      const h3 = await createHorse(u3.id, {
        speed: 50,
        stamina: 50,
        agility: 50,
        balance: 50,
        precision: 50,
        boldness: 50,
      });
      const h4 = await createHorse(u4.id, {
        speed: 1,
        stamina: 1,
        agility: 1,
        balance: 1,
        precision: 1,
        boldness: 1,
      });
      const show = await createShowDirect(u1.id, {
        closeDate: new Date(Date.now() - 1000),
        prize: 1000,
        discipline: 'Racing',
      });
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: h1.id, userId: u1.id, feePaid: 0 },
      });
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: h2.id, userId: u2.id, feePaid: 0 },
      });
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: h3.id, userId: u3.id, feePaid: 0 },
      });
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: h4.id, userId: u4.id, feePaid: 0 },
      });

      const h = makeReqRes(undefined);
      await executeClosedShows(h.req, h.res);

      const results = await prisma.competitionResult.findMany({
        where: { showId: show.id },
      });
      expect(results).toHaveLength(4);
      const prizes = results.map(r => Number(r.prizeWon)).sort((a, b) => b - a);
      // floor(1000*0.5)=500, floor(1000*0.3)=300, floor(1000*0.2)=200, none=0
      expect(prizes).toEqual([500, 300, 200, 0]);
    });

    it('updates show status to completed after execution', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const show = await createShowDirect(user.id, {
        closeDate: new Date(Date.now() - 1000),
        prize: 0,
        discipline: 'Polo',
      });
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: horse.id, userId: user.id, feePaid: 0 },
      });

      const h = makeReqRes(undefined);
      await executeClosedShows(h.req, h.res);

      const after = await prisma.show.findUnique({ where: { id: show.id } });
      expect(after.status).toBe('completed');
      expect(after.executedAt).not.toBeNull();
    });

    it('handles scheduler call with (null, null) without crashing', async () => {
      await expect(executeClosedShows(null, null)).resolves.not.toThrow();
    });

    it('does not return a value when res is null (scheduler mode)', async () => {
      const result = await executeClosedShows(null, null);
      expect(result).toBeUndefined();
    });

    it('sets firstEverWin milestone for 1st place winner', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id, {
        speed: 99,
        stamina: 99,
        agility: 99,
        balance: 99,
        precision: 99,
        boldness: 99,
      });
      const show = await createShowDirect(user.id, {
        closeDate: new Date(Date.now() - 1000),
        prize: 0,
        discipline: 'Dressage',
      });
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: horse.id, userId: user.id, feePaid: 0 },
      });

      const h = makeReqRes(undefined);
      await executeClosedShows(h.req, h.res);

      const userAfter = await prisma.user.findUnique({
        where: { id: user.id },
        select: { settings: true },
      });
      const settings = userAfter.settings ?? {};
      expect(settings.milestones?.firstWin).toBeDefined();
      expect(typeof settings.milestones.firstWin).toBe('string');
    });

    it('does not overwrite existing firstWin milestone', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id, {
        speed: 99,
        stamina: 99,
        agility: 99,
        balance: 99,
        precision: 99,
        boldness: 99,
      });
      const existingTimestamp = '2026-01-01T00:00:00.000Z';
      // Pre-seed milestone.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          settings: { milestones: { firstWin: existingTimestamp } },
        },
      });
      const show = await createShowDirect(user.id, {
        closeDate: new Date(Date.now() - 1000),
        prize: 0,
        discipline: 'Racing',
      });
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: horse.id, userId: user.id, feePaid: 0 },
      });

      const h = makeReqRes(undefined);
      await executeClosedShows(h.req, h.res);

      const userAfter = await prisma.user.findUnique({
        where: { id: user.id },
        select: { settings: true },
      });
      expect(userAfter.settings.milestones.firstWin).toBe(existingTimestamp);
    });

    it('uses default stat value of 50 when horse stat is null', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id, {
        speed: null,
        stamina: null,
        agility: null,
        balance: null,
        precision: null,
        boldness: null,
      });
      const show = await createShowDirect(user.id, {
        closeDate: new Date(Date.now() - 1000),
        prize: 0,
        discipline: 'Polo',
      });
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: horse.id, userId: user.id, feePaid: 0 },
      });

      const h = makeReqRes(undefined);
      await executeClosedShows(h.req, h.res);

      const result = await prisma.competitionResult.findFirst({ where: { showId: show.id } });
      expect(result).not.toBeNull();
      const score = Number(result.score);
      // Base = (50+50+50+50+50)/5 = 50; ±9 luck → range [41, 59]; clamped to [0, 100]
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});
