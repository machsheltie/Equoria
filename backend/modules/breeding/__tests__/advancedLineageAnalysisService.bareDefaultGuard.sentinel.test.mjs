/**
 * advancedLineageAnalysisService — bare-default stat-fallback sentinel (Equoria-qrb08).
 *
 * Asserts that backend/services/advancedLineageAnalysisService.mjs never
 * reintroduces the bare-default `horse.<statField> || 50` pattern when reading
 * Horse stat columns. Horse stats are nullable Int columns (0..100); a stat of
 * 0 is a legitimate game state (undeveloped or injury). The `||` fallback
 * silently boosts that legitimate 0 to 50, skewing pedigree quality, breeding
 * predictions, and lineage performance averages.
 *
 * Canonical fix: nullish coalescing `?? 50` — only triggers on null/undefined,
 * preserves legitimate 0.
 *
 * Sentinel-positive: this test FAILS if any `horse.<statField> || <number>`
 * pattern is reintroduced. Plant-violation proof: temporarily reverting any
 * call site back to `|| 50` makes this test fail with a diagnostic line:col +
 * matched text.
 *
 * Cross-reference: OPTIMAL_FIX_DISCIPLINE.md §2 (sentinel-positive test
 * required), §3 (adjacent-locations check filed as separate bd issues — the
 * same antipattern lives in `enhancedGeneticProbabilityService.mjs`,
 * `geneticDiversityTrackingService.mjs`, `legacyScoreCalculator.mjs`,
 * `competitionScore.mjs`, etc. — each handled as a follow-up).
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
// original file reduced to a thin public-API re-export hub. The stat-reading
// code this sentinel protects now lives in the extracted modules, so the scan
// follows the code: every lineage module is checked for the bare-default
// stat-fallback pattern.
const SERVICE_DIR = resolve(__dirname, '..', 'services');
const ALL_LINEAGE_MODULE_PATHS = [
  resolve(SERVICE_DIR, 'advancedLineageAnalysisService.mjs'),
  resolve(SERVICE_DIR, 'lineageTree.mjs'),
  resolve(SERVICE_DIR, 'lineageDiversity.mjs'),
  resolve(SERVICE_DIR, 'lineagePerformance.mjs'),
  resolve(SERVICE_DIR, 'lineageBreedingRecommendations.mjs'),
];

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
    // QUOTE the forbidden pattern when documenting why it was removed (the comment
    // is not executable code, so it can't reintroduce the defect).
    // Guard: only strip when `//` is NOT inside a string literal. Simple heuristic
    // that's sufficient for this file (no `//` inside strings in source).
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

describe('Equoria-qrb08 — bare-default stat-fallback sentinel for advancedLineageAnalysisService', () => {
  it.each(ALL_LINEAGE_MODULE_PATHS)(
    'contains no bare `horse.<stat> || <number>` patterns in %s (use `?? <number>` to preserve legitimate stat-0)',
    modulePath => {
      const source = readFileSync(modulePath, 'utf8');
      const violations = findBareStatDefaults(source);

      // Sentinel-positive diagnostic: list every offending line/col + the match.
      // If this fails, replace `||` with `??` at the reported location.
      expect(violations).toEqual([]);
    },
  );

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
    // pattern. Without this, the regex could be over-broad and falsely flag
    // the very fix we're enforcing.
    const fixed = `
      const a = horse.speed ?? 50;
      const b = stallion.stamina ?? 50;
      const c = mare.intelligence ?? 0;
    `;
    expect(findBareStatDefaults(fixed)).toEqual([]);
  });

  it('the regex detector does NOT flag unrelated `|| <number>` patterns on non-stat fields', () => {
    // Negative control: only stat-column reads should be flagged. Patterns
    // like `result.length || 0` or `config.timeout || 5000` must pass.
    const unrelated = `
      const len = result.length || 0;
      const timeout = config.timeout || 5000;
      const count = items.count || 1;
    `;
    expect(findBareStatDefaults(unrelated)).toEqual([]);
  });
});
