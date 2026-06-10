/**
 * typedNotFound404.integration.test.mjs
 *
 * Sentinel-positive integration coverage for Equoria-pwjs5 — the 7
 * routes/controllers hardened by Equoria-4xwyi (96a3b92fd) which replaced the
 * fragile `error.message.includes('not found')` string-sniff with type-based
 * 404 detection: `AppError.isAppError(error) && error.statusCode === 404`.
 *
 * What the hardening guarantees, and what this suite proves end-to-end against
 * the REAL Express app + REAL DB (no mocks, no bypass headers):
 *
 *   (a) A genuinely missing resource id → 404 with the canonical
 *       `{ success: false, ... }` JSON envelope.
 *
 *   (b) FAIL-CLOSED / NO OVER-MATCH: a NON-404 error reaching a hardened
 *       handler's catch is classified by its real (non-404) status and is NOT
 *       masked as a 404. This is the inverse of the Equoria-93lhj antipattern
 *       (any internal error whose message happened to contain "not found" used
 *       to masquerade as a clean 404). The bare-500 fail-closed path requires a
 *       truly unexpected fault (DB outage / import failure) that cannot be
 *       triggered mocklessly; the reachable, honest mockless proof is a non-404
 *       error → its correct non-404 status (here 400), never 404 — see the (b)
 *       block's NOTE for why.
 *
 * IMPORTANT — honest accounting of WHERE the 404 originates (read before
 * editing): EVERY one of the 7 hardened routes is fronted by a pre-handler
 * ownership gate — either `requireOwnership(...)` middleware (foal routes,
 * horseBreedingRoutes `/:id/breeding-data`, traitDiscoveryRoutes
 * `/progress|/check-conditions`) or an in-handler `validateBatchHorseOwnership`
 * check (advancedBreedingGeneticsRoutes POST routes). For a genuinely MISSING
 * id, that ownership gate returns the 404 BEFORE the hardened type-based catch
 * is ever reached. The catch's typed-404 branch is therefore defense-in-depth
 * for a "resource is owned but a downstream dependency throws a typed 404"
 * future case (the vkzvx/4xwyi commit comments say exactly this). So:
 *
 *   - The "(a) missing id → 404" tests below assert the player-facing contract
 *     (missing → 404 typed envelope) end-to-end. They do NOT claim to exercise
 *     the handler's type-check for the missing-id case — the ownership gate
 *     fires first. That is documented per assertion so a future reader does not
 *     mistake these for handler-branch coverage.
 *
 *   - The "(b) non-404 → 500" test DOES drive a hardened handler's catch with a
 *     REAL, mockless, non-404 error: PUT /grooms/:id/bonus-traits on a groom the
 *     user OWNS (so ownership passes), with a constraint-violating bonus map.
 *     `assignBonusTraits()` throws a plain `Error('Bonus trait constraints
 *     violated: ...')` — not an AppError, statusCode undefined — so the type
 *     check (`AppError.isAppError && statusCode===404`) is false and the handler
 *     correctly returns 500, proving it does not misclassify a non-404 error as
 *     a 404.
 *
 * Real DB only (CLAUDE.md Principle 3). Fixtures are name-scoped `TestFixture-*`
 * and cleaned up via the helper's tracked-id scoped delete (FK order: horses &
 * grooms removed before their user via cleanupTestData()).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';
// An id that is a valid positive int4 but will not exist in the canonical DB.
// int4 max is 2_147_483_647; this stays inside the ownership middleware's
// INT4_MAX guard so the request reaches the ownership lookup (not a 400).
const MISSING_ID = 2_000_111_222;

describe('INTEGRATION: type-based 404 vs 500-unexpected — Equoria-4xwyi routes (pwjs5)', () => {
  let owner;
  let ownerToken;
  let ownerAccessCookie; // accessToken cookie for per-user CSRF binding on mutations
  let ownedHorse; // an adult horse owned by `owner` (used for owned-path probes)
  let ownedGroom; // a groom owned by `owner`

  beforeAll(async () => {
    const ts = Date.now();
    const ownerData = await createTestUser({
      username: `TestFixture-pwjs5-owner-${ts}`,
      email: `testfixture-pwjs5-owner-${ts}@test.com`,
    });
    owner = ownerData.user;
    ownerToken = ownerData.token;
    ownerAccessCookie = `accessToken=${ownerToken}`;

    ownedHorse = await createTestHorse({
      name: `TestFixture-pwjs5-horse-${ts}`,
      userId: owner.id,
    });

    ownedGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-pwjs5-groom-${ts}`,
        speciality: 'foal_care',
        personality: 'gentle',
        skillLevel: 'novice',
        sessionRate: 15.0,
        userId: owner.id,
      },
    });
  }, 120000);

  afterAll(async () => {
    try {
      // Scoped delete of the groom this suite made (createTestHorse + user are
      // handled by cleanupTestData's tracked-id sweep; the groom is created
      // directly so we delete it explicitly here, BEFORE the user is removed).
      if (ownedGroom?.id) {
        await prisma.groom.deleteMany({ where: { id: { in: [ownedGroom.id] } } });
      }
    } catch {
      /* ignore cleanup errors */
    }
    await cleanupTestData();
  }, 120000);

  // ---- shared helper: authenticated CSRF for a mutation by THIS owner ----
  async function ownerCsrf() {
    return fetchCsrf(app, { origin: ORIGIN, extraCookies: ownerAccessCookie });
  }

  // ===================================================================
  // (a) MISSING RESOURCE → 404 typed envelope (player-facing contract)
  //     NOTE: 404 originates from the ownership gate for these routes,
  //     which fires before the hardened handler catch (see file header).
  // ===================================================================
  describe('(a) genuinely missing resource id → 404 typed JSON envelope', () => {
    it('GET /foals/:foalId/development → 404 (ownership gate; foal route)', async () => {
      const res = await request(app)
        .get(`/api/v1/foals/${MISSING_ID}/development`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false });
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(0);
    });

    it('GET /foals/:foalId (getFoalHandler) → 404 (ownership gate; foal route)', async () => {
      const res = await request(app)
        .get(`/api/v1/foals/${MISSING_ID}`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false });
    });

    it('GET /horses/:id/breeding-data → 404 (ownership gate; horseBreedingRoutes)', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${MISSING_ID}/breeding-data`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false });
    });

    it('GET /horses/:id/training-history → 404 (ownership gate; horseHistoryRoutes)', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${MISSING_ID}/training-history`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false });
    });

    it('GET /trait-discovery/progress/:horseId → 404 (ownership gate; traitDiscoveryRoutes)', async () => {
      const res = await request(app)
        .get(`/api/v1/trait-discovery/progress/${MISSING_ID}`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false });
    });

    it('GET /grooms/:id/bonus-traits → 404 (ownership gate; groomBonusTraitsController GET)', async () => {
      const res = await request(app)
        .get(`/api/v1/grooms/${MISSING_ID}/bonus-traits`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false });
    });

    it('POST /breeding/genetic-probability with a missing horse → 404 (in-handler batch-ownership; advancedBreedingGeneticsRoutes)', async () => {
      const csrf = await ownerCsrf();
      const res = await request(app)
        .post('/api/v1/breeding/genetic-probability')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        // One real owned horse + one missing id → batch ownership returns null → 404.
        .send({ stallionId: ownedHorse.id, mareId: MISSING_ID });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false });
      // This route's envelope uses `error` (not `message`) — assert the real shape.
      expect(typeof res.body.error).toBe('string');
    });

    it('POST /breeding/breeding-recommendations with a missing horse → 404 (in-handler batch-ownership; advancedBreedingGeneticsRoutes)', async () => {
      const csrf = await ownerCsrf();
      const res = await request(app)
        .post('/api/v1/breeding/breeding-recommendations')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ stallionId: ownedHorse.id, mareId: MISSING_ID });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false });
      expect(typeof res.body.error).toBe('string');
    });
  });

  // ===================================================================
  // (b) NON-404 error reaching a hardened handler catch is NOT masked as 404.
  //
  //     The failure mode the type-check defends against (Equoria-93lhj) is the
  //     INVERSE of a missing-resource 404: a non-404 internal error being
  //     mis-classified AS a 404 because its message happened to contain
  //     "not found". The type-based branch (`AppError.isAppError && statusCode
  //     ===404`, which runs FIRST in every hardened catch) must yield control to
  //     the handler's other status branches for any non-AppError error.
  //
  //     We drive this mocklessly: an OWNED groom (ownership middleware passes) +
  //     a constraint-violating bonus map. assignBonusTraits() throws a PLAIN
  //     Error('Bonus trait constraints violated: ...') — NOT an AppError,
  //     statusCode undefined. updateGroomBonusTraits's catch evaluates the
  //     type-404 branch (false → does NOT 404), then its dedicated
  //     'constraints violated' branch → 400. The decisive contract this locks
  //     in: the type-based 404 branch does not over-match a non-AppError into a
  //     404; the error is classified by its real (non-404) status.
  //
  //     NOTE on why this is 400 and not a bare 500: every non-404 error
  //     reachable from REAL DB state on an OWNED resource through these handlers
  //     carries a string one of the retained 400 branches matches (here
  //     'constraints violated'). The bare-500 fail-closed path requires a truly
  //     unexpected fault (DB outage / import failure) that cannot be triggered
  //     without injecting one — i.e. a mock, which CLAUDE.md Principle 3 forbids.
  //     Asserting the honest reachable outcome (non-404 → 400, never 404) is the
  //     correct mockless sentinel for "the type-check does not over-match".
  // ===================================================================
  describe('(b) non-404 error in a hardened handler is NOT masked as 404', () => {
    it('PUT /grooms/:id/bonus-traits (owned groom, constraint-violating bonus) → 400, NOT 404 (updateGroomBonusTraits)', async () => {
      const csrf = await ownerCsrf();
      const res = await request(app)
        .put(`/api/v1/grooms/${ownedGroom.id}/bonus-traits`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        // 5 is far above MAX_TRAIT_BONUS (0.3): validateBonusTraits() rejects it,
        // assignBonusTraits() throws a PLAIN Error('Bonus trait constraints
        // violated: ...'). The body is a valid object so the route-level
        // `body('bonusTraits').isObject()` validator passes and we reach the
        // service throw — the path the type-based catch must NOT widen to 404.
        .send({ bonusTraits: { TestFixtureTrait: 5 } });

      // The decisive assertion: a non-AppError error is classified by its real
      // (non-404) status — here 400 — and is NEVER masked as a 404 by the
      // type-based branch that runs first.
      expect(res.status).not.toBe(404);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false });
      expect(String(res.body.message)).toContain('constraints violated');
    });
  });
});
