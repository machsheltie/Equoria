/**
 * conformationShowRoutesHttp.integration.test.mjs
 *
 * HTTP-level sentinel-positive integration test for the conformation
 * sub-router. Companion to Equoria-pety (route-wiring fix) and
 * Equoria-jbll (sentinel test).
 *
 * Background:
 *   backend/modules/competition/routes/conformationShowRoutes.mjs exposes
 *     POST /enter
 *     GET  /eligibility/:horseId
 *     GET  /titles/:horseId
 *   (POST /execute was removed by Equoria-mwjst — see the last block.)
 *   …but as of Equoria-pety it is NOT imported or mounted into
 *   competitionRoutes.mjs, so every endpoint returns 404 in production
 *   despite the 16 controller-level tests passing.
 *
 * Sentinel contract (OPTIMAL_FIX_DISCIPLINE.md §2):
 *   These tests MUST fail (404) before the route mount lands and MUST pass
 *   once it does. They prove that the HTTP path is reachable — they do NOT
 *   re-test controller behaviour (that's owned by conformationShowEntry/
 *   Execution/Scoring/Service unit suites).
 *
 * Doctrine:
 *   - Real express app from backend/app.mjs (no isolated harness).
 *   - Real auth (createTestUser issues a real JWT).
 *   - Real DB via createTestHorse/cleanupTestData.
 *   - No bypass headers, no mocks, no test.skip.
 *   - Fixture names prefixed `TestFixture-conformation-routes-http-` so
 *     cleanup is scoped.
 *
 * Assertion model:
 *   We assert `status !== 404`. We do NOT pin to 200 — these endpoints have
 *   their own auth/validation/eligibility paths and the controllers may
 *   legitimately return 400/403/409/etc. for a synthetic fixture. The
 *   wiring defect we're guarding against is the 404 from an unmounted
 *   sub-router, which 404 alone proves.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const FIXTURE_PREFIX = 'TestFixture-conformation-routes-http';

let owner;
let token;
let horse;

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');

  const created = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
  });
  owner = created.user;
  token = created.token;

  horse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-Horse-${tag}`,
    userId: owner.id,
  });
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

describe('conformation sub-router HTTP mount (Equoria-pety sentinel)', () => {
  // ── Sentinel: GET endpoints prove the sub-router is mounted ─────────────
  //
  // Why only GETs are used as wiring sentinels here:
  //
  //   POST routes on authRouter pass through `authenticateToken` and then
  //   `csrfProtection` BEFORE express's route matcher runs. An authenticated
  //   POST without a CSRF token therefore returns 403 from the CSRF guard
  //   regardless of whether the sub-router is mounted — so a POST status of
  //   "not 404" cannot distinguish mounted-but-CSRF-blocked from
  //   not-mounted-but-CSRF-blocked. Using a POST as a wiring sentinel would
  //   produce a vacuously-passing test (OPTIMAL_FIX_DISCIPLINE.md §2).
  //
  //   GETs do NOT trigger csrfProtection's reject path. Auth passes, then
  //   express runs the route matcher. If the sub-router isn't mounted,
  //   the unmatched path falls through to the global 404 handler. If it
  //   IS mounted, the GET reaches validation/controller and returns
  //   something other than 404 (200/400/etc.). That's a real sentinel.
  //
  //   Controller behaviour for the three endpoints remains covered by
  //   conformationShowEntry/Execution/Scoring/Service unit suites.

  it('GET /api/v1/competition/conformation/eligibility/:horseId is reachable (status !== 404)', async () => {
    const res = await request(app)
      .get(`/api/v1/competition/conformation/eligibility/${horse.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    // Router-not-mounted manifests as a plain 404 from the global no-match
    // handler. Any other status — 200/400/500 — proves the request reached
    // the sub-router stack.
    expect(res.status).not.toBe(404);
  });

  it('GET /api/v1/competition/conformation/titles/:horseId is reachable (status !== 404)', async () => {
    const res = await request(app)
      .get(`/api/v1/competition/conformation/titles/${horse.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).not.toBe(404);
  });

  // ── Control: confirm the global 404 handler still fires for true
  //   non-routes under the same mount point. This stops a future refactor
  //   from "fixing" the sentinel by adding a catch-all.

  it('an unknown conformation sub-path still returns 404 (control)', async () => {
    const res = await request(app)
      .get('/api/v1/competition/conformation/this-path-does-not-exist')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// Early settlement over HTTP is impossible (Equoria-mwjst, Codex scan
// 2026-10-02 Finding 2).
//
// OLD CONTRACT (vulnerable): this block was "executes the show end-to-end over
// real HTTP and returns ranked results" — a player who hosted a conformation
// show seven days from due POSTed /execute and received 200 with Blue/Red
// ribbons, 10/7 title points and breeding-value boosts, immediately.
//
// CORRECTED CONTRACT (owner ruling 2026-10-05): conformation shows run exactly
// 7 days from creation and are settled by the nightly show job only. There is
// no player settlement route, so the host's request finds nothing (404) and the
// show, its entries and its horses are untouched. The legitimate path — the
// nightly executor settling a DUE show exactly once, rewards and fee escrow
// included — is proven in conformationShowSettlementServerAuthoritative
// .integration.test.mjs. The old "no CSRF token → 403" case is gone with the
// route: an unmatched POST still meets csrfProtection first, so it could only
// ever re-prove the global CSRF guard, not anything about settlement.
// ===========================================================================

describe('POST /api/v1/competition/conformation/execute — no early settlement (Equoria-mwjst)', () => {
  const SUITE = 'TestFixture-conformation-execute-http';
  let host;
  let hostToken;
  let csrf;
  let show;
  let horse1;
  let horse2;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const tag = randomBytes(4).toString('hex');

    const created = await createTestUser({
      username: `${SUITE}-${tag}`,
      email: `${SUITE}-${tag}@example.com`,
    });
    host = created.user;
    hostToken = created.token;

    horse1 = await createTestHorse({ name: `${SUITE}-H1-${tag}`, userId: host.id });
    horse2 = await createTestHorse({ name: `${SUITE}-H2-${tag}`, userId: host.id });

    // Every entry has an ACTIVE groom (handler), exactly as the real entry
    // flow requires, so nothing but the missing route can stop a settlement.
    const groom = await prisma.groom.create({
      data: {
        name: `${SUITE}-Groom-${tag}`,
        speciality: 'showHandling',
        personality: 'gentle',
        showHandlingSkill: 'expert',
        userId: host.id,
      },
    });
    for (const h of [horse1, horse2]) {
      await prisma.groomAssignment.create({
        data: { groomId: groom.id, foalId: h.id, userId: host.id, isActive: true },
      });
    }

    // A player-hosted conformation show that opened now and closes in seven
    // days — the show the old test settled immediately.
    const openDate = new Date();
    const closeDate = new Date(openDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    show = await prisma.show.create({
      data: {
        name: `${SUITE}-Show-${tag}`,
        discipline: 'Conformation',
        levelMin: 1,
        levelMax: 10,
        entryFee: 50,
        prize: 0,
        openDate,
        closeDate,
        runDate: closeDate,
        showType: 'conformation',
        status: 'open',
        hostUserId: host.id,
        createdByUserId: host.id,
      },
    });

    for (const h of [horse1, horse2]) {
      await prisma.showEntry.create({
        data: {
          show: { connect: { id: show.id } },
          horse: { connect: { id: h.id } },
          user: { connect: { id: host.id } },
          feePaid: 50,
        },
      });
    }

    // Equoria-plw0h per-user CSRF binding: mint the token for host.id so the
    // request clears csrfProtection and reaches the route matcher — the 404
    // asserted below is then the router's answer, not the CSRF guard's.
    csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${hostToken}`] });

    // Scoped, fail-loud cleanup (Equoria-1ohys) — only rows this suite created.
    cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: show?.id } }), 'showEntry');
    cleanup.add(
      () =>
        prisma.competitionResult.deleteMany({ where: { horseId: { in: [horse1?.id, horse2?.id].filter(Boolean) } } }),
      'competitionResult',
    );
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { groomId: groom.id } }), 'groomAssignment');
    cleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
    cleanup.add(() => prisma.show.deleteMany({ where: { name: { startsWith: SUITE } } }), 'show');
    cleanup.add(() => cleanupTestData(), 'cleanupTestData');
  }, 120000);

  afterAll(() => cleanup.run());

  it('the host’s settle request for a show seven days from due is 404 and awards nothing', async () => {
    const res = await request(app)
      .post('/api/v1/competition/conformation/execute')
      .set('Authorization', `Bearer ${hostToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ showId: show.id });

    expect(res.status).toBe(404);

    const [showAfter, results, horses] = await Promise.all([
      prisma.show.findUnique({ where: { id: show.id } }),
      prisma.competitionResult.findMany({ where: { showId: show.id } }),
      prisma.horse.findMany({
        where: { id: { in: [horse1.id, horse2.id] } },
        select: { titlePoints: true, currentTitle: true, breedingValueBoost: true },
      }),
    ]);
    expect(showAfter.status).toBe('open');
    expect(showAfter.executedAt).toBeNull();
    expect(results).toEqual([]);
    expect(horses).toEqual([
      { titlePoints: 0, currentTitle: null, breedingValueBoost: 0 },
      { titlePoints: 0, currentTitle: null, breedingValueBoost: 0 },
    ]);
  });
});
