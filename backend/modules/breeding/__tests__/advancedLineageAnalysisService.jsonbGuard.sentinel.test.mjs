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
const SERVICE_PATH = resolve(__dirname, '..', '..', '..', 'services', 'advancedLineageAnalysisService.mjs');

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
  it('contains no bare `horse.<jsonbField> || [] / {}` patterns (use asFlagArray/asFlagObject instead)', () => {
    const source = readFileSync(SERVICE_PATH, 'utf8');
    const violations = findBareDefaults(source);

    // Sentinel-positive diagnostic: list every offending line/col + the match.
    // If this fails, the offending line:col will be in the assertion output;
    // replace the bare default with asFlagArray(...) or asFlagObject(...).
    expect(violations).toEqual([]);
  });

  it('imports asFlagArray and asFlagObject from jsonbArrayGuard.mjs', () => {
    // Cross-check: the fix must actually import the helpers it's supposed to
    // use. Without this, a future refactor could remove the import and the
    // file would fall back to bare patterns the first-test scan misses
    // (e.g. a stylistic rewrite using `?? []`).
    const source = readFileSync(SERVICE_PATH, 'utf8');
    expect(source).toMatch(/import\s*\{[^}]*\basFlagArray\b/);
    expect(source).toMatch(/import\s*\{[^}]*\basFlagObject\b/);
    expect(source).toMatch(/from\s+['"][./]*utils\/jsonbArrayGuard\.mjs['"]/);
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
