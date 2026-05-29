/**
 * ultraRareMechanicalEffects — bare-default stat-fallback sentinel (Equoria-x3dlk).
 *
 * Asserts that backend/utils/ultraRareMechanicalEffects.mjs never reintroduces
 * the bare-default `<obj>.<statField> || <number>` (dot-access) OR
 * `<obj>[<dynamicStat>] || <number>` (bracket-access) pattern when writing or
 * reading stat fields. Horse stats are nullable Int columns (0..100); stat-0
 * is a legitimate game state (undeveloped or injury). The `||` fallback
 * silently masks 0 by collapsing it to the fallback — for non-zero fallbacks
 * this corrupts the stat; for `|| 0` it is numerically harmless but defeats
 * the canonical one-form rule (qrb08 doctrine).
 *
 * Canonical fix: nullish coalescing `?? <number>` — only triggers on
 * null/undefined, preserves legitimate 0.
 *
 * This file covers BOTH access forms because the file uses both:
 *   - line 585: `modifiedStats.stamina ?? 0`   (dot-access on the stamina bonus)
 *   - line 608: `modifiedStats[statName] ?? 0` (bracket-access in the allStatBonus loop)
 *
 * Sentinel-positive: this test FAILS if either pattern is reintroduced.
 *
 * Cross-reference:
 * - Template: backend/modules/breeding/__tests__/advancedLineageAnalysisService.bareDefaultGuard.sentinel.test.mjs (Equoria-qrb08)
 * - OPTIMAL_FIX_DISCIPLINE.md §2 (sentinel-positive test required), §3 (adjacent-locations: bracket-access form caught here at line 608)
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVICE_PATH = resolve(__dirname, '..', 'utils', 'ultraRareMechanicalEffects.mjs');

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

  // Dot-access form: `<ident>.<stat> || <number>` — covers
  // `modifiedStats.stamina || 0`, `horse.speed || 50`, etc.
  const dotPattern = new RegExp(`\\b\\w+\\.(?:${STAT_FIELDS.join('|')})\\s*\\|\\|\\s*\\d+`, 'g');

  // Bracket-access form: `<ident>[<anything-that-could-be-a-stat-key>] || <number>`.
  // We intentionally keep this LOOSE — any bracketed property read with `|| <n>`
  // tail on an identifier named like `*Stats` or `*stats` (signals stat-bag
  // semantics) is forbidden. This is the only file in the codebase that uses
  // the dynamic loop form, and tightening it later is cheap.
  // The bracket-content matcher accepts: identifiers (statName),
  // single-quoted strings ('speed'), and double-quoted strings ("speed").
  const bracketPattern = /\b\w*[Ss]tats?\s*\[\s*(?:\w+|'[^']*'|"[^"]*")\s*\]\s*\|\|\s*\d+/g;

  lines.forEach((line, idx) => {
    // Strip single-line `//` comments before scanning — comments may legitimately
    // QUOTE the forbidden pattern when documenting why it was removed.
    const commentIdx = line.indexOf('//');
    const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;

    dotPattern.lastIndex = 0;
    let m;
    while ((m = dotPattern.exec(codePart)) !== null) {
      violations.push({ line: idx + 1, col: m.index + 1, text: m[0], form: 'dot' });
    }
    bracketPattern.lastIndex = 0;
    while ((m = bracketPattern.exec(codePart)) !== null) {
      violations.push({ line: idx + 1, col: m.index + 1, text: m[0], form: 'bracket' });
    }
  });

  return violations;
}

describe('Equoria-x3dlk — bare-default stat-fallback sentinel for ultraRareMechanicalEffects', () => {
  it('contains no bare `<stats>.<stat> || <number>` or `<stats>[<key>] || <number>` patterns', () => {
    const source = readFileSync(SERVICE_PATH, 'utf8');
    const violations = findBareStatDefaults(source);

    // Sentinel-positive diagnostic: list every offending line/col + the match.
    expect(violations).toEqual([]);
  });

  it('the regex detector itself FIRES on planted bare-default violations (sentinel-positive)', () => {
    const planted = `
      const a = modifiedStats.stamina || 0;
      const b = horse.speed || 50;
      const c = modifiedStats[statName] || 0;
      const d = baseStats['speed'] || 0;
    `;
    const violations = findBareStatDefaults(planted);
    // Dot form: `modifiedStats.stamina || 0`, `horse.speed || 50` → 2 matches
    // Bracket form: `modifiedStats[statName] || 0`, `baseStats['speed'] || 0` → 2 matches
    expect(violations.length).toBe(4);
    const texts = violations.map(v => v.text);
    expect(texts).toContain('modifiedStats.stamina || 0');
    expect(texts).toContain('horse.speed || 50');
    expect(texts).toContain('modifiedStats[statName] || 0');
    // baseStats with literal key — string contents shown as-is by RegExp
    expect(texts.some(t => /baseStats\[.*\]\s*\|\|\s*0/.test(t))).toBe(true);
  });

  it('the regex detector does NOT flag the canonical nullish-coalescing form', () => {
    const fixed = `
      const a = modifiedStats.stamina ?? 0;
      const b = horse.speed ?? 50;
      const c = modifiedStats[statName] ?? 0;
    `;
    expect(findBareStatDefaults(fixed)).toEqual([]);
  });

  it('the regex detector does NOT flag unrelated `|| <number>` patterns on non-stat fields', () => {
    const unrelated = `
      const len = result.length || 0;
      const timeout = config.timeout || 5000;
      const arr = items[idx] || 0;
    `;
    expect(findBareStatDefaults(unrelated)).toEqual([]);
  });
});
