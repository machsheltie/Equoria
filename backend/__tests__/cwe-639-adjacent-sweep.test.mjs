/**
 * CWE-639 Adjacent-Locations Sweep — sentinel tests for Equoria-4o39.
 *
 * Each describe block covers ONE leak fixed in the 4o39 sweep. Each test asserts
 * cross-user access returns 404 (not 403) AND that the response body is byte-
 * identical to the not-exists case — the byte-identical sentinel is what makes
 * these CWE-639 tests, not just "404 instead of 403" tests.
 *
 * Companion child issues:
 *   - Equoria-m55h — ultraRareTraitRoutes /effects/calculate
 *   - Equoria-qpeg — enhancedReportingRoutes /horses/compare-epigenetics
 *   - Equoria-msh4 — environmentalRoutes /environment/calculate-impact
 *   - Equoria-q4yy — traitDiscoveryRoutes /discover/batch
 *   - Equoria-5w2v — groomAssignmentService.validateAssignmentEligibility
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { createMockToken } from '../__tests__/factories/index.mjs';
import { fetchCsrf } from '../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. A cleanup delete that fails must
// FAIL the suite (not be swallowed by a silent no-op catch arm), so a leaked
// multi-user/horse/groom IDOR fixture surfaces at the source instead of trips
// the canonical NULL-phenotype sentinel (Equoria-a429/lfj5) in a later suite.
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

describe('CWE-639 adjacent-locations sweep (Equoria-4o39)', () => {
  // Equoria-0ys7m / Equoria-plw0h per-user CSRF binding: tokenA / userA are
  // minted per-test in beforeEach, so the CSRF token must be (re-)issued under
  // userA inside beforeEach too — see the bound fetchCsrf call below. A
  // beforeAll anonymous fetch (CSRF_SESSION_SALT identifier) would
  // HMAC-mismatch the Bearer mutations' req.user.id and 403 before the
  // ownership middleware ever runs, masking the real CWE-639
  // 404-not-403 / byte-identical disclosure-resistance assertions.
  let __csrf__;
  let userA;
  let userB;
  let tokenA;
  let horseA;
  let horseB;
  let groomA;
  let groomB;
  const cleanup = createCleanupTracker();
  // Equoria-1ohys: ids of extra horses created inside individual tests (e.g.
  // horseA2). Folded into the suite-level `horse` cleanup task so they are
  // deleted BEFORE their owning user (FK order) by the same fail-loud sweep,
  // instead of a per-test swallowed finally-block delete. Reset each beforeEach.
  let extraHorseIds = [];

  const NONEXISTENT_ID = 999999999;

  beforeEach(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';
    extraHorseIds = [];

    userA = await prisma.user.create({
      data: {
        email: `cwe639a-${randomBytes(8).toString('hex')}@example.com`,
        username: `cwe639a-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Cwe',
        lastName: 'A',
        emailVerified: true,
      },
    });
    userB = await prisma.user.create({
      data: {
        email: `cwe639b-${randomBytes(8).toString('hex')}@example.com`,
        username: `cwe639b-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Cwe',
        lastName: 'B',
        emailVerified: true,
      },
    });

    tokenA = createMockToken(userA.id, {
      payload: { email: userA.email, role: userA.role || 'user' },
    });

    // Equoria-plw0h: issue the CSRF token under userA by forwarding the access
    // token cookie on the GET /csrf-token call. getCsrfToken decodes it
    // best-effort and binds the token's sessionIdentifier to userA.id — the
    // same identifier authenticateToken resolves for the Bearer mutations
    // below, so csrfProtection validates instead of 403ing.
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${tokenA}`] });

    horseA = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `CweHorseA-${randomBytes(8).toString('hex')}`,
        userId: userA.id,
        sex: 'mare',
        dateOfBirth: new Date(),
      },
    });
    horseB = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `CweHorseB-${randomBytes(8).toString('hex')}`,
        userId: userB.id,
        sex: 'stallion',
        dateOfBirth: new Date(),
      },
    });
    groomA = await prisma.groom.create({
      data: {
        name: `CweGroomA-${randomBytes(8).toString('hex')}`,
        userId: userA.id,
        speciality: 'TRAINING',
        personality: 'diligent',
      },
    });
    groomB = await prisma.groom.create({
      data: {
        name: `CweGroomB-${randomBytes(8).toString('hex')}`,
        userId: userB.id,
        speciality: 'CARE',
        personality: 'calm',
      },
    });

    // Equoria-1ohys: register scoped, fail-loud cleanup in FK-delete order
    // (refreshToken/groomAssignment by userId → groom → horse → user; children
    // before parents, Horse.userId is Restrict). run() drains the tracker queue
    // each afterEach, so per-test fixtures registered later (e.g. horseA2 in the
    // compare-epigenetics test) are also covered and the next beforeEach starts
    // from an empty queue. Scoped by userId / id-IN — never a bare deleteMany
    // (CLAUDE.md §2).
    cleanup.add(() => {
      const ids = [userA?.id, userB?.id].filter(Boolean);
      return ids.length > 0
        ? prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } })
        : undefined;
    }, 'refreshToken');
    cleanup.add(() => {
      const ids = [userA?.id, userB?.id].filter(Boolean);
      return ids.length > 0
        ? prisma.groomAssignment.deleteMany({ where: { userId: { in: ids } } })
        : undefined;
    }, 'groomAssignment');
    cleanup.add(
      () =>
        prisma.groom.deleteMany({
          where: { id: { in: [groomA?.id, groomB?.id].filter(Boolean) } },
        }),
      'groom',
    );
    cleanup.add(
      () =>
        prisma.horse.deleteMany({
          where: { id: { in: [horseA?.id, horseB?.id, ...extraHorseIds].filter(Boolean) } },
        }),
      'horse',
    );
    cleanup.add(() => {
      const ids = [userA?.id, userB?.id].filter(Boolean);
      return prisma.user.deleteMany({ where: { id: { in: ids } } });
    }, 'user');
  });

  afterEach(() => cleanup.run());

  // ─── Equoria-m55h ────────────────────────────────────────────────────────
  describe('ultraRareTraitRoutes POST /api/v1/auth/ultra-rare-traits/effects/calculate', () => {
    it('returns 404 for cross-user horse with byte-identical response to not-exists', async () => {
      const resNotOwned = await request(app)
        .post('/api/v1/auth/ultra-rare-traits/effects/calculate')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseId: horseB.id, effectType: 'stress', baseValue: 1 });

      expect(resNotOwned.status).toBe(404);
      expect(resNotOwned.body.success).toBe(false);

      const resMissing = await request(app)
        .post('/api/v1/auth/ultra-rare-traits/effects/calculate')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseId: NONEXISTENT_ID, effectType: 'stress', baseValue: 1 });

      expect(resMissing.status).toBe(404);
      // Byte-identical sentinel — divergence allows ID enumeration.
      expect(resMissing.body).toEqual(resNotOwned.body);
    });
  });

  // ─── Equoria-qpeg ────────────────────────────────────────────────────────
  describe('enhancedReportingRoutes POST /horses/compare-epigenetics', () => {
    it('returns 404 for cross-user horseIds with byte-identical response to not-exists', async () => {
      // Need at least 2 horseIds (route AC). Equoria-1ohys: register the extra
      // horse for the suite-level fail-loud `horse` cleanup (deleted before its
      // owning user, in FK order) instead of a swallowed finally-block delete.
      const horseA2 = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `CweHorseA2-${randomBytes(8).toString('hex')}`,
          userId: userA.id,
          sex: 'mare',
          dateOfBirth: new Date(),
        },
      });
      extraHorseIds.push(horseA2.id);

      const resCrossUser = await request(app)
        .post('/api/v1/auth/horses/compare-epigenetics')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseIds: [horseA.id, horseB.id] });

      expect(resCrossUser.status).toBe(404);
      expect(resCrossUser.body.success).toBe(false);

      const resMissing = await request(app)
        .post('/api/v1/auth/horses/compare-epigenetics')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseIds: [horseA.id, NONEXISTENT_ID] });

      expect(resMissing.status).toBe(404);
      expect(resMissing.body).toEqual(resCrossUser.body);
    });
  });

  // ─── Equoria-msh4 ────────────────────────────────────────────────────────
  describe('environmentalRoutes POST /environment/calculate-impact', () => {
    it('returns 404 for cross-user horseIds with byte-identical response to not-exists', async () => {
      const resCrossUser = await request(app)
        .post('/api/v1/auth/environment/calculate-impact')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseIds: [horseB.id] });

      expect(resCrossUser.status).toBe(404);
      expect(resCrossUser.body.success).toBe(false);

      const resMissing = await request(app)
        .post('/api/v1/auth/environment/calculate-impact')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseIds: [NONEXISTENT_ID] });

      expect(resMissing.status).toBe(404);
      expect(resMissing.body).toEqual(resCrossUser.body);
    });
  });

  // ─── Equoria-q4yy ────────────────────────────────────────────────────────
  describe('traitDiscoveryRoutes POST /api/v1/trait-discovery/discover/batch (all-fail)', () => {
    it('returns 404 (not 403) when all horses fail ownership; per-horse messages disclosure-resistant', async () => {
      const resAllForeign = await request(app)
        .post('/api/v1/trait-discovery/discover/batch')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseIds: [horseB.id] });

      expect(resAllForeign.status).toBe(404);
      expect(resAllForeign.body.success).toBe(false);

      const resAllMissing = await request(app)
        .post('/api/v1/trait-discovery/discover/batch')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseIds: [NONEXISTENT_ID] });

      expect(resAllMissing.status).toBe(404);
      // Per-horse error message is the same for both not-exists and not-yours
      // (already disclosure-resistant via findOwnedResource — see route).
      // The per-horse `horseId` field will differ (different IDs), but the
      // error string for each is identical.
      const fErr = resAllForeign.body.errors[0]?.error;
      const mErr = resAllMissing.body.errors[0]?.error;
      expect(fErr).toBe(mErr);
    });
  });

  // ─── Equoria-5w2v ────────────────────────────────────────────────────────
  describe('groomAssignmentRoutes /api/v1/groom-assignments/validate', () => {
    it('errors do not distinguish exists-but-not-yours from doesnt-exist', async () => {
      const resForeignGroom = await request(app)
        .post('/api/v1/groom-assignments/validate')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ groomId: groomB.id, horseId: horseA.id });

      const resMissingGroom = await request(app)
        .post('/api/v1/groom-assignments/validate')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ groomId: NONEXISTENT_ID, horseId: horseA.id });

      // Status codes equal AND the errors array equal — disclosure-resistant.
      expect(resForeignGroom.status).toBe(resMissingGroom.status);
      expect(resForeignGroom.body.data.errors).toEqual(resMissingGroom.body.data.errors);
      // The 'You do not own this groom' message must NOT appear — that was
      // the leak vector.
      expect(JSON.stringify(resForeignGroom.body)).not.toContain('You do not own');

      const resForeignHorse = await request(app)
        .post('/api/v1/groom-assignments/validate')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ groomId: groomA.id, horseId: horseB.id });

      const resMissingHorse = await request(app)
        .post('/api/v1/groom-assignments/validate')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ groomId: groomA.id, horseId: NONEXISTENT_ID });

      expect(resForeignHorse.body.data.errors).toEqual(resMissingHorse.body.data.errors);
      expect(JSON.stringify(resForeignHorse.body)).not.toContain('You do not own');
    });
  });

  // ─── Equoria-a7dy ────────────────────────────────────────────────────────
  // groomSystem.assignGroomToFoal utility — defense-in-depth dead-code error
  // string that previously read 'You do not own groom X'. Even though the
  // route-level dual findOwnedResource middleware already 404s before this
  // throw is reachable, a service-level direct call (bypass) must surface the
  // same byte-identical 'Groom with ID X not found' error as the missing-row
  // case so a future caller cannot leak ownership status.
  describe('groomSystem.assignGroomToFoal direct service call (bypass middleware)', () => {
    it('cross-user groom yields byte-identical error to missing groom', async () => {
      const { assignGroomToFoal } = await import('../utils/groomSystem.mjs');

      // Caller (userA) tries to assign userB's groom to a foal — bypass the
      // route middleware by calling the utility directly.
      const crossUserError = await assignGroomToFoal(horseA.id, groomB.id, userA.id).catch(e => e);

      // Same call shape, but with a non-existent groom ID.
      const missingError = await assignGroomToFoal(horseA.id, NONEXISTENT_ID, userA.id).catch(e => e);

      expect(crossUserError).toBeInstanceOf(Error);
      expect(missingError).toBeInstanceOf(Error);
      // The leak vector: previously crossUserError.message contained the
      // groom's name plus 'You do not own groom'. After Equoria-a7dy hardening
      // both errors must read 'Groom with ID <id> not found' — the only ID-
      // dependent variation is the literal ID the caller supplied.
      expect(crossUserError.message).toBe(`Groom with ID ${groomB.id} not found`);
      expect(missingError.message).toBe(`Groom with ID ${NONEXISTENT_ID} not found`);
      // Sentinel: the leaky substring must be gone.
      expect(crossUserError.message).not.toContain('You do not own');
    });
  });

  // ─── Equoria-b4q6 ────────────────────────────────────────────────────────
  // POST /api/v1/horses/foals — previously had a TODO(security) about missing
  // sireId/damId ownership validation (CWE-284). Now enforced by the
  // dual-ownership inline middleware in horseRoutes.mjs `POST /foals`. Both
  // cross-user and not-exists must surface byte-identical 404s.
  describe('horseRoutes POST /api/v1/horses/foals', () => {
    let breed;

    beforeEach(async () => {
      breed = await prisma.breed.upsert({
        where: { name: 'Thoroughbred' },
        update: {},
        create: { name: 'Thoroughbred', description: 'Shared CWE-639 sweep breed' },
      });
    });

    it('returns 404 for cross-user sire byte-identical to nonexistent sire', async () => {
      // Cross-user sire: userA tries to use userB's stallion (horseB) as sire,
      // with their own mare (horseA) as dam.
      const resCrossUserSire = await request(app)
        .post('/api/v1/horses/foals')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          name: `CweFoalA-${randomBytes(4).toString('hex')}`,
          breedId: breed.id,
          sireId: horseB.id,
          damId: horseA.id,
        });

      expect(resCrossUserSire.status).toBe(404);
      expect(resCrossUserSire.body).toMatchObject({ success: false, message: 'Sire not found' });

      // Nonexistent sire ID
      const resMissingSire = await request(app)
        .post('/api/v1/horses/foals')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          name: `CweFoalA-${randomBytes(4).toString('hex')}`,
          breedId: breed.id,
          sireId: NONEXISTENT_ID,
          damId: horseA.id,
        });

      expect(resMissingSire.status).toBe(404);
      // Byte-identical sentinel — divergence enables horse ID enumeration.
      expect(resMissingSire.body).toEqual(resCrossUserSire.body);
    });

    it('returns 404 for cross-user dam byte-identical to nonexistent dam', async () => {
      // Cross-user dam: userA tries to use userB's mare (horseB has sex
      // 'stallion' in this fixture, but findOwnedResource just checks
      // ownership — the test still proves dam ownership is gated).
      const resCrossUserDam = await request(app)
        .post('/api/v1/horses/foals')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          name: `CweFoalA-${randomBytes(4).toString('hex')}`,
          breedId: breed.id,
          sireId: horseA.id,
          damId: horseB.id,
        });

      expect(resCrossUserDam.status).toBe(404);
      expect(resCrossUserDam.body).toMatchObject({ success: false, message: 'Dam not found' });

      // Nonexistent dam ID
      const resMissingDam = await request(app)
        .post('/api/v1/horses/foals')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          name: `CweFoalA-${randomBytes(4).toString('hex')}`,
          breedId: breed.id,
          sireId: horseA.id,
          damId: NONEXISTENT_ID,
        });

      expect(resMissingDam.status).toBe(404);
      // Byte-identical sentinel
      expect(resMissingDam.body).toEqual(resCrossUserDam.body);
    });
  });
});
