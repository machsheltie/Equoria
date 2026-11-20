/**
 * Coverage for the shared ESLint `camelcase` configuration
 * (backend/eslint-plugins/camelcase-naming-rule.mjs, Equoria-pjvp8.9).
 *
 * Owner ruling q351: the naming check stays the guard, and an ESLint naming
 * rule at error backs it. This proves the rule as configured FIRES on the
 * snake_case identifiers and keys Equoria owns (a no-op configuration would
 * pass every lint and fail here), stays quiet on camelCase and on the outside
 * names the allow-list exempts.
 */

import { describe, it, expect } from '@jest/globals';
import { Linter } from 'eslint';
import { camelcaseAllowPatterns, camelcaseRule } from './camelcase-naming-rule.mjs';

function camelcaseMessages(code) {
  const linter = new Linter({ configType: 'flat' });
  return linter
    .verify(code, [
      {
        languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
        rules: { camelcase: camelcaseRule },
      },
    ])
    .filter(m => m.ruleId === 'camelcase');
}

describe('camelcase naming rule — fires on Equoria-owned snake_case', () => {
  it.each([
    ['a variable', 'const foal_count = 1; export { foal_count };'],
    ['a function', 'export function groom_horse() {}'],
    ['an object key', 'export const fee = { stud_fee: 1 };'],
    ['an assigned property', 'const horse = {}; horse.sale_price = 2; export { horse };'],
    ['a destructured name', 'const { bond_score } = {}; export { bond_score };'],
  ])('reports %s', (_label, code) => {
    expect(camelcaseMessages(code).length).toBeGreaterThan(0);
  });

  it('is configured at error', () => {
    expect(camelcaseRule[0]).toBe('error');
    expect(camelcaseRule[1].properties).toBe('always');
  });
});

describe('camelcase naming rule — quiet on camelCase and exempt outside names', () => {
  it.each([
    ['camelCase names', 'const foalCount = 1; export const fee = { studFee: foalCount };'],
    ['a genetic locus key', 'export const genotype = { E_Extension: "E/e", MFSD12_Mushroom: "N/N" };'],
    ['an allow-listed OAuth field', 'export const body = { grant_type: "refresh_token" };'],
    ['the test-only export prefix', 'export const __TESTING_ONLY_seam = 1;'],
    ['an UPPER_SNAKE environment name', 'export const env = { DATABASE_URL: "x" };'],
  ])('allows %s', (_label, code) => {
    expect(camelcaseMessages(code)).toEqual([]);
  });

  it('anchors every allow-list token, so a longer snake name is still reported', () => {
    expect(camelcaseAllowPatterns({ tokens: { pg_dump: 'x' } })).toContain('^pg_dump$');
    expect(camelcaseMessages('export const pg_dump_extra = 1;').length).toBeGreaterThan(0);
  });
});
