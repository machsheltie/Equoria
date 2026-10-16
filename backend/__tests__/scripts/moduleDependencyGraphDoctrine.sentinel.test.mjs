/**
 * Equoria-q4uem.4 (WS4 S5) module-dependency-graph doctrine sentinel.
 *
 * Proves scripts/doctrine-checks/check-module-dependency-graph.mjs actually fires, rule
 * by rule, by planting a violation, running the REAL script as a child process, asserting
 * on its exit code and its file:line output, and removing the plant:
 *   clean tree      -> exit 0, >= 20 modules named (non-vacuity)
 *   R1 cycle        -> economy file importing the bank barrel (bank -> economy exists);
 *                      also when the import follows a same-line block comment (S5 review M3)
 *                      or another statement on the same line (fix round 2, minor 6)
 *   R2 deep import  -> unmarked cross-module deep import; a marked one that is not pinned
 *                      in module-dependency-graph-allowlist.json; a stale allow-list entry
 *   R2 non-literal  -> dynamic import() whose specifier is a template literal, a plain
 *                      backtick literal or a join(__dirname, …) call (S5 review I1); also one
 *                      hidden behind a regex literal after an `if (…)` header (round 2, minor 9);
 *                      also in a SHARED-LAYER file a module closure walks through (round 4, M2)
 *   R2 CommonJS     -> createRequire(…) / require(…) in an ESM-only module file (round 2, minor 8)
 *                      or in a shared-layer file a module closure walks through (round 4, M2);
 *                      any .cjs file under backend/modules fails outright (round 4, M1)
 *   R2 backslash    -> an import specifier containing `\` (S5 review M4)
 *   R2 lexer        -> fail-closed on an unterminated template literal and on a template
 *                      literal that CONTAINS import/export/require text the scanners would
 *                      otherwise have read; a long template without such text passes (round 3)
 *   R3 export *     -> planted module barrel with `export *`
 *   R4 HTTP layer   -> planted module barrel re-exporting a Routes.mjs (any block), a
 *                      /controllers/ file and a bare *Controller.mjs (production block), a
 *                      controller reached THROUGH proxy files by any re-export shape (S5 review
 *                      M2, round 2 evasion 7, round 3: `export const X = binding[.member]`,
 *                      semicolon-less `export default`), and — closure-based (round 3) — ANY
 *                      barrel name whose target's static import closure reaches a route module
 *                      or controller, with the path reported; the barrel's OWN import sites,
 *                      including a dynamic import() inside an exported function, are closure-
 *                      checked and blamed on the barrel's own line (round 4, I); when one barrel's
 *                      bad line cascades into other barrels' closures the ORIGIN line is reported
 *                      first and the cascades name it (round 4, I); a controller under the
 *                      `// Test-consumed only (… Equoria-7t1tn` label fails outright too (WS4
 *                      S5-pre: no controller in any barrel block); any entry left in the retired
 *                      testBlockControllers section fails; a route module inside the test block fails
 *   R5 upward       -> module file importing backend/app/routers.mjs
 *   --closure       -> three pure services evaluate no route module or controller file
 *
 * Plant hygiene (lessons from Equoria-or7o5 and S5 review M7): every plant has a unique,
 * per-run file or directory name; EVERY directory the suite creates is recorded and removed
 * deepest-first in afterEach; the suite asserts after each cleanup and at the end that no
 * plant path remains under backend/modules or backend/utils. The allow-list JSON is edited
 * only by two arms, which restore it byte-for-byte and assert that they did.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { isReservedScratchPlantPathSegment } from '../../../scripts/lib/doctrine-scan-patterns.mjs';
import {
  CHECK,
  ALLOWLIST,
  MODULES,
  RUN_ID,
  PLANT_TOKEN,
  PLANT_MODULE,
  PLANT_MODULE_B,
  TEST_LABEL,
  esc,
  relPosix,
  PM,
  PMB,
  planted,
  plantFile,
  cleanupPlants,
  strayPlants,
  runCheck,
  runWithExtraAllowlistEntry,
} from '../helpers/moduleDependencyGraphDoctrinePlants.mjs';

const WRITER_NOTE = '// sentinel plant; removed by afterEach\n';
const CTRL = `${PM}/controllers/epigeneticFlagController.mjs`;
const CTRL_RE = esc(CTRL);
const PROXY = `${PM}/services/proxy.mjs`;
const PROXY_RE = esc(PROXY);
const CTRL_IMPORT = "import { evaluateFlags } from '../controllers/epigeneticFlagController.mjs';\n";

beforeAll(() => {
  expect(fs.existsSync(CHECK)).toBe(true);
  expect(fs.existsSync(ALLOWLIST)).toBe(true);
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
    expect(res.out).toMatch(/nonliteral-dynamic=0/);
    expect(res.out).toMatch(/commonjs=0/);
    expect(res.out).toMatch(/closure-checked=\d+/);
    expect(res.out).toMatch(/shared-files=[1-9]\d*/); // the shared layer really is scanned (round 4, M2)
    // Round 4 cosmetic 2: each summary counter counts only its own violation class. Old format:
    // `deep-imports=` counted every R2 line; new: unmarked cross-module deep imports only, with
    // separate backslash=, cjs-files= and shared-violations= counters.
    // WS4 S6: R2 is strict — no hk739 markers remain and the deepImports section is empty.
    expect(res.out).toMatch(/ deep-imports=0 \(marked 0 listed 0/);
    expect(res.out).toMatch(/backslash=0/);
    expect(res.out).toMatch(/cjs-files=0/);
    expect(res.out).toMatch(/shared-violations=0/);
  });

  it('R1: FAILS on a planted cross-module cycle and prints it with the plant file:line', () => {
    const plant = plantFile(`economy/${PLANT_TOKEN}cycle_${RUN_ID}.mjs`, "import '../bank/index.mjs';\n");
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(/R1 cycle: bank -> economy -> bank/);
    expect(res.out).toContain(`${relPosix(plant)}:1`);
    expect(res.out).toMatch(/FAIL — \d+ violation line\(s\)/);
  });

  it('R1 (M3): an import preceded by a same-line block comment is still seen', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}comment_${RUN_ID}.mjs`,
      "/* Equoria sentinel plant */ import '../bank/index.mjs';\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(/R1 cycle: bank -> economy -> bank/);
    expect(res.out).toContain(`${relPosix(plant)}:1`);
  });

  it('R1 (M3 control): comment-only lines and block-comment bodies never create an edge', () => {
    plantFile(
      `economy/${PLANT_TOKEN}commentonly_${RUN_ID}.mjs`,
      "// import '../bank/index.mjs';\n/*\nimport '../bank/index.mjs';\n*/\nexport const sentinelPlant = 1;\n",
    );
    const res = runCheck();
    expect(res.status).toBe(0);
  });

  it('R2: FAILS on an unmarked cross-module deep import with file:line', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}deep_${RUN_ID}.mjs`,
      "import { getTransactionHistory } from '../bank/controllers/bankController.mjs';\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R2 ${esc(relPosix(plant))}:1 cross-module deep import of backend/modules/bank/controllers/bankController\\.mjs`,
      ),
    );
  });

  it('R2 (minor 6): a deep import that does not start its line (after `;`) is still seen', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}midline_${RUN_ID}.mjs`,
      "export const z = 1; import { getTransactionHistory } from '../bank/controllers/bankController.mjs';\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R2 ${esc(relPosix(plant))}:1 cross-module deep import of backend/modules/bank/controllers/bankController\\.mjs`,
      ),
    );
  });

  it('R2 (S6, strict): an Equoria-hk739-marked deep import now FAILS as a plain deep import — no marker is honoured (old contract: marked + pinned passed)', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}marked_${RUN_ID}.mjs`,
      "// eslint-disable-next-line no-restricted-imports -- Equoria-hk739: sentinel plant\nimport { getTransactionHistory } from '../bank/controllers/bankController.mjs';\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    const rel = relPosix(plant);
    expect(res.out).toMatch(
      new RegExp(`R2 ${esc(rel)}:2 cross-module deep import of backend/modules/bank/controllers/bankController\\.mjs`),
    );
    expect(res.out).not.toMatch(/R2-allowlist .*marked deep import/);
  });

  it('R2 (S6 fix, M2): a leftover Equoria-hk739 marker line in front of a BARREL import FAILS by itself — "marked" is enforced, not just reported', () => {
    // auth -> horses is an existing barrel edge, so the plant adds no cycle and no deep import:
    // the only thing wrong with it is the marker line.
    const plant = plantFile(
      `auth/services/${PLANT_TOKEN}marker_${RUN_ID}.mjs`,
      "// eslint-disable-next-line no-restricted-imports -- Equoria-hk739: sentinel plant\nimport { generateGenotype } from '../../horses/index.mjs';\nexport const planted = generateGenotype;\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toContain('R2 leftover Equoria-hk739 marker line(s): 1 — delete them');
    expect(res.out).toContain(`${relPosix(plant)}:1`);
    expect(res.out).not.toMatch(/cross-module deep import/);
    expect(res.out).toMatch(/ deep-imports=0 \(marked 1 listed 0/);
  });

  it('R2 (S6): the retired deepImports allow-list section must stay empty — any entry FAILS as stale', () => {
    const key = `backend/modules/economy/${PLANT_TOKEN}gone_${RUN_ID}.mjs -> backend/modules/bank/index.mjs`;
    const res = runWithExtraAllowlistEntry('deepImports', key);
    expect(res.status).toBe(1);
    expect(res.out).toContain(`R2-allowlist stale entry "${key}"`);
  });

  it('R2 (I1): FAILS on a dynamic import() whose specifier is a template literal with an expression', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}tpl_${RUN_ID}.mjs`,
      'export async function load(m) {\n  return import(`../${m}/index.mjs`);\n}\n',
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R2 ${esc(relPosix(plant))}:2 dynamic import\\(\\) whose specifier is not a plain quoted string literal`,
      ),
    );
  });

  it('R2 (I1): FAILS on a dynamic import() with a plain backtick literal', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}tick_${RUN_ID}.mjs`,
      'export const load = () => import(`../bank/index.mjs`);\n',
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(`R2 ${esc(relPosix(plant))}:1 dynamic import\\(\\) whose specifier is not a plain quoted`),
    );
  });

  it('R2 (I1): FAILS on a dynamic import() built with join(__dirname, …)', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}join_${RUN_ID}.mjs`,
      "import { join } from 'node:path';\nexport const load = () => import(join(__dirname, '../bank/index.mjs'));\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(`R2 ${esc(relPosix(plant))}:2 dynamic import\\(\\) whose specifier is not a plain quoted`),
    );
  });

  it('R2 (I1 control): a dynamic import() with a plain quoted same-module specifier is not flagged', () => {
    plantFile(`economy/${PLANT_TOKEN}literal_${RUN_ID}.mjs`, "export const load = () => import('./index.mjs');\n");
    const res = runCheck();
    expect(res.status).toBe(0);
  });

  it('R2 (minor 9): a non-literal import() hidden behind a regex literal after an `if (…)` header is still seen', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}regexif_${RUN_ID}.mjs`,
      'export function f(s, p) {\n  if (s) /`/.test(s); import(p);\n}\n',
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(`R2 ${esc(relPosix(plant))}:2 dynamic import\\(\\) whose specifier is not a plain quoted`),
    );
  });

  it('R2 (minor 9 fail-safe): an unterminated template literal fails closed', () => {
    const plant = plantFile(`economy/${PLANT_TOKEN}unterminated_${RUN_ID}.mjs`, 'export const t = `abc\n');
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(new RegExp(`R2 ${esc(relPosix(plant))}:1 lexer fail-safe: unterminated template literal`));
  });

  it('R2 (round 3 fail-safe): a template literal that CONTAINS statement-shaped import text fails closed', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}tplimport_${RUN_ID}.mjs`,
      'export const t = `\nimport { hidden } from "../bank/index.mjs";\n`;\n',
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(`R2 ${esc(relPosix(plant))}:1 lexer fail-safe: template literal contains import/export/require text`),
    );
  });

  it('R2 (round 3 control): a 100-line HTML template with no import/export text passes', () => {
    const rows = Array.from({ length: 96 }, (_, i) => `  <tr><td>Row ${i + 1}</td><td>\${items[${i}]}</td></tr>`).join(
      '\n',
    );
    plantFile(
      `economy/${PLANT_TOKEN}html_${RUN_ID}.mjs`,
      `export const page = (items) => \`<!doctype html>\n<table>\n${rows}\n</table>\n\`;\n`,
    );
    const res = runCheck();
    expect(res.status).toBe(0);
  });

  it('R2 (minor 8): createRequire(…) and require(…) in an ESM-only module file fail with file:line', () => {
    // The plant uses import.meta.filename, not import.meta.url, so this fixture text is not
    // read as a real `createRequire(import.meta.url)` by the Equoria-6gcvi no-CommonJS
    // sentinel's text scan of every backend *.mjs; the graph gate flags any createRequire(.
    const plant = plantFile(
      `economy/${PLANT_TOKEN}cjs_${RUN_ID}.mjs`,
      "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.filename);\nconst bank = require('../bank/index.mjs');\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(new RegExp(`R2 ${esc(relPosix(plant))}:2 CommonJS-style loading \\(createRequire\\(`));
    expect(res.out).toMatch(new RegExp(`R2 ${esc(relPosix(plant))}:3 CommonJS-style loading \\(require\\(`));
  });

  it("R2 (round 4, M1): a .cjs file under backend/modules fails outright, and the reviewer's bridge plant is caught", () => {
    // The fixture text is built from parts so the Equoria-6gcvi no-CommonJS sentinel's text
    // scan of every backend *.mjs does not read this STRING as a real `module.exports =`;
    // the planted bridge.cjs itself is plain CommonJS.
    const bridge = plantFile(
      `${PLANT_MODULE}/bridge.cjs`,
      `${'module'}.exports = require('./controllers/aController.mjs');\n`,
    );
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { a } from './bridge.cjs';\n");
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(`R2 ${esc(relPosix(bridge))}:1 CommonJS module file \\(\\.cjs\\) under backend/modules`),
    );
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports a from \\./bridge\\.cjs: the import closure of ${esc(relPosix(bridge))} reaches controller`,
      ),
    );
  });

  it('R2 (round 4, M2): a non-literal dynamic import() and a require() in SHARED-LAYER files that a module closure walks are flagged', () => {
    const helper1 = plantFile(`../utils/${PLANT_TOKEN}helper1_${RUN_ID}.mjs`, 'export const h1 = (p) => import(p);\n');
    const helper2 = plantFile(
      `../utils/${PLANT_TOKEN}helper2_${RUN_ID}.mjs`,
      "export const h2 = () => require('node:fs');\n",
    );
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { s } from './services/s.mjs';\n");
    plantFile(
      `${PLANT_MODULE}/services/s.mjs`,
      `import { h1 } from '../../../utils/${PLANT_TOKEN}helper1_${RUN_ID}.mjs';\nimport { h2 } from '../../../utils/${PLANT_TOKEN}helper2_${RUN_ID}.mjs';\nexport const s = () => [h1, h2];\n`,
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R2 ${esc(relPosix(helper1))}:1 dynamic import\\(\\) whose specifier is not a plain quoted string literal`,
      ),
    );
    expect(res.out).toMatch(new RegExp(`R2 ${esc(relPosix(helper2))}:1 CommonJS-style loading \\(require\\(`));
  });

  it('R2 (M4): FAILS on an import specifier containing a backslash', () => {
    const plant = plantFile(`economy/${PLANT_TOKEN}bslash_${RUN_ID}.mjs`, "import '..\\\\bank\\\\index.mjs';\n");
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(new RegExp(`R2 ${esc(relPosix(plant))}:1 import specifier contains a backslash`));
  });

  it('R3: FAILS on `export *` in a barrel', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export * from './x.mjs';\n");
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(new RegExp(`R3 ${esc(PM)}/index\\.mjs:1 \`export \\*\` in a barrel`));
  });

  it('R4: FAILS on a route module re-export in a barrel (any block, even the test block)', () => {
    plantFile(
      `${PLANT_MODULE}/index.mjs`,
      `${TEST_LABEL}export { default as plantRoutes } from './routes/plantRoutes.mjs';\n`,
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(new RegExp(`R4 ${esc(PM)}/index\\.mjs:3 barrel re-exports a route module`));
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
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports controller name\\(s\\) a from \\./controllers/aController\\.mjs`,
      ),
    );
    expect(res.out).toMatch(
      new RegExp(`R4 ${esc(PM)}/index\\.mjs:2 barrel re-exports controller name\\(s\\) b from \\./bController\\.mjs`),
    );
    expect(res.out).not.toMatch(/cService/); // services are the contract; never flagged
  });

  it('R4 (minor 6): a barrel re-export that does not start its line is still classified', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export const z = 1; export { a } from './controllers/aController.mjs';\n");
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports controller name\\(s\\) a from \\./controllers/aController\\.mjs`,
      ),
    );
  });

  it('R4: a barrel that merely IMPORTS a controller or route file is flagged (no two-step evasion)', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "import { a } from './controllers/aController.mjs';\nexport { a };\n");
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(new RegExp(`R4 ${esc(PM)}/index\\.mjs:1 barrel imports a controller file`));
  });

  it("R4 (round 4, I): a dynamic import() of a controller inside an exported function of the barrel is closure-checked and blamed on the barrel's own line", () => {
    plantFile(
      `${PLANT_MODULE}/index.mjs`,
      "export const zzr3revLazy = () => import('./controllers/leaderboardController.mjs');\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel dynamically imports \\./controllers/leaderboardController\\.mjs: the import closure of ${esc(PM)}/controllers/leaderboardController\\.mjs reaches controller`,
      ),
    );
  });

  it('R4 (round 4, I): a cascade names the ORIGIN barrel line first and the cascading barrel cites it', () => {
    plantFile(`${PLANT_MODULE_B}/index.mjs`, "export { b } from './controllers/bController.mjs';\n");
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { a } from './services/a.mjs';\n");
    plantFile(
      `${PLANT_MODULE}/services/a.mjs`,
      `import { b } from '../../${PLANT_MODULE_B}/index.mjs';\nexport const a = () => b();\n`,
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    const origin = res.out.indexOf(
      `R4 ${PMB}/index.mjs:1 barrel re-exports controller name(s) b from ./controllers/bController.mjs`,
    );
    const cascade = res.out.indexOf(
      `R4 ${PM}/index.mjs:1 barrel re-exports a from ./services/a.mjs: the import closure of`,
    );
    expect(origin).toBeGreaterThanOrEqual(0);
    expect(cascade).toBeGreaterThan(origin);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports a from \\./services/a\\.mjs: .*— via origin ${esc(PMB)}/index\\.mjs:1`,
      ),
    );
  });

  it('R4 (M2): a controller reached THROUGH a re-export-only proxy file is caught, with the chain named', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { a } from './services/proxy.mjs';\n");
    plantFile(
      `${PLANT_MODULE}/services/proxy.mjs`,
      `${WRITER_NOTE}export { a } from '../controllers/aController.mjs';\n`,
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports controller name\\(s\\) a via ${PROXY_RE} -> ${esc(PM)}/controllers/aController\\.mjs`,
      ),
    );
  });

  it('R4 (M2): a proxy that star-exports a controller is caught too', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { a } from './services/proxy.mjs';\n");
    plantFile(`${PLANT_MODULE}/services/proxy.mjs`, `${WRITER_NOTE}export * from '../controllers/aController.mjs';\n`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports controller name\\(s\\) a via .*proxy\\.mjs -> .*aController\\.mjs`,
      ),
    );
  });

  it('R4 (minor 6): a proxy whose re-export does not start its line is still followed', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { a } from './services/proxy.mjs';\n");
    plantFile(
      `${PLANT_MODULE}/services/proxy.mjs`,
      "export const z = 1; export { a } from '../controllers/aController.mjs';\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports controller name\\(s\\) a via ${PROXY_RE} -> .*aController\\.mjs`,
      ),
    );
  });

  it('R4 (evasion 7): a proxy that IMPORTS a controller and re-exports the binding in a second statement is caught (production block)', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { zzrvEval3 } from './services/proxy.mjs';\n");
    plantFile(`${PLANT_MODULE}/services/proxy.mjs`, `${CTRL_IMPORT}export { evaluateFlags as zzrvEval3 };\n`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports controller name\\(s\\) zzrvEval3 via ${PROXY_RE} -> ${CTRL_RE}`,
      ),
    );
  });

  it('R4 (evasion 7 + S5-pre): the same two-statement proxy under the test label fails R4 outright (no test-block exemption for controllers)', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, `${TEST_LABEL}export { zzrvEval3 } from './services/proxy.mjs';\n`);
    plantFile(`${PLANT_MODULE}/services/proxy.mjs`, `${CTRL_IMPORT}export { evaluateFlags as zzrvEval3 };\n`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:3 barrel re-exports controller name\\(s\\) zzrvEval3 via ${PROXY_RE} -> ${CTRL_RE}`,
      ),
    );
  });

  it('R4 (evasion 7): `export default` of an imported controller binding in a proxy is followed', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { default as flags } from './services/proxy.mjs';\n");
    plantFile(`${PLANT_MODULE}/services/proxy.mjs`, `${CTRL_IMPORT}export default evaluateFlags;\n`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports controller name\\(s\\) flags via ${PROXY_RE} -> ${CTRL_RE}`,
      ),
    );
  });

  it('R4 (round 3): a semicolon-less `export default` of an imported controller binding is followed (precise diagnostic)', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { default as flags } from './services/proxy.mjs';\n");
    plantFile(`${PLANT_MODULE}/services/proxy.mjs`, `${CTRL_IMPORT}export default evaluateFlags\n`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports controller name\\(s\\) flags via ${PROXY_RE} -> ${CTRL_RE}`,
      ),
    );
  });

  it('R4 (evasion 7): a namespace import of a controller re-exported by a proxy is followed', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { flagsNs } from './services/proxy.mjs';\n");
    plantFile(
      `${PLANT_MODULE}/services/proxy.mjs`,
      "import * as flagsController from '../controllers/epigeneticFlagController.mjs';\nexport { flagsController as flagsNs };\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports controller name\\(s\\) flagsNs via ${PROXY_RE} -> ${CTRL_RE}`,
      ),
    );
  });

  it('R4 (round 3): `export const X = <imported binding>` in a proxy is caught, with the chain named', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { zzEval } from './services/proxy.mjs';\n");
    plantFile(`${PLANT_MODULE}/services/proxy.mjs`, `${CTRL_IMPORT}export const zzEval = evaluateFlags;\n`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports controller name\\(s\\) zzEval via ${PROXY_RE} -> ${CTRL_RE}`,
      ),
    );
  });

  it('R4 (round 3): `export const X = ns.member` of a namespace-imported controller is caught', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { zzEval2 } from './services/proxy.mjs';\n");
    plantFile(
      `${PLANT_MODULE}/services/proxy.mjs`,
      "import * as c from '../controllers/epigeneticFlagController.mjs';\nexport const zzEval2 = c.evaluateFlags;\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports controller name\\(s\\) zzEval2 via ${PROXY_RE} -> ${CTRL_RE}`,
      ),
    );
  });

  it('R4 (round 3): the barrel importing such a name and exporting it in a second statement is caught', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "import { zzEval } from './services/proxy.mjs';\nexport { zzEval };\n");
    plantFile(`${PLANT_MODULE}/services/proxy.mjs`, `${CTRL_IMPORT}export const zzEval = evaluateFlags;\n`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(`R4 ${esc(PM)}/index\\.mjs:1 barrel imports a controller file via ${PROXY_RE} -> ${CTRL_RE}`),
    );
  });

  it('R4 (round 3, closure): a production name whose target merely IMPORTS a controller deeper in its closure fails, with the path', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { svc } from './services/svc.mjs';\n");
    plantFile(
      `${PLANT_MODULE}/services/svc.mjs`,
      "import { util } from './util.mjs';\nexport const svc = () => util();\n",
    );
    plantFile(`${PLANT_MODULE}/services/util.mjs`, `${CTRL_IMPORT}export const util = () => evaluateFlags();\n`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports svc from \\./services/svc\\.mjs: the import closure of ${esc(PM)}/services/svc\\.mjs reaches controller ${CTRL_RE} \\(${esc(PM)}/services/svc\\.mjs -> ${esc(PM)}/services/util\\.mjs -> ${CTRL_RE}\\)`,
      ),
    );
  });

  it('R4 (round 3 control): a production service whose closure contains no route module or controller passes', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { own } from './services/own.mjs';\n");
    plantFile(
      `${PLANT_MODULE}/services/own.mjs`,
      "import { helper } from './helper.mjs';\nexport const own = () => helper();\n",
    );
    plantFile(`${PLANT_MODULE}/services/helper.mjs`, 'export const helper = () => 1;\n');
    const res = runCheck();
    expect(res.status).toBe(0);
  });

  it('R4 (evasion 7 control): a proxy that imports a controller but re-exports only its own service binding is still flagged by the closure rule', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, "export { own } from './services/proxy.mjs';\n");
    plantFile(`${PLANT_MODULE}/services/proxy.mjs`, `${CTRL_IMPORT}export const own = () => evaluateFlags;\n`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:1 barrel re-exports own from \\./services/proxy\\.mjs: the import closure of ${PROXY_RE} reaches controller ${CTRL_RE}`,
      ),
    );
  });

  it('R4 (S5-pre): a controller under the Equoria-7t1tn label fails R4 outright — old contract: classified test-block and governed by the pinned list; new ruling: no controller in any barrel block', () => {
    plantFile(`${PLANT_MODULE}/index.mjs`, `${TEST_LABEL}export { d } from './controllers/dController.mjs';\n`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(
      new RegExp(
        `R4 ${esc(PM)}/index\\.mjs:3 barrel re-exports controller name\\(s\\) d from \\./controllers/dController\\.mjs`,
      ),
    );
    expect(res.out).not.toMatch(/R4-allowlist .*test-block controller name/);
  });

  it('R4 (M1): a stale testBlockControllers allow-list entry FAILS (the list only shrinks)', () => {
    const key = `${PLANT_MODULE}.gone`;
    const res = runWithExtraAllowlistEntry('testBlockControllers', key);
    expect(res.status).toBe(1);
    expect(res.out).toContain(`R4-allowlist stale entry "${key}"`);
  });

  it('R4 sentinel block: a `// Sentinel-asserted` label after the test label returns to production rules (no exemption)', () => {
    plantFile(
      `${PLANT_MODULE}/index.mjs`,
      `${TEST_LABEL}export { s } from './services/sService.mjs';\n// Sentinel-asserted (plant)\nexport { e } from './controllers/eController.mjs';\n`,
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(new RegExp(`R4 ${esc(PM)}/index\\.mjs:5 barrel re-exports controller name\\(s\\) e`));
  });

  it('R5: FAILS when a module file imports the application layer', () => {
    const plant = plantFile(`economy/${PLANT_TOKEN}up_${RUN_ID}.mjs`, "import '../../app/routers.mjs';\n");
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toContain(`R5 ${relPosix(plant)}:1 module file imports the application layer`);
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

  it('plant hygiene (M7): a two-level nested plant leaves neither directory behind after cleanup', () => {
    const deep = plantFile(`${PLANT_MODULE}/sub/deep_${RUN_ID}.mjs`, WRITER_NOTE);
    const sub = path.dirname(deep);
    const top = path.dirname(sub);
    expect(fs.existsSync(deep)).toBe(true);
    expect(planted).toEqual(expect.arrayContaining([top, sub, deep]));
    cleanupPlants();
    expect(fs.existsSync(deep)).toBe(false);
    expect(fs.existsSync(sub)).toBe(false);
    expect(fs.existsSync(top)).toBe(false);
    expect(strayPlants()).toEqual([]);
  });

  // Equoria-rfv9j (found in the S6 push window): under the two-lane sharded gate, sibling
  // scripts-dir sentinels plant and delete files under backend/modules while THIS suite's gate is
  // reading the tree. Observed: moduleBarrelBoundaryEslint's `_v8l96_sentinel_*` plants vanished
  // between the gate's directory walk and its read -> ENOENT crash -> three arms here failed.
  // The gate now (F1) tolerates ONLY ENOENT at the walk/read/stat and reports vanished entries as
  // WARNs, and (F2) skips the reserved scratch names of OTHER suites (shared predicate, precedent
  // Equoria-27lqy) while keeping its OWN `_ws4graphplant_` plants visible (F3), so no arm here
  // goes vacuous.
  it('rfv9j F1: a listed entry that vanishes before the read (dangling symlink) is a WARN and the gate stays OK — not a crash', () => {
    const link = path.join(MODULES, 'economy', `${PLANT_TOKEN}vanish_${RUN_ID}.mjs`);
    try {
      fs.symlinkSync(`./${PLANT_TOKEN}vanished_target_${RUN_ID}.mjs`, link, 'file');
    } catch (err) {
      if (err && (err.code === 'EPERM' || err.code === 'EACCES')) {
        // No symlink privilege on this machine (Windows without Developer Mode): the wiring arm
        // below still pins the tolerant read; say so loudly instead of failing on privilege.
        console.warn(`[sentinel] rfv9j F1: cannot create a symlink here (${err.code}); the wiring arm covers F1`);
        return;
      }
      throw err;
    }
    planted.push(link);
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(link)).toBe(false); // dangling: a read of the listed entry is ENOENT
    const res = runCheck();
    expect(res.out).not.toMatch(/Error: ENOENT/);
    expect(res.status).toBe(0);
    expect(res.out).toMatch(new RegExp(`WARN vanished entry ${esc(relPosix(link))}`));
    expect(res.out).toMatch(/ vanished=1 /);
  });

  it('rfv9j F2: a FOREIGN sentinel plant (reserved `_v8l96_sentinel` name) carrying a cross-module deep import is skipped with a WARN — the gate stays OK', () => {
    const plant = plantFile(
      `competition/_v8l96_sentinel_ws4race_${RUN_ID}.mjs`,
      "import { x } from '../horses/services/horseService.mjs';\nexport const y = x;\n",
    );
    const res = runCheck();
    expect(res.out).not.toMatch(/cross-module deep import/);
    expect(res.status).toBe(0);
    expect(res.out).toMatch(new RegExp(`WARN skipped foreign sentinel plant ${esc(relPosix(plant))}`));
    expect(res.out).toMatch(/ foreign-skipped=1 /);
  });

  it("rfv9j F3: the reserved-name skip is for FOREIGN plants only — this suite's own plants stay visible to its gate (no arm goes vacuous) while other scanners skip them", () => {
    const own = `${PLANT_TOKEN}x_${RUN_ID}.mjs`;
    expect(isReservedScratchPlantPathSegment(own)).toBe(true); // noCommonJsInMjs / noDeprecatedDbIndexImport skip my plants
    expect(isReservedScratchPlantPathSegment(own, [PLANT_TOKEN])).toBe(false); // my gate names its own token
    expect(isReservedScratchPlantPathSegment('_v8l96_sentinel_cross_deep.mjs', [PLANT_TOKEN])).toBe(true);
    expect(isReservedScratchPlantPathSegment('horseService.mjs', [PLANT_TOKEN])).toBe(false);
    expect(fs.readFileSync(CHECK, 'utf8')).toMatch(/OWN_PLANT_TOKENS = \[\s*'_ws4graphplant_'/);
    // End to end: an own plant IS still seen by the gate (the R2 arm above would be vacuous otherwise).
    const plant = plantFile(
      `economy/${PLANT_TOKEN}seen_${RUN_ID}.mjs`,
      "import { getTransactionHistory } from '../bank/controllers/bankController.mjs';\n",
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toMatch(new RegExp(`R2 ${esc(relPosix(plant))}:1 cross-module deep import`));
    expect(res.out).not.toMatch(/foreign-skipped=[1-9]/);
  });

  it('rfv9j wiring: the gate routes its directory walk and every walked-file read through the shared ENOENT-tolerant helpers and the reserved-name skip', () => {
    const src = fs.readFileSync(CHECK, 'utf8');
    expect(src).toContain("from '../lib/doctrine-scan-patterns.mjs'");
    expect(src).toContain('readdirSyncTolerant(');
    expect(src).toContain('readScannedFileSyncTolerant(');
    expect(src).toContain('isReservedScratchPlantPathSegment(');
    // Only the allow-list JSON (a tracked config file, never a plant) is read directly.
    expect(src.match(/fs\.readFileSync\(/g) ?? []).toEqual(['fs.readFileSync(']);
    expect(src).toMatch(/fs\.readFileSync\(ALLOWLIST_PATH/);
  });
});
