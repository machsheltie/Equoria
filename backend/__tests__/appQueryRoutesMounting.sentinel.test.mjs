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
 *   3. MOUNT ORDER + PREFIX — the order that reproduces base first-match
 *      behaviour, prefix by prefix: on /horses the query router is mounted
 *      BEFORE horseRoutes (at base the six reads were reached before any other
 *      two-segment route); on /users the query router is mounted AFTER
 *      userRoutes (at base GET /:id/progress and GET /:id/activity were
 *      registered before GET /dashboard/:userId, so GET /users/dashboard/progress
 *      must keep matching /:id/progress). Each query-router layer must also be
 *      mounted on its own prefix. Sentinel-positive: swapping either prefix's
 *      two mount lines in routers.mjs fails this test (recorded in the WS4 report).
 *   4. NO PATH-LESS USE — every layer of both query routers is a route. A
 *      path-less router.use() in a router mounted ahead of the module router
 *      would execute for every request on that prefix, which base never did.
 */

import { describe, it, expect } from '@jest/globals';
import { buildRouters } from '../app/routers.mjs';
import horseQueryRoutes from '../app/queries/horseQueryRoutes.mjs';
import userQueryRoutes from '../app/queries/userQueryRoutes.mjs';
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

  it('MOUNT ORDER: /horses query router BEFORE horseRoutes; /users query router AFTER userRoutes', () => {
    const { authRouter } = buildRouters();
    const handles = authRouter.stack.filter(l => l.name === 'router').map(l => l.handle);
    const idx = router => handles.indexOf(router);
    expect(idx(horseQueryRoutes)).toBeGreaterThanOrEqual(0);
    expect(idx(horseRoutes)).toBeGreaterThanOrEqual(0);
    expect(idx(userQueryRoutes)).toBeGreaterThanOrEqual(0);
    expect(idx(userRoutes)).toBeGreaterThanOrEqual(0);
    // /horses: the six reads were reached before any competing route at base.
    expect(idx(horseQueryRoutes)).toBeLessThan(idx(horseRoutes));
    // /users: GET /:id/progress and GET /:id/activity preceded GET /dashboard/:userId
    // at base, so the module router must still see /users/dashboard/progress first.
    expect(idx(userRoutes)).toBeLessThan(idx(userQueryRoutes));
  });

  it('MOUNT PREFIX: each query router is mounted on its own prefix', () => {
    const { authRouter } = buildRouters();
    const layerOf = router => authRouter.stack.find(l => l.name === 'router' && l.handle === router);
    const horsesLayer = layerOf(horseQueryRoutes);
    const usersLayer = layerOf(userQueryRoutes);
    expect(horsesLayer.regexp.test('/horses/42/history')).toBe(true);
    expect(horsesLayer.regexp.test('/users/42')).toBe(false);
    expect(usersLayer.regexp.test('/users/dashboard/x')).toBe(true);
    expect(usersLayer.regexp.test('/horses/42')).toBe(false);
  });

  it('NO PATH-LESS USE: every layer of both query routers is a route', () => {
    expect(horseQueryRoutes.stack.length).toBeGreaterThan(0);
    expect(userQueryRoutes.stack.length).toBeGreaterThan(0);
    expect(horseQueryRoutes.stack.every(l => Boolean(l.route))).toBe(true);
    expect(userQueryRoutes.stack.every(l => Boolean(l.route))).toBe(true);
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
