/**
 * advancedLineageAnalysisService — JSONB-guard sentinel (Equoria-472l6).
 *
 * Asserts that backend/services/advancedLineageAnalysisService.mjs never
 * reintroduces the bare-default `|| []` / `|| {}` pattern when reading JSONB
 * columns from a Prisma `horse` row. The bare default is a stealth-corruption
 * vector: a JSONB column that has drifted to a string (truthy, non-array)
 * silently flows through, breaking downstream `.forEach`/`.includes`/spread
 * operations or — worse — succeeding with wrong-typed values.
 *
 * The canonical fix is `asFlagArray()` / `asFlagObject()` from
 * `backend/utils/jsonbArrayGuard.mjs`, which apply the full four-part guard
 * mandated by .claude/rules/CONTRIBUTING.md "Backend Conventions" #1.
 *
 * Sentinel-positive: this test FAILS if a bare pattern is reintroduced.
 * Plant-violation proof: temporarily reverting any call site to
 * `horse.positiveTraits || []` makes this test fail with a diagnostic
 * line:col + matched text.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Equoria-cdgwd: advancedLineageAnalysisService moved from backend/services/
// to backend/modules/breeding/services/ (commit 404baf191, efonm wave 3). The
// SERVICE_PATH was not updated to follow the move, so this sentinel was reading
// a nonexistent path (ENOENT) and silently guarded nothing. Path now points at
// the file's real co-located home: one level up from __tests__ → the module
// root → services/.
//
// Equoria-urqic.6: the 1206-line monolith was split into three cohesive sibling
// modules (lineageTree / lineageDiversity / lineagePerformance), with the
// original file reduced to a thin public-API re-export hub. The JSONB-reading
// code (and therefore the guard usage this sentinel protects) now lives in the
// extracted modules. The scan follows the code: every lineage module is checked
// for bare defaults, and the import check targets the two modules that actually
// read JSONB columns (lineageTree + lineagePerformance).
const SERVICE_DIR = resolve(__dirname, '..', 'services');
const SERVICE_PATH = resolve(SERVICE_DIR, 'advancedLineageAnalysisService.mjs');
// Modules that read Horse JSONB columns and must use asFlagArray/asFlagObject.
const JSONB_GUARD_MODULE_PATHS = [
  resolve(SERVICE_DIR, 'lineageTree.mjs'),
  resolve(SERVICE_DIR, 'lineagePerformance.mjs'),
  resolve(SERVICE_DIR, 'lineageBreedingRecommendations.mjs'),
];
// Every module the urqic.6 split produced (hub + 4 extracted) — the bare-default
// scan must cover them all so a regression in any one is caught.
const ALL_LINEAGE_MODULE_PATHS = [
  SERVICE_PATH,
  resolve(SERVICE_DIR, 'lineageTree.mjs'),
  resolve(SERVICE_DIR, 'lineageDiversity.mjs'),
  resolve(SERVICE_DIR, 'lineagePerformance.mjs'),
  resolve(SERVICE_DIR, 'lineageBreedingRecommendations.mjs'),
];

// Fields the bd issue calls out specifically as JSONB on the Horse model.
// Pattern hits e.g. `horse.positiveTraits || []`, `stallion.positiveTraits || []`,
// `mare.disciplineScores || {}`, etc. — any `<ident>.<jsonbField> || (\[\]|\{\})`.
const JSONB_ARRAY_FIELDS = ['positiveTraits', 'negativeTraits', 'hiddenTraits'];
const JSONB_OBJECT_FIELDS = ['disciplineScores'];

function findBareDefaults(source) {
  const violations = [];
  const lines = source.split('\n');

  const arrayPattern = new RegExp(`\\b\\w+\\.(?:${JSONB_ARRAY_FIELDS.join('|')})\\s*\\|\\|\\s*\\[\\s*\\]`, 'g');
  const objectPattern = new RegExp(`\\b\\w+\\.(?:${JSONB_OBJECT_FIELDS.join('|')})\\s*\\|\\|\\s*\\{\\s*\\}`, 'g');

  lines.forEach((line, idx) => {
    for (const pattern of [arrayPattern, objectPattern]) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(line)) !== null) {
        violations.push({ line: idx + 1, col: m.index + 1, text: m[0] });
      }
    }
  });

  return violations;
}

describe('Equoria-472l6 — JSONB-guard sentinel for advancedLineageAnalysisService', () => {
  it.each(ALL_LINEAGE_MODULE_PATHS)(
    'contains no bare `horse.<jsonbField> || [] / {}` patterns in %s (use asFlagArray/asFlagObject instead)',
    modulePath => {
      const source = readFileSync(modulePath, 'utf8');
      const violations = findBareDefaults(source);

      // Sentinel-positive diagnostic: list every offending line/col + the match.
      // If this fails, the offending line:col will be in the assertion output;
      // replace the bare default with asFlagArray(...) or asFlagObject(...).
      expect(violations).toEqual([]);
    },
  );

  it.each(JSONB_GUARD_MODULE_PATHS)('imports every JSONB guard it USES from jsonbArrayGuard.mjs in %s', modulePath => {
    // Cross-check: the modules that READ JSONB columns must actually import
    // the helpers they're supposed to use. Without this, a future refactor
    // could remove the import and the file would fall back to bare patterns
    // the first-test scan misses (e.g. a stylistic rewrite using `?? []`).
    //
    // Equoria-urqic.6: after the monolith split, each module imports only the
    // guard(s) it actually uses (lineagePerformance uses asFlagObject only;
    // lineageBreedingRecommendations uses asFlagArray only) — so the check is
    // usage-conditional rather than demanding BOTH symbols everywhere. It
    // still asserts: (a) the module imports at least one guard, (b) the import
    // is from the canonical jsonbArrayGuard.mjs path, and (c) any guard the
    // module CALLS is also imported (no call to an un-imported symbol).
    const source = readFileSync(modulePath, 'utf8');

    // (b) canonical import path present.
    expect(source).toMatch(/from\s+['"][./]*utils\/jsonbArrayGuard\.mjs['"]/);

    // (a) at least one guard imported.
    const importsArray = /import\s*\{[^}]*\basFlagArray\b/.test(source);
    const importsObject = /import\s*\{[^}]*\basFlagObject\b/.test(source);
    expect(importsArray || importsObject).toBe(true);

    // (c) every guard CALLED must be imported — catches a call to an
    // un-imported symbol (which would be a ReferenceError at runtime AND a
    // sign the canonical helper was bypassed).
    if (/\basFlagArray\s*\(/.test(source)) {
      expect(importsArray).toBe(true);
    }
    if (/\basFlagObject\s*\(/.test(source)) {
      expect(importsObject).toBe(true);
    }
  });

  it('the regex detector itself FIRES on a planted bare-default violation (sentinel-positive)', () => {
    // Prove the detector is not vacuous: a synthetic source string containing
    // the exact pattern we forbid MUST be flagged. Without this, a regex
    // typo could silently let the real test pass while the guard is dead.
    const planted = `
      const x = stallion.positiveTraits || [];
      const y = mare.disciplineScores || {};
    `;
    const violations = findBareDefaults(planted);
    expect(violations.length).toBe(2);
    expect(violations[0].text).toBe('stallion.positiveTraits || []');
    expect(violations[1].text).toBe('mare.disciplineScores || {}');
  });

  it('the regex detector does NOT flag the canonical asFlagArray()/asFlagObject() usage', () => {
    // Negative control: the fixed forms must NOT match the bare-default
    // pattern. Without this, the regex could be over-broad and falsely flag
    // the very fix we're enforcing.
    const fixed = `
      const x = asFlagArray(stallion.positiveTraits);
      const y = asFlagObject(mare.disciplineScores);
    `;
    expect(findBareDefaults(fixed)).toEqual([]);
  });
});
