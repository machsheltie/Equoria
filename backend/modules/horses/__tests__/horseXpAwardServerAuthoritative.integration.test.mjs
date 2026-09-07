/**
 * horseXpAwardServerAuthoritative.integration.test.mjs
 *
 * Security regression for the 2026-09-05 audit Finding 3 (Equoria-6p398.3).
 *
 * DEFECT (pre-fix): `POST /api/v1/horses/:id/award-xp` was chained
 * authenticateToken -> mutationRateLimiter -> validateHorseId ->
 * requireOwnership('horse') -> horseXpController.awardXpToHorse. Ownership was
 * the ONLY authorization: the controller took the caller's `amount` and `reason`
 * straight off `req.body` and handed them to `addXpToHorse`. The audit
 * reproduced an ordinary `role=user` account POSTing
 * `{"amount":1000,"reason":"audit fixture"}` against its OWN horse and receiving
 * HTTP 200 with `horseXp 0 -> 1000` and `availableStatPoints 0 -> 10` — ten free
 * stat points, no training, no competition. Horse stats feed competition scoring
 * which feeds prize money, so this was a self-serve economic faucet.
 *
 * FIX: horse XP is SERVER-AUTHORITATIVE. The manual-award endpoint is removed
 * from the player API (410 Gone, mirroring the Equoria-kacla `/enter-show`
 * hard-deprecation idiom) and the controller handler is deleted. The ONLY way
 * horse XP moves is the internal service (`addXpToHorseCore` /
 * `addXpToHorse`), whose live caller is the competition award path
 * (`competitionAwards.awardPlacementProgression`, driven by the overnight
 * `executeClosedShows` executor) which computes the amount from server state.
 * No admin manual-grant surface is introduced: nothing in the repository — no
 * admin route, no script, no frontend component — ever called this endpoint, so
 * there is no supported admin use to preserve.
 *
 * INVARIANTS asserted here:
 *   - No HTTP request, from any role or body, can raise Horse.horseXp,
 *     Horse.availableStatPoints, or create a HorseXpEvent row.
 *   - Anonymous and cross-owner attempts stay rejected.
 *   - A client-supplied `role` claim or an event-shaped `reason` grants nothing.
 *   - The internal XP service still awards XP + derived stat points + the audit
 *     row atomically on a caller-supplied transaction client (the exact contract
 *     the competition award path composes with).
 *   - Owners keep XP reads, XP history, and spending of EARNED stat points, and
 *     concurrent allocation still cannot overspend (Equoria-wsj2i preserved).
 *
 * Real DB, real app, real CSRF. No mocks, no bypass headers. Fixtures are
 * `TestFixture-`/`testfixture-` named and cleanup is id-scoped and fail-loud.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { addXpToHorseCore } from '../services/horseXpModelService.mjs';

const ORIGIN = 'http://localhost:3000';
const BASE_SPEED = 50;
const ALLOC_CONCURRENCY = 5;

const cleanup = createCleanupTracker();
const createdHorseIds = [];

let owner;
let ownerToken;
/** Same real user id, but the JWT lies about the role. */
let forgedAdminToken;
let stranger;
let strangerToken;

/** The audit's target: must stay at horseXp 0 / availableStatPoints 0. */
let auditHorse;
/** Receives XP through the INTERNAL service only. */
let earnedHorse;
/** Starts with exactly one earned point for the concurrency claim. */
let raceHorse;

async function makeUser(tag) {
  const uniq = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      email: `testfixture-6p398-${tag}-${uniq}@test.com`,
      username: `TestFixture6p398${tag}${uniq}`,
      password: 'irrelevant-hash',
      firstName: 'Finding3',
      lastName: 'Tester',
      money: 1000,
    },
  });
}

