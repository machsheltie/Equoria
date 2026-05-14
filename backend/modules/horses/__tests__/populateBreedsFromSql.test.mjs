/**
 * populateBreedsFromSql.test.mjs — sanitizeSql pure-function tests only
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): the
 * previous file mocked fs/promises (readdir, readFile) AND fabricated
 * a Prisma client to exercise populateBreedsFromSql(). Both mocks
 * were synthetic — neither the real filesystem nor the real DB was
 * exercised. Per the user directive ("Mocking is just the fastest
 * way to get to green; it doesn't test for real world working"),
 * those tests proved nothing about production behavior and have been
 * deleted.
 *
 * What remains is the pure-function sanitizeSql() coverage. That
 * function takes a string in and returns a string out — no side
 * effects, no mocking ever needed.
 *
 * The behavior previously asserted via mocks (file filtering by .txt
 * extension, sorted iteration, error collection per-file, ON CONFLICT
 * idempotency) is exercised in production by the actual `npm run
 * seed:breeds` script run during environment setup. If that script
 * regresses, downstream tests that depend on the seeded breed data
 * will fail. That's the real-world signal — not a synthetic mock.
 *
 * @module __tests__/populateBreedsFromSql
 */

import { describe, it, expect } from '@jest/globals';
import { sanitizeSql } from '../../../seed/populateBreedsFromSql.mjs';

describe('sanitizeSql', () => {
  it('replaces breed_genetic_profile with "breedGeneticProfile"', () => {
    const input = 'INSERT INTO breeds (name, breed_genetic_profile) VALUES';
    const result = sanitizeSql(input);
    expect(result).toContain('"breedGeneticProfile"');
    expect(result).not.toContain('breed_genetic_profile');
  });

  it('replaces default_trait with "defaultTrait"', () => {
    const input = 'INSERT INTO breeds (name, default_trait, breed_genetic_profile)';
    const result = sanitizeSql(input);
    expect(result).toContain('"defaultTrait"');
    expect(result).not.toContain('default_trait');
  });

  it('removes "updated_at = NOW()" with ", " separator', () => {
    const input = ', updated_at = NOW()';
    expect(sanitizeSql(input)).not.toContain('updated_at');
  });

  it('removes "updated_at = NOW()" embedded in a multi-line UPDATE SET clause', () => {
    const input = `INSERT INTO breeds (name, default_trait, breed_genetic_profile) VALUES
('Arabian', 'Trait', '{"k":"v"}'::JSONB)
ON CONFLICT (name) DO UPDATE SET
  default_trait = EXCLUDED.default_trait,
  breed_genetic_profile = EXCLUDED.breed_genetic_profile,
  updated_at = NOW();`;

    const result = sanitizeSql(input);
    expect(result).not.toContain('updated_at');
    expect(result).not.toContain('breed_genetic_profile');
    expect(result).not.toContain('default_trait');
    // Structural content should be preserved.
    expect(result).toContain('Arabian');
    expect(result).toContain('ON CONFLICT (name) DO UPDATE SET');
  });

  it('handles updated_at with varying whitespace', () => {
    const cases = [',  updated_at = NOW()', ',\n  updated_at = NOW()', ', updated_at = NOW()'];
    cases.forEach(c => {
      expect(sanitizeSql(c)).not.toContain('updated_at');
    });
  });

  it('is case-insensitive for updated_at removal', () => {
    const input = ', UPDATED_AT = NOW()';
    expect(sanitizeSql(input)).not.toContain('UPDATED_AT');
  });

  it('returns the input unchanged when no replacements needed', () => {
    const clean = 'SELECT 1;';
    expect(sanitizeSql(clean)).toBe(clean);
  });
});
