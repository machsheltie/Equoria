/**
 * 🔒 ROUTE-AUTH SENTINEL — representative mutations must NOT be publicly reachable
 *
 * Parent: Equoria-jk9oj.1 (foundation for the route-module security-boundary split).
 *
 * WHY THIS EXISTS
 * The three-tier router split lives in backend/app/routers.mjs:
 *   - publicRouter : no auth (health, docs, login/register)
 *   - authRouter   : authenticateToken + csrfProtection on every route
 *   - adminRouter  : authenticateToken + requireRole('admin') + requireAdminMfa
 * Auth is therefore conferred BY THE MOUNT. Before this sentinel there was no
 * test proving that a state-changing endpoint (a mutation) can't be hit by an
 * anonymous caller. If someone re-mounted a sensitive router on publicRouter, or
 * registered a new mutation under the wrong mount, nothing would have failed.
 *
 * WHAT THIS ASSERTS
 * For a representative mutation per router category, an UNAUTHENTICATED request
 * (no accessToken cookie, no Authorization header, no bypass headers — Constitution
 * §3) returns 401 or 403. Crucially it asserts the status is ALSO NOT 404 and NOT
 * 2xx:
 *   - NOT 2xx  → the request was not served anonymously (the real defect we guard).
 *   - NOT 404  → the route still EXISTS. A 404 would mean the endpoint was renamed
 *                or unmounted, which would otherwise let "auth enforced" pass
 *                vacuously (you can't bypass auth on a route that no longer exists).
 * The 404 guard is what makes this a real regression-catcher rather than a tautology.
 *
 * SENTINEL-POSITIVE COMPANION (OPTIMAL_FIX_DISCIPLINE §2)
 * The final describe block proves the assertion FIRES on the exact defect it
 * guards: it builds a throwaway publicRouter-style Express app (no auth
 * middleware) with a POST route that returns 200, then shows the same
 * `expectUnauthenticatedRejection` helper THROWS against it. This proves the
 * check would catch a mutation accidentally mounted public — WITHOUT weakening
 * the real app (the throwaway app is local to the test and never touches the
 * production router composition).
 *
 * REAL DB / REAL APP: drives the actual backend/app.mjs via supertest against the
 * canonical DB. No mocks, no bypass headers, no test.skip.
 */

import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import app from '../../../app.mjs';

const ORIGIN = 'http://localhost:3000';

/**
 * Assert that an unauthenticated request to a mutation endpoint is rejected.
 * Rejected means 401 or 403 — and explicitly NOT 2xx (served anonymously) and
 * NOT 404 (route vanished, which would make the auth check vacuous).
 *
 * @param {import('supertest').Response} res
 * @param {string} label  human-readable endpoint label for failure messages
 */
function expectUnauthenticatedRejection(res, label) {
  // Loud, specific failure if the route was served (2xx) or has gone missing (404).
  if (res.status >= 200 && res.status < 300) {
    throw new Error(
      `[route-auth-sentinel] ${label} was served to an UNAUTHENTICATED caller ` +
        `(status ${res.status}). A mutation must require auth. ` +
        'Check that the owning router is mounted under authRouter/adminRouter ' +
        'and declares a local authenticateToken guard.',
    );
  }
  if (res.status === 404) {
    throw new Error(
      `[route-auth-sentinel] ${label} returned 404 — the route no longer exists. ` +
        "This sentinel's representative endpoint must be updated to a real path, " +
        'otherwise "auth enforced" passes vacuously on a non-existent route.',
    );
  }
  expect([401, 403]).toContain(res.status);
}

