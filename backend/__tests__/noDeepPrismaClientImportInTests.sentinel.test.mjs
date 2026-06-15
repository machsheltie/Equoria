/**
 * Equoria-fefh2.44 sentinel — no deep `@prisma/client` node_modules import
 * anywhere in the backend test tree.
 *
 * ROOT CAUSE THIS GUARDS: cronDistributedLock's race test used to construct
 * its second client via
 *
 *   await import('../../packages/database/node_modules/@prisma/client/index.js')
 *
 * That absolute-path import loaded a SECOND JS copy of the generated client.
 * Two JS client copies sharing ONE native query engine corrupt interactive-
 * transaction bookkeeping: in ~50% of full shard-7 processes the singleton's
 * `$transaction` silently degraded to autocommit-per-statement (proven by
 * txid_current() diverging across two statements of one transaction —
 * 1044126/1044127 — while pg_locks showed the "held" xact advisory lock
 * already released). That is the fefh2.44 flake. The fix is to construct the
 * second client from prismaClient.mjs's re-export (ONE @prisma/client copy
 * per process).
 *
 * WHY A SENTINEL AND NOT JUST ESLINT: the existing no-restricted-imports ban
 * (Equoria-4qjo) on deep "node_modules/@prisma/client" generated-client paths
 * does NOT protect the test tree against this regression, for two independent
 * reasons:
 *   (1) backend/eslint.config.mjs turns `no-restricted-imports` OFF entirely
 *       in the test-files override block, and
 *   (2) ESLint's no-restricted-imports does not flag DYNAMIC `import()`
 *       expressions — and the regression form was a dynamic import.
 * A source scan catches both the static and the dynamic form, in test files,
 * regardless of eslint config. This is the only check that actually fires on
 * the real fefh2.44 regression.
 *
 * Sentinel-positive shape (OPTIMAL_FIX_DISCIPLINE §2): the test plants a file
 * containing the literal forbidden pattern under a scratch dir and proves the
 * scan fires. Without that proof a future refactor of the regex could let the
 * regression slip back in silently.
 *
 * The forbidden token is assembled at runtime so THIS sentinel's own source
 * does not match its own scan.
 */

import { describe, it, expect, afterAll, afterEach } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(HERE, '..'); // .../backend
const TARGET_DIRS = [
  path.join(BACKEND_ROOT, '__tests__'),
  path.join(BACKEND_ROOT, 'tests'),
  path.join(BACKEND_ROOT, 'modules'),
];
const PLANT_DIR = path.join(BACKEND_ROOT, '__tests__', '_deep_prisma_import_sentinel_scratch');

// Assembled via array-join so neither the self-scan nor the no-useless-concat
// lint rule fires on this line. Matches both forms the regression could take:
//   await import('.../node_modules/@prisma/client/index.js')
//   import { PrismaClient } from '.../node_modules/@prisma/client'
const FORBIDDEN = ['node_modules/', '@prisma', '/client'].join('');

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      if (entry.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        stack.push(full);
        continue;
      }
      if (entry.isFile() && /\.(mjs|js|cjs|ts)$/.test(entry.name)) {
        out.push(full);
      }
    }
  }
  return out;
}

function findMatches(dirs) {
  const hits = [];
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      let txt;
      try {
        txt = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const lines = txt.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        if (lines[i].includes(FORBIDDEN)) {
          hits.push(`${file}:${i + 1}`);
        }
      }
    }
  }
  return hits;
}

afterEach(() => {
  try {
    fs.rmSync(PLANT_DIR, { recursive: true, force: true });
  } catch {
    // best-effort cleanup; surfacing rm errors would be noise
  }
});

afterAll(() => {
  try {
    fs.rmSync(PLANT_DIR, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

describe('no deep @prisma/client node_modules import in backend test tree (Equoria-fefh2.44)', () => {
  it('baseline: zero deep-import matches across __tests__, tests, and modules', () => {
    const hits = findMatches(TARGET_DIRS);
    // Defensively exclude THIS sentinel's own path in case the walker
    // re-enters its scratch dir on a future refactor.
    const filtered = hits.filter(h => !h.includes('noDeepPrismaClientImportInTests.sentinel.test.mjs'));
    expect(filtered).toEqual([]);
  });

  it('SENTINEL: scan fires when a fresh test file imports @prisma/client by deep node_modules path', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const planted = path.join(PLANT_DIR, 'planted.test.mjs');
    // Reconstruct the exact regression line in the PLANTED file (so the
    // planted file contains the literal forbidden path) while THIS source
    // never does. The literal generated-client path `@prisma/client/index.js`
    // IS a .js file; this string is written into a scratch file, never imported.
    const PLANTED_LINE = `const { PrismaClient } = await import('../../packages/${FORBIDDEN}/index.js');`; // doctrine-allow: stale-js-extension
    fs.writeFileSync(
      planted,
      [
        '// PLANTED by noDeepPrismaClientImportInTests.sentinel.test.mjs — Equoria-fefh2.44.',
        '// Reintroducing the deep generated-client import is the exact flake regression.',
        PLANTED_LINE,
        '',
      ].join('\n'),
    );

    const hits = findMatches(TARGET_DIRS);
    const plantedHit = hits.find(h => h.includes('planted.test.mjs'));
    expect(plantedHit).toBeDefined();
  });
});
