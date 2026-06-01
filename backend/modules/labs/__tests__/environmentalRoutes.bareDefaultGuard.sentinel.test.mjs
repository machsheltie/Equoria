/**
 * environmentalRoutes — bare-default stat-fallback sentinel (Equoria-hnci3).
 *
 * Asserts that
 * backend/modules/labs/routes/environmentalRoutes.mjs never reintroduces
 * the bare-default `horse.<statField> || <number>` pattern when reading
 * Horse stat columns. Horse stats are nullable Int columns (0..100); a
 * stat of 0 is a legitimate game state (undeveloped or injury). The `||`
 * fallback silently masks 0 by collapsing it to the fallback — for
 * non-zero fallbacks (this file uses 50) this corrupts environmental
 * impact / triggers / stress calculations by treating an intentional
 * stat-0 as if the horse had average stats.
 *
 * Canonical fix: nullish coalescing `?? <number>` — only triggers on
 * null/undefined, preserves legitimate 0.
 *
 * Sentinel-positive: this test FAILS if any `horse.<statField> || <number>`
 * pattern is reintroduced in the routes file.
 *
 * Cross-reference:
 * - Template: backend/modules/competition/__tests__/competitionScore.bareDefaultGuard.sentinel.test.mjs (Equoria-l99ed)
 * - OPTIMAL_FIX_DISCIPLINE.md §2 (sentinel-positive test required)
 * - Parent doctrine: Equoria-xngqe / Equoria-qrb08
 * - Sibling guards: advancedLineageAnalysisService (Equoria-qrb08),
 *   competitionScore (Equoria-l99ed),
 *   competitionController (Equoria-182zv),
 *   enhancedGeneticProbabilityService (Equoria-yvxkx),
 *   legacyScoreCalculator (Equoria-ho2b9),
 *   ultraRareMechanicalEffects (Equoria-x3dlk).
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROUTES_PATH = resolve(__dirname, '..', 'routes', 'environmentalRoutes.mjs');

// The 10 canonical Horse stat columns. Match any `<ident>.<stat> || <number>`
// pattern at any nesting depth — covers `horse.speed || 50`,
// `stallion.speed || 50`, `mare.intelligence || 50`, etc.
const STAT_FIELDS = [
  'speed',
  'stamina',
  'agility',
  'balance',
  'precision',
  'intelligence',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
];

function findBareStatDefaults(source) {
  const violations = [];
  const lines = source.split('\n');
  const pattern = new RegExp(`\\b\\w+\\.(?:${STAT_FIELDS.join('|')})\\s*\\|\\|\\s*\\d+`, 'g');

  lines.forEach((line, idx) => {
    // Strip single-line `//` comments before scanning — comments may legitimately
    // QUOTE the forbidden pattern when documenting why it was removed.
    const commentIdx = line.indexOf('//');
    const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;

    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(codePart)) !== null) {
      violations.push({ line: idx + 1, col: m.index + 1, text: m[0] });
    }
  });

  return violations;
}

describe('Equoria-hnci3 — bare-default stat-fallback sentinel for environmentalRoutes', () => {
  it('contains no bare `<ident>.<stat> || <number>` patterns (use `?? <number>` to preserve legitimate stat-0)', () => {
    const source = readFileSync(ROUTES_PATH, 'utf8');
    const violations = findBareStatDefaults(source);

    // Sentinel-positive diagnostic: list every offending line/col + the match.
    // If this fails, replace `||` with `??` at the reported location.
    expect(violations).toEqual([]);
  });

  it('the regex detector itself FIRES on a planted bare-default violation (sentinel-positive)', () => {
    // Prove the detector is not vacuous: a synthetic source string containing
    // the exact pattern we forbid MUST be flagged. Without this, a regex typo
    // could silently let the real test pass while the guard is dead.
    const planted = `
      const a = horse.speed || 50;
      const b = stallion.stamina || 50;
      const c = mare.intelligence || 0;
    `;
    const violations = findBareStatDefaults(planted);
    expect(violations.length).toBe(3);
    expect(violations[0].text).toBe('horse.speed || 50');
    expect(violations[1].text).toBe('stallion.stamina || 50');
    expect(violations[2].text).toBe('mare.intelligence || 0');
  });

  it('the regex detector does NOT flag the canonical nullish-coalescing form', () => {
    // Negative control: the fixed `?? 50` form must NOT match the bare-default
    // pattern.
    const fixed = `
      const a = horse.speed ?? 50;
      const b = stallion.stamina ?? 50;
      const c = mare.intelligence ?? 0;
    `;
    expect(findBareStatDefaults(fixed)).toEqual([]);
  });

  it('the regex detector does NOT flag unrelated `|| <number>` patterns on non-stat fields', () => {
    // Negative control: only stat-column reads should be flagged. Patterns
    // like `horse.health || 85` (different field), `result.length || 0`, etc.
    // must pass.
    const unrelated = `
      const h = horse.health || 85;
      const len = result.length || 0;
      const timeout = config.timeout || 5000;
    `;
    expect(findBareStatDefaults(unrelated)).toEqual([]);
  });
});
