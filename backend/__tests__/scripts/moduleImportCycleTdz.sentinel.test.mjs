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
 *      (../../horses/index.mjs). The horses barrel of that time re-exported the
 *      horses route/controller subgraph, which transitively re-entered the auth
 *      barrel (auth/index.mjs -> authRoutes.mjs) WHILE authController.mjs was
 *      still mid-evaluation. authRoutes.mjs read `authController.register` — a
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
 * HISTORY: hk739 first worked around the cycle with eslint-disabled deep imports
 * of the clean leaf horses services. WS4 (Equoria-q4uem.4) removed the CAUSE
 * instead: no barrel re-exports a route or a controller any more (S4, S5-pre),
 * so the horses barrel's static closure reaches no auth or competition file, and
 * since WS4 S6 the three files import the horses barrel (../../horses/index.mjs)
 * again, with the hk739 markers and carve-out comments gone:
 *   - modules/auth/services/onboardingService.mjs
 *   - modules/auth/controllers/onboardingController.mjs
 *   - modules/competition/services/conformationShowScoring.mjs
 * The module-graph doctrine gate (scripts/doctrine-checks/check-module-dependency-
 * graph.mjs: R2 strict, closure-based R4) keeps the cause out; THIS suite guards
 * the symptom.
 *
 * SENTINEL-POSITIVE intent (why STATIC top-level imports, not dynamic import()):
 * the original failure is a MODULE-LINK-TIME TDZ — it only reproduces when the
 * cycling module is imported STATICALLY at the top of a module, exactly how the
 * three broken suites imported it. A dynamic `await import()` inside a test body
 * resolves the graph in a different order and does NOT reliably reproduce the
 * link-time crash (verified during the hk739 fix: reverting the leaf-import to the
 * then-cyclic barrel crashed conformationShowRoutes.test.mjs but a dynamic-import
 * sentinel still passed). So this sentinel imports the same entry points the broken
 * suites did via STATIC imports below. If the horses barrel ever again reaches a
 * route or controller that re-enters auth or competition, THIS SUITE fails to LOAD
 * with the exact TDZ ReferenceError — surfacing the regression loudly instead of
 * letting it hide as a silent "1 suite failed to load" with zero coverage.
 *
 * The second describe block starts a FRESH Node process at each real entry point
 * (and at the three converted files) and proves the harness bites on a copy of the
 * cycle shape under the OS temp dir — see its comment for why the entry point matters.
 */

import { describe, it, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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

  it('auth onboarding service + controller evaluated with their horses-barrel imports (WS4 S6) without a TDZ', () => {
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

// WS4 S6 (Equoria-q4uem.4): the nine Equoria-hk739 carve-outs import the horses barrel again. The
// static imports above prove the whole graph links from this suite's entry point; this block proves
// EVALUATION ORDER from each REAL entry point in a fresh Node process, failing on the exact symptom
// hk739 guarded ("Cannot access … before initialization").
//
// Why the entry points and not (only) the converted files (S6 review, I2): the hk739 TDZ surfaces
// only when the process STARTS at the module whose `const` the cycle reads back while that module
// is still evaluating (authController.register; conformationShowRoutes' router). A process started
// at the converted file itself exits 0 even with the cycle present, because the upstream module
// then evaluates to completion before the route file reads it. The temp-shape arm below proves
// both halves on a copy of the cycle shape outside the repo, so the real-tree arms are known to
// be able to fail. The three converted files stay as extras.
//
// No `--env-file` (S6 review, I1): backend/.env.test is gitignored and absent in CI; the child
// inherits this process's environment, which Jest's setup has already loaded.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// Imports `url` as the entry point of a fresh Node process. `process.exit(0)` after a successful
// import keeps the probe about evaluation order (a route module may open handles on import).
function importAlone(url) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const m = await import(${JSON.stringify(url)}); if (Object.keys(m).length === 0) throw new Error('no exports'); process.exit(0);`,
    ],
    { cwd: REPO_ROOT, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'test' }, timeout: 120_000 },
  );
}

describe('import-only evaluation-order smoke from the former hk739 cycle entry points (WS4 S6)', () => {
  // The modules whose `const` the two cycles read back (and the barrel/route files on the way).
  const ENTRY_POINTS = [
    'backend/modules/auth/controllers/authController.mjs',
    'backend/modules/auth/index.mjs',
    'backend/modules/auth/routes/authRoutes.mjs',
    'backend/modules/competition/routes/competitionRoutes.mjs',
    'backend/modules/competition/routes/conformationShowRoutes.mjs',
  ];
  // The converted files themselves — extras, see the block comment.
  const CONVERTED = [
    'backend/modules/auth/controllers/onboardingController.mjs',
    'backend/modules/auth/services/onboardingService.mjs',
    'backend/modules/competition/services/conformationShowScoring.mjs',
  ];
  for (const file of [...ENTRY_POINTS, ...CONVERTED]) {
    it(`${file} evaluates as the entry point of a fresh process without a temporal-dead-zone error`, () => {
      const res = importAlone(pathToFileURL(path.join(REPO_ROOT, file)).href);
      expect(res.stderr).not.toMatch(/before initialization/);
      expect(res.status).toBe(0);
    });
  }

  it('the harness bites: a copy of the hk739 cycle shape under the OS temp dir FAILS when started at the entry point and passes when started at the converted file', () => {
    // A -> B -> H -> R -> A, where R reads A.register at the top level: authController ->
    // onboardingController -> horses barrel (OLD shape, re-exporting a route file) -> that route
    // file re-entering auth and reading `register` the way authRoutes.mjs did.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ws4-tdz-shape-${process.pid}-`));
    try {
      const shape = {
        'authController.mjs': "import './onboardingController.mjs';\nexport const register = () => 'register';\n",
        'onboardingController.mjs':
          "import { generateGenotype } from './horsesBarrel.mjs';\nexport const completeOnboarding = () => generateGenotype();\n",
        'horsesBarrel.mjs':
          "export { generateGenotype } from './leaf.mjs';\nexport { default as horseRoutes } from './horseRoutes.mjs';\n",
        'horseRoutes.mjs':
          "import * as authController from './authController.mjs';\nconst router = { stack: [] };\nrouter.stack.push(authController.register);\nexport default router;\n",
        'leaf.mjs': 'export const generateGenotype = () => ({ genes: [] });\n',
      };
      for (const [name, text] of Object.entries(shape)) {
        fs.writeFileSync(path.join(dir, name), text);
      }

      const atEntryPoint = importAlone(pathToFileURL(path.join(dir, 'authController.mjs')).href);
      expect(atEntryPoint.status).not.toBe(0);
      expect(atEntryPoint.stderr).toMatch(/ReferenceError: Cannot access 'register' before initialization/);

      const atConvertedFile = importAlone(pathToFileURL(path.join(dir, 'onboardingController.mjs')).href);
      expect(atConvertedFile.stderr).not.toMatch(/before initialization/);
      expect(atConvertedFile.status).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    expect(fs.existsSync(dir)).toBe(false);
  });
});
