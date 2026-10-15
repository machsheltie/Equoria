/**
 * appQueryRoutesMounting.sentinel.test.mjs (Equoria-q4uem.4, WS4 S3)
 *
 * The application query layer (backend/app/queries/) hosts the cross-domain
 * reads that used to live inside the horses and users module routers:
 *
 *   horseQueryRoutes  GET /trainable/:userId, GET /:id/history, GET /:id/overview,
 *                     GET /:id/training-history, GET /:id/breeding-data,
 *                     GET /:id/trait-card                     (mounted at /horses)
 *   userQueryRoutes   GET /dashboard/:userId                  (mounted at /users)
 *
 * routers.mjs mounts each query router on the same prefix immediately BEFORE
 * the module router. Three structural invariants keep every re-homed URL
 * byte-identical in behaviour:
 *
 *   1. UNION — the pre-split horses inventory that the Equoria-y8u2j module
 *      sentinel used to assert in full is still mounted at /horses once both
 *      routers are considered (old contract: the horses module router tree
 *      hosts these routes; new ruling: WS4 Q2a moves cross-domain reads to
 *      backend/app/queries/, and the guarantee moves here, no weaker).
 *   2. EXACT INVENTORIES — each query router exposes exactly its re-homed
 *      routes and nothing else, so a route cannot drift back or sprout.
 *   3. MOUNT ORDER — in authRouter.stack the query-router layer precedes the
 *      module-router layer for both prefixes. A query router mounted AFTER a
 *      module router would still answer (its paths are two-segment and the
 *      module routers have no competing two-segment pattern), but the order
 *      is what the WS4 route-table dump and first-match probe certified, so it
 *      is pinned. Sentinel-positive: swapping the two mount lines in
 *      routers.mjs fails this test (recorded in the WS4 report).
 */

import { describe, it, expect } from '@jest/globals';
import { buildRouters } from '../app/routers.mjs';
import horseQueryRoutes from '../app/queries/horseQueryRoutes.mjs';
import userQueryRoutes from '../app/queries/userQueryRoutes.mjs';
import horseRoutes from '../modules/horses/routes/horseRoutes.mjs';
import userRoutes from '../modules/users/routes/userRoutes.mjs';

// Flatten a router (and its mounted sub-routers) into "METHOD path" signatures.
function collectRoutes(router, basePath = '') {
  const collected = [];
  for (const layer of router.stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      collected.push({ path: basePath + layer.route.path, methods });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      collected.push(...collectRoutes(layer.handle, basePath));
    }
  }
  return collected;
}
const sigsOf = router =>
  collectRoutes(router)
    .map(r => `${r.methods.sort().join(',')} ${r.path}`)
    .sort();

const HORSE_QUERY_ROUTES = [
  'GET /trainable/:userId',
  'GET /:id/history',
  'GET /:id/overview',
  'GET /:id/training-history',
  'GET /:id/breeding-data',
  'GET /:id/trait-card',
].sort();
const USER_QUERY_ROUTES = ['GET /dashboard/:userId'];

// The full Equoria-y8u2j pre-split inventory (parent + sub-routers), now split
// between the query router and the module router tree.
const PRE_SPLIT_HORSES_INVENTORY = [
  'GET /',
  'POST /',
  'POST /batch-update',
  'GET /:id',
  'PUT /:id',
  'DELETE /:id',
  'GET /trait-trends',
  'GET /temperament-definitions',
  'GET /trainable/:userId',
  'POST /foals',
  'GET /:id/history',
  'GET /:id/overview',
  'GET /:id/prize-summary',
  'GET /:id/training-history',
  'GET /:horseId/competition-history',
];

describe('application query routers mounting sentinel (Equoria-q4uem.4)', () => {
  it('UNION: horseQueryRoutes + horseRoutes still host every pre-split horses route', () => {
    const union = new Set([...sigsOf(horseQueryRoutes), ...sigsOf(horseRoutes)]);
    for (const sig of PRE_SPLIT_HORSES_INVENTORY) {
      expect(union.has(sig)).toBe(true);
    }
  });

  it('UNION: userQueryRoutes + userRoutes host GET /dashboard/:userId exactly once', () => {
    const all = [...sigsOf(userQueryRoutes), ...sigsOf(userRoutes)];
    expect(all.filter(sig => sig === 'GET /dashboard/:userId')).toHaveLength(1);
  });

  it('EXACT: horseQueryRoutes exposes exactly the six re-homed horse reads', () => {
    expect(sigsOf(horseQueryRoutes)).toEqual(HORSE_QUERY_ROUTES);
    // and the module tree no longer hosts them (no duplicate first-match candidates)
    const moduleSigs = new Set(sigsOf(horseRoutes));
    for (const sig of HORSE_QUERY_ROUTES) {
      expect(moduleSigs.has(sig)).toBe(false);
    }
  });

  it('EXACT: userQueryRoutes exposes exactly GET /dashboard/:userId', () => {
    expect(sigsOf(userQueryRoutes)).toEqual(USER_QUERY_ROUTES);
    expect(new Set(sigsOf(userRoutes)).has('GET /dashboard/:userId')).toBe(false);
  });

  it('MOUNT ORDER: each query router is mounted on the auth router BEFORE its module router', () => {
    const { authRouter } = buildRouters();
    const handles = authRouter.stack.filter(l => l.name === 'router').map(l => l.handle);
    const idx = router => handles.indexOf(router);
    expect(idx(horseQueryRoutes)).toBeGreaterThanOrEqual(0);
    expect(idx(horseRoutes)).toBeGreaterThanOrEqual(0);
    expect(idx(userQueryRoutes)).toBeGreaterThanOrEqual(0);
    expect(idx(userRoutes)).toBeGreaterThanOrEqual(0);
    expect(idx(horseQueryRoutes)).toBeLessThan(idx(horseRoutes));
    expect(idx(userQueryRoutes)).toBeLessThan(idx(userRoutes));
  });
});
