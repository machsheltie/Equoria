/**
 * appQueryRoutesMounting.sentinel.test.mjs (Equoria-q4uem.4, WS4 S3)
 *
 * The application query layer (backend/app/queries/) hosts the cross-domain
 * reads that used to live inside the horses and users module routers:
 *
 *   horseQueryRoutes  GET /trainable/:userId, GET /:id/history, GET /:id/overview,
 *                     GET /:id/training-history, GET /:id/breeding-data,
 *                     GET /:id/trait-card                     (mounted at /horses)
 *
 * The users half (userQueryRoutes: GET /dashboard/:userId) was retired by
 * Equoria-oey96.40 (owner decision 2026-07-07: the orphaned dashboard endpoint
 * and its hook are deleted). Old contract: userQueryRoutes exposed exactly
 * GET /dashboard/:userId and mounted AFTER userRoutes. New ruling: the route and
 * router no longer exist; this sentinel now asserts they stay gone.
 *
 * routers.mjs mounts the horses query router on its prefix immediately BEFORE
 * the module router. Structural invariants keep every re-homed URL
 * byte-identical in behaviour:
 *
 *   1. UNION — the pre-split horses inventory that the Equoria-y8u2j module
 *      sentinel used to assert in full is still mounted at /horses once both
 *      routers are considered (old contract: the horses module router tree
 *      hosts these routes; new ruling: WS4 Q2a moves cross-domain reads to
 *      backend/app/queries/, and the guarantee moves here, no weaker).
 *   2. EXACT INVENTORIES — each query router exposes exactly its re-homed
 *      routes and nothing else, so a route cannot drift back or sprout.
 *   3. MOUNT ORDER + PREFIX — the order that reproduces base first-match
 *      behaviour, prefix by prefix: on /horses the query router is mounted
 *      BEFORE horseRoutes (at base the six reads were reached before any other
 *      two-segment route). The query-router layer must also be mounted on its
 *      own prefix. Sentinel-positive: swapping the two mount lines in
 *      routers.mjs fails this test (recorded in the WS4 report).
 *   4. NO PATH-LESS USE — every layer of the query router is a route. A
 *      path-less router.use() in a router mounted ahead of the module router
 *      would execute for every request on that prefix, which base never did.
 */

import { existsSync } from 'node:fs';
import { describe, it, expect } from '@jest/globals';
import { buildRouters } from '../app/routers.mjs';
import horseQueryRoutes from '../app/queries/horseQueryRoutes.mjs';
import horseRoutes from '../modules/horses/routes/horseRoutes.mjs';
import userRoutes from '../modules/users/routes/userRoutes.mjs';
// Equoria-q4uem.4 (WS4 S4): bank owns GET /users/transactions; its router mounts at
// /users BEFORE userRoutes (at base /transactions was registered ahead of GET /:id).
import bankUserTransactionsRoutes from '../modules/bank/routes/bankUserTransactionsRoutes.mjs';
// The three handlers the bank route must execute, in base order (S4 review M3).
import { getTransactionHistory } from '../modules/bank/controllers/bankController.mjs';
import { authenticateToken } from '../middleware/auth.mjs';
import { queryRateLimiter } from '../middleware/rateLimiting.mjs';

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
].sort();

// Owner ruling 2026-10-28 (q152, Equoria-a7f1p): no trait reports for players.
// Old contract: GET /:id/trait-card (query router) and GET /trait-trends
// (module router) were part of the inventories above; they are hosted nowhere.
const retiredTraitReportRoutes = ['GET /:id/trait-card', 'GET /trait-trends'];