async function makeHorse(userId, tag, extra = {}) {
  return createTestHorse(
    prisma,
    {
      name: `TestFixture-6p398-${tag}-${randomBytes(6).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      age: 5,
      userId,
      speed: BASE_SPEED,
      horseXp: 0,
      availableStatPoints: 0,
      ...extra,
    },
    createdHorseIds,
  );
}

/** Read the three columns Finding 3 moved, plus the audit-row count. */
async function readXpState(horseId) {
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: { horseXp: true, availableStatPoints: true, speed: true },
  });
  const events = await prisma.horseXpEvent.count({ where: { horseId } });
  return { ...horse, events };
}

/** POST with a real per-user CSRF pair (no bypass). */
async function authedPost(path, token, body) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post(path)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

beforeAll(async () => {
  owner = await makeUser('owner');
  stranger = await makeUser('stranger');

  ownerToken = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
  // A forged privilege claim: the JWT says admin, the persisted User row does not.
  forgedAdminToken = generateTestToken({ id: owner.id, email: owner.email, role: 'admin' });
  strangerToken = generateTestToken({ id: stranger.id, email: stranger.email, role: 'user' });

  auditHorse = await makeHorse(owner.id, 'audit');
  earnedHorse = await makeHorse(owner.id, 'earned');
  raceHorse = await makeHorse(owner.id, 'race', { availableStatPoints: 1 });

  // FK order: HorseXpEvent cascades off Horse; Horse.userId is onDelete:Restrict,
  // so horses go before their owners. Scoped by the ids this suite created.
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [owner.id, stranger.id] } } }), 'users');
}, 120000);

afterAll(() => cleanup.run(), 120000);

// ─── The audited request ────────────────────────────────────────────────────────

describe('SECURITY: POST /api/v1/horses/:id/award-xp is not a player-reachable XP faucet (Finding 3)', () => {
  it('REGRESSION: the audited amount:1000 request from role=user on an OWNED horse is rejected and changes nothing', async () => {
    const before = await readXpState(auditHorse.id);

    const res = await authedPost(`/api/v1/horses/${auditHorse.id}/award-xp`, ownerToken, {
      amount: 1000,
      reason: 'audit fixture',
    });

    // Pre-fix this was 200 with xpGained 1000. Any 2xx is the defect.
    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);

    const after = await readXpState(auditHorse.id);
    expect(after.horseXp).toBe(before.horseXp);
    expect(after.availableStatPoints).toBe(before.availableStatPoints);
    expect(after.events).toBe(before.events);
    // The audit's exact persisted-state claim, stated absolutely.
    expect(after.horseXp).toBe(0);
    expect(after.availableStatPoints).toBe(0);
    expect(after.events).toBe(0);
  }, 60000);

  it('a JWT claiming role=admin grants no manual award', async () => {
    const res = await authedPost(`/api/v1/horses/${auditHorse.id}/award-xp`, forgedAdminToken, {
      amount: 1000,
      reason: 'audit fixture',
    });

    expect(res.status).toBe(410);

    const after = await readXpState(auditHorse.id);
    expect(after.horseXp).toBe(0);
    expect(after.availableStatPoints).toBe(0);
    expect(after.events).toBe(0);
  }, 60000);

  it('a reason string claiming a competition happened grants no award', async () => {
    const res = await authedPost(`/api/v1/horses/${auditHorse.id}/award-xp`, ownerToken, {
      amount: 30,
      reason: 'Competition: 1st place in Dressage',
      role: 'admin',
      isAdmin: true,
    });

    expect(res.status).toBe(410);

    const after = await readXpState(auditHorse.id);
    expect(after.horseXp).toBe(0);
    expect(after.availableStatPoints).toBe(0);
    expect(after.events).toBe(0);
  }, 60000);

  it('an anonymous request is still rejected by authentication and changes nothing', async () => {
    // Bare CSRF fetch: no accessToken cookie, so authenticateToken finds no
    // token and rejects before anything else runs.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/horses/${auditHorse.id}/award-xp`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 1000, reason: 'audit fixture' });

    expect(res.status).toBe(401);

    const after = await readXpState(auditHorse.id);
    expect(after.horseXp).toBe(0);
    expect(after.availableStatPoints).toBe(0);
    expect(after.events).toBe(0);
  }, 60000);

  it("a cross-owner request against another player's horse is rejected and changes nothing", async () => {
    const res = await authedPost(`/api/v1/horses/${auditHorse.id}/award-xp`, strangerToken, {
      amount: 1000,
      reason: 'audit fixture',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).not.toBe(200);

    const after = await readXpState(auditHorse.id);
    expect(after.horseXp).toBe(0);
    expect(after.availableStatPoints).toBe(0);
    expect(after.events).toBe(0);
  }, 60000);
});

