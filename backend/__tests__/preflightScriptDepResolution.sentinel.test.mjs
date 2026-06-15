/**
 * Equoria-fefh2.43 item 2 sentinel — preflight scripts must resolve `dotenv`
 * and `pg` from backend/node_modules via createRequire, NOT as bare ESM
 * specifiers.
 *
 * ROOT CAUSE THIS GUARDS: `scripts/preflight/db-probe.mjs` and
 * `scripts/preflight/db-health.mjs` originally imported their deps as bare
 * ESM specifiers:
 *
 *   import dotenv from 'dotenv';
 *   import { Client } from 'pg';
 *
 * A bare `import x from 'pg'` is resolved by Node from the IMPORTING FILE's
 * own directory tree (scripts/preflight → scripts → repo-root node_modules),
 * NOT from process.cwd(). The CI jobs that run these scripts (`backend-tests`,
 * `security-gate` in .github/workflows/test.yml) only `npm ci` inside
 * `backend/` and `packages/database/` — repo-root node_modules is never
 * installed — so the bare import threw at module-load time:
 *
 *   Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'dotenv' imported from
 *   /home/runner/work/Equoria/Equoria/scripts/preflight/db-probe.mjs
 *
 * That crash failed `preflightTimerSentinel.test.mjs` (which spawns both
 * scripts) only in CI — locally it passed because a dev's repo-root
 * node_modules happens to contain pg/dotenv. The fix anchors a createRequire
 * to backend/package.json so both deps resolve from backend/node_modules
 * regardless of Node's default ESM resolution path or the cwd.
 *
 * WHY A SOURCE-SCAN SENTINEL (not just the behavioral spawn test):
 *   - The behavioral `preflightTimerSentinel.test.mjs` can only catch the
 *     regression in an environment WITHOUT a repo-root node_modules. A dev
 *     box (and this worktree) HAS one, so the behavioral test passes there
 *     even with bare imports — it cannot reproduce the CI failure locally.
 *   - This source scan asserts the structural fix is present in EVERY
 *     environment, deterministically, with no DB and no spawn. If a future
 *     edit reverts to a bare `import ... from 'pg'|'dotenv'`, this fires
 *     immediately — long before the next CI run would.
 *
 * Sentinel-positive shape (OPTIMAL_FIX_DISCIPLINE §2): the bare-import
 * detector is proven to FIRE on a planted bare-import line and to correctly
 * IGNORE the safe createRequire form — so a future regex refactor can't turn
 * the guard into a placebo.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

const SCRIPTS = ['scripts/preflight/db-probe.mjs', 'scripts/preflight/db-health.mjs'];

// The two deps that must NOT be bare-imported (they live only in
// backend/node_modules, not repo-root node_modules in CI).
const GUARDED_DEPS = ['dotenv', 'pg'];

function read(relPath) {
  return readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
}

/**
 * Returns true iff `src` contains an ACTIVE (non-commented) bare ESM import
 * of `dep` — i.e. `import ... from 'dep'` / "dep". Comment lines (`*`, `//`,
 * `#`) are ignored so the explanatory header blocks that NAME the deps don't
 * trip the detector.
 */
function hasBareImport(src, dep) {
  // Matches: import X from 'dep'  |  import {X} from "dep"  |  import 'dep'
  const bareRe = new RegExp(`\\bimport\\b[^;\\n]*?from\\s+['"]${dep}['"]|\\bimport\\s+['"]${dep}['"]`);
  return src
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('*') && !l.startsWith('//') && !l.startsWith('#') && !l.startsWith('/*'))
    .some(l => bareRe.test(l));
}

describe('preflight scripts resolve deps from backend, not bare ESM (Equoria-fefh2.43 item 2)', () => {
  for (const script of SCRIPTS) {
    describe(script, () => {
      const src = read(script);

      for (const dep of GUARDED_DEPS) {
        it(`does NOT bare-import '${dep}' (would ERR_MODULE_NOT_FOUND in CI)`, () => {
          expect(hasBareImport(src, dep)).toBe(false);
        });
      }

      it('imports createRequire from node:module', () => {
        expect(src).toMatch(/import\s+\{\s*createRequire\s*\}\s+from\s+['"]node:module['"]/);
      });

      it('anchors createRequire to backend/package.json', () => {
        // The anchor path must reference backend's package.json so resolution
        // happens from backend/node_modules. Both scripts build the path with
        // 'backend' and 'package.json' segments (resolve/join).
        expect(src).toMatch(/createRequire\(/);
        expect(src).toMatch(/['"]backend['"]/);
        expect(src).toMatch(/['"]package\.json['"]/);
      });

      it('acquires both guarded deps through the backend-anchored require', () => {
        // e.g. `const dotenv = backendRequire('dotenv');`
        //      `const { Client } = backendRequire('pg');`
        for (const dep of GUARDED_DEPS) {
          expect(src).toMatch(new RegExp(`Require\\(['"]${dep}['"]\\)`));
        }
      });
    });
  }

  // ── Sentinel-positive (OPTIMAL_FIX_DISCIPLINE §2) ─────────────────────────
  describe('SENTINEL: bare-import detector fires on the real regression form', () => {
    it('detects an active bare `import dotenv from "dotenv"`', () => {
      expect(hasBareImport("import dotenv from 'dotenv';\n", 'dotenv')).toBe(true);
      expect(hasBareImport('import dotenv from "dotenv";\n', 'dotenv')).toBe(true);
    });

    it('detects an active bare `import { Client } from "pg"`', () => {
      expect(hasBareImport("import { Client } from 'pg';\n", 'pg')).toBe(true);
    });

    it('detects a side-effect bare import `import "dotenv"`', () => {
      expect(hasBareImport("import 'dotenv';\n", 'dotenv')).toBe(true);
    });

    it('does NOT fire on the safe createRequire form', () => {
      const safe = "const dotenv = backendRequire('dotenv');\nconst { Client } = backendRequire('pg');\n";
      expect(hasBareImport(safe, 'dotenv')).toBe(false);
      expect(hasBareImport(safe, 'pg')).toBe(false);
    });

    it('does NOT fire on a commented mention of the dep', () => {
      expect(hasBareImport(" * these deps live in backend/node_modules ('dotenv' / 'pg')\n", 'dotenv')).toBe(false);
      expect(hasBareImport("// import { Client } from 'pg'  (the old broken form)\n", 'pg')).toBe(false);
    });
  });
});
