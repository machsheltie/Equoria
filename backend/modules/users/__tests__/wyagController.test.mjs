/**
 * wyagController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getWhileYouWereGone.
 * Route lives under authRouter at /api/v1/while-you-were-gone (authRouter is
 * mounted at /api/v1 only — Equoria-myfc5).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `wyag-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `wyag${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Wyag',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  // Scoped, fail-loud cleanup (Equoria-cu3t5) — replaces a swallowed cleanup
  // catch. FK order (Equoria-myfc5): delete any horses owned by this fixture
  // user BEFORE the user row, because Horse.userId is onDelete:Restrict
  // (schema:282) — a user delete would P2003 if a horse referenced it.
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/while-you-were-gone ──────────────────────────────────────────

describe('GET /api/v1/while-you-were-gone', () => {
  it('returns 200 with items and since timestamp', async () => {
    const res = await request(app)
      .get('/api/v1/while-you-were-gone')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.since).toBeDefined();
  });

  it('returns 200 with a valid since query param', async () => {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .get(`/api/v1/while-you-were-gone?since=${since}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.since).toBeDefined();
  });

  it('returns 400 for an invalid since timestamp', async () => {
    const res = await request(app)
      .get('/api/v1/while-you-were-gone?since=not-a-date')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/while-you-were-gone').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── Six event-type aggregation (Equoria-oey96.29) ────────────────────────────
//
// Story 24.1 (docs/epics.md:788-804) specifies SIX event types. The controller
// originally aggregated only three (competition-result, foal-milestone,
// message). These arms prove the three previously-missing types —
// club-activity (priority 4), training-complete (priority 5), market-sale
// (priority 6) — are now sourced from REAL persisted rows (no fabrication),
// respect the `since` lookback window (same clock source as existing blocks),
// and slot into the correct priority ordering across all six.

function hoursAgo(n) {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

describe('GET /api/v1/while-you-were-gone — six event-type aggregation (Equoria-oey96.29)', () => {
  const cleanup6 = createCleanupTracker();
  const horseIds = [];
  const saleIds = [];
  const messageIds = [];
  let player;
  let playerToken;
  let otherUser;
  let club;
  let show;
  let concludedElection;
  let inWindowSaleId;
  let outOfWindowSaleId;

  // `since` used by the "appears" + priority arms. In-window fixtures are stamped
  // at hoursAgo(1); out-of-window fixtures at hoursAgo(10).
  const SINCE = hoursAgo(2).toISOString();

  beforeAll(async () => {
    const hex = () => randomBytes(4).toString('hex');

    player = await prisma.user.create({
      data: {
        email: `wyag6-player-${hex()}-${hex()}@test.com`,
        username: `wyag6p${hex()}${hex()}`,
        password: 'irrelevant-hash',
        firstName: 'Wyag6',
        lastName: 'Player',
        money: 5000,
      },
    });
    otherUser = await prisma.user.create({
      data: {
        email: `wyag6-other-${hex()}-${hex()}@test.com`,
        username: `wyag6o${hex()}${hex()}`,
        password: 'irrelevant-hash',
        firstName: 'Wyag6',
        lastName: 'Other',
        money: 5000,
      },
    });
    playerToken = generateTestToken({ id: player.id, email: player.email, role: 'user' });

    // ── Priority 1: competition-result (real CompetitionResult in window) ──
    show = await prisma.show.create({
      data: {
        name: `TestFixture-WYAG6-Show-${hex()}`,
        discipline: 'Dressage',
        levelMin: 1,
        levelMax: 10,
        entryFee: 100,
        prize: 500,
        runDate: hoursAgo(1),
      },
    });
    const compHorse = await createTestHorse(
      prisma,
      { name: `TestFixture-WYAG6-Comp-${hex()}`, sex: 'Mare', dateOfBirth: hoursAgo(24 * 365 * 4), userId: player.id },
      horseIds,
    );
    await prisma.competitionResult.create({
      data: {
        score: 88.5,
        placement: '1st',
        discipline: 'Dressage',
        runDate: hoursAgo(1),
        showName: show.name,
        prizeWon: 500,
        horseId: compHorse.id,
        showId: show.id,
        createdAt: hoursAgo(1),
      },
    });

    // ── Priority 2: foal-milestone (real FoalDevelopment in window) ──
    const foalHorse = await createTestHorse(
      prisma,
      { name: `TestFixture-WYAG6-Foal-${hex()}`, sex: 'Colt', dateOfBirth: hoursAgo(24 * 10), userId: player.id },
      horseIds,
    );
    await prisma.foalDevelopment.create({
      data: {
        foalId: foalHorse.id,
        bondScore: 42,
        isActive: true,
        lastInteractionAt: hoursAgo(1),
      },
    });

    // ── Priority 3: message (real unread DirectMessage in window) ──
    const msg = await prisma.directMessage.create({
      data: {
        senderId: otherUser.id,
        recipientId: player.id,
        subject: 'Hello',
        content: 'A message that arrived while you were gone.',
        isRead: false,
        createdAt: hoursAgo(1),
      },
    });
    messageIds.push(msg.id);

    // ── Priority 4: club-activity (real new member + concluded election) ──
    club = await prisma.club.create({
      data: {
        name: `TestFixture-WYAG6-Club-${hex()}`,
        type: 'discipline',
        category: 'Dressage',
        description: 'A test club',
        leaderId: player.id,
      },
    });
    // player is a member (president); their own join predates the window and is
    // excluded by the userId!=player filter regardless.
    await prisma.clubMembership.create({
      data: { clubId: club.id, userId: player.id, role: 'president', joinedAt: hoursAgo(72) },
    });
    // NEW member joins the player's club within the window → club-activity.
    await prisma.clubMembership.create({
      data: { clubId: club.id, userId: otherUser.id, role: 'member', joinedAt: hoursAgo(1) },
    });
    // Election that CONCLUDED (endsAt) within the window → club-activity.
    concludedElection = await prisma.clubElection.create({
      data: {
        clubId: club.id,
        position: 'President',
        status: 'closed',
        startsAt: hoursAgo(8),
        endsAt: hoursAgo(1),
      },
    });

    // ── Priority 5: training-complete (cooldown EXPIRED within window) ──
    // trainingCooldown is the timestamp the cooldown ENDS. A value inside
    // [since, now] means the horse became ready to train while the player was
    // away (NOT "training happened" — a freshly-trained horse has a FUTURE
    // cooldown and must NOT appear).
    await createTestHorse(
      prisma,
      {
        name: `TestFixture-WYAG6-Train-${hex()}`,
        sex: 'Stallion',
        dateOfBirth: hoursAgo(24 * 365 * 5),
        userId: player.id,
        trainingCooldown: hoursAgo(1),
      },
      horseIds,
    );
    // Negative control: a horse still ON cooldown (future) must NOT appear.
    await createTestHorse(
      prisma,
      {
        name: `TestFixture-WYAG6-OnCooldown-${hex()}`,
        sex: 'Stallion',
        dateOfBirth: hoursAgo(24 * 365 * 5),
        userId: player.id,
        trainingCooldown: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      },
      horseIds,
    );

    // ── Priority 6: market-sale (real HorseSale, seller=player, in window) ──
    const soldHorse = await createTestHorse(
      prisma,
      {
        name: `TestFixture-WYAG6-Sold-${hex()}`,
        sex: 'Mare',
        dateOfBirth: hoursAgo(24 * 365 * 6),
        userId: otherUser.id,
      },
      horseIds,
    );
    const inSale = await prisma.horseSale.create({
      data: {
        horseId: soldHorse.id,
        sellerId: player.id,
        buyerId: otherUser.id,
        salePrice: 1200,
        horseName: soldHorse.name,
        soldAt: hoursAgo(1),
      },
    });
    inWindowSaleId = inSale.id;
    saleIds.push(inSale.id);

    // Out-of-window sale (soldAt before SINCE) → must be excluded.
    const oldSoldHorse = await createTestHorse(
      prisma,
      {
        name: `TestFixture-WYAG6-OldSold-${hex()}`,
        sex: 'Mare',
        dateOfBirth: hoursAgo(24 * 365 * 6),
        userId: otherUser.id,
      },
      horseIds,
    );
    const outSale = await prisma.horseSale.create({
      data: {
        horseId: oldSoldHorse.id,
        sellerId: player.id,
        buyerId: otherUser.id,
        salePrice: 800,
        horseName: oldSoldHorse.name,
        soldAt: hoursAgo(10),
      },
    });
    outOfWindowSaleId = outSale.id;
    saleIds.push(outSale.id);

    // FK-ordered, scoped cleanup (Equoria-myfc5 / CLAUDE.md §2). HorseSale is a
    // RESTRICT relation on horse — delete sales BEFORE horses.
    cleanup6.add(() => prisma.directMessage.deleteMany({ where: { id: { in: messageIds } } }), 'directMessages');
    cleanup6.add(() => prisma.clubElection.deleteMany({ where: { clubId: club.id } }), 'clubElections');
    cleanup6.add(() => prisma.clubMembership.deleteMany({ where: { clubId: club.id } }), 'clubMemberships');
    cleanup6.add(() => prisma.club.deleteMany({ where: { id: club.id } }), 'club');
    cleanup6.add(() => prisma.horseSale.deleteMany({ where: { id: { in: saleIds } } }), 'horseSales');
    cleanup6.add(
      () => prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } }),
      'competitionResults',
    );
    cleanup6.add(() => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: horseIds } } }), 'foalDevelopment');
    cleanup6.add(() => prisma.show.deleteMany({ where: { id: show.id } }), 'show');
    cleanup6.add(() => cleanupTestHorses(prisma, horseIds), 'horses');
    cleanup6.add(() => prisma.user.deleteMany({ where: { id: { in: [player.id, otherUser.id] } } }), 'users');
  }, 60000);

  afterAll(() => cleanup6.run(), 60000);

  async function fetchItems(since = SINCE) {
    const res = await request(app)
      .get(`/api/v1/while-you-were-gone?since=${encodeURIComponent(since)}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${playerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    return res.body.data.items;
  }

  it('club-activity: emits a real new-member event with correct type/priority/timestamp', async () => {
    const items = await fetchItems();
    const clubItems = items.filter(i => i.type === 'club-activity');
    expect(clubItems.length).toBeGreaterThanOrEqual(1);
    for (const it of clubItems) {
      expect(it.priority).toBe(4);
      expect(new Date(it.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(SINCE).getTime());
    }
    // New member (otherUser) joined the player's club within the window.
    const memberEvent = clubItems.find(i => i.title.includes(otherUser.username));
    expect(memberEvent).toBeDefined();
  });

  it('club-activity: emits a real concluded-election event', async () => {
    const items = await fetchItems();
    const clubItems = items.filter(i => i.type === 'club-activity');
    const electionEvent = clubItems.find(i => i.metadata && i.metadata.electionId === concludedElection.id);
    expect(electionEvent).toBeDefined();
    expect(electionEvent.priority).toBe(4);
  });

  it('training-complete: emits a real cooldown-expired event (not on-cooldown horses)', async () => {
    const items = await fetchItems();
    const trainItems = items.filter(i => i.type === 'training-complete');
    expect(trainItems.length).toBeGreaterThanOrEqual(1);
    for (const it of trainItems) {
      expect(it.priority).toBe(5);
      // Cooldown timestamp must be within the window (expired while away).
      expect(new Date(it.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(SINCE).getTime());
      expect(new Date(it.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
      // The still-on-cooldown horse must NOT appear.
      expect(it.title).not.toContain('OnCooldown');
    }
  });

  it('market-sale: emits a real HorseSale event with the correct sale price', async () => {
    const items = await fetchItems();
    const saleItems = items.filter(i => i.type === 'market-sale');
    expect(saleItems.length).toBeGreaterThanOrEqual(1);
    const inWindow = saleItems.find(i => i.metadata && i.metadata.saleId === inWindowSaleId);
    expect(inWindow).toBeDefined();
    expect(inWindow.priority).toBe(6);
    expect(inWindow.title).toContain('1200');
  });

  it('window-exclusion: a market-sale sold BEFORE `since` is excluded', async () => {
    const items = await fetchItems();
    const saleItems = items.filter(i => i.type === 'market-sale');
    const excluded = saleItems.find(i => i.metadata && i.metadata.saleId === outOfWindowSaleId);
    expect(excluded).toBeUndefined();
  });

  it('priority ordering: all six event types present and sorted ascending by priority', async () => {
    const items = await fetchItems();
    const typesPresent = new Set(items.map(i => i.type));
    for (const t of [
      'competition-result',
      'foal-milestone',
      'message',
      'club-activity',
      'training-complete',
      'market-sale',
    ]) {
      expect(typesPresent.has(t)).toBe(true);
    }
    // priorities must be non-decreasing (controller sorts by priority asc).
    const priorities = items.map(i => i.priority);
    for (let i = 1; i < priorities.length; i += 1) {
      expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]);
    }
    // canonical priority per type.
    const byType = Object.fromEntries(items.map(i => [i.type, i.priority]));
    expect(byType['competition-result']).toBe(1);
    expect(byType['foal-milestone']).toBe(2);
    expect(byType['message']).toBe(3);
    expect(byType['club-activity']).toBe(4);
    expect(byType['training-complete']).toBe(5);
    expect(byType['market-sale']).toBe(6);
  });
});
