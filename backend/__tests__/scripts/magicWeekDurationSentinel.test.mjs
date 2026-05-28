/**
 * Equoria-maint — Sentinel for "no magic 7 * 24 * 60 * 60 * 1000 literal in
 * backend production code." Tests are allowlisted (separate codemod scope).
 *
 * The literal `7 * 24 * 60 * 60 * 1000` appeared in 8+ production sites with
 * at least three distinct semantic meanings (1 week / 1 game year /
 * gestation). After this codemod, production code MUST import from
 * `backend/constants/time.mjs` (MS_PER_WEEK / MS_PER_GAME_YEAR / GESTATION_MS)
 * so the meaning is named at the call site.
 *
 * Production scope: backend/modules/, backend/services/, backend/middleware/,
 * backend/utils/, backend/controllers/, backend/routes/, backend/models/,
 * backend/seed/, backend/scripts/.
 *
 * Allowlist (intentional):
 * - backend/__tests__/, backend/modules/<x>/__tests__/, *.test.mjs files —
 *   tests use the literal to construct mock dates / expected expirations.
 *   Sweeping tests is materially larger work and a separate bd issue.
 * - backend/constants/time.mjs itself — defines the constants.
 *
 * PLANTED-VIOLATION proof: tests below assert the detector regex matches
 * synthetic violation source, so a passing-but-vacuous detector cannot
 * silently degrade.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');

// Detector regex: literal `7 * 24 * 60 * 60 * 1000` with arbitrary internal
// whitespace. Also catches `N * 7 * 24 * 60 * 60 * 1000` because the
// numeric prefix is matched separately by the host code.
const WEEK_MS_LITERAL = /\b7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000\b/;

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// Production directories (NOT __tests__, NOT *.test.mjs).
const PRODUCTION_DIRS = [
  'modules',
  'services',
  'middleware',
  'utils',
  'controllers',
  'routes',
  'models',
  'seed',
  'scripts',
];

function isProductionFile(absPath) {
  const rel = path.relative(BACKEND_ROOT, absPath).replace(/\\/g, '/');
  if (!rel.endsWith('.mjs')) {
    return false;
  }
  if (rel.endsWith('.test.mjs')) {
    return false;
  }
  if (rel.includes('/__tests__/')) {
    return false;
  }
  if (rel.includes('/tests/')) {
    return false;
  }
  // Must live under one of the production dirs (first path segment).
  const first = rel.split('/')[0];
  return PRODUCTION_DIRS.includes(first);
}

// Allowlist: the constants file itself (defines MS_PER_DAY * 7).
const ALLOWLIST = [
  path.normalize('backend/constants/time.mjs'),
];

function walkMjs(root) {
  const out = [];
  function recurse(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', '.archive', 'coverage', 'dist', 'build'].includes(e.name)) {
          continue;
        }
        recurse(path.join(dir, e.name));
      } else if (e.isFile() && e.name.endsWith('.mjs')) {
        out.push(path.join(dir, e.name));
      }
    }
  }
  recurse(root);
  return out;
}

describe('Equoria-maint — no magic 7 * 24 * 60 * 60 * 1000 literal in backend production', () => {
  test('WEEK_MS_LITERAL fires on a synthetic violation (PLANTED)', () => {
    const synthetic = 'const x = 7 * 24 * 60 * 60 * 1000;';
    expect(WEEK_MS_LITERAL.test(stripComments(synthetic))).toBe(true);
  });

  test('WEEK_MS_LITERAL fires on a multiplied form (PLANTED)', () => {
    const synthetic = 'const x = 3 * 7 * 24 * 60 * 60 * 1000;';
    expect(WEEK_MS_LITERAL.test(stripComments(synthetic))).toBe(true);
  });

  test('WEEK_MS_LITERAL fires on whitespace variation (PLANTED)', () => {
    const synthetic = 'const x = 7  *  24*60 * 60 *1000;';
    expect(WEEK_MS_LITERAL.test(stripComments(synthetic))).toBe(true);
  });

  test('WEEK_MS_LITERAL does NOT match a comment-only mention (NEGATIVE)', () => {
    const commentOnly = `
      // Replaces 7 * 24 * 60 * 60 * 1000 (which was banned by maint).
      /* 7 * 24 * 60 * 60 * 1000 also appears here in a block comment. */
      export const X = MS_PER_WEEK;
    `;
    expect(WEEK_MS_LITERAL.test(stripComments(commentOnly))).toBe(false);
  });

  test('WEEK_MS_LITERAL does NOT match unrelated arithmetic (NEGATIVE)', () => {
    // 7 days, 12 hours, etc — different total — must not false-positive.
    expect(WEEK_MS_LITERAL.test('const x = 7 * 24 * 60 * 60;')).toBe(false);
    expect(WEEK_MS_LITERAL.test('const x = 14 * 24 * 60 * 60 * 1000;')).toBe(false);
    expect(WEEK_MS_LITERAL.test('const x = 7 * 24 * 3600 * 1000;')).toBe(false);
  });

  test('no production backend file uses the bare 7 * 24 * 60 * 60 * 1000 literal', () => {
    const files = walkMjs(BACKEND_ROOT).filter(isProductionFile);
    expect(files.length).toBeGreaterThan(50); // sanity: real production tree

    const violations = [];
    for (const filePath of files) {
      const rel = path.relative(REPO_ROOT, filePath);
      if (ALLOWLIST.includes(path.normalize(rel))) {
        continue;
      }
      const source = fs.readFileSync(filePath, 'utf8');
      const stripped = stripComments(source);
      if (WEEK_MS_LITERAL.test(stripped)) {
        violations.push(rel);
      }
    }

    expect(violations).toEqual([]);
  });
});
