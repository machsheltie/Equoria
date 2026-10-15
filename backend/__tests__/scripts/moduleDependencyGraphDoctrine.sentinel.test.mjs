/**
 * Equoria-q4uem.4 (WS4 S5) module-dependency-graph doctrine sentinel.
 *
 * Proves scripts/doctrine-checks/check-module-dependency-graph.mjs actually fires, rule
 * by rule, by planting a violation, running the REAL script as a child process, asserting
 * on its exit code and its file:line output, and removing the plant:
 *   clean tree      -> exit 0, >= 20 modules named (non-vacuity)
 *   R1 cycle        -> economy file importing the bank barrel (bank -> economy exists)
 *   R2 deep import  -> unmarked cross-module deep import; a 10th Equoria-hk739-marked one
 *                      trips the shrink-only baseline instead
 *   R3 export *     -> planted module barrel with `export *`
 *   R4 HTTP layer   -> planted module barrel re-exporting a Routes.mjs (any block), a
 *                      /controllers/ file and a bare *Controller.mjs (production block);
 *                      the same controller under the `// Test-consumed only (… Equoria-7t1tn`
 *                      label is classified as test-block and fails only the shrink-only
 *                      name baseline; a route module inside the test block still fails
 *   R5 upward       -> module file importing backend/app/routers.mjs
 *   --closure       -> three pure services evaluate no route module or controller file
 *                      (WS4 acceptance criterion 3)
 *
 * Plant hygiene (lesson from Equoria-or7o5): every plant has a unique, per-run file or
 * directory name, every created path is recorded and removed in afterEach (directories
 * included), and the suite asserts after each cleanup and at the end that no plant path
 * remains under backend/modules.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-module-dependency-graph.mjs');
const MODULES = path.join(REPO_ROOT, 'backend/modules');
const RUN_ID = `${process.pid}-${randomBytes(4).toString('hex')}`;
const PLANT_TOKEN = '_ws4graphplant_';

/** Every path this suite creates, removed (deepest first) in afterEach. */
const planted = [];

function plantFile(relFromModules, content) {
  const abs = path.join(MODULES, relFromModules);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    planted.push(dir);
  }
  fs.writeFileSync(abs, content);
  planted.push(abs);
  return abs;
}

function cleanupPlants() {
  for (const p of [...planted].reverse()) {
    fs.rmSync(p, { recursive: true, force: true });
  }
  for (const p of planted) {
    expect(fs.existsSync(p)).toBe(false);
  }
  planted.length = 0;
}

/** No file or directory carrying the plant token anywhere under backend/modules (two levels). */
function strayPlants() {
  const found = [];
  for (const top of fs.readdirSync(MODULES)) {
    if (top.includes(PLANT_TOKEN)) {
      found.push(top);
    }
    const abs = path.join(MODULES, top);
    if (fs.statSync(abs).isDirectory()) {
      for (const inner of fs.readdirSync(abs)) {
        if (inner.includes(PLANT_TOKEN)) {
          found.push(`${top}/${inner}`);
        }
      }
    }
  }
  return found;
}

