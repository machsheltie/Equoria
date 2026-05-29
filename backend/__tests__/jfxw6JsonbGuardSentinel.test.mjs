/**
 * jfxw6 — JSONB guard sentinel for backend/models/horseModel.mjs (sl48c sibling).
 *
 * Equoria-jfxw6: adjacent-locations finding from Equoria-sl48c. The legacy
 * model file backend/models/horseModel.mjs:327,381 uses the same bare-default
 * `<something>.disciplineScores || {}` pattern guarded against in sl48c and
 * 472l6. Same defect class — when the JSONB column drifts to a non-object
 * type (null primitive / array on legacy rows), the bare default silently
 * passes the wrong-typed value downstream.
 *
 * This sentinel FAILS if backend/models/horseModel.mjs reintroduces the bare
 * pattern, AND positively verifies that the regex detector itself fires on a
 * planted violation (so a regex typo cannot make the test vacuously green).
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_ROOT = resolve(__dirname, '..');

const TARGET_FILE = resolve(BACKEND_ROOT, 'models', 'horseModel.mjs');

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

describe('Equoria-jfxw6 — JSONB guard sentinel for backend/models/horseModel.mjs', () => {
  it('contains no bare `<ident>.<jsonbField> || [] / {}` patterns', () => {
    const source = readFileSync(TARGET_FILE, 'utf8');
    const violations = findBareDefaults(source);
    // If this fails, the offending line:col will appear in the assertion
    // output — replace the bare default with asFlagArray(...) or
    // asFlagObject(...) from backend/utils/jsonbArrayGuard.mjs.
    expect(violations).toEqual([]);
  });

  it('imports asFlagObject from jsonbArrayGuard.mjs', () => {
    // Cross-check: the fix must actually import the helper it uses.
    // Without this, a future refactor could remove the import and the
    // file would silently fall back to a bare `?? {}` the first scan
    // misses.
    const source = readFileSync(TARGET_FILE, 'utf8');
    expect(source).toMatch(/import\s*\{[^}]*\basFlagObject\b/);
    expect(source).toMatch(/from\s+['"][./]*utils\/jsonbArrayGuard\.mjs['"]/);
  });

  it('the regex detector itself FIRES on a planted bare-default violation (sentinel-positive)', () => {
    // Prove the detector is not vacuous: a synthetic source string
    // containing the exact pattern we forbid MUST be flagged. Without
    // this, a regex typo could silently let the file scan pass while the
    // guard is dead.
    const planted = `
      const x = currentHorse.disciplineScores || {};
      const y = horse.disciplineScores || {};
    `;
    const violations = findBareDefaults(planted);
    expect(violations.length).toBe(2);
    expect(violations[0].text).toBe('currentHorse.disciplineScores || {}');
    expect(violations[1].text).toBe('horse.disciplineScores || {}');
  });

  it('the regex detector does NOT flag canonical asFlagObject() usage', () => {
    // Negative control: the fixed forms must NOT match the bare-default
    // pattern. Without this, the regex could be over-broad and falsely
    // flag the very fix we're enforcing.
    const fixed = `
      const x = asFlagObject(currentHorse.disciplineScores);
      const y = asFlagObject(horse.disciplineScores);
    `;
    expect(findBareDefaults(fixed)).toEqual([]);
  });
});
