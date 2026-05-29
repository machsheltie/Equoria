/**
 * Equoria-becrm doctrine-check sentinel.
 *
 * Proves that `scripts/doctrine-checks/check-no-prisma-in-routes.mjs`
 * actually fires when a prisma import / `prisma.X` call is planted in a
 * routes file. Without this sentinel, a future regex narrowing or scope
 * shrinkage could silently let new prisma-in-routes violations slip past
 * — the "test that doesn't really test" pattern the constitution rejects
 * (OPTIMAL_FIX_DISCIPLINE §2).
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-no-prisma-in-routes.mjs');
// The planted file lives directly in modules/_doctrine_sentinel/routes/
// so the scan picks it up via the `modules/<x>/routes/*.mjs` walk.
const PLANT_DIR = path.join(REPO_ROOT, 'backend/modules/_becrm_doctrine_sentinel/routes');

afterEach(() => {
  // Best-effort cleanup so a test crash doesn't poison subsequent runs.
  try {
    fs.rmSync(path.dirname(PLANT_DIR), { recursive: true, force: true });
  } catch {
    // intentional: cleanup is best-effort
  }
});

function runCheck() {
  return spawnSync('node', [CHECK], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('check-no-prisma-in-routes.mjs (Equoria-becrm)', () => {
  it('passes against the current tree (no prisma-in-routes violations)', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/no-prisma-in-routes.*OK/);
  });

  it('SENTINEL: fails when a prisma import is planted in a routes file', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    // Build the planted source by concatenation so THIS sentinel file
    // does not itself contain the literal `prismaClient.mjs` import
    // string (which would trigger the check on the sentinel and break
    // the "baseline clean" test above).
    const plantedSource =
      `import express from 'express';\n` +
      `import prisma from '../../../` +
      `../packages/database/prismaClient.mjs';\n` +
      `const router = express.Router();\n` +
      `router.get('/', async (req, res) => res.json(await prisma.horse.findMany()));\n` +
      `export default router;\n`;
    fs.writeFileSync(path.join(PLANT_DIR, 'plantedRoutes.mjs'), plantedSource);

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no-prisma-in-routes.*FAIL/);
    expect(res.stderr).toMatch(/plantedRoutes\.mjs/);
  });

  it('SENTINEL: fails when a bare `prisma.X` call is planted in a routes file', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    // No import — just the call expression — to prove the second branch of
    // the scan (the `\bprisma\.[A-Za-z_$]` regex) also fires.
    const plantedSource =
      `import express from 'express';\n` +
      `const router = express.Router();\n` +
      // Declare prisma as undefined so the file parses but the doctrine
      // regex still hits.
      `const prisma = undefined;\n` +
      `router.get('/', async (req, res) => { await prisma.horse.findMany(); res.end(); });\n` +
      `export default router;\n`;
    fs.writeFileSync(path.join(PLANT_DIR, 'plantedCall.mjs'), plantedSource);

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no-prisma-in-routes.*FAIL/);
    expect(res.stderr).toMatch(/plantedCall\.mjs/);
  });
});
