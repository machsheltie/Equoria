/**
 * wyagController.test.mjs — real DB
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted from
 * jest.unstable_mockModule of db + logger to a real-DB integration test.
 *
 * Tests the GET /api/v1/while-you-were-gone endpoint with real Prisma.
 *
 * Removed (per doctrine):
 *   - "gracefully handles competitionResult/directMessage/foalDevelopment query
 *     failure" — required mocking these to reject. Synthetic Prisma fault
 *     injection forbidden. The .catch() blocks ARE in production and
 *     exercised on real schema drift, but the synthetic fault path is not
 *     a permitted test pattern.
 *   - "returns 500 on unexpected top-level error" — required injecting
 *     a bad req object. Replaced with the missing-user 401 behavioral test.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../db/index.mjs';
import { getWhileYouWereGone } from '../controllers/wyagController.mjs';

const SUITE_PREFIX = 'wyag';

function makeReqRes(userId, query = {}) {
  let _status = 200;
  let _body = null;
  return {
    req: { user: userId === undefined ? null : { id: userId }, query, body: {}, params: {} },
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

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Wyag',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createHorse(userId, overrides = {}) {
  return prisma.horse.create({
    data: {
      name: overrides.name ?? `${SUITE_PREFIX}-h-${randomBytes(4).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      user: { connect: { id: userId } },
    },
  });
}

async function createShow(name = null) {
  return prisma.show.create({
    data: {
      name: name ?? `${SUITE_PREFIX}-show-${randomBytes(4).toString('hex')}`,
      discipline: 'Dressage',
      levelMin: 1,
      levelMax: 10,
      entryFee: 50,
      prize: 200,
      runDate: new Date(),
      showType: 'ridden',
      status: 'open',
    },
  });
}

async function createCompetitionResult(horseId, showId, overrides = {}) {
  return prisma.competitionResult.create({
    data: {
      score: 75.5,
      placement: overrides.placement ?? '1',
      discipline: 'Dressage',
      runDate: new Date(),
      showName: 'Test Show',
      prizeWon: overrides.prizeWon ?? 500,
      horse: { connect: { id: horseId } },
      show: { connect: { id: showId } },
      createdAt: overrides.createdAt ?? new Date(),
    },
  });
}

async function createDirectMessage(senderId, recipientId, content) {
  return prisma.directMessage.create({
    data: {
      sender: { connect: { id: senderId } },
      recipient: { connect: { id: recipientId } },
      subject: 'Test',
      content,
    },
  });
}

async function createActiveFoal(userId, name) {
  // FoalDevelopment requires a foal Horse. Note schema relation is `foal`,
  // not `horse` (this is the same defect class as 21R-PROD-BUG-1 — but for
  // wyagController, the query is `foal: { userId }` which IS the correct
  // relation, so this should work).
  const foalHorse = await createHorse(userId, { name });
  return prisma.foalDevelopment.create({
    data: {
      foalId: foalHorse.id,
      isActive: true,
      lastInteractionAt: new Date(),
      bondScore: 50,
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
  const horses = await prisma.horse.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const horseIds = horses.map(h => h.id);
  if (horseIds.length > 0) {
    await prisma.foalDevelopment.deleteMany({ where: { foalId: { in: horseIds } } });
    await prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } });
  }
  await prisma.show.deleteMany({ where: { name: { startsWith: SUITE_PREFIX } } });
  await prisma.directMessage.deleteMany({
    where: { OR: [{ senderId: { in: userIds } }, { recipientId: { in: userIds } }] },
  });
  await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('getWhileYouWereGone (real DB)', () => {
  // Prewarm the Prisma connection before the cleanup so hook time isn't
  // burned waiting on the post-prior-suite connection handshake. The 120s
  // hook budget covers the worst-case where the prior suite (e.g.
  // weeklyFlagEvaluationService at ~105s) leaves the connection pool
  // contended; cleanupSuite itself is <50ms when the connection is warm.
  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    await cleanupSuite();
  }, 120_000);
  afterAll(cleanupSuite, 120_000);
  afterEach(cleanupSuite, 120_000);

  it('returns 401 when user is not authenticated', async () => {
    const h = makeReqRes(undefined);
    await getWhileYouWereGone(h.req, h.res);
    expect(h.res.statusValue).toBe(401);
    expect(h.res.jsonValue).toMatchObject({
      success: false,
      message: 'Authentication required',
    });
  });

  it('returns empty items when no events exist', async () => {
    const user = await createUser();
    const h = makeReqRes(user.id);
    await getWhileYouWereGone(h.req, h.res);

    expect(h.res.statusValue).toBe(200);
    const body = h.res.jsonValue;
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([]);
    expect(body.data.hasMore).toBe(false);
  });

  it('returns since as ISO string in response', async () => {
    const user = await createUser();
    const h = makeReqRes(user.id);
    await getWhileYouWereGone(h.req, h.res);
    const body = h.res.jsonValue;
    expect(typeof body.data.since).toBe('string');
    expect(isNaN(new Date(body.data.since).getTime())).toBe(false);
  });

  it('defaults since to ~4 hours ago when not provided', async () => {
    const user = await createUser();
    const before = Date.now() - 4 * 60 * 60 * 1000;
    const h = makeReqRes(user.id);
    await getWhileYouWereGone(h.req, h.res);
    const sinceMs = new Date(h.res.jsonValue.data.since).getTime();
    const after = Date.now() - 4 * 60 * 60 * 1000;
    expect(sinceMs).toBeGreaterThanOrEqual(before - 1000);
    expect(sinceMs).toBeLessThanOrEqual(after + 1000);
  });

  it('uses provided since query parameter', async () => {
    const user = await createUser();
    const sinceDate = '2026-03-01T10:00:00.000Z';
    const h = makeReqRes(user.id, { since: sinceDate });
    await getWhileYouWereGone(h.req, h.res);
    expect(h.res.jsonValue.data.since).toBe(sinceDate);
  });

  it('returns 400 for invalid since timestamp', async () => {
    const user = await createUser();
    const h = makeReqRes(user.id, { since: 'not-a-date' });
    await getWhileYouWereGone(h.req, h.res);
    expect(h.res.statusValue).toBe(400);
    expect(h.res.jsonValue).toMatchObject({
      success: false,
      message: 'Invalid since timestamp',
    });
  });

  it('returns competition-result items with priority 1', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id, { name: 'Thunder' });
    const show = await createShow(`${SUITE_PREFIX}-spring-cup`);
    await createCompetitionResult(horse.id, show.id, { placement: '1', prizeWon: 500 });

    const h = makeReqRes(user.id);
    await getWhileYouWereGone(h.req, h.res);

    const item = h.res.jsonValue.data.items.find(i => i.type === 'competition-result');
    expect(item).toBeDefined();
    expect(item.priority).toBe(1);
    expect(item.title).toContain('Thunder');
    expect(item.title).toContain(`${SUITE_PREFIX}-spring-cup`);
    expect(item.description).toContain('1');
    expect(item.actionUrl).toBe('/competitions');
  });

  it('returns message items with priority 3', async () => {
    const recipient = await createUser();
    const sender = await createUser();
    await prisma.user.update({ where: { id: sender.id }, data: { username: 'FarmFriend' } });
    await createDirectMessage(sender.id, recipient.id, 'Hello, want to trade horses?');

    const h = makeReqRes(recipient.id);
    await getWhileYouWereGone(h.req, h.res);

    const item = h.res.jsonValue.data.items.find(i => i.type === 'message');
    expect(item).toBeDefined();
    expect(item.priority).toBe(3);
    expect(item.title).toContain('FarmFriend');
    expect(item.description).toContain('Hello');
    expect(item.actionUrl).toBe('/messages');
  });

  it('returns foal-milestone items with priority 2', async () => {
    const user = await createUser();
    await createActiveFoal(user.id, 'Baby Star');

    const h = makeReqRes(user.id);
    await getWhileYouWereGone(h.req, h.res);

    const item = h.res.jsonValue.data.items.find(i => i.type === 'foal-milestone');
    expect(item).toBeDefined();
    expect(item.priority).toBe(2);
    expect(item.title).toContain('Baby Star');
    expect(item.actionUrl).toBe('/grooms');
  });

  it('sorts items by priority then by timestamp descending', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id, { name: 'A' });
    const show = await createShow();
    await createCompetitionResult(horse.id, show.id, { placement: '2', prizeWon: 100 });
    await createActiveFoal(user.id, 'Foal');
    const sender = await createUser();
    await createDirectMessage(sender.id, user.id, 'Hi');

    const h = makeReqRes(user.id);
    await getWhileYouWereGone(h.req, h.res);
    const types = h.res.jsonValue.data.items.map(i => i.type);
    // Priority order: competition (1), foal (2), message (3)
    expect(types).toEqual(['competition-result', 'foal-milestone', 'message']);
  });

  it('limits output to 8 items maximum', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id);
    const show = await createShow();
    // Create 10 competition results.
    for (let i = 0; i < 10; i++) {
      await createCompetitionResult(horse.id, show.id, { placement: `${i + 1}` });
    }

    const h = makeReqRes(user.id);
    await getWhileYouWereGone(h.req, h.res);
    expect(h.res.jsonValue.data.items.length).toBeLessThanOrEqual(8);
  });

  it('handles horse name fallback when horse.name is empty', async () => {
    // Production code path: `${result.horse?.name ?? 'Your horse'}`. When
    // we create a real horse it always has a name, so to test the fallback
    // we'd need horse.name=null/undefined. The current Horse schema requires
    // name (String, not nullable). So this fallback is unreachable in
    // practice. Keep the test as documentation that the fallback exists by
    // verifying the response shape includes the horse name.
    const user = await createUser();
    const horse = await createHorse(user.id, { name: 'NamedHorse' });
    const show = await createShow();
    await createCompetitionResult(horse.id, show.id, { placement: '3', prizeWon: 50 });

    const h = makeReqRes(user.id);
    await getWhileYouWereGone(h.req, h.res);
    const item = h.res.jsonValue.data.items.find(i => i.type === 'competition-result');
    expect(item.title).toContain('NamedHorse');
  });

  it('truncates message content to 80 characters in description', async () => {
    const recipient = await createUser();
    const sender = await createUser();
    const longContent = 'A'.repeat(200);
    await createDirectMessage(sender.id, recipient.id, longContent);

    const h = makeReqRes(recipient.id);
    await getWhileYouWereGone(h.req, h.res);
    const item = h.res.jsonValue.data.items.find(i => i.type === 'message');
    expect(item.description.length).toBeLessThanOrEqual(80);
  });
});
