/**
 * duplicateLookupsRetired.sentinel.test.mjs (Equoria-a7f1p, owner ruling q151)
 *
 * Owner ruling 2026-10-28 (q151, "Remove the duplicates"): the behind-the-scenes
 * lookups that copy something a screen already reads from another route are
 * removed. Old contract: each route below answered under /api/v1. New ruling:
 * no mounted router hosts them, and the route each screen actually reads stays.
 *
 * The walker follows the real authRouter from backend/app/routers.mjs the way
 * Express 4 dispatches: a router layer whose prefix matches hands the rest of
 * the path to its sub-router, a route layer must match the path and the method.
 */

import { describe, it, expect } from '@jest/globals';
import { buildRouters } from '../app/routers.mjs';

function hosts(router, method, path) {
  for (const layer of router.stack) {
    if (!layer.match(path)) {
      continue;
    }
    if (layer.route) {
      const methods = layer.route.methods;
      if (methods[method.toLowerCase()] || methods._all) {
        return true;
      }
    } else if (layer.handle && Array.isArray(layer.handle.stack)) {
      const rest = path.slice(layer.path.length) || '/';
      if (hosts(layer.handle, method, rest.startsWith('/') ? rest : `/${rest}`)) {
        return true;
      }
    }
  }
  return false;
}

const retiredDuplicates = [
  ['GET', '/horses/41/history'],
  ['GET', '/competition/horse/41/results'],
  ['GET', '/bank/transactions'],
  ['GET', '/leaderboards/players/xp'],
  ['GET', '/leaderboards/horses/earnings'],
  ['GET', '/leaderboards/horses/performance'],
  ['GET', '/leaderboards/players/horse-earnings'],
  ['GET', '/leaderboards/recent-winners'],
  ['GET', '/leaderboards/stats'],
  ['GET', '/leaderboards/competition'],
  ['GET', '/grooms/definitions'],
  ['GET', '/grooms/assignments/41'],
  ['GET', '/groom-assignments/groom/41/limits'],
  ['GET', '/groom-assignments/salary-costs'],
  ['POST', '/groom-assignments/validate'],
  ['GET', '/groom-assignments/dashboard'],
  ['GET', '/groom-assignments/config'],
  ['GET', '/groom-salaries/history'],
  ['GET', '/groom-salaries/groom/41/salary'],
  ['GET', '/grooms/41/bonus-traits'],
];

// The routes the screens read instead; they must stay mounted. They also prove
// the walker finds a hosted route, so the retired assertions cannot pass vacuously.
const keptSources = [
  ['GET', '/competition/results/horse/41'],
  ['GET', '/horses/41/competition-history'],
  ['GET', '/users/transactions'],
  ['GET', '/leaderboards/boards/playerXp'],
  ['GET', '/leaderboards/user-summary/41'],
  ['GET', '/leaderboards/horse/41'],
  ['GET', '/grooms/user/41'],
  ['GET', '/groom-assignments'],
  ['GET', '/groom-salaries/cost'],
];

describe('duplicate lookups retired (Equoria-a7f1p, q151)', () => {
  const { authRouter } = buildRouters();

  it.each(retiredDuplicates)('%s %s is hosted by no mounted router', (method, path) => {
    expect(hosts(authRouter, method, path)).toBe(false);
  });

  it.each(keptSources)('%s %s, the source a screen reads, stays mounted', (method, path) => {
    expect(hosts(authRouter, method, path)).toBe(true);
  });
});
