/**
 * legacyScoreCalculator — bare-default stat-fallback sentinel (Equoria-ho2b9).
 *
 * Asserts that backend/modules/horses/services/legacyScoreCalculator.mjs never
 * reintroduces the bare-default `horse.<statField> || <number>` pattern when reading Horse
 * stat columns. Horse stats are nullable Int columns (0..100); a stat of 0
 * is a legitimate game state (undeveloped or injury). The `||` fallback
 * silently masks 0 by collapsing it to the fallback — for non-zero fallbacks
 * this corrupts the score; for `|| 0` it is numerically harmless but defeats
 * the canonical one-form rule (qrb08 doctrine).
 *
 * Canonical fix: nullish coalescing `?? <number>` — only triggers on
 * null/undefined, preserves legitimate 0.
 *
 * History: the source file originally had 20 bare-default violations (10 in
 * the array form, 10 in the object form); the Equoria-ho2b9 migration replaced
 * all of them with `??` (verified clean — stat reads at lines 130-139 and
 * 155-164 use `?? 0`). This sentinel guards against regression.
 *
 * Equoria-dl3kz: SERVICE_PATH was ENOENT-dead — it pointed at the pre-move
 * location `backend/services/legacyScoreCalculator.mjs`, but the source moved
 * to `backend/modules/horses/services/legacyScoreCalculator.mjs`. While dead,
 * readFileSync would have thrown, so the guard exercised nothing. Path repaired
 * to the real file; the source was already clean (no violations leaked in).
 *
 * Sentinel-positive: this test FAILS if any `horse.<statField> || <number>`
 * pattern is reintroduced.
 *
 * Cross-reference:
 * - Template: backend/modules/breeding/__tests__/advancedLineageAnalysisService.bareDefaultGuard.sentinel.test.mjs (Equoria-qrb08)
 * - OPTIMAL_FIX_DISCIPLINE.md §2 (sentinel-positive test required)
 * - Sibling guards: competitionScore (Equoria-l99ed),
 *   ultraRareMechanicalEffects (Equoria-x3dlk),
 *   advancedLineageAnalysisService (Equoria-qrb08), etc.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Equoria-dl3kz: real file is backend/modules/horses/services/legacyScoreCalculator.mjs
// (one level up from this __tests__ dir, then into services/). The previous
// '..','..','..','services' path resolved to backend/services/ (ENOENT-dead).
const SERVICE_PATH = resolve(__dirname, '..', 'services', 'legacyScoreCalculator.mjs');

// The 10 canonical Horse stat columns.
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

describe('Equoria-ho2b9 — bare-default stat-fallback sentinel for legacyScoreCalculator', () => {
  it('contains no bare `horse.<stat> || <number>` patterns (use `?? <number>` to preserve legitimate stat-0)', () => {
    const source = readFileSync(SERVICE_PATH, 'utf8');
    const violations = findBareStatDefaults(source);

    // Sentinel-positive diagnostic: list every offending line/col + the match.
    expect(violations).toEqual([]);
  });

  it('the regex detector itself FIRES on a planted bare-default violation (sentinel-positive)', () => {
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
    const fixed = `
      const a = horse.speed ?? 50;
      const b = stallion.stamina ?? 50;
      const c = mare.intelligence ?? 0;
    `;
    expect(findBareStatDefaults(fixed)).toEqual([]);
  });

  it('the regex detector does NOT flag unrelated `|| <number>` patterns on non-stat fields', () => {
    const unrelated = `
      const len = result.length || 0;
      const timeout = config.timeout || 5000;
      const count = items.count || 1;
    `;
    expect(findBareStatDefaults(unrelated)).toEqual([]);
  });
});
