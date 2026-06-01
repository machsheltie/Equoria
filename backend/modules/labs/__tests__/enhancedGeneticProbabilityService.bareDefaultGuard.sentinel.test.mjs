/**
 * enhancedGeneticProbabilityService — bare-default stat-fallback sentinel
 * (Equoria-yvxkx).
 *
 * Asserts that backend/services/enhancedGeneticProbabilityService.mjs never
 * reintroduces the bare-default `<obj>.<statField> || <number>` (dot-access)
 * or `<obj>[stat] || <number>` (bracket-access) pattern when reading Horse
 * stat columns. Horse stats are nullable Int columns (0..100); stat-0 is a
 * legitimate game state (undeveloped or injury).
 *
 * This file's fallback was `|| 50` — which actively corrupts genetic probability
 * for a stat-0 horse by boosting it to 50. The `??` fix preserves legitimate 0
 * and only falls back when the column is null/undefined.
 *
 * Sentinel-positive: this test FAILS if any `<obj>.<statField> || <number>`
 * pattern is reintroduced.
 *
 * Cross-reference:
 * - Template: backend/modules/breeding/__tests__/advancedLineageAnalysisService.bareDefaultGuard.sentinel.test.mjs (Equoria-qrb08)
 * - OPTIMAL_FIX_DISCIPLINE.md §2 (sentinel-positive test required), §3 (bracket-access form bundled here per single-line companion rule)
 * - Sibling guards: competitionScore (Equoria-l99ed),
 *   ultraRareMechanicalEffects (Equoria-x3dlk),
 *   legacyScoreCalculator (Equoria-ho2b9).
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVICE_PATH = resolve(__dirname, '..', '..', '..', 'services', 'enhancedGeneticProbabilityService.mjs');

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

  // Dot-access form: `<ident>.<stat> || <number>`
  const dotPattern = new RegExp(`\\b\\w+\\.(?:${STAT_FIELDS.join('|')})\\s*\\|\\|\\s*\\d+`, 'g');

  // Bracket-access form scoped to identifiers `stallion`, `mare`, `horse`,
  // `foal`, `sire`, `dam`, or `*[Ss]tat*` (stat-bag semantics) reading via
  // a `stat`/`statName`-like identifier key. Catches the two sites at
  // lines 137/138 (`stallion[stat] || 50`, `mare[stat] || 50`) without
  // false-positives on unrelated `obj[key] || N` reads.
  const bracketPattern = /\b(?:stallion|mare|horse|foal|sire|dam|\w*[Ss]tats?)\s*\[\s*\w*[Ss]tat\w*\s*\]\s*\|\|\s*\d+/g;

  lines.forEach((line, idx) => {
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

describe('Equoria-yvxkx — bare-default stat-fallback sentinel for enhancedGeneticProbabilityService', () => {
  it('contains no bare `<obj>.<stat> || <number>` or `<parent>[stat] || <number>` patterns', () => {
    const source = readFileSync(SERVICE_PATH, 'utf8');
    const violations = findBareStatDefaults(source);

    expect(violations).toEqual([]);
  });

  it('the regex detector itself FIRES on a planted bare-default violation (sentinel-positive)', () => {
    const planted = `
      const a = stats.speed || 50;
      const b = horse.stamina || 50;
      const c = stallion[stat] || 50;
      const d = mare[statName] || 50;
    `;
    const violations = findBareStatDefaults(planted);
    expect(violations.length).toBe(4);
    const texts = violations.map(v => v.text);
    expect(texts).toContain('stats.speed || 50');
    expect(texts).toContain('horse.stamina || 50');
    expect(texts).toContain('stallion[stat] || 50');
    expect(texts).toContain('mare[statName] || 50');
  });

  it('the regex detector does NOT flag the canonical nullish-coalescing form', () => {
    const fixed = `
      const a = stats.speed ?? 50;
      const b = horse.stamina ?? 50;
      const c = stallion[stat] ?? 50;
    `;
    expect(findBareStatDefaults(fixed)).toEqual([]);
  });

  it('the regex detector does NOT flag unrelated `|| <number>` patterns on non-stat fields', () => {
    const unrelated = `
      const len = result.length || 0;
      const timeout = config.timeout || 5000;
      const disc = disciplines[discipline] || 0;
    `;
    expect(findBareStatDefaults(unrelated)).toEqual([]);
  });
});
