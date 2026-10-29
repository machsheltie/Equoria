/**
 * trainerDiscoveryRetired.sentinel.test.mjs (Equoria-oey96.47, owner ruling q304)
 *
 * Owner ruling 2026-10-29 (q304): the trainer "discovery" panel and its saved data
 * are retired. Old contract: GET /api/v1/trainers/:id/discovery answered six
 * generated discovery slots, persisted on the trainer row. New ruling: no mounted
 * router hosts that read, and the trainer reads the screens use (roster, hire,
 * assignments, roster cap, dismiss) stay. Trainers keep their speciality (secret
 * until Expert, trainerSpecialitySecretUntilExpert.integration.test.mjs) and fit.
 *
 * The walker follows the real authRouter from backend/app/routers.mjs the way
 * Express 4 dispatches (same walker as duplicateLookupsRetired.sentinel).
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

const retired = [['GET', '/trainers/41/discovery']];

// The trainer routes the screens read; they must stay mounted. They also prove the
// walker finds a hosted route, so the retired assertion cannot pass vacuously.
const kept = [
  ['GET', '/trainers/user/0b6f1c2e-6a7d-4f7e-9a51-3f2d8c4b5a61'],
  ['GET', '/trainers/marketplace'],
  ['POST', '/trainers/marketplace/hire'],
  ['GET', '/trainers/assignments'],
  ['GET', '/trainers/roster-cap'],
  ['DELETE', '/trainers/41/dismiss'],
];

describe('trainer discovery retired (Equoria-oey96.47, q304)', () => {
  const { authRouter } = buildRouters();

  it.each(retired)('%s %s is hosted by no mounted router', (method, path) => {
    expect(hosts(authRouter, method, path)).toBe(false);
  });

  it.each(kept)('%s %s stays mounted', (method, path) => {
    expect(hosts(authRouter, method, path)).toBe(true);
  });
});