// Representative mutation per router category. Each path is verified to exist in
// the route files (a 404 here fails the test by design — see the helper).
const REPRESENTATIVE_MUTATIONS = [
  // authRouter — core game create
  {
    label: 'POST /api/v1/horses (authRouter — create horse)',
    method: 'post',
    path: '/api/v1/horses',
    body: { name: 'TestFixture-sentinel-horse' },
  },
  // authRouter — grooms domain
  {
    label: 'POST /api/v1/grooms/hire (authRouter — hire groom)',
    method: 'post',
    path: '/api/v1/grooms/hire',
    body: { name: 'TestFixture-sentinel-groom', speciality: 'foal_care', skill_level: 'novice', personality: 'gentle' },
  },
  // authRouter — financial/economy
  {
    label: 'POST /api/v1/bank/claim (authRouter — claim weekly reward)',
    method: 'post',
    path: '/api/v1/bank/claim',
    body: {},
  },
  // authRouter — breeding/foal mutation
  {
    label: 'POST /api/v1/foals/1/activity (authRouter — foal activity)',
    method: 'post',
    path: '/api/v1/foals/1/activity',
    body: { activityType: 'gentle_touch' },
  },
  // authRouter — crafting (jk9oj.2 target router)
  {
    label: 'POST /api/v1/crafting/craft (authRouter — craft item)',
    method: 'post',
    path: '/api/v1/crafting/craft',
    body: { recipeId: 'TestFixture-sentinel-recipe' },
  },
  // authRouter — community (jk9oj.2 target router)
  {
    label: 'POST /api/v1/messages (authRouter — send message)',
    method: 'post',
    path: '/api/v1/messages',
    body: { recipientId: '00000000-0000-0000-0000-000000000000', subject: 'x', content: 'y' },
  },
  // adminRouter — system administration
  {
    label: 'POST /api/v1/admin/cron/start (adminRouter — start cron)',
    method: 'post',
    path: '/api/v1/admin/cron/start',
    body: {},
  },
];

describe('Route-auth sentinel — representative mutations reject unauthenticated callers (Equoria-jk9oj.1)', () => {
  it.each(REPRESENTATIVE_MUTATIONS)(
    'rejects $label without auth (401/403, not 2xx, not 404)',
    async ({ method, path, body, label }) => {
      const agent = request(app);
      const res = await agent[method](path).set('Origin', ORIGIN).send(body);

      expectUnauthenticatedRejection(res, label);
    },
  );

  it('covers at least one endpoint per router category (auth + admin)', () => {
    const hasAuthRouter = REPRESENTATIVE_MUTATIONS.some(m => !m.path.startsWith('/api/v1/admin'));
    const hasAdminRouter = REPRESENTATIVE_MUTATIONS.some(m => m.path.startsWith('/api/v1/admin'));
    expect(hasAuthRouter).toBe(true);
    expect(hasAdminRouter).toBe(true);
  });
});

/**
 * SENTINEL-POSITIVE: prove the assertion catches the very defect it guards.
 *
 * We construct a throwaway app mimicking publicRouter (NO auth middleware) with a
 * mutation that returns 200. The helper MUST throw against it — proving that if a
 * real mutation were ever mounted public (served 200 to anonymous), the sentinel
 * above would fail rather than pass silently. The throwaway app is fully local;
 * it does not touch the production router composition in app.mjs.
 */
describe('Route-auth sentinel — sentinel-positive (the check fires on a public mutation)', () => {
  function buildLeakyPublicApp() {
    const leaky = express();
    leaky.use(express.json());
    // Simulates a mutation accidentally registered on a public (no-auth) router.
    leaky.post('/api/v1/leaky/mutation', (req, res) => {
      res.status(200).json({ success: true, leaked: true });
    });
    return leaky;
  }

  it('a publicly-mounted mutation returns 200 (the defect we must catch)', async () => {
    const leaky = buildLeakyPublicApp();
    const res = await request(leaky).post('/api/v1/leaky/mutation').send({});
    // Baseline: the leak really is reachable anonymously.
    expect(res.status).toBe(200);
  });

  it('expectUnauthenticatedRejection THROWS on that public mutation (proves the guard works)', async () => {
    const leaky = buildLeakyPublicApp();
    const res = await request(leaky).post('/api/v1/leaky/mutation').send({});

    // If the helper did NOT throw here, the whole sentinel above would be a
    // placebo. We assert it throws with the "served to an UNAUTHENTICATED caller"
    // message — the exact failure a real public-mount regression would produce.
    expect(() => expectUnauthenticatedRejection(res, 'POST /api/v1/leaky/mutation')).toThrow(
      /served to an UNAUTHENTICATED caller/,
    );
  });

  it('expectUnauthenticatedRejection THROWS on a 404 (route-vanished guard)', () => {
    // Synthesize a 404 response shape — proves the vacuous-pass guard fires too.
    const fourOhFour = { status: 404 };
    expect(() => expectUnauthenticatedRejection(fourOhFour, 'POST /api/v1/gone')).toThrow(/no longer exists/);
  });

  it('expectUnauthenticatedRejection PASSES on a genuine 401', () => {
    const unauthorized = { status: 401 };
    expect(() => expectUnauthenticatedRejection(unauthorized, 'POST /api/v1/protected')).not.toThrow();
  });
});
