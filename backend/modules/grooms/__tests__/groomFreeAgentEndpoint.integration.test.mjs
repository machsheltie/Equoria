/**
 * Equoria-ypb7d.2 — the grooms-for-hire pool, over REAL HTTP.
 *
 * TWO GAPS THIS FILE CLOSES, both raised in the fix-round-1 review.
 *
 * F1 (High) — THE POOL PREDICATE AND THE HIRE PREDICATE HAVE TO BE THE SAME ONE.
 *   The first version of `hireFreeAgent` restated the predicate instead of sharing it:
 *   `listFreeAgents` required a CLOSED ENGAGEMENT (`FREE_AGENT_WHERE`), while the hire
 *   pre-read and the guarded claim required only
 *   `{ userId: null, retired: false, isActive: true }`. Measured in the shared
 *   development database at the time: **65 grooms satisfied the hire predicate and 0
 *   satisfied the pool predicate** — leftover fixtures and legacy rows no player ever
 *   hired, engageable for `sessionRate × 7` by anyone who supplied an id. A player
 *   never sees those ids in a listing, but "not in any listing" is not an
 *   authorization boundary. The fix is one frozen predicate spread into both places;
 *   this file is the case that would have caught the drift.
 *
 * THE OTHER GAP — no test drove these two routes over HTTP at all. Every existing case
 *   calls the controllers directly with a fake `req`/`res`, so the authenticated
 *   router, `authenticateToken`, CSRF and the JSON body parser were all unexercised.
 *   Registering a handler on a router is not the same as it being reachable, and a
 *   404 from a missing route looks exactly like a 404 from a refused hire.
 *
 * THE GUARDED CLAIM'S 409 (fix round 3). The controller's double-hire refusal —
 *   `claimed.count !== 1` -> `FreeAgentUnavailableError` -> 409 — was asserted only by a
 *   two-caller race whose loser took the 404 pre-read branch about three times in five,
 *   so loosening that race's status assertion left the mapping covered by nothing. A
 *   re-review proved it by deleting the guard and watching the race case pass four runs
 *   in six. The case below imposes the ordering with the `groomHireRaceBarrier` seam
 *   instead of hoping for it, so the 409 is asserted on EVERY run.
 *
 * Real DB, no mocks, id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { ENGAGEMENT_END_REASONS } from '../services/groomEngagementService.mjs';
import { __TESTING_ONLY_setGroomHireRaceBarrier } from '../services/groomHireRaceBarrier.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-ypb7d-http';
const SESSION_RATE = 20; // → hire cost 140
const HIRE_COST = SESSION_RATE * 7;
const BARRIER_TIMEOUT_MS = 20000;

const tag = () => randomBytes(6).toString('hex');

async function makeUser(label, money = 20000) {
  const suffix = tag();
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${label}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${label}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Ypb7dHttp',
      lastName: label,
      money,
      settings: {},
    },
  });
  return {
    id: user.id,
    token: generateTestToken({ id: user.id, email: user.email, role: 'user' }),
  };
}

async function makeFreeGroom(label, { withClosedEngagement, formerEmployerId }) {
  const groom = await prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      startAge: 20,
      sessionRate: SESSION_RATE,
      userId: null,
    },
  });
  if (withClosedEngagement) {
    await prisma.groomEngagement.create({
      data: {
        groomId: groom.id,
        userId: formerEmployerId,
        endedAt: new Date('2026-03-09T09:00:00.000Z'),
        endReason: ENGAGEMENT_END_REASONS.FEE_UNPAID,
      },
    });
  }
  return groom;
}

/**
 * Suspend ONE `hireFreeAgent` request between its pool pre-read and its transaction.
 *
 * Mirrors `buyHorseStaleListing.integration`'s use of the marketplace seam
 * (Equoria-6p398.4): resolve `reached` when the target request arrives, then hold it on
 * `gate` until the test calls `release()`. Targeted by BOTH `groomId` and `userId` so a
 * concurrent request from anyone else passes straight through.
 */
function armHireBarrier({ groomId, userId }) {
  let markReached;
  let openGate;
  const reached = new Promise(resolve => {
    markReached = resolve;
  });
  const gate = new Promise(resolve => {
    openGate = resolve;
  });
  __TESTING_ONLY_setGroomHireRaceBarrier(async (stage, context) => {
    if (stage !== 'hireFreeAgent:afterPoolPreRead') {
      return;
    }
    if (context?.groomId !== groomId || context?.userId !== userId) {
      return;
    }
    markReached();
    await gate;
  });
  return {
    reached,
    release: () => openGate(),
    disarm: () => __TESTING_ONLY_setGroomHireRaceBarrier(null),
  };
}

