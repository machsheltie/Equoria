/**
 * Equoria-v8l96.4 — Sentinel-positive proof for the module public-API barrel
 * boundary ESLint rule (the per-module `no-restricted-imports` blocks generated
 * by `crossModuleBarrelBoundaryConfigs` in backend/eslint.config.mjs).
 *
 * The capstone of the v8l96 epic. CONTRIBUTING.md § "Module public API
 * boundaries" mandates that every cross-module import goes through the target
 * module's `index.mjs` barrel; reaching into another module's internals
 * (controllers/services/routes/models/data/…) is forbidden. This rule turns
 * that from convention into lint-enforced fact. SAME-module deep imports
 * (a horses controller importing `../services/x.mjs`) remain ALLOWED — the
 * barrier is BETWEEN modules, never within one.
 *
 * Why a CLI sentinel (not eslint's RuleTester): the discrimination this rule
 * relies on is NOT a property of a single rule — it is a property of the
 * flat-config `files:`-scoping interaction across 21 generated per-module
 * blocks plus the global / test-files / routes-layer blocks. RuleTester runs a
 * rule in isolation and cannot exercise that resolution. Running the REAL
 * eslint CLI from cwd=backend/ against the REAL backend/eslint.config.mjs —
 * exactly as `npm run lint` and the doctrine gate do — is the only thing that
 * proves the boundary actually holds in the deployed config.
 *
 * This sentinel plants throwaway probe files, runs eslint on each, asserts the
 * EXACT discrimination, and cleans up. It proves BOTH directions, so the rule
 * can neither silently weaken (stop firing on a real cross-module reach) nor
 * over-fire (break a legitimate same-module / barrel / intra-module import):
 *
 *   ARM 1 (FIRES):   a cross-module DEEP import (competition → horses/services)
 *                    trips `no-restricted-imports` with the Cross-module message.
 *   ARM 2 (PASSES):  a SAME-module deep import (horses controller → ../services)
 *                    produces NO restricted-imports error.
 *   ARM 3 (PASSES):  a cross-module BARREL import (competition → ../../horses/
 *                    index.mjs) produces NO restricted-imports error — the
 *                    barrel is the sanctioned public-API path.
 *   ARM 4 (PASSES):  the economy intra-module sub-domain case (inventory →
 *                    ../../tackShop) produces NO restricted-imports error —
 *                    tackShop is NESTED inside the economy module, so this is a
 *                    same-module import, not a cross-module one. This is the
 *                    discrimination canary the global-glob approach got wrong.
 *   ARM 5 (FIRES):   a cross-module deep import inside a module TEST file
 *                    (modules/horses/__tests__) still trips the rule — the
 *                    v8l96.3 migration cleaned module tests, so the barrier
 *                    must not have a test-shaped hole.
 *
 * Each probe asserts on the PRESENCE/ABSENCE of `no-restricted-imports`
 * specifically (grepping the eslint output), not raw exit code — so an
 * incidental `no-unused-vars` on a probe cannot mask or fake the signal.
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs, { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const BACKEND = path.join(REPO_ROOT, 'backend');

// Resolve the eslint CLI the SAME way check-backend-lint-and-format.mjs does:
// direct filesystem probe at backend/ then repo root (hoisted installs).
function resolveEslintCli() {
  for (const base of [BACKEND, REPO_ROOT]) {
    const candidate = path.join(base, 'node_modules', 'eslint', 'bin', 'eslint.js');
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const eslintCli = resolveEslintCli();

// Run eslint on a single file from cwd=backend so it loads backend/eslint.config.mjs
// and applies the per-module `files:` scoping, exactly like `npm run lint`.
function runEslint(absFile) {
  const rel = path.relative(BACKEND, absFile).split(path.sep).join('/');
  const res = spawnSync(process.execPath, [eslintCli, rel], { cwd: BACKEND, encoding: 'utf8' });
  return `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
}

// Each probe: { absPath, contents }. We write, lint, assert, delete.
const PROBES = {
  // ARM 1 — cross-module deep import: MUST fire.
  crossDeep: {
    abs: path.join(BACKEND, 'modules', 'competition', '_v8l96_sentinel_cross_deep.mjs'),
    src: "import { x } from '../../horses/services/horseService.mjs';\nexport const y = x;\n",
  },
  // ARM 2 — same-module deep import: MUST NOT fire.
  sameDeep: {
    abs: path.join(BACKEND, 'modules', 'horses', 'controllers', '_v8l96_sentinel_same_deep.mjs'),
    src: "import { x } from '../services/horseService.mjs';\nexport const y = x;\n",
  },
  // ARM 3 — cross-module BARREL import: MUST NOT fire.
  crossBarrel: {
    abs: path.join(BACKEND, 'modules', 'competition', '_v8l96_sentinel_cross_barrel.mjs'),
    src: "import { x } from '../../horses/index.mjs';\nexport const y = x;\n",
  },
  // ARM 4 — economy intra-module sub-domain import: MUST NOT fire.
  economyIntra: {
    abs: path.join(BACKEND, 'modules', 'economy', 'inventory', 'controllers', '_v8l96_sentinel_econ_intra.mjs'),
    src: "import { x } from '../../tackShop/controllers/tackShopController.mjs';\nexport const y = x;\n",
  },
  // ARM 5 — module TEST file cross-module deep import: MUST fire.
  testCrossDeep: {
    abs: path.join(BACKEND, 'modules', 'horses', '__tests__', '_v8l96_sentinel_test_cross.test.mjs'),
    src: "import { x } from '../../breeding/services/foalingService.mjs';\nexport const y = x;\n",
  },
};

function writeProbe(p) {
  fs.mkdirSync(path.dirname(p.abs), { recursive: true });
  fs.writeFileSync(p.abs, p.src);
}

const maybe = eslintCli ? describe : describe.skip;

beforeAll(() => {
  if (!eslintCli) {
    throw new Error(
      'eslint CLI not found under backend/node_modules or repo-root node_modules. ' +
        'Run `cd backend && npm ci` so this sentinel can exercise the real gate.',
    );
  }
});

afterEach(() => {
  for (const p of Object.values(PROBES)) {
    try {
      fs.rmSync(p.abs, { force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

maybe('module public-API barrel boundary ESLint rule (Equoria-v8l96.4)', () => {
  it('ARM 1 — a CROSS-module deep import FIRES no-restricted-imports', () => {
    writeProbe(PROBES.crossDeep);
    const out = runEslint(PROBES.crossDeep.abs);
    expect(out).toMatch(/no-restricted-imports/);
    expect(out).toMatch(/Cross-module deep import/);
    expect(out).toMatch(/horses/);
  });

  it('ARM 2 — a SAME-module deep import does NOT fire no-restricted-imports', () => {
    writeProbe(PROBES.sameDeep);
    const out = runEslint(PROBES.sameDeep.abs);
    expect(out).not.toMatch(/no-restricted-imports/);
  });

  it('ARM 3 — a cross-module BARREL (index.mjs) import does NOT fire no-restricted-imports', () => {
    writeProbe(PROBES.crossBarrel);
    const out = runEslint(PROBES.crossBarrel.abs);
    expect(out).not.toMatch(/no-restricted-imports/);
  });

  it('ARM 4 — economy intra-module sub-domain import does NOT fire (discrimination canary)', () => {
    writeProbe(PROBES.economyIntra);
    const out = runEslint(PROBES.economyIntra.abs);
    expect(out).not.toMatch(/no-restricted-imports/);
  });

  it('ARM 5 — a CROSS-module deep import in a module TEST file FIRES (no test-shaped hole)', () => {
    writeProbe(PROBES.testCrossDeep);
    const out = runEslint(PROBES.testCrossDeep.abs);
    expect(out).toMatch(/no-restricted-imports/);
    expect(out).toMatch(/Cross-module deep import/);
    expect(out).toMatch(/breeding/);
  });

  it('eslint.config.mjs carries the per-module barrel-boundary generator (literal regression guard)', () => {
    const configText = fs.readFileSync(path.join(BACKEND, 'eslint.config.mjs'), 'utf8');
    expect(configText).toContain('crossModuleBarrelBoundaryConfigs');
    expect(configText).toContain('crossModulePatternsFor');
    expect(configText).toContain('BARREL_MODULES');
    // The `**/<other>/*/**` glob primitive is what discriminates a deep import
    // (has a sub-dir segment) from the barrel (index.mjs, no sub-dir). Guard it.
    expect(configText).toContain('`**/${other}/*/**`');
  });
});