// The full Equoria-y8u2j pre-split inventory (parent + sub-routers), now split
// between the query router and the module router tree.
const PRE_SPLIT_HORSES_INVENTORY = [
  'GET /',
  'POST /',
  'POST /batch-update',
  'GET /:id',
  'PUT /:id',
  'DELETE /:id',
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

  it('RETIRED (q152): the trait card and trait trends are hosted by neither horses router', () => {
    const union = new Set([...sigsOf(horseQueryRoutes), ...sigsOf(horseRoutes)]);
    for (const sig of retiredTraitReportRoutes) {
      expect(union.has(sig)).toBe(false);
    }
  });

  it('EXACT: horseQueryRoutes exposes exactly the re-homed horse reads', () => {
    expect(sigsOf(horseQueryRoutes)).toEqual(HORSE_QUERY_ROUTES);
    // and the module tree no longer hosts them (no duplicate first-match candidates)
    const moduleSigs = new Set(sigsOf(horseRoutes));
    for (const sig of HORSE_QUERY_ROUTES) {
      expect(moduleSigs.has(sig)).toBe(false);
    }
  });

  it('RETIRED (Equoria-oey96.40): GET /dashboard/:userId is hosted by no router and no users query router is mounted', () => {
    expect(new Set(sigsOf(userRoutes)).has('GET /dashboard/:userId')).toBe(false);
    const { authRouter } = buildRouters();
    // Every mounted router layer: none may host the retired dashboard route.
    const hosted = authRouter.stack.filter(l => l.name === 'router').flatMap(l => sigsOf(l.handle));
    expect(hosted).not.toContain('GET /dashboard/:userId');
    const queryDir = new URL('../app/queries/', import.meta.url);
    expect(existsSync(new URL('userQueryRoutes.mjs', queryDir))).toBe(false);
    expect(existsSync(new URL('userDashboardQuery.mjs', queryDir))).toBe(false);
  });

  it('MOUNT ORDER: /horses query router BEFORE horseRoutes', () => {
    const { authRouter } = buildRouters();
    const handles = authRouter.stack.filter(l => l.name === 'router').map(l => l.handle);
    const idx = router => handles.indexOf(router);
    expect(idx(horseQueryRoutes)).toBeGreaterThanOrEqual(0);
    expect(idx(horseRoutes)).toBeGreaterThanOrEqual(0);
    expect(idx(userRoutes)).toBeGreaterThanOrEqual(0);
    // /horses: the six reads were reached before any competing route at base.
    expect(idx(horseQueryRoutes)).toBeLessThan(idx(horseRoutes));
  });

  it('MOUNT PREFIX: each query router is mounted on its own prefix', () => {
    const { authRouter } = buildRouters();
    const layerOf = router => authRouter.stack.find(l => l.name === 'router' && l.handle === router);
    const horsesLayer = layerOf(horseQueryRoutes);
    expect(horsesLayer.regexp.test('/horses/42/history')).toBe(true);
    expect(horsesLayer.regexp.test('/users/42')).toBe(false);
  });

  it('NO PATH-LESS USE: every layer of the horses query router is a route', () => {
    expect(horseQueryRoutes.stack.length).toBeGreaterThan(0);
    expect(horseQueryRoutes.stack.every(l => Boolean(l.route))).toBe(true);
  });

  describe('bank-owned GET /users/transactions (Equoria-q4uem.4, WS4 S4)', () => {
    it('EXACT + NO PATH-LESS USE: the bank users-router exposes exactly GET /transactions', () => {
      expect(sigsOf(bankUserTransactionsRoutes)).toEqual(['GET /transactions']);
      expect(bankUserTransactionsRoutes.stack.every(l => Boolean(l.route))).toBe(true);
      // userRoutes no longer hosts it (one first-match candidate only)
      expect(new Set(sigsOf(userRoutes)).has('GET /transactions')).toBe(false);
    });

    it('MOUNT ORDER + PREFIX: mounted on /users BEFORE userRoutes (base registered /transactions ahead of /:id)', () => {
      const { authRouter } = buildRouters();
      const layers = authRouter.stack.filter(l => l.name === 'router');
      const handles = layers.map(l => l.handle);
      const idx = router => handles.indexOf(router);
      expect(idx(bankUserTransactionsRoutes)).toBeGreaterThanOrEqual(0);
      expect(idx(bankUserTransactionsRoutes)).toBeLessThan(idx(userRoutes));
      const layer = layers.find(l => l.handle === bankUserTransactionsRoutes);
      expect(layer.regexp.test('/users/transactions')).toBe(true);
      expect(layer.regexp.test('/bank/transactions')).toBe(false);
    });

    it('CHAIN: GET /transactions runs exactly [queryRateLimiter, authenticateToken, getTransactionHistory], base order', () => {
      // Equoria-q4uem.4 (WS4 S4, review M3): the move from userRoutes to the bank
      // router must keep the executed chain byte-identical; pin the live handler
      // references in order, not just the route signature.
      const [layer] = bankUserTransactionsRoutes.stack;
      expect(layer.route.path).toBe('/transactions');
      const handles = layer.route.stack.map(l => l.handle);
      expect(handles).toEqual([queryRateLimiter, authenticateToken, getTransactionHistory]);
      expect(handles).toHaveLength(3);
      expect(handles[0]).toBe(queryRateLimiter);
      expect(handles[1]).toBe(authenticateToken);
      expect(handles[2]).toBe(getTransactionHistory);
    });
  });
});
