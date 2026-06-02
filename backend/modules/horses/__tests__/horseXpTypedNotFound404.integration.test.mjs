/**
 * horseXpTypedNotFound404.integration.test.mjs
 *
 * Sentinel-positive integration coverage for Equoria-nm579 — the horseXpRoutes
 * legacy-score and trait-card endpoints hardened by Equoria-vkzvx (79ed6a00c),
 * which replaced `error.message.includes('not found')` string-sniffing with
 * type-based 404 detection: `AppError.isAppError(error) && error.statusCode === 404`.
 *
 * Routes covered:
 *   GET /api/v1/horses/:id/legacy-score  (calculateLegacyScore — throws typed
 *                                         NotFoundError for a missing horse)
 *   GET /api/v1/horses/:id/trait-card    (generateTraitTimeline — returns an
 *                                         EMPTY timeline for a missing horse;
 *                                         does NOT throw not-found)
 *
 * What this suite proves end-to-end against the REAL app + REAL DB (no mocks,
 * no bypass headers):
 *
 *   (a) A genuinely missing horse id → 404 with the canonical
 *       `{ success: false, message }` envelope.
 *
 *   (b) An OWNED, real horse → 200 (NOT a spurious 404). This is the
 *       sentinel-negative direction of the type-check: the hardened catch must
 *       NOT fire for a request that succeeds. For trait-card this is especially
 *       load-bearing — generateTraitTimeline returns an empty timeline rather
 *       than throwing, so the only way a 404 could appear here is a bug.
 *
 * HONEST accounting of the 404 origin (read before editing): BOTH routes are
 * fronted by `requireOwnership('horse')`. For a MISSING id, that middleware
 * returns the 404 BEFORE the hardened handler catch is reached. The vkzvx
 * commit comment states this explicitly for trait-card ("ownership is already
 * proven by requireOwnership before this handler runs — so a real 404 here
 * would only originate from a typed NotFoundError thrown by a future
 * dependency"). Consequently:
 *
 *   - The "(a) missing → 404" tests assert the player-facing contract
 *     end-to-end (missing → 404 typed envelope). They do not claim to exercise
 *     the handler's type-check for the missing-id case — ownership fires first.
 *
 *   - There is NO mockless way to drive a NON-404 error into these two
 *     handlers' catch for an OWNED horse (calculateLegacyScore / generateTrait-
 *     Timeline succeed for an owned horse and only throw typed-404 for missing —
 *     which ownership intercepts). The "non-404 error is NOT masked as 404"
 *     property of the SHARED type-check pattern is proven mocklessly in
 *     the sibling suite
 *     `backend/modules/breeding/__tests__/typedNotFound404.integration.test.mjs`
 *     (PUT /grooms/:id/bonus-traits, owned groom, constraint-violating body →
 *     400, never 404). Re-asserting it here would require a mock, which CLAUDE.md
 *     Principle 3 forbids. The owned-horse → 200 tests below are the honest,
 *     mockless sentinel-negative coverage for these two routes.
 *
 * Real DB only. Fixtures are name-scoped `TestFixture-*`; cleanup is the
 * helper's tracked-id scoped delete (horses removed before their user).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import {
  createTestUser,
  createTestHorse,
  cleanupTestData,
} from '../../../tests/helpers/testAuth.mjs';

const ORIGIN = 'http://localhost:3000';
// Valid positive int4, below the ownership middleware INT4_MAX guard
// (2_147_483_647), so the request reaches the ownership lookup and 404s there
// rather than being rejected as a 400 out-of-range id.
const MISSING_ID = 2_000_333_444;

describe('INTEGRATION: type-based 404 — horseXpRoutes legacy-score / trait-card (Equoria-nm579)', () => {
  let owner;
  let ownerToken;
  let ownedHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const ownerData = await createTestUser({
      username: `TestFixture-nm579-owner-${ts}`,
      email: `testfixture-nm579-owner-${ts}@test.com`,
    });
    owner = ownerData.user;
    ownerToken = ownerData.token;

    ownedHorse = await createTestHorse({
      name: `TestFixture-nm579-horse-${ts}`,
      userId: owner.id,
    });
  }, 120000);

  afterAll(async () => {
    await cleanupTestData();
  }, 120000);

  // ===================================================================
  // (a) MISSING horse → 404 typed envelope (player-facing contract).
  //     404 originates from requireOwnership('horse') for these routes.
  // ===================================================================
  describe('(a) genuinely missing horse id → 404 typed JSON envelope', () => {
    it('GET /horses/:id/legacy-score → 404', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${MISSING_ID}/legacy-score`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false });
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(0);
    });

    it('GET /horses/:id/trait-card → 404', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${MISSING_ID}/trait-card`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false });
      expect(typeof res.body.message).toBe('string');
    });
  });

  // ===================================================================
  // (b) OWNED real horse → 200 (sentinel-negative: the hardened catch
  //     must NOT misfire a 404 on a request that succeeds).
  // ===================================================================
  describe('(b) owned real horse → 200, NOT a spurious 404', () => {
    it('GET /horses/:id/legacy-score on an owned horse → 200 with a numeric legacy score', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${ownedHorse.id}/legacy-score`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.status).not.toBe(404); // the type-check must not misfire
      expect(res.body).toMatchObject({ success: true });
      // calculateLegacyScore returns an OBJECT ({ horseId, totalScore, ... });
      // the route wraps it as data.legacyScore. Assert the real shape, not a
      // primitive — totalScore is the numeric aggregate.
      expect(res.body.data.legacyScore).toBeTruthy();
      expect(typeof res.body.data.legacyScore).toBe('object');
      expect(res.body.data.legacyScore.horseId).toBe(ownedHorse.id);
      expect(typeof res.body.data.legacyScore.totalScore).toBe('number');
    });

    it('GET /horses/:id/trait-card on an owned horse → 200 with a timeline (empty, not a 404)', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${ownedHorse.id}/trait-card`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.status).not.toBe(404); // generateTraitTimeline returns empty, never throws
      expect(res.body).toMatchObject({ success: true });
      // A fresh horse with no trait history yields a timeline object (isEmpty:true
      // shape) — assert the data envelope exists rather than over-fitting fields.
      expect(res.body.data).toHaveProperty('timeline');
      expect(res.body.data.timeline).toBeTruthy();
    });
  });
});
