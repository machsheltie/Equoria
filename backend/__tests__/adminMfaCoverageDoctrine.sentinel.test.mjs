/**
 * Equoria-e4a2y doctrine-check sentinel.
 *
 * Proves that `scripts/doctrine-checks/check-admin-mfa-coverage.mjs` actually
 * FIRES when a `requireRole('admin')` route is planted WITHOUT `requireAdminMfa`
 * in the same call expression — and stays GREEN when the route is covered.
 *
 * Why this exists (OPTIMAL_FIX_DISCIPLINE §2 — a check without a positive test
 * is a placebo): the Equoria-l432a incident was a `requireRole('admin')` route
 * (POST /shows/execute) on the authRouter that silently missed the adminRouter's
 * global `requireAdminMfa`. The doctrine check is the structural guard so that
 * class of defect cannot recur per-route. This sentinel guards the guard: if a
 * future regex narrowing or scope shrinkage stopped the check from catching an
 * uncovered admin route, THIS test fails.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-admin-mfa-coverage.mjs');
// Plant under modules/<x>/routes/ so the scan's modules-routes walk picks it up.
// Lowercase, non-marker basename so it is NOT excluded by the plant-artifact
// filter (isPlantArtifactBasename is case-sensitive for DO_NOT_COMMIT/PLANTED).
const PLANT_MODULE = path.join(REPO_ROOT, 'backend/modules/_e4a2y_doctrine_sentinel');
const PLANT_DIR = path.join(PLANT_MODULE, 'routes');

afterEach(() => {
  // Best-effort cleanup so a test crash doesn't poison subsequent runs.
  try {
    fs.rmSync(PLANT_MODULE, { recursive: true, force: true });
  } catch {
    // intentional: cleanup is best-effort
  }
});

function runCheck() {
  return spawnSync('node', [CHECK], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function plant(basename, source) {
  fs.mkdirSync(PLANT_DIR, { recursive: true });
  fs.writeFileSync(path.join(PLANT_DIR, basename), source);
}

describe('check-admin-mfa-coverage.mjs (Equoria-e4a2y)', () => {
  it('passes against the current tree (every admin route carries requireAdminMfa)', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/admin-mfa-coverage.*OK/);
  });

  it('SENTINEL: fails when a requireRole(admin) route lacks requireAdminMfa', () => {
    plant(
      'plantedUncovered.mjs',
      "import express from 'express';\n" +
        "import { requireRole } from '../../../middleware/auth.mjs';\n" +
        'const router = express.Router();\n' +
        "router.post('/danger', requireRole('admin'), (req, res) => res.end());\n" +
        'export default router;\n',
    );

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/admin-mfa-coverage.*FAIL/);
    expect(res.stderr).toMatch(/plantedUncovered\.mjs/);
  });

  it('SENTINEL: fails for a MULTI-LINE requireRole(admin) route lacking requireAdminMfa', () => {
    // The defect class is exactly a route whose middleware chain spans lines —
    // the per-call balanced-paren scan must see the whole argument list.
    plant(
      'plantedMultiline.mjs',
      "import express from 'express';\n" +
        "import { authenticateToken, requireRole } from '../../../middleware/auth.mjs';\n" +
        'const router = express.Router();\n' +
        'router.post(\n' +
        "  '/danger',\n" +
        '  authenticateToken,\n' +
        "  requireRole('admin'),\n" +
        '  (req, res) => res.end(),\n' +
        ');\n' +
        'export default router;\n',
    );

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/admin-mfa-coverage.*FAIL/);
    expect(res.stderr).toMatch(/plantedMultiline\.mjs/);
  });

  it('NEGATIVE: passes when the planted admin route DOES carry requireAdminMfa', () => {
    // Proves the check is not vacuously failing — a correctly-gated route is
    // accepted, so the GREEN signal is meaningful.
    plant(
      'plantedCovered.mjs',
      "import express from 'express';\n" +
        "import { requireRole, requireAdminMfa } from '../../../middleware/auth.mjs';\n" +
        'const router = express.Router();\n' +
        "router.post('/danger', requireRole('admin'), requireAdminMfa, (req, res) => res.end());\n" +
        'export default router;\n',
    );

    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/admin-mfa-coverage.*OK/);
  });

  it('NEGATIVE: a requireRole(admin) only in a comment is NOT flagged', () => {
    // Comment-only mentions describe the gate; they are not a real route chain.
    plant(
      'plantedCommentOnly.mjs',
      "import express from 'express';\n" +
        'const router = express.Router();\n' +
        "// historical: this route used requireRole('admin') before the refactor\n" +
        "router.get('/safe', (req, res) => res.end());\n" +
        'export default router;\n',
    );

    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/admin-mfa-coverage.*OK/);
  });
});
