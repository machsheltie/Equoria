/**
 * userController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getUser, getUserProgressAPI, getUserCompetitionStats,
 * getGameNotifications, markGameNotificationsRead, getCommunityActivity.
 * All routes live under authRouter → real auth + real CSRF for PATCH.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;

// Fail-loud, scoped cleanup tracker (Equoria-cu3t5) for the top-level fixture
// (`user`) plus the transient per-test fixtures various `it` blocks create.
// Tests push transient ids into these accumulators instead of doing a swallowed
// try/finally cleanup catch; the suite afterAll deletes them
// by id and fails loudly if any delete throws.
const cleanup = createCleanupTracker();
const transientUserIds = [];
const transientXpEventIds = [];
const transientNotificationIds = [];

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `uc-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `uc${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'UC',
      lastName: 'Tester',
      money: 1000,
      settings: {},
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  // FK order: child rows (notifications, xpEvents) before the users that own
  // them. Transient users created by the 403 / delete tests are independent of
  // `user`, so their order relative to `user` is irrelevant.
  cleanup.add(
    () => prisma.notification.deleteMany({ where: { id: { in: transientNotificationIds } } }),
    'transient notifications',
  );
  cleanup.add(() => prisma.xpEvent.deleteMany({ where: { id: { in: transientXpEventIds } } }), 'transient xpEvents');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: transientUserIds } } }), 'transient users');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/users/community/activity ───────────────────────────────────────

describe('GET /api/v1/users/community/activity', () => {
  it('returns 200 with activity array', async () => {
    const res = await request(app)
      .get('/api/v1/users/community/activity')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/users/community/activity').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/users/me/game-notifications ─────────────────────────────────────

describe('GET /api/v1/users/me/game-notifications', () => {
  it('returns 200 with empty notifications for new user', async () => {
    const res = await request(app)
      .get('/api/v1/users/me/game-notifications')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('notifications');
    expect(Array.isArray(res.body.data.notifications)).toBe(true);
    expect(res.body.data).toHaveProperty('unreadCount');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/users/me/game-notifications').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/v1/users/me/game-notifications/read-all ─────────────────────────

describe('PATCH /api/v1/users/me/game-notifications/read-all', () => {
  it('returns 200 and marks notifications as read', async () => {
    // Seed a real Notification row (not JSONB) so the handler has something to mark
    const seeded = await prisma.notification.create({
      data: { userId: user.id, type: 'stat_gain', payload: { message: 'test' }, isRead: false },
    });
    // Tracked for scoped, fail-loud cleanup in afterAll (Equoria-cu3t5).
    transientNotificationIds.push(seeded.id);

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .patch('/api/v1/users/me/game-notifications/read-all')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify the row was actually marked read in the DB
    const updated = await prisma.notification.findUnique({ where: { id: seeded.id } });
    expect(updated.isRead).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .patch('/api/v1/users/me/game-notifications/read-all')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/users/:id ───────────────────────────────────────────────────────

describe('GET /api/v1/users/:id', () => {
  it('returns 200 with user data for self', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data).toHaveProperty('currentHorses');
    expect(res.body.data).toHaveProperty('stableLimit');
  });

  it('returns 403 when accessing another user', async () => {
    const other = await prisma.user.create({
      data: {
        email: `uc-other-${Date.now()}@test.com`,
        username: `ucother${Date.now()}`,
        password: 'hash',
        firstName: 'Other',
        lastName: 'User',
        money: 0,
      },
    });
    // Tracked for scoped, fail-loud cleanup in afterAll (Equoria-cu3t5).
    transientUserIds.push(other.id);

    const res = await request(app)
      .get(`/api/v1/users/${other.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/users/${user.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/users/:id/progress ─────────────────────────────────────────────

describe('GET /api/v1/users/:id/progress', () => {
  it('returns 200 with progress data for self', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${user.id}/progress`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('userId');
    expect(res.body.data).toHaveProperty('level');
    expect(res.body.data).toHaveProperty('xp');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/users/${user.id}/progress`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/users/:userId/competition-stats ─────────────────────────────────

describe('GET /api/v1/users/:userId/competition-stats', () => {
  it('returns 200 with zero stats for a user with no competition history', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${user.id}/competition-stats`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId');
    expect(res.body.totalCompetitions).toBe(0);
    expect(res.body.totalWins).toBe(0);
  });

  it('returns 400 for non-UUID userId', async () => {
    const res = await request(app)
      .get('/api/v1/users/notauuid/competition-stats')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/users/${user.id}/competition-stats`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/users/:userId/competition-stats — with real results ─────────────
// (covers lines 580-660: aggregation logic, placementToNumber, recentCompetitions)

describe('GET /api/v1/users/:userId/competition-stats — with results', () => {
  let statsUser;
  let statsToken;
  let statsHorse;
  let show;
  const createdShowIds = [];
  const createdResultIds = [];
  // Local fail-loud, scoped cleanup tracker (Equoria-cu3t5) for this describe's
  // fixtures; replaces the swallowed per-row cleanup catches.
  const statsCleanup = createCleanupTracker();

  beforeAll(async () => {
    statsUser = await prisma.user.create({
      data: {
        email: `stats-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
        username: `stats${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        password: 'hash',
        firstName: 'Stats',
        lastName: 'Tester',
        money: 0,
      },
    });
    statsToken = generateTestToken({ id: statsUser.id, email: statsUser.email, role: 'user' });

    statsHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-StatsHorse-${Date.now()}`,
        sex: 'Stallion',
        dateOfBirth: new Date('2018-01-01'),
        age: 7,
        userId: statsUser.id,
      },
    });

    // Seed varied competition results to exercise placement branches.
    // UNIQUE(showId, horseId) (migration 20260521120000) forbids a horse
    // from having two results in the SAME show, so each result gets its own
    // dedicated show. Aggregate stats are show-agnostic, so totals and
    // placement-branch coverage are unchanged.
    const placements = [
      ['1st', 95],
      ['2nd', 90],
      ['3rd', 85],
      ['4th', 80],
      [null, 75], // null placement → placementToNumber → 0 branch
    ];
    for (let i = 0; i < placements.length; i++) {
      const [placement, score] = placements[i];
      const resultShow = await prisma.show.create({
        data: {
          name: `TestFixture-StatsShow-${Date.now()}-${i}`,
          discipline: 'Dressage',
          levelMin: 1,
          levelMax: 10,
          entryFee: 100,
          prize: 1000,
          runDate: new Date('2024-01-01'),
          hostUserId: statsUser.id,
        },
      });
      createdShowIds.push(resultShow.id);
      if (!show) {
        show = resultShow;
      }
      const r = await prisma.competitionResult.create({
        data: {
          horseId: statsHorse.id,
          showId: resultShow.id,
          showName: resultShow.name,
          discipline: 'Dressage',
          placement,
          score: String(score),
          prizeWon: placement === '1st' ? 500 : placement === '2nd' ? 300 : 100,
          runDate: new Date('2024-01-01'),
        },
      });
      createdResultIds.push(r.id);
    }
    // FK order: competitionResults → shows → horse → user. Scoped by id.
    statsCleanup.add(
      () => prisma.competitionResult.deleteMany({ where: { id: { in: createdResultIds } } }),
      'competitionResults',
    );
    statsCleanup.add(() => prisma.show.deleteMany({ where: { id: { in: createdShowIds } } }), 'shows');
    statsCleanup.add(() => prisma.horse.delete({ where: { id: statsHorse.id } }), 'horse');
    statsCleanup.add(() => prisma.user.delete({ where: { id: statsUser.id } }), 'user');
  }, 60000);

  afterAll(() => statsCleanup.run(), 30000);

  it('returns aggregated stats with real competition results', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${statsUser.id}/competition-stats`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${statsToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalCompetitions).toBeGreaterThanOrEqual(5);
    expect(res.body.totalWins).toBeGreaterThanOrEqual(1);
    expect(res.body.totalTop3).toBeGreaterThanOrEqual(3);
    expect(res.body.bestPlacement).toBe(1);
    expect(res.body.mostSuccessfulDiscipline).toBe('Dressage');
    expect(Array.isArray(res.body.recentCompetitions)).toBe(true);
    expect(res.body.recentCompetitions.length).toBeLessThanOrEqual(5);
    expect(typeof res.body.winRate).toBe('number');
    expect(res.body.totalPrizeMoney).toBeGreaterThan(0);
  });

  it('recentCompetitions entries have expected shape', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${statsUser.id}/competition-stats`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${statsToken}`);

    expect(res.status).toBe(200);
    for (const r of res.body.recentCompetitions) {
      expect(r).toHaveProperty('competitionId');
      expect(r).toHaveProperty('discipline');
      expect(r).toHaveProperty('placement');
      expect(r).toHaveProperty('finalScore');
      expect(r).toHaveProperty('prizeMoney');
    }
  });
});

// ─── GET /api/v1/users/dashboard/:userId ─────────────────────────────────────────
// (covers getDashboardData lines 141-310, the largest uncovered chunk)

describe('GET /api/v1/users/dashboard/:userId', () => {
  it('returns 200 with dashboard data for self', async () => {
    const res = await request(app)
      .get(`/api/v1/users/dashboard/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data).toHaveProperty('horses');
    expect(res.body.data).toHaveProperty('shows');
    expect(res.body.data).toHaveProperty('activity');
    expect(res.body.data.user.id).toBe(user.id);
    expect(typeof res.body.data.horses.total).toBe('number');
  });

  it('caches dashboard data — second call returns same shape', async () => {
    // First call populates cache, second hits cache (covers cache HIT branch)
    const first = await request(app)
      .get(`/api/v1/users/dashboard/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .get(`/api/v1/users/dashboard/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(200);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/users/dashboard/${user.id}`).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });

  it('returns 403 when accessing another user dashboard', async () => {
    const other = await prisma.user.create({
      data: {
        email: `dash-other-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
        username: `dashother${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        password: 'hash',
        firstName: 'Dash',
        lastName: 'Other',
        money: 0,
      },
    });
    // Tracked for scoped, fail-loud cleanup in afterAll (Equoria-cu3t5).
    transientUserIds.push(other.id);

    const res = await request(app)
      .get(`/api/v1/users/dashboard/${other.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/v1/users/dashboard/:userId — with horse data ───────────────────────
// Exercises horse-counts, shows, training-log branches in getDashboardData

describe('GET /api/v1/users/dashboard/:userId — with horses and activity', () => {
  let dashUser;
  let dashToken;
  let dashHorse;
  // Local fail-loud, scoped cleanup tracker (Equoria-cu3t5) for this describe's
  // fixtures; replaces the swallowed cleanup catches.
  const dashCleanup = createCleanupTracker();

  beforeAll(async () => {
    dashUser = await prisma.user.create({
      data: {
        email: `dash-rich-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
        username: `dashrich${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        password: 'hash',
        firstName: 'Dash',
        lastName: 'Rich',
        money: 1000,
      },
    });
    dashToken = generateTestToken({ id: dashUser.id, email: dashUser.email, role: 'user' });

    dashHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-DashHorse-${Date.now()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2018-01-01'),
        age: 7,
        userId: dashUser.id,
      },
    });
    // FK order: horse before its owning user. Scoped by id.
    dashCleanup.add(() => prisma.horse.delete({ where: { id: dashHorse.id } }), 'horse');
    dashCleanup.add(() => prisma.user.delete({ where: { id: dashUser.id } }), 'user');
  }, 30000);

  afterAll(() => dashCleanup.run(), 30000);

  it('returns horses.total > 0 when user has horses', async () => {
    const res = await request(app)
      .get(`/api/v1/users/dashboard/${dashUser.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${dashToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.horses.total).toBeGreaterThan(0);
  });
});

// ─── GET /api/v1/users/:id/activity ──────────────────────────────────────────────
// (covers getUserActivity lines 320-352)

describe('GET /api/v1/users/:id/activity', () => {
  it('returns 200 with empty activity array for new user', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${user.id}/activity`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('includes XP_GAIN events when xpEvents exist', async () => {
    // Seed an xpEvent row directly
    const event = await prisma.xpEvent.create({
      data: {
        userId: user.id,
        amount: 100,
        reason: 'Test XP event for activity feed',
      },
    });
    // Tracked for scoped, fail-loud cleanup in afterAll (Equoria-cu3t5).
    transientXpEventIds.push(event.id);

    const res = await request(app)
      .get(`/api/v1/users/${user.id}/activity`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const xpEvent = res.body.data.find(e => e.type === 'XP_GAIN');
    expect(xpEvent).toBeDefined();
    expect(xpEvent.metadata).toHaveProperty('amount');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/users/${user.id}/activity`).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── PUT /api/v1/users/:id — updateUserController ────────────────────────────────
// (covers updateUserController lines 494-521)

describe('PUT /api/v1/users/:id', () => {
  it('returns 200 when updating self', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .put(`/api/v1/users/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ firstName: 'Updated' });

    expect([200, 204]).toContain(res.status);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .put(`/api/v1/users/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ firstName: 'Updated' });

    expect(res.status).toBe(401);
  });

  it('returns 403 when updating another user', async () => {
    const other = await prisma.user.create({
      data: {
        email: `put-other-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
        username: `putother${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        password: 'hash',
        firstName: 'Put',
        lastName: 'Other',
        money: 0,
      },
    });
    // Tracked for scoped, fail-loud cleanup in afterAll (Equoria-cu3t5).
    transientUserIds.push(other.id);

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .put(`/api/v1/users/${other.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ firstName: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

// ─── POST /api/v1/users/:id/add-xp — addXpController ─────────────────────────────
// (covers addXpController lines 700-728)

describe('POST /api/v1/users/:id/add-xp', () => {
  it('returns 200 and adds XP for self', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/users/${user.id}/add-xp`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 50 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Response shape includes either currentXP or xp depending on the addXp path taken
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/users/${user.id}/add-xp`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 50 });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/users/search — searchUsers ──────────────────────────────────────
// (covers searchUsers lines 741-758)

describe('GET /api/v1/users/search', () => {
  it('returns 200 with matched users for prefix query', async () => {
    // user fixture has username starting with "uc<timestamp>" — use a 2-char prefix
    const prefix = user.username.slice(0, 2);
    const res = await request(app)
      .get(`/api/v1/users/search?username=${encodeURIComponent(prefix)}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.users)).toBe(true);
    expect(res.body.data).toHaveProperty('pagination');
    expect(typeof res.body.data.pagination.total).toBe('number');
  });

  it('returns 400 for query shorter than 2 chars', async () => {
    const res = await request(app)
      .get('/api/v1/users/search?username=a')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('respects limit param', async () => {
    const prefix = user.username.slice(0, 2);
    const res = await request(app)
      .get(`/api/v1/users/search?username=${encodeURIComponent(prefix)}&limit=1`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.users.length).toBeLessThanOrEqual(1);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/users/search?username=foo').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/v1/users/:id — deleteUserController ─────────────────────────────
// (covers deleteUserController lines 667-693)

describe('DELETE /api/v1/users/:id', () => {
  it('returns 200 when deleting self', async () => {
    // Create a throwaway user since we'll delete them
    const throwaway = await prisma.user.create({
      data: {
        email: `del-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
        username: `del${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        password: 'hash',
        firstName: 'Del',
        lastName: 'Throwaway',
        money: 0,
      },
    });
    const throwawayToken = generateTestToken({
      id: throwaway.id,
      email: throwaway.email,
      role: 'user',
    });
    // Tracked for scoped, fail-loud cleanup in afterAll (Equoria-cu3t5). The
    // happy path deletes this user via the API; the id-scoped deleteMany in
    // afterAll is idempotent (count 0 if already gone) and only the safety-net
    // for the failure path — so it stays fail-loud without false positives.
    transientUserIds.push(throwaway.id);

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${throwawayToken}`] });
    const res = await request(app)
      .delete(`/api/v1/users/${throwaway.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${throwawayToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect([200, 204]).toContain(res.status);
  });

  it('returns 403 when deleting another user', async () => {
    const other = await prisma.user.create({
      data: {
        email: `del-other-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
        username: `delother${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        password: 'hash',
        firstName: 'Del',
        lastName: 'Other',
        money: 0,
      },
    });
    // Tracked for scoped, fail-loud cleanup in afterAll (Equoria-cu3t5).
    transientUserIds.push(other.id);

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .delete(`/api/v1/users/${other.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete(`/api/v1/users/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});
