/**
 * Static broken-relative-import sweep sentinel (Equoria-rg7s4 / zzod8).
 *
 * WHY THIS EXISTS
 * ---------------
 * The efonm/rdtcb module-move refactors relocated service / model / util
 * files into backend/modules/<domain>/services/ (and data/), but left a class
 * of stale relative imports pointing at paths that no longer exist:
 *   - boot-graph services (cronJobs, cronJobService, groomHandlerService, ...)
 *     — fixed in zzod8; app.mjs could not boot.
 *   - standalone CLI / seed scripts (init-test-database.mjs `../utils/*` that
 *     should be `./utils/*`; seed-test-data.mjs; seed/userSeed.mjs's
 *     nonexistent `../utils/authUtils.mjs`) — fixed in rg7s4. These don't
 *     break boot (not in the app graph) but threw ERR_MODULE_NOT_FOUND when
 *     the script ran.
 *
 * A unit test can't import the CLI scripts to catch this — several run
 * destructive DB work at module top level (e.g. seed/userSeed.mjs). So this
 * sentinel STATICALLY parses every non-test backend .mjs file, extracts each
 * `import ... from './rel/path.mjs'` (real import statements only, not strings
 * in comments), resolves the target against the importing file, and asserts
 * the target FILE EXISTS. A stale relative import — the exact rg7s4/zzod8
 * defect class — fails this sentinel loudly in CI.
 *
 * Scope: relative specifiers ('./x', '../x') ending in .mjs only. Bare
 * specifiers (packages) and non-.mjs are out of scope — package resolution is
 * Node's job and is exercised by the runtime/boot sentinel.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(HERE, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '__tests__', 'tests']);

/** Only match real import statements, not relative paths quoted in comments. */
const IMPORT_RE = /^\s*import\s+[^;]*?\sfrom\s+'(\.\.?\/[^']+\.mjs)'\s*;?\s*$/gm;

function collectMjsFiles(dir, acc) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) {
        continue;
      }
      collectMjsFiles(full, acc);
    } else if (
      e.isFile() &&
      e.name.endsWith('.mjs') &&
      !e.name.endsWith('.test.mjs') &&
      !e.name.endsWith('.spec.mjs')
    ) {
      acc.push(full);
    }
  }
}

describe('no broken relative imports in backend source (Equoria-rg7s4 / zzod8)', () => {
  it('every relative .mjs import in non-test backend source resolves to a real file', () => {
    const files = [];
    collectMjsFiles(BACKEND_ROOT, files);

    const broken = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      let m;
      IMPORT_RE.lastIndex = 0;
      while ((m = IMPORT_RE.exec(src)) !== null) {
        const spec = m[1];
        const target = path.resolve(path.dirname(file), spec);
        if (!fs.existsSync(target)) {
          broken.push(`${path.relative(BACKEND_ROOT, file)} -> ${spec}`);
        }
      }
    }

    // Non-vacuous: we actually scanned a meaningful number of files.
    expect(files.length).toBeGreaterThan(50);
    expect(broken).toEqual([]);
  });
});