function runCheck(args = []) {
  const res = spawnSync('node', [CHECK, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
  return { status: res.status, out: `${res.stdout}\n${res.stderr}` };
}

beforeAll(() => {
  expect(fs.existsSync(CHECK)).toBe(true);
  expect(strayPlants()).toEqual([]);
});

afterEach(() => {
  cleanupPlants();
  expect(strayPlants()).toEqual([]);
});

afterAll(() => {
  expect(planted).toEqual([]);
  expect(strayPlants()).toEqual([]);
});

const PLANT_MODULE = `${PLANT_TOKEN}${RUN_ID}`;
const TEST_LABEL =
  "// Test-consumed only (other modules' tests; Equoria-7t1tn tracks moving those tests\n// into the owning module, after which these lines go).\n";

describe('check-module-dependency-graph.mjs (Equoria-q4uem.4, WS4 S5)', () => {
  it('passes on the current tree and names at least 20 modules (non-vacuity)', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    const m = res.out.match(/OK — modules=(\d+) files=(\d+) edges=(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBeGreaterThanOrEqual(20);
    expect(Number(m[2])).toBeGreaterThanOrEqual(50);
    expect(Number(m[3])).toBeGreaterThan(0);
    expect(res.out).toMatch(/cycles=0 deep-imports=0 .*star-exports=0 http-in-barrel=0 .*upward=0/);
  });

  it('R1: FAILS on a planted cross-module cycle and prints it with the plant file:line', () => {
    // bank -> economy exists today; an economy file importing the bank barrel closes the loop.
    const plant = plantFile(`economy/${PLANT_TOKEN}cycle_${RUN_ID}.mjs`, "import '../bank/index.mjs';\n");
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(/R1 cycle: bank -> economy -> bank/);
    expect(res.out).toContain(`${path.relative(REPO_ROOT, plant).split(path.sep).join('/')}:1`);
    expect(res.out).toMatch(/FAIL — \d+ violation line\(s\)/);
  });

  it('R2: FAILS on an unmarked cross-module deep import with file:line', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}deep_${RUN_ID}.mjs`,
      "import { getTransactionHistory } from '../bank/controllers/bankController.mjs';\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    const relPlant = path.relative(REPO_ROOT, plant).split(path.sep).join('/');
    expect(res.out).toMatch(
      new RegExp(
        `R2 ${relPlant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:1 cross-module deep import of backend/modules/bank/controllers/bankController\\.mjs`,
      ),
    );
  });

  it('R2 baseline: an Equoria-hk739-marked deep import is honoured but a 10th marked site trips the shrink-only baseline', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}marked_${RUN_ID}.mjs`,
      "// eslint-disable-next-line no-restricted-imports -- Equoria-hk739: sentinel plant\nimport { getTransactionHistory } from '../bank/controllers/bankController.mjs';\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    const relPlant = path.relative(REPO_ROOT, plant).split(path.sep).join('/');
    expect(res.out).not.toMatch(new RegExp(`R2 ${relPlant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:2 `)); // not a direct violation
    expect(res.out).toMatch(/R2-baseline marked deep imports 10 > 9/);
    expect(res.out).toContain(`${relPlant}:2`);
  });

  it('R3: FAILS on `export *` in a barrel', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export * from './x.mjs';\n");
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(new RegExp(`R3 backend/modules/${PLANT_MODULE}/index\\.mjs:1 \`export \\*\` in a barrel`));
  });

  it('R4: FAILS on a route module re-export in a barrel (any block, even the test block)', () => {
    plantFile(
      `${PLANT_MODULE}/index.mjs`,
      `${TEST_LABEL}export { default as plantRoutes } from './routes/plantRoutes.mjs';\n`,
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(`R4 backend/modules/${PLANT_MODULE}/index\\.mjs:3 barrel re-exports a route module`),
    );
  });

  it('R4: FAILS on controller re-exports in the production block — /controllers/ directory AND bare *Controller.mjs name', () => {
    plantFile(
      `${PLANT_MODULE}/index.mjs`,
      "export { a } from './controllers/aController.mjs';\nexport { b } from './bController.mjs';\nexport { c } from './services/cService.mjs';\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 backend/modules/${PLANT_MODULE}/index\\.mjs:1 barrel re-exports controller name\\(s\\) a from \\./controllers/aController\\.mjs`,
      ),
    );
    expect(res.out).toMatch(
      new RegExp(
        `R4 backend/modules/${PLANT_MODULE}/index\\.mjs:2 barrel re-exports controller name\\(s\\) b from \\./bController\\.mjs`,
      ),
    );
    expect(res.out).not.toMatch(/cService/); // services are the contract; never flagged
  });

  it('R4: a barrel that merely IMPORTS a controller or route file is flagged (no two-step evasion)', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "import { a } from './controllers/aController.mjs';\nexport { a };\n");
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(`R4 backend/modules/${PLANT_MODULE}/index\\.mjs:1 barrel imports a controller file`),
    );
  });

  it('R4 test block: a controller under the Equoria-7t1tn label is recognised as test-only and fails ONLY the shrink-only name baseline (12 > 11)', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, `${TEST_LABEL}export { d } from './controllers/dController.mjs';\n`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).not.toMatch(new RegExp(`R4 backend/modules/${PLANT_MODULE}/index\\.mjs:3 `)); // not a production-block violation
    expect(res.out).toMatch(/R4-baseline test-block controller names 12 > 11/);
    expect(res.out).toContain(`${PLANT_MODULE}.d`);
  });

  it('R4 sentinel block: a `// Sentinel-asserted` label after the test label returns to production rules (no exemption)', () => {
    plantFile(
      `${PLANT_MODULE}/index.mjs`,
      `${TEST_LABEL}export { s } from './services/sService.mjs';\n// Sentinel-asserted (plant)\nexport { e } from './controllers/eController.mjs';\n`,
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(`R4 backend/modules/${PLANT_MODULE}/index\\.mjs:5 barrel re-exports controller name\\(s\\) e`),
    );
  });

  it('R5: FAILS when a module file imports the application layer', () => {
    const plant = plantFile(`economy/${PLANT_TOKEN}up_${RUN_ID}.mjs`, "import '../../app/routers.mjs';\n");
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toContain(
      `R5 ${path.relative(REPO_ROOT, plant).split(path.sep).join('/')}:1 module file imports the application layer`,
    );
  });

  it('WARN lines never affect the exit code (Q9a)', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.out).toMatch(/warn=\d+/);
  });

  it('--closure: three pure services evaluate no route module or controller file (acceptance criterion 3)', () => {
    for (const file of [
      'backend/modules/traits/services/traitInteractionMatrix.mjs',
      'backend/modules/horses/services/conformationService.mjs',
      'backend/modules/horses/services/horseXpModelService.mjs',
    ]) {
      const res = runCheck(['--closure', file]);
      expect(res.status).toBe(0);
      const lines = res.out.split('\n').filter(l => l && !l.startsWith('[module-dependency-graph]'));
      expect(lines.length).toBeGreaterThan(0);
      const http = lines.filter(l => /\/routes\/|Routes\.mjs$|\/controllers\/|Controller\.mjs$/.test(l));
      expect(http).toEqual([]);
    }
  });
});
