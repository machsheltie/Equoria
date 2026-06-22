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
 * Historically the canary for this was the Epic-20 shim
 * backend/controllers/groomController.mjs, which did
 *   export { ..., getGroomProfile, ... } from '../modules/grooms/index.mjs';
 * That shim was retired in Equoria-v8l96.5 (the whole backend/controllers/
 * compat-shim directory was deleted). The invariant it guarded still lives on
 * the BARREL: the explicit named re-export in index.mjs that disambiguates
 * `getGroomProfile` to the controller HTTP handler. This sentinel is therefore
 * re-pointed at the barrel itself (the module that actually owns the
 * invariant) instead of the deleted shim.
 *
 * The fix is an explicit named re-export in the barrel that disambiguates
 * `getGroomProfile` to the controller HTTP handler (the cross-module public
 * surface). The service `getGroomProfile(groomId)` remains reachable via
 * same-module deep import.
 *
 * SENTINEL-POSITIVE intent: this suite imports the barrel and reads
 * `getGroomProfile`. If the barrel re-introduces the ambiguous star export
 * (i.e. drops the explicit named re-export), ESM rejects the import at
 * link time with the "conflicting star exports" SyntaxError and the whole
 * suite fails to load — exactly the regression this guards.
 */

import { describe, it, expect } from '@jest/globals';

describe('grooms barrel — no conflicting star exports (Equoria-p7z26)', () => {
  it('barrel module loads without the "conflicting star exports" SyntaxError', async () => {
    // If the barrel re-introduces the ambiguous star export, this dynamic
    // import rejects with the "conflicting star exports" SyntaxError at link
    // time. (Was previously asserted via the now-deleted Epic-20 shim.)
    const barrel = await import('../index.mjs');
    expect(typeof barrel.getGroomProfile).toBe('function');
  });

  it('barrel exposes getGroomProfile as the controller HTTP handler (req,res arity)', async () => {
    const barrel = await import('../index.mjs');
    expect(typeof barrel.getGroomProfile).toBe('function');
    // The controller handler signature is (req, res) -> arity 2.
    // The service signature is (groomId) -> arity 1. Assert we exposed the
    // controller handler, not the service, through the public barrel surface.
    expect(barrel.getGroomProfile.length).toBe(2);
  });

  it('barrel re-exports the same getGroomProfile reference the controller exports', async () => {
    const barrel = await import('../index.mjs');
    const controller = await import('../controllers/groomController.mjs');
    expect(barrel.getGroomProfile).toBe(controller.getGroomProfile);
  });

  it('service getGroomProfile remains reachable via same-module deep import', async () => {
    const service = await import('../services/groomProgressionService.mjs');
    expect(typeof service.getGroomProfile).toBe('function');
    // Service signature is (groomId) -> arity 1; distinct from the controller.
    expect(service.getGroomProfile.length).toBe(1);
  });
});
