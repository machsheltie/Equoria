/**
 * Sentinel: module-import TDZ circular-dependency regression guard (Equoria-hk739).
 *
 * Three backend test suites used to FAIL TO LOAD (Jest "Test suite failed to
 * run", 0 tests executed) because of two temporal-dead-zone (TDZ) circular
 * imports through module barrels:
 *
 *   1. AUTH cycle — `Cannot access 'register' before initialization`.
 *      authController.mjs re-exports onboardingController.mjs and imports
 *      onboardingService.mjs; BOTH imported the full horses barrel
 *      (../../horses/index.mjs). The horses barrel re-exports the horses
 *      route/controller subgraph, which transitively re-enters the auth barrel
 *      (auth/index.mjs -> authRoutes.mjs) WHILE authController.mjs is still
 *      mid-evaluation. authRoutes.mjs reads `authController.register` — a
 *      `const` declared later in authController, still in its temporal dead
 *      zone — and the import chain crashed. This broke:
 *        - modules/auth/__tests__/buildStarterSettings.test.mjs
 *        - modules/auth/__tests__/starterKitInventory.test.mjs
 *
 *   2. COMPETITION cycle — `Cannot access 'conformationShowRoutes' before
 *      initialization`. conformationShowScoring.mjs imported the full horses
 *      barrel; the barrel's horses route subgraph re-entered the in-progress
 *      competitionRoutes.mjs -> conformationShowRoutes.mjs default export
 *      (the `router` const, still in TDZ). This broke:
 *        - modules/competition/__tests__/conformationShowRoutes.test.mjs
 *
 * FIX: deep-import the specific CLEAN LEAF horses services (which import only
 * utils/constants/data, no routes/controllers/barrels) instead of the full
 * horses barrel. See the eslint-disabled imports in:
 *   - modules/auth/services/onboardingService.mjs
 *   - modules/auth/controllers/onboardingController.mjs
 *   - modules/competition/services/conformationShowScoring.mjs
 *
 * SENTINEL-POSITIVE intent (why STATIC top-level imports, not dynamic import()):
 * the original failure is a MODULE-LINK-TIME TDZ — it only reproduces when the
 * cycling module is imported STATICALLY at the top of a module, exactly how the
 * three broken suites imported it. A dynamic `await import()` inside a test body
 * resolves the graph in a different order and does NOT reliably reproduce the
 * link-time crash (verified during this fix: reverting the leaf-import to the
 * barrel crashed conformationShowRoutes.test.mjs but a dynamic-import sentinel
 * still passed). So this sentinel imports the same entry points the broken
 * suites did via STATIC imports below. If any leaf deep-import is reverted to
 * the horses barrel, THIS SUITE fails to LOAD with the exact TDZ ReferenceError
 * — surfacing the regression loudly instead of letting it hide as a silent
 * "1 suite failed to load" with zero coverage.
 */

