/**
 * sl48c — JSONB guard sentinel for the 3 adjacent files identified in the
 * Equoria-472l6 adjacent-locations finding.
 *
 * Files (per bd Equoria-sl48c):
 *   - backend/services/enhancedGeneticProbabilityService.mjs:175,176,379,380
 *   - backend/modules/horses/controllers/horseController.mjs:517
 *   - backend/modules/training/controllers/trainingController.mjs:744
 *
 * All sites previously used the bare `something.disciplineScores || {}`
 * pattern — a stealth-corruption vector when the JSONB column drifts to a
 * primitive / array / null on legacy rows. Canonical fix: asFlagObject() /
 * asFlagArray() from backend/utils/jsonbArrayGuard.mjs (full four-part
 * guard, per .claude/rules/CONTRIBUTING.md "Backend Conventions" #1).
 *
 * This sentinel FAILS if any of the three files reintroduces the bare
 * pattern, AND positively verifies that the regex detector itself fires on
 * a planted violation (so a regex typo cannot make the test vacuously
 * green).
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_ROOT = resolve(__dirname, '..');

const TARGET_FILES = [
  resolve(BACKEND_ROOT, 'services', 'enhancedGeneticProbabilityService.mjs'),
  resolve(BACKEND_ROOT, 'modules', 'horses', 'controllers', 'horseController.mjs'),
  resolve(BACKEND_ROOT, 'modules', 'training', 'controllers', 'trainingController.mjs'),
];

// JSONB fields called out by the 472l6 adjacent-locations finding. Pattern
// matches `<ident>.<field> || []` or `<ident>.<field> || {}`.
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

describe('Equoria-sl48c — JSONB guard sentinel for the 3 adjacent files', () => {
  for (const filePath of TARGET_FILES) {
    const relative = filePath.replace(BACKEND_ROOT, 'backend');

    it(`contains no bare \`<ident>.<jsonbField> || [] / {}\` patterns in ${relative}`, () => {
      const source = readFileSync(filePath, 'utf8');
      const violations = findBareDefaults(source);
      // If this fails, the offending line:col will appear in the assertion
      // output — replace the bare default with asFlagArray(...) or
      // asFlagObject(...) from backend/utils/jsonbArrayGuard.mjs.
      expect(violations).toEqual([]);
    });

    it(`imports asFlagObject from jsonbArrayGuard.mjs in ${relative}`, () => {
      // Cross-check: the fix must actually import the helper it uses.
      // Without this, a future refactor could remove the import and the
      // file would silently fall back to a bare `?? {}` the first scan
      // misses.
      const source = readFileSync(filePath, 'utf8');
      expect(source).toMatch(/import\s*\{[^}]*\basFlagObject\b/);
      expect(source).toMatch(/from\s+['"][./]*utils\/jsonbArrayGuard\.mjs['"]/);
    });
  }

  it('the regex detector itself FIRES on a planted bare-default violation (sentinel-positive)', () => {
    // Prove the detector is not vacuous: a synthetic source string
    // containing the exact pattern we forbid MUST be flagged. Without
    // this, a regex typo could silently let the file scan pass while the
    // guard is dead.
    const planted = `
      const x = stallion.positiveTraits || [];
      const y = mare.disciplineScores || {};
    `;
    const violations = findBareDefaults(planted);
    expect(violations.length).toBe(2);
    expect(violations[0].text).toBe('stallion.positiveTraits || []');
    expect(violations[1].text).toBe('mare.disciplineScores || {}');
  });

  it('the regex detector does NOT flag canonical asFlagArray()/asFlagObject() usage', () => {
    // Negative control: the fixed forms must NOT match the bare-default
    // pattern. Without this, the regex could be over-broad and falsely
    // flag the very fix we're enforcing.
    const fixed = `
      const x = asFlagArray(stallion.positiveTraits);
      const y = asFlagObject(mare.disciplineScores);
    `;
    expect(findBareDefaults(fixed)).toEqual([]);
  });
});
