/**
 * typedNotFound404.integration.test.mjs
 *
 * Sentinel-positive integration coverage for Equoria-pwjs5 — the
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
 *       to masquerade as a clean 404). The proof drives the bare-500
 *       fail-closed path with a real database fault (a Postgres trigger scoped
 *       to one fixture foal), never a mock — see the (b) block.
 *
 * IMPORTANT — honest accounting of WHERE the 404 originates (read before
 * editing): EVERY one of the hardened routes is fronted by a pre-handler
 * ownership gate — either `requireOwnership(...)` middleware (foal routes,
 * horseQueryRoutes (backend/app/queries, Equoria-q4uem.4) `/:id/breeding-data`; the
 * traitDiscoveryRoutes case left with those routes, Equoria-a7f1p) or an in-handler
 * `validateBatchHorseOwnership`
 * check. For a genuinely MISSING
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
 *   - The "(b) non-404 → not 404" test DOES drive a hardened handler's catch
 *     with a REAL, non-404 error: GET /foals/:foalId/development on a foal the
 *     user OWNS (so ownership passes) and that has no development record yet,
 *     while a Postgres trigger scoped to that foal makes the record's INSERT
 *     fail. The resulting Prisma error is not an AppError, so the type check
 *     (`AppError.isAppError && statusCode===404`) is false and the handler
 *     fails closed with 500, proving it does not misclassify a non-404 error
 *     as a 404. History: the block's first example, PUT
 *     /grooms/:id/bonus-traits, became a closed 410-Gone route
 *     (Equoria-bvddn.3); its second, a repeated POST /foals/:foalId/enrichment,
 *     was removed with player-run foal enrichment (Equoria-fr2kg). See the (b)
 *     block below.
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

const ORIGIN = 'http://localhost:3000';
// An id that is a valid positive int4 but will not exist in the canonical DB.
// int4 max is 2_147_483_647; this stays inside the ownership middleware's
// INT4_MAX guard so the request reaches the ownership lookup (not a 400).
const MISSING_ID = 2_000_111_222;

describe('INTEGRATION: type-based 404 vs 500-unexpected — Equoria-4xwyi routes (pwjs5)', () => {
  let owner;
  let ownerToken;
  let ownedGroom; // a groom owned by `owner`
  let ownedFoal; // a day-0 foal owned by `owner`, no development row (the (b) non-404 probe)

  beforeAll(async () => {
    const ts = Date.now();
    const ownerData = await createTestUser({
      username: `TestFixture-pwjs5-owner-${ts}`,
      email: `testfixture-pwjs5-owner-${ts}@test.com`,
    });
    owner = ownerData.user;
    ownerToken = ownerData.token;

    ownedGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-pwjs5-groom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        skillLevel: 'novice',
        sessionRate: 15.0,
        userId: owner.id,
      },
    });

    // Day-0 foal for the (b) non-404 probe (GET /foals/:foalId/development,
    // getFoalDevelopmentHandler). age 0 passes getFoalDevelopment's foal-age
    // check, and the foal has no FoalDevelopment row, so the read creates one —
    // the INSERT the (b) trigger makes fail.
    ownedFoal = await createTestHorse({
      name: `TestFixture-pwjs5-foal-${ts}`,
      userId: owner.id,
      age: 0,
      dateOfBirth: new Date(),
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

    it('GET /horses/:id/breeding-data → 404 (ownership gate; horseQueryRoutes)', async () => {
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

    it('GET /grooms/:id/bonus-traits → 404 (ownership gate; groomBonusTraitsController GET)', async () => {
      const res = await request(app)
        .get(`/api/v1/grooms/${MISSING_ID}/bonus-traits`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false });
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
  //     Equoria-bvddn.3 (audit 2026-09-25) closed PUT /grooms/:id/bonus-traits
  //     (410 Gone for every caller — it let any groom owner assign arbitrary
  //     bonus traits with no earning check, which also unlocked the rare-trait
  //     booster perk for free; see groomBonusTraitsRouteClosed.integration.
  //     test.mjs for that regression suite). That route used to be this
  //     block's only example, but it is now unreachable before
  //     `updateGroomBonusTraits`'s type-based catch runs at all, so it can no
  //     longer prove this guarantee. Per CLAUDE.md (never reduce coverage to
  //     make an unrelated change convenient), the example below replaces it
  //     with a DIFFERENT still-open, HTTP-reachable Equoria-4xwyi-hardened
  //     handler that exercises the identical catch shape:
  //     `foalController.getFoalDevelopmentHandler`.
  //
  //     (Equoria-fr2kg: the previous example here, a repeated POST
  //     /foals/:foalId/enrichment answered 400 'already completed', went with
  //     the removed player-run foal enrichment — owner ruling 2026-10-14/15.)
  //
  //     An OWNED day-0 foal with no FoalDevelopment row is read via GET
  //     /foals/:foalId/development. getFoalDevelopment creates the missing
  //     row; a BEFORE INSERT trigger on foal_development, scoped to this
  //     foal's id, raises inside Postgres, so Prisma throws a database error —
  //     NOT an AppError, statusCode undefined, and its message does not
  //     contain the retained 'not a foal' string. The handler's type-404
  //     branch is false and it fails closed with 500. The decisive contract:
  //     the type-based 404 branch does not over-match a non-AppError into a
  //     404. The trigger is a real database fault, not a mock (the
  //     foalDevelopmentServerAuthoritative precedent).
  // ===================================================================
  describe('(b) non-404 error in a hardened handler is NOT masked as 404', () => {
    it('GET /foals/:foalId/development (owned foal, development INSERT fails in Postgres) → 500, NOT 404 (getFoalDevelopmentHandler)', async () => {
      const suffix = `${Date.now()}_${ownedFoal.id}`;
      const fn = `fr2kg_fail_dev_insert_${suffix}`;
      const trg = `fr2kg_fail_dev_insert_trg_${suffix}`;
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION ${fn}() RETURNS trigger AS $$
        BEGIN
          IF NEW."foalId" = ${Number(ownedFoal.id)} THEN
            RAISE EXCEPTION 'injected test failure (TestFixture-pwjs5)';
          END IF;
          RETURN NEW;
        END $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER ${trg} BEFORE INSERT ON foal_development FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
      );

      let res;
      try {
        res = await request(app)
          .get(`/api/v1/foals/${ownedFoal.id}/development`)
          .set('Origin', ORIGIN)
          .set('Authorization', `Bearer ${ownerToken}`);
      } finally {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trg} ON foal_development`);
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`);
      }

      // The decisive assertion: a non-AppError error is classified by its real
      // (non-404) status — here the fail-closed 500 — and is NEVER masked as a
      // 404 by the type-based branch that runs first.
      expect(res.status).not.toBe(404);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, message: 'Internal server error' });
      expect(await prisma.foalDevelopment.count({ where: { foalId: ownedFoal.id } })).toBe(0);
    });
  });
});