import { describe, it, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// STATIC imports — these are the cycle entry points. If the TDZ regresses, the
// import chain throws "Cannot access 'register' / 'conformationShowRoutes'
// before initialization" at module-link time and the whole suite fails to load.
import * as authController from '../../modules/auth/controllers/authController.mjs';
import * as authBarrel from '../../modules/auth/index.mjs';
// Equoria-q4uem.4 (WS4 S4, controller ruling Q5): barrels no longer surface route
// defaults (old contract: barrels surface route defaults; new ruling: they do
// not), so the two route modules that were the cycle re-entry points are imported
// statically here, which keeps the module-link-time TDZ probe intact.
import authRoutes from '../../modules/auth/routes/authRoutes.mjs';
import competitionRoutes from '../../modules/competition/routes/competitionRoutes.mjs';
import * as onboardingService from '../../modules/auth/services/onboardingService.mjs';
import * as onboardingController from '../../modules/auth/controllers/onboardingController.mjs';
import conformationShowRoutes from '../../modules/competition/routes/conformationShowRoutes.mjs';
import * as conformationShowScoring from '../../modules/competition/services/conformationShowScoring.mjs';
import * as horsesBarrel from '../../modules/horses/index.mjs';

describe('module-import TDZ circular-dependency sentinel (Equoria-hk739)', () => {
  it('authController finished evaluation past the register TDZ point', () => {
    // `register` is a `const` declared mid-module — its presence proves the
    // module evaluated past the point that used to crash on the cycle.
    expect(typeof authController.register).toBe('function');
    expect(typeof authController.login).toBe('function');
    expect(typeof authController.buildStarterSettings).toBe('function');
  });

  it('auth barrel links without surfacing register; authRoutes (the cycle re-entry point) links as a route module', () => {
    // Old contract: the auth barrel surfaced the controller handler `register`. New ruling
    // (Equoria-q4uem.4, WS4 S5-pre): no barrel re-exports a controller in any block, so the
    // barrel is still the module-link-time TDZ probe (it links and carries its constants) and
    // `register` is reached through authController.mjs, asserted above.
    expect(typeof authBarrel.ALLOWED_PREFERENCE_KEYS).toBe('object');
    expect(authBarrel.register).toBeUndefined();
    expect(typeof authRoutes).toBe('function'); // express Router default, imported directly (WS4 S4)
  });

  it('auth onboarding service + controller imported their leaf horses deps', () => {
    expect(typeof onboardingService.createStarterHorseForNewUser).toBe('function');
    expect(typeof onboardingController.completeOnboarding).toBe('function');
    expect(typeof onboardingController.advanceOnboarding).toBe('function');
  });

  it('conformationShowRoutes default export is the express Router (router const not in TDZ)', () => {
    expect(typeof conformationShowRoutes).toBe('function');
    expect(Array.isArray(conformationShowRoutes.stack)).toBe(true);
  });

  it('conformationShowScoring + competitionRoutes evaluated cleanly', () => {
    expect(typeof conformationShowScoring.CONFORMATION_SHOW_CONFIG).toBe('object');
    expect(typeof competitionRoutes).toBe('function'); // route module imported directly (WS4 S4)
  });

  it('horses barrel surfaces the symbols the former carve-outs now import from it (WS4 S6)', () => {
    expect(typeof horsesBarrel.generateGenotype).toBe('function');
    expect(typeof horsesBarrel.calculatePhenotype).toBe('function');
    expect(typeof horsesBarrel.generateMarkings).toBe('function');
    expect(typeof horsesBarrel.generateTemperamentWithDefault).toBe('function');
    expect(typeof horsesBarrel.calculateOverallConformation).toBe('function');
  });
});

// WS4 S6 (Equoria-q4uem.4): the nine Equoria-hk739 carve-outs now import the horses barrel.
// The static imports above prove the whole graph links from this suite's entry point; this
// block proves EVALUATION ORDER for each converted file on its own — a fresh Node process whose
// entry point is that file, so the horses barrel is reached from it first — and fails on the
// exact symptom hk739 guarded ("Cannot access … before initialization").
describe('import-only evaluation-order smoke for the former hk739 carve-outs (WS4 S6)', () => {
  const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const CONVERTED = [
    'backend/modules/auth/controllers/onboardingController.mjs',
    'backend/modules/auth/services/onboardingService.mjs',
    'backend/modules/competition/services/conformationShowScoring.mjs',
  ];
  for (const file of CONVERTED) {
    it(`${file} evaluates alone in a fresh process without a temporal-dead-zone error`, () => {
      const url = pathToFileURL(path.join(REPO_ROOT, file)).href;
      const res = spawnSync(
        process.execPath,
        [
          '--env-file=backend/.env.test',
          '--input-type=module',
          '-e',
          `const m = await import(${JSON.stringify(url)}); if (Object.keys(m).length === 0) throw new Error('no exports');`,
        ],
        { cwd: REPO_ROOT, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'test' } },
      );
      expect(res.stderr).not.toMatch(/before initialization/);
      expect(res.status).toBe(0);
    });
  }
});
