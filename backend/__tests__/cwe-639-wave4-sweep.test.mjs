/**
 * CWE-639 Wave-4 Sweep — sentinel tests for Equoria-9ov8 wave 4.
 *
 * Each describe block covers ONE leak fixed in the wave-4 sweep. Each test
 * asserts cross-user access returns 404 (not 403) AND that the response body
 * is byte-identical to the not-exists case — the byte-identical sentinel is
 * what makes these CWE-639 tests, not just "404 instead of 403" tests.
 *
 * Wave-4 issue:
 *   - Equoria-bik1 — showController.enterShow (POST /api/v1/shows/:id/enter)
 *
 * Adjacent leaks identified in wave 4 but filed for separate landing per
 * non-bundling rule (EDGE_CASE_FIX_DISCIPLINE.md §7):
 *   - Equoria-y0l4 — messageController.getMessage
 *   - Equoria-a3kp — messageController.markRead
 *   - Equoria-c4g3 — competitionRoutes POST /execute
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
// multi-user/horse/show IDOR fixture surfaces at the source instead of trips
// the canonical NULL-phenotype sentinel (Equoria-a429/lfj5) in a later suite.
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

describe('CWE-639 wave-4 sweep (Equoria-9ov8)', () => {
  // Equoria-plw0h per-user CSRF binding: tokenA / userA are minted per-test in
  // beforeEach, so the CSRF token must be (re-)issued under userA inside
  // beforeEach too — see the bound fetchCsrf call below. A beforeAll
  // anonymous fetch (CSRF_SESSION_SALT identifier) would HMAC-mismatch the
  // Bearer mutations' req.user.id and 403 before the ownership check ever
  // runs, masking the real CWE-639 disclosure-resistance assertion.
  let __csrf__;
  let userA;
  let userB;
  let tokenA;
  let horseA;
  let horseB;
  let show;
  const cleanup = createCleanupTracker();

  const NONEXISTENT_ID = 999999999;

  beforeEach(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';

    userA = await prisma.user.create({
      data: {
        email: `cwe639w4a-${randomBytes(8).toString('hex')}@example.com`,
        username: `cwe639w4a-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Cwe',
        lastName: 'W4A',
        emailVerified: true,
      },
    });
    userB = await prisma.user.create({
      data: {
        email: `cwe639w4b-${randomBytes(8).toString('hex')}@example.com`,
        username: `cwe639w4b-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Cwe',
        lastName: 'W4B',
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

    // Horse owned by user A — age 5 to satisfy enterShow age gate
    horseA = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `CweHorseW4A-${randomBytes(8).toString('hex')}`,
        userId: userA.id,
        sex: 'mare',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        healthStatus: 'Excellent',
      },
    });
    // Horse owned by user B — same age/health profile so the only test variable
    // is the cross-user ownership signal.
    horseB = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `CweHorseW4B-${randomBytes(8).toString('hex')}`,
        userId: userB.id,
        sex: 'stallion',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        healthStatus: 'Excellent',
      },
    });

    // An open show user A can attempt to enter
    show = await prisma.show.create({
      data: {
        name: `CweShowW4-${randomBytes(8).toString('hex')}`,
        discipline: 'Dressage',
        levelMin: 1,
        levelMax: 10,
        entryFee: 0,
        prize: 100,
        runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        hostUserId: userA.id,
        status: 'open',
      },
    });

    // Equoria-1ohys: register scoped, fail-loud cleanup in FK-delete order
    // (showEntry → show → refreshToken → horse → user; children before
    // parents, Horse.userId is Restrict). Replaces the swallowed no-op catch
    // arms on the showEntry/show deletes — a cleanup failure now fails the
    // suite. Scoped by showId / userId / id-IN — never a bare deleteMany
    // (CLAUDE.md §2).
    cleanup.add(
      () => (show?.id ? prisma.showEntry.deleteMany({ where: { showId: show.id } }) : undefined),
      'showEntry',
    );
    cleanup.add(() => (show?.id ? prisma.show.delete({ where: { id: show.id } }) : undefined), 'show');
    cleanup.add(() => {
      const ids = [userA?.id, userB?.id].filter(Boolean);
      return ids.length > 0 ? prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } }) : undefined;
    }, 'refreshToken');
    cleanup.add(
      () =>
        prisma.horse.deleteMany({
          where: { id: { in: [horseA?.id, horseB?.id].filter(Boolean) } },
        }),
      'horse',
    );
    cleanup.add(() => {
      const ids = [userA?.id, userB?.id].filter(Boolean);
      return prisma.user.deleteMany({ where: { id: { in: ids } } });
    }, 'user');
  });

  afterEach(() => cleanup.run());

  // ─── Equoria-bik1 ────────────────────────────────────────────────────────
  describe('showController.enterShow POST /api/v1/shows/:id/enter', () => {
    it('returns 404 for cross-user horseId with byte-identical response to not-exists', async () => {
      // Cross-user case: user A trying to enter user B's horse
      const resCrossUser = await request(app)
        .post(`/api/v1/shows/${show.id}/enter`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseId: horseB.id });

      expect(resCrossUser.status).toBe(404);
      expect(resCrossUser.body.success).toBe(false);

      // Not-exists case: user A trying to enter a non-existent horse
      const resMissing = await request(app)
        .post(`/api/v1/shows/${show.id}/enter`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseId: NONEXISTENT_ID });

      expect(resMissing.status).toBe(404);
      // Byte-identical sentinel — divergence enables horse ID enumeration.
      expect(resMissing.body).toEqual(resCrossUser.body);
    });
  });
});
