/**
 * Sentinel: grooms barrel must NOT have ambiguous star exports (Equoria-p7z26).
 *
 * backend/modules/grooms/index.mjs star-exports both
 * controllers/groomController.mjs and services/groomProgressionService.mjs,
 * and BOTH historically exported `getGroomProfile`. ESM treats a name
 * star-exported by 2+ modules as ambiguous; a NAMED re-export of that name
 * through the barrel throws at module-link time:
 *   "contains conflicting star exports for name 'getGroomProfile'"
 *
 * This is the exact failure path of the Epic-20 shim
 * backend/controllers/groomController.mjs, which does
 *   export { ..., getGroomProfile, ... } from '../modules/grooms/index.mjs';
 *
 * The fix is an explicit named re-export in the barrel that disambiguates
 * `getGroomProfile` to the controller HTTP handler (the cross-module public
 * surface the shim consumes). The service `getGroomProfile(groomId)` remains
 * reachable via same-module deep import.
 *
 * SENTINEL-POSITIVE intent: this suite imports the shim. Before the fix it
 * threw SyntaxError at link time (whole suite fails to load). After the fix
 * the shim loads and exposes the controller handler.
 */

import { describe, it, expect } from '@jest/globals';

describe('grooms barrel — no conflicting star exports (Equoria-p7z26)', () => {
  it('Epic-20 shim controllers/groomController.mjs loads without SyntaxError', async () => {
    // If the barrel re-introduces the ambiguous star export, this dynamic
    // import rejects with the "conflicting star exports" SyntaxError.
    const shim = await import('../../../controllers/groomController.mjs');
    expect(typeof shim.getGroomProfile).toBe('function');
  });

  it('barrel exposes getGroomProfile as the controller HTTP handler (req,res arity)', async () => {
    const barrel = await import('../index.mjs');
    expect(typeof barrel.getGroomProfile).toBe('function');
    // The controller handler signature is (req, res) -> arity 2.
    // The service signature is (groomId) -> arity 1. Assert we exposed the
    // controller handler, not the service, through the public barrel surface.
    expect(barrel.getGroomProfile.length).toBe(2);
  });

  it('shim re-exports the same getGroomProfile reference the controller exports', async () => {
    const shim = await import('../../../controllers/groomController.mjs');
    const controller = await import('../controllers/groomController.mjs');
    expect(shim.getGroomProfile).toBe(controller.getGroomProfile);
  });

  it('service getGroomProfile remains reachable via same-module deep import', async () => {
    const service = await import('../services/groomProgressionService.mjs');
    expect(typeof service.getGroomProfile).toBe('function');
    // Service signature is (groomId) -> arity 1; distinct from the controller.
    expect(service.getGroomProfile.length).toBe(1);
  });
});
