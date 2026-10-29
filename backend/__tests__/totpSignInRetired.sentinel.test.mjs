/**
 * totpSignInRetired.sentinel.test.mjs (Equoria-a7f1p, owner ruling q305)
 *
 * Owner ruling 2026-10-29 (q305): authenticator-app (TOTP) sign-in is removed
 * entirely. Old contract: POST /api/v1/auth/mfa/enroll, /mfa/verify-enrollment and
 * /mfa/disable managed a TOTP secret, and /auth/login answered an enrolled account
 * with an mfaChallengeToken that POST /auth/mfa/challenge exchanged for a session.
 * New ruling: no mounted router hosts any of the four, and sign-in, the recovery-
 * address change and the staff emailed check-in stay.
 *
 * The walker follows the real routers from backend/app/routers.mjs the way Express 4
 * dispatches (same walker as duplicateLookupsRetired.sentinel).
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

// authRouter paths are relative to its /api/v1 mount; publicRouter paths are absolute.
const retiredAuthenticated = [
  ['POST', '/auth/mfa/enroll'],
  ['POST', '/auth/mfa/verify-enrollment'],
  ['POST', '/auth/mfa/disable'],
];
const retiredPublic = [['POST', '/api/v1/auth/mfa/challenge']];

// What stays: they also prove the walker finds hosted routes (no vacuous pass).
const keptAuthenticated = [
  ['POST', '/auth/email-change/request'],
  ['GET', '/auth/email-change/status'],
];
const keptPublic = [
  ['POST', '/api/v1/auth/login'],
  ['GET', '/api/v1/auth/email-change/confirm'],
];

describe('authenticator-app sign-in retired (Equoria-a7f1p, q305)', () => {
  const { publicRouter, authRouter, staffRouter } = buildRouters();

  it.each(retiredAuthenticated)('%s %s is hosted by no signed-in router', (method, path) => {
    expect(hosts(authRouter, method, path)).toBe(false);
  });

  it.each(retiredPublic)('%s %s is hosted by no public router', (method, path) => {
    expect(hosts(publicRouter, method, path)).toBe(false);
  });

  it.each(keptAuthenticated)('%s %s stays mounted', (method, path) => {
    expect(hosts(authRouter, method, path)).toBe(true);
  });

  it.each(keptPublic)('%s %s stays mounted', (method, path) => {
    expect(hosts(publicRouter, method, path)).toBe(true);
  });

  it('the staff emailed check-in router is still built', () => {
    expect(Array.isArray(staffRouter.stack)).toBe(true);
    expect(staffRouter.stack.length).toBeGreaterThan(0);
  });
});