// ─── The retained legitimate award path ─────────────────────────────────────────

describe('the internal XP service remains the only horse-XP source and is unchanged', () => {
  it('addXpToHorseCore on a caller transaction awards XP, derives the stat point, and writes the audit row atomically', async () => {
    // This is the EXACT function competitionAwards.awardPlacementProgression
    // calls inside the show executor's per-entry transaction, with the same
    // shape of amount (server-computed) and reason (server-composed).
    const result = await prisma.$transaction(tx =>
      addXpToHorseCore(tx, earnedHorse.id, 100, 'Competition: 1st place in Dressage'),
    );

    expect(result.newXp).toBe(100);
    expect(result.statPointsGained).toBe(1);
    expect(result.newAvailableStatPoints).toBe(1);

    const after = await readXpState(earnedHorse.id);
    expect(after.horseXp).toBe(100);
    expect(after.availableStatPoints).toBe(1);
    // XP and its audit row commit together: horseXp == SUM(HorseXpEvent.amount).
    expect(after.events).toBe(1);

    const [event] = await prisma.horseXpEvent.findMany({ where: { horseId: earnedHorse.id } });
    expect(event.amount).toBe(100);
    expect(event.reason).toBe('Competition: 1st place in Dressage');
  }, 60000);
});

// ─── Owner-facing reads and earned-stat spending stay available ─────────────────

describe('owners keep XP reads and earned-stat allocation', () => {
  it('GET /:id/xp returns the server-awarded XP to the owner', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${earnedHorse.id}/xp`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentXP).toBe(100);
    expect(res.body.data.availableStatPoints).toBe(1);
  }, 60000);

  it('GET /:id/xp-history returns the server-side award', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${earnedHorse.id}/xp-history`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.events.length).toBe(1);
    expect(res.body.data.events[0].amount).toBe(100);
  }, 60000);

  it('the owner can spend the earned stat point via POST /:id/allocate-stat', async () => {
    const res = await authedPost(`/api/v1/horses/${earnedHorse.id}/allocate-stat`, ownerToken, {
      statName: 'speed',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.newStatValue).toBe(BASE_SPEED + 1);
    expect(res.body.data.remainingStatPoints).toBe(0);

    const after = await readXpState(earnedHorse.id);
    expect(after.speed).toBe(BASE_SPEED + 1);
    expect(after.availableStatPoints).toBe(0);
    // Spending a point must not rewrite XP or the audit trail.
    expect(after.horseXp).toBe(100);
    expect(after.events).toBe(1);
  }, 60000);

  it('concurrent allocation cannot overspend one earned point (Equoria-wsj2i preserved)', async () => {
    const responses = await Promise.all(
      Array.from({ length: ALLOC_CONCURRENCY }, () =>
        authedPost(`/api/v1/horses/${raceHorse.id}/allocate-stat`, ownerToken, {
          statName: 'speed',
        }),
      ),
    );

    const successes = responses.filter(r => r.status === 200);
    expect(successes.length).toBe(1);

    const after = await readXpState(raceHorse.id);
    expect(after.availableStatPoints).toBe(0);
    expect(after.speed).toBe(BASE_SPEED + 1);
  }, 120000);
});
