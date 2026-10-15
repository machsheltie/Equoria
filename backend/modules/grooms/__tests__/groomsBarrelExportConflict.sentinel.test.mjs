/**
 * Sentinel: grooms barrel must NOT have ambiguous star exports (Equoria-p7z26).
 *
 * THE DEFECT THIS GUARDS: backend/modules/grooms/index.mjs used to star-export both
 * controllers/groomController.mjs and services/groomProgressionService.mjs, and BOTH
 * export `getGroomProfile`. ESM treats a name star-exported by 2+ modules as ambiguous:
 * it silently vanishes from the namespace, and a NAMED re-export of it through the
 * barrel throws at module-link time:
 *   "contains conflicting star exports for name 'getGroomProfile'"
 *
 * Historically the canary was the Epic-20 shim backend/controllers/groomController.mjs,
 * which re-exported `getGroomProfile` from the barrel. That shim was retired in
 * Equoria-v8l96.5 (the whole backend/controllers/ compat-shim directory was deleted),
 * and this suite was re-pointed at the barrel, which then carried the invariant as an
 * explicit named re-export disambiguating `getGroomProfile` to the controller handler.
 *
 * CONTRACT CHANGE (Equoria-q4uem.4, WS4 S4, controller ruling G1):
 *   Old contract: the grooms barrel exposes the controller `getGroomProfile` without a
 *   conflicting star export.
 *   New ruling (WS4 design rule 2: no controllers in barrels): the barrel has no
 *   `export *`; `barrel.getGroomProfile` is undefined; both definers stay reachable by
 *   same-module deep import with arities 2 and 1 and distinct references.
 * p7z26's intent — no silent shadowing and no ambiguous export — is preserved: a barrel
 * built only from named re-exports cannot merge two `getGroomProfile`s, and the HTTP
 * handler is not a cross-module capability (backend/app/routers.mjs wires route modules).
 *
 * SENTINEL-POSITIVE intent: re-introducing `export *` for either defining file fails the
 * source check AND surfaces `getGroomProfile` on the barrel namespace (one star) or makes
 * it ambiguous (two stars; the source check still fails). Proven RED on a planted
 * `export * from './controllers/groomController.mjs'` and GREEN on the clean barrel
 * (WS4 report, S4e).
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BARREL_PATH = resolve(__dirname, '..', 'index.mjs');

describe('grooms barrel — no conflicting star exports (Equoria-p7z26)', () => {
  it('barrel source has no `export *` in executable code (named re-exports only)', () => {
    const source = readFileSync(BARREL_PATH, 'utf8');
    // Strip /* … */ and // … comments so the header's own mention of `export *` cannot trip this.
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/\bexport\s*\*/);
  });

  it('barrel loads and does not expose getGroomProfile (neither definer leaks through a merge)', async () => {
    const barrel = await import('../index.mjs');
    // Non-vacuous: the barrel really loaded and carries its named service contract.
    expect(Object.keys(barrel).length).toBeGreaterThan(0);
    expect(barrel.getGroomProfile).toBeUndefined();
    expect(Object.keys(barrel)).not.toContain('getGroomProfile');
  });

  it('controller getGroomProfile remains reachable via same-module deep import (req,res arity)', async () => {
    const controller = await import('../controllers/groomController.mjs');
    expect(typeof controller.getGroomProfile).toBe('function');
    // The controller handler signature is (req, res) -> arity 2.
    expect(controller.getGroomProfile.length).toBe(2);
  });

  it('service getGroomProfile remains reachable via same-module deep import, distinct from the controller', async () => {
    const service = await import('../services/groomProgressionService.mjs');
    const controller = await import('../controllers/groomController.mjs');
    expect(typeof service.getGroomProfile).toBe('function');
    // Service signature is (groomId) -> arity 1; distinct from the controller.
    expect(service.getGroomProfile.length).toBe(1);
    expect(service.getGroomProfile).not.toBe(controller.getGroomProfile);
  });
});
