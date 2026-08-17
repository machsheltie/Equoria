/**
 * communityHubStats.integration.test.mjs (Equoria-r4cyk)
 *
 * Real-DB integration coverage for the two community-hub aggregate endpoints
 * that replace the hub's fabricated stub stats:
 *
 *   GET /api/v1/messages/conversations-count
 *     → { success, data: { count } } — distinct correspondents (either
 *       direction, deduplicated across directions).
 *
 *   GET /api/v1/clubs/elections/open-count
 *     → { success, data: { count } } — elections currently OPEN (not manually
 *       closed, startsAt <= now < endsAt) across clubs the caller belongs to.
 *
 * Both endpoints are scoped to the authenticated caller, so exact-equality
 * assertions are safe against the canonical DB: the caller is a fresh fixture
 * user, and no pre-existing row can reference them (CLAUDE.md §2 — fixtures
 * coexist with real game state).
 *
 * Real DB, real Express app via supertest — no mocks, no bypass headers.
 * Scoped fixtures, id-scoped fail-loud cleanup (Equoria-0y9f5).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

const DAY_MS = 24 * 60 * 60 * 1000;

const cleanup = createCleanupTracker();

let userA; // the caller under test — has messages + one club with elections
let userB; // correspondent (both directions) + club president
let userC; // correspondent (outbound only) + other-club president
let userD; // zero-state caller — no messages, no clubs
let tokenA;
let tokenD;
let clubMine; // userA is a member
let clubOther; // userA is NOT a member — its open election must not count

const userIds = [];
const clubIds = [];

async function createFixtureUser(tag) {
  const hex = randomBytes(6).toString('hex');
  const user = await prisma.user.create({
    data: {
      email: `hubstats-${tag}-${hex}@test.com`,
      username: `hubstats${tag}${hex}`,
      password: 'irrelevant-hash',
      firstName: 'HubStats',
      lastName: tag,
      money: 1000,
    },
  });
  userIds.push(user.id);
  return user;
}

beforeAll(async () => {
  userA = await createFixtureUser('A');
  userB = await createFixtureUser('B');
  userC = await createFixtureUser('C');
  userD = await createFixtureUser('D');
  tokenA = generateTestToken({ id: userA.id, email: userA.email, role: 'user' });
  tokenD = generateTestToken({ id: userD.id, email: userD.email, role: 'user' });

  // ── Messages: A's distinct correspondents must resolve to exactly {B, C}.
  //    B→A twice (same-sender dedupe), A→B once (cross-direction dedupe),
  //    A→C once (outbound-only correspondent).
  const msg = (senderId, recipientId, subject) =>
    prisma.directMessage.create({
      data: { senderId, recipientId, subject, content: `TestFixture-hubstats ${subject}` },
    });
  await msg(userB.id, userA.id, 'TestFixture-hubstats b-to-a 1');
  await msg(userB.id, userA.id, 'TestFixture-hubstats b-to-a 2');
  await msg(userA.id, userB.id, 'TestFixture-hubstats a-to-b');
  await msg(userA.id, userC.id, 'TestFixture-hubstats a-to-c');

  // ── Clubs + elections.
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  clubMine = await prisma.club.create({
    data: {
      name: `TestFixture-HubStats-Mine-${stamp}`,
      type: 'discipline',
      category: 'Dressage',
      description: 'Hub stats fixture club (caller is a member)',
      leaderId: userB.id,
    },
  });
  clubOther = await prisma.club.create({
    data: {
      name: `TestFixture-HubStats-Other-${stamp}`,
      type: 'breed',
      category: 'Thoroughbred',
      description: 'Hub stats fixture club (caller is NOT a member)',
      leaderId: userC.id,
    },
  });
  clubIds.push(clubMine.id, clubOther.id);

  await prisma.clubMembership.createMany({
    data: [
      { clubId: clubMine.id, userId: userB.id, role: 'president' },
      { clubId: clubMine.id, userId: userA.id, role: 'member' },
      { clubId: clubOther.id, userId: userC.id, role: 'president' },
    ],
  });

  const now = Date.now();
  await prisma.clubElection.createMany({
    data: [
      // OPEN — the only one that must count for userA.
      {
        clubId: clubMine.id,
        position: 'TestFixture-hubstats-open',
        status: 'open',
        startsAt: new Date(now - DAY_MS),
        endsAt: new Date(now + DAY_MS),
      },
      // Upcoming — startsAt in the future → not counted.
      {
        clubId: clubMine.id,
        position: 'TestFixture-hubstats-upcoming',
        status: 'upcoming',
        startsAt: new Date(now + DAY_MS),
        endsAt: new Date(now + 2 * DAY_MS),
      },
      // Manually closed despite open dates → not counted (mirrors
      // resolveElectionStatus: manual close always wins).
      {
        clubId: clubMine.id,
        position: 'TestFixture-hubstats-manually-closed',
        status: 'closed',
        startsAt: new Date(now - DAY_MS),
        endsAt: new Date(now + DAY_MS),
      },
      // Date-expired but status column still 'open' (stale row) → not counted
      // (mirrors resolveElectionStatus: endsAt <= now is closed).
      {
        clubId: clubMine.id,
        position: 'TestFixture-hubstats-date-expired',
        status: 'open',
        startsAt: new Date(now - 3 * DAY_MS),
        endsAt: new Date(now - DAY_MS),
      },
      // Open election in a club the caller does NOT belong to → not counted.
      {
        clubId: clubOther.id,
        position: 'TestFixture-hubstats-other-club-open',
        status: 'open',
        startsAt: new Date(now - DAY_MS),
        endsAt: new Date(now + DAY_MS),
      },
    ],
  });

  // Scoped, fail-loud cleanup. FK order: elections → memberships → clubs,
  // then messages (scoped to fixture users), then the users themselves.
  cleanup.add(() => prisma.clubElection.deleteMany({ where: { clubId: { in: clubIds } } }), 'clubElection');
  cleanup.add(() => prisma.clubMembership.deleteMany({ where: { clubId: { in: clubIds } } }), 'clubMembership');
  cleanup.add(() => prisma.club.deleteMany({ where: { id: { in: clubIds } } }), 'club');
  cleanup.add(
    () =>
      prisma.directMessage.deleteMany({
        where: {
          OR: [{ senderId: { in: userIds } }, { recipientId: { in: userIds } }],
        },
      }),
    'directMessage',
  );
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/messages/conversations-count ───────────────────────────────

describe('GET /api/v1/messages/conversations-count', () => {
  it('returns the distinct-correspondent count, deduplicated across directions', async () => {
    const res = await request(app)
      .get('/api/v1/messages/conversations-count')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // B (2 inbound + 1 outbound = one conversation) + C (1 outbound) = 2.
    expect(res.body.data.count).toBe(2);
  });

  it('returns 0 for a user with no messages', async () => {
    const res = await request(app)
      .get('/api/v1/messages/conversations-count')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${tokenD}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });

  it('is NOT swallowed by the /:id catch-all (route-ordering lock-in)', async () => {
    // If /:id were registered first, 'conversations-count' would parse as an
    // invalid message id and return 400 'Invalid message ID'.
    const res = await request(app)
      .get('/api/v1/messages/conversations-count')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.message).not.toBe('Invalid message ID');
    expect(typeof res.body.data.count).toBe('number');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/messages/conversations-count').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/clubs/elections/open-count ─────────────────────────────────

describe('GET /api/v1/clubs/elections/open-count', () => {
  it('counts only genuinely-open elections in clubs the caller belongs to', async () => {
    const res = await request(app)
      .get('/api/v1/clubs/elections/open-count')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Of the 5 fixture elections, exactly 1 is open AND in userA's club:
    // upcoming, manually-closed, date-expired, and other-club-open are all
    // excluded.
    expect(res.body.data.count).toBe(1);
  });

  it('returns 0 for a user with no club memberships', async () => {
    const res = await request(app)
      .get('/api/v1/clubs/elections/open-count')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${tokenD}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/clubs/elections/open-count').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
