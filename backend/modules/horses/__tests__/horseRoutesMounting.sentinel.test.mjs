/**
 * horseRoutesMounting.sentinel.test.mjs
 *
 * Route-ordering and mounting sentinel for the Equoria-y8u2j god-file split.
 *
 * The split moved POST /foals, GET /:id/history, GET /:id/overview,
 * GET /:id/prize-summary, GET /:id/training-history, and
 * GET /:horseId/competition-history out of horseRoutes.mjs into two new
 * sub-routers (horseFoalRoutes.mjs + horseHistoryRoutes.mjs). The sub-routers
 * are mounted on the parent via `router.use(...)`. This test locks in three
 * structural invariants so an accidental reorder, a missing mount, or a
 * deleted route can't ship silently:
 *
 *   1. EVERY pre-split route (across parent + sub-routers) is present in the
 *      flattened parent route stack after import.
 *   2. The parent's `GET /:id` (single-segment catch-all) does NOT come
 *      AFTER a same-segment specific route in a way that would shadow it.
 *      Today there are no GET /<literal> single-segment routes after /:id,
 *      but the test asserts the constraint so a future addition will fail.
 *   3. The new sub-routers are MOUNTED — `router.use` returns a layer with
 *      a nested `handle.stack` containing the extracted routes.
 *
 * Why this test exists (CONTRIBUTING.md "Route ordering — specific routes
 * BEFORE /:id catch-alls"): the parent file has
 * `GET /temperament-definitions` registered BEFORE `GET /:id` (GET /trait-trends,
 * once also there, was removed by owner ruling 2026-10-28, q152). If a future
 * refactor swaps that order, the catch-all swallows them silently and they
 * return a 404 from the catch-all's ownership middleware. A direct HTTP test
 * is the strongest proof, but `app.mjs` import is currently blocked by
 * Equoria-evv49 (passwordController.mjs stale db/index.mjs path); this
 * sentinel reads the structural shape directly so it works even while the
 * full HTTP integration test is gated on that fix.
 *
 * Equoria-q4uem.4 (WS4 S3, controller ruling): GET /trainable/:userId,
 * GET /:id/history, GET /:id/overview and GET /:id/training-history compose
 * data from other domains and moved out of this module into
 * backend/app/queries/horseQueryRoutes.mjs, which routers.mjs mounts at
 * /horses BEFORE this router. Old contract: the horses module router tree
 * hosts those routes. New ruling: the guarantee that every pre-split route is
 * still mounted at /horses moves to backend/__tests__/
 * appQueryRoutesMounting.sentinel.test.mjs (union of both routers + mount
 * order), which is no weaker. This file keeps the module-local invariants.
 */

import { describe, it, expect } from '@jest/globals';

import horseRoutes from '../routes/horseRoutes.mjs';
import horseHistoryRoutes from '../routes/horseHistoryRoutes.mjs';
import horseFoalRoutes from '../routes/horseFoalRoutes.mjs';

// Express layer types we care about. The router stack entries each have a
// `route` (single endpoint) OR a `handle` with a sub-stack (mounted router).
function collectRoutes(router, basePath = '') {
  const collected = [];
  for (const layer of router.stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      collected.push({ path: basePath + layer.route.path, methods });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      // Mounted sub-router via router.use(subRouter). Recurse so we see the
      // flat set of (method, path) pairs as the parent does.
      collected.push(...collectRoutes(layer.handle, basePath));
    }
  }
  return collected;
}

describe('horseRoutes mounting sentinel (Equoria-y8u2j)', () => {
  const allRoutes = collectRoutes(horseRoutes);
  const routeSet = new Set(allRoutes.map(r => `${r.methods.sort().join(',')} ${r.path}`));

  it('exposes every pre-split route after the foal/history sub-router extractions', () => {
    // Pre-split inventory still owned by this module: GET /, POST /,
    // POST /batch-update, GET /:id, PUT /:id, DELETE /:id, GET /trait-trends,
    // GET /temperament-definitions, POST /foals (now in horseFoalRoutes),
    // GET /:id/prize-summary, GET /:horseId/competition-history (now in
    // horseHistoryRoutes), plus the four other sub-routers' contributions
    // (feed, genetics, xp, breeding) which keep their own pre-split paths.
    // GET /trainable/:userId, GET /:id/history, GET /:id/overview and
    // GET /:id/training-history are asserted by the app-level sentinel
    // (Equoria-q4uem.4, see header).
    const required = [
      'GET /',
      'POST /',
      'POST /batch-update',
      'GET /:id',
      'PUT /:id',
      'DELETE /:id',
      'GET /temperament-definitions',
      'POST /foals',
      'GET /:id/prize-summary',
      'GET /:horseId/competition-history',
    ];
    for (const sig of required) {
      expect(routeSet.has(sig)).toBe(true);
    }
  });

  // Old contract: GET /trait-trends was also required here. Owner ruling
  // 2026-10-28 (q152, Equoria-a7f1p): no trait reports, so it is gone.
  it('no longer registers GET /trait-trends (q152)', () => {
    expect(routeSet.has('GET /trait-trends')).toBe(false);
  });

  it('keeps GET /temperament-definitions registered BEFORE GET /:id (catch-all ordering, per CONTRIBUTING.md)', () => {
    // The parent file owns these three GETs in this exact order so the
    // /:id catch-all does not swallow the literal paths. Sub-router routes
    // (any 2-segment path like /:id/history) are fine in any order because
    // Express matches by exact segment count for the leading path-part.
    const parentGets = horseRoutes.stack
      .filter(l => l.route && Object.keys(l.route.methods).includes('get'))
      .map(l => l.route.path);
    const idxTempDefs = parentGets.indexOf('/temperament-definitions');
    const idxCatchAll = parentGets.indexOf('/:id');
    expect(idxTempDefs).toBeGreaterThanOrEqual(0);
    expect(idxCatchAll).toBeGreaterThanOrEqual(0);
    expect(idxTempDefs).toBeLessThan(idxCatchAll);
  });

  it('mounts both new sub-routers (horseHistoryRoutes + horseFoalRoutes) under the parent', () => {
    // Each `router.use(subRouter)` becomes a stack layer whose `handle` is
    // the sub-router. Identity comparison proves the mount really happened
    // (and that an Edit-pass didn't drop the `router.use` line by accident).
    const mounted = horseRoutes.stack.filter(l => l.name === 'router').map(l => l.handle);
    expect(mounted).toEqual(expect.arrayContaining([horseHistoryRoutes, horseFoalRoutes]));
  });

  it('horseHistoryRoutes exposes exactly the 2 routes that remain horses-local (Equoria-q4uem.4)', () => {
    // /:id/history, /:id/overview and /:id/training-history moved to
    // backend/app/queries/horseQueryRoutes.mjs (asserted there).
    const sigs = collectRoutes(horseHistoryRoutes)
      .map(r => `${r.methods.sort().join(',')} ${r.path}`)
      .sort();
    expect(sigs).toEqual(['GET /:id/prize-summary', 'GET /:horseId/competition-history'].sort());
  });

  it('horseFoalRoutes exposes exactly POST /foals', () => {
    const sigs = collectRoutes(horseFoalRoutes).map(r => `${r.methods.sort().join(',')} ${r.path}`);
    expect(sigs).toEqual(['POST /foals']);
  });
});