async function waitFor(promise, label) {
  let timer;
  try {
    await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), BARRIER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function hireRequest(token, body) {
  return fetchCsrf(app).then(csrf => {
    const req = request(app)
      .post('/api/v1/groom-marketplace/free-agents/hire')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  });
}

describe('Equoria-ypb7d.2 — GET/POST /api/v1/groom-marketplace/free-agents over HTTP', () => {
  let hirer;
  let formerEmployer;
  /** In the pool: free agent WITH a closed engagement. */
  let released;
  /** NOT in the pool: free agent with NO engagement history at all. */
  let neverEngaged;
  let cleanup;

  beforeEach(async () => {
    cleanup = createCleanupTracker();
    hirer = await makeUser('hirer');
    formerEmployer = await makeUser('former');
    released = await makeFreeGroom('released', {
      withClosedEngagement: true,
      formerEmployerId: formerEmployer.id,
    });
    neverEngaged = await makeFreeGroom('neverengaged', { withClosedEngagement: false });

    const groomIds = [released.id, neverEngaged.id];
    // Engagements before grooms; ledger and grooms before users. `userId` may be
    // either NULL or the hirer's by the time this runs, so grooms are deleted by ID.
    cleanup.add(() => prisma.groomEngagement.deleteMany({ where: { groomId: { in: groomIds } } }), 'engagements');
    cleanup.add(
      () =>
        prisma.userTransaction.deleteMany({
          where: { userId: { in: [hirer.id, formerEmployer.id] } },
        }),
      'ledger rows',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'grooms');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [hirer.id, formerEmployer.id] } } }), 'users');
  }, 60000);

  afterEach(() => cleanup.run(), 60000);

  it('GET lists the released groom and NOT the never-engaged one', async () => {
    const res = await request(app)
      .get('/api/v1/groom-marketplace/free-agents?limit=100')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${hirer.token}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.grooms.map(g => g.id);
    expect(ids).toContain(released.id);
    // The pool's own predicate: a free agent nobody ever hired is not "back in the
    // marketplace", it is fixture debris. This is the listing half of F1.
    expect(ids).not.toContain(neverEngaged.id);
  }, 60000);

  it('GET requires authentication', async () => {
    const res = await request(app).get('/api/v1/groom-marketplace/free-agents').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  }, 30000);

  it('POST hires a groom the pool lists, over the real middleware chain', async () => {
    const res = await hireRequest(hirer.token, { groomId: released.id });

    expect(res.status).toBe(201);
    expect(res.body.data.groom.id).toBe(released.id);
    expect(res.body.data.cost).toBe(HIRE_COST);

    const row = await prisma.groom.findUnique({
      where: { id: released.id },
      select: { userId: true, feeUnpaidSince: true },
    });
    expect(row.userId).toBe(hirer.id);
    expect(row.feeUnpaidSince).toBeNull();

    const open = await prisma.groomEngagement.findMany({
      where: { groomId: released.id, endedAt: null },
    });
    expect(open).toHaveLength(1);
    expect(open[0].userId).toBe(hirer.id);

    const wallet = await prisma.user.findUnique({
      where: { id: hirer.id },
      select: { money: true },
    });
    expect(Number(wallet.money)).toBe(20000 - HIRE_COST);
  }, 60000);

  // ── F1: THE CASE THAT WOULD HAVE CAUGHT THE PREDICATE DRIFT ─────────────────
  it('POST REFUSES a free agent the pool would never list, and writes nothing', async () => {
    // `neverEngaged` satisfies the OLD hire predicate exactly — `userId: null`,
    // `retired: false`, `isActive: true` — and fails the pool predicate, because it
    // has no closed engagement. Pre-fix this returned 201 and handed the groom over.
    const before = await prisma.user.findUnique({
      where: { id: hirer.id },
      select: { money: true },
    });

    const res = await hireRequest(hirer.token, { groomId: neverEngaged.id });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not available for hire/i);

    // PERSISTED STATE, not just the status code: nothing moved.
    const row = await prisma.groom.findUnique({
      where: { id: neverEngaged.id },
      select: { userId: true, hiredDate: true },
    });
    expect(row.userId).toBeNull();

    expect(await prisma.groomEngagement.count({ where: { groomId: neverEngaged.id } })).toBe(0);

    const after = await prisma.user.findUnique({
      where: { id: hirer.id },
      select: { money: true },
    });
    expect(Number(after.money)).toBe(Number(before.money));

    expect(await prisma.userTransaction.count({ where: { userId: hirer.id, category: 'groom_hire' } })).toBe(0);
  }, 60000);

  it('POST requires authentication, and refuses before touching any groom', async () => {
    const res = await hireRequest(null, { groomId: released.id });
    // 401 from `authenticateToken`, not 400/404 from the handler — the refusal is in
    // the middleware chain, which is the half no in-process test exercises.
    expect(res.status).toBe(401);

    const row = await prisma.groom.findUnique({
      where: { id: released.id },
      select: { userId: true },
    });
    expect(row.userId).toBeNull();
  }, 30000);

  // ── THE GUARDED CLAIM'S 409, DETERMINISTICALLY ──────────────────────────────
  it('POST answers 409 when the groom is claimed between the pre-read and the claim', async () => {
    // Fix round 3. This is the case the tolerant `404 or 409` on the race case does NOT
    // provide, and the re-review proved the cost of that: with
    // `if (claimed.count !== 1) throw` deleted from the controller, the two-caller race
    // still passed four runs in six, because the loser usually took the 404 pre-read
    // branch and never reached the guard at all. Nothing in the tree asserted
    // `claimed.count !== 1` -> FreeAgentUnavailableError -> 409.
    //
    // So stop racing. The seam suspends THIS request after its pool pre-read has
    // succeeded — so it is committed to the claim — while the test hands the groom to
    // someone else. On release, the claim's `where` no longer matches, `count` is 0, and
    // the controller must refuse with 409. There is no interleaving left to be lucky
    // about: the ordering is imposed, so this either passes every run or the guard is
    // gone.
    const barrier = armHireBarrier({ groomId: released.id, userId: hirer.id });
    try {
      // Fire the hire that will be suspended. Do NOT await it yet.
      const suspended = hireRequest(hirer.token, { groomId: released.id });
      await waitFor(barrier.reached, 'the hire to reach the seam after its pool pre-read');

      // Its pre-read has already succeeded, so the 404 branch is behind it. Now let
      // someone else take the groom — sequentially, with nothing racing.
      const stealer = await makeUser('stealer');
      cleanup.add(() => prisma.groomEngagement.deleteMany({ where: { userId: stealer.id } }), 'stealer engagements');
      cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: stealer.id } }), 'stealer ledger rows');
      cleanup.add(() => prisma.user.delete({ where: { id: stealer.id } }), 'stealer');

      const stolen = await hireRequest(stealer.token, { groomId: released.id });
      expect(stolen.status).toBe(201);

      barrier.release();
      const res = await suspended;

      // THE ASSERTION. 409, from the controller, through the real middleware chain.
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/hired by someone else/i);

      // And the refusal rolled everything back: the debit ran BEFORE the claim inside
      // that transaction, so a 409 that left the loser poorer would be a worse defect
      // than the double hire.
      const wallet = await prisma.user.findUnique({
        where: { id: hirer.id },
        select: { money: true },
      });
      expect(Number(wallet.money)).toBe(20000);
      expect(
        await prisma.userTransaction.count({
          where: { userId: hirer.id, category: 'groom_hire' },
        }),
      ).toBe(0);

      // The groom belongs to the stealer, and to exactly one open engagement.
      const row = await prisma.groom.findUnique({
        where: { id: released.id },
        select: { userId: true },
      });
      expect(row.userId).toBe(stealer.id);
      const open = await prisma.groomEngagement.findMany({
        where: { groomId: released.id, endedAt: null },
      });
      expect(open).toHaveLength(1);
      expect(open[0].userId).toBe(stealer.id);
    } finally {
      // Never leave a later suite suspended, even if an assertion above threw.
      barrier.release();
      barrier.disarm();
    }
  }, 60000);

  it('POST rejects a malformed groomId with 400 and no state change', async () => {
    const res = await hireRequest(hirer.token, { groomId: 'not-a-number' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/groomId/i);

    const wallet = await prisma.user.findUnique({
      where: { id: hirer.id },
      select: { money: true },
    });
    expect(Number(wallet.money)).toBe(20000);
  }, 30000);
});
