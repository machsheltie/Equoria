/**
 * populateBreedsFromSql.test.mjs
 *
 * Unit tests for the breed SQL seed script (Story 31A-1).
 *
 * Strategy: balanced mocking — mock the filesystem (fs/promises) and the
 * Prisma client.  Real business logic (sanitizeSql, file filtering, error
 * collection) is tested against actual implementations.
 */

import { jest } from '@jest/globals';
import { sanitizeSql } from '../seed/populateBreedsFromSql.mjs';

// ---------------------------------------------------------------------------
// sanitizeSql unit tests (pure function — no mocking needed)
// ---------------------------------------------------------------------------

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

  it('removes ", updated_at = NOW()" from ON CONFLICT clause', () => {
    const input = `ON CONFLICT (name) DO UPDATE SET
  default_trait = EXCLUDED.default_trait,
  breed_genetic_profile = EXCLUDED.breed_genetic_profile,
  updated_at = NOW();`;
    const result = sanitizeSql(input);
    expect(result).not.toContain('updated_at');
    expect(result).not.toContain('NOW()');
  });

  it('handles the full typical Arabian.txt pattern end-to-end', () => {
    const jt = '$json$';
    const input =
      'INSERT INTO breeds (name, default_trait, breed_genetic_profile) VALUES\n' +
      `('Arabian', 'Refined', ${jt}{"key":"value"}${jt}::JSONB)\n` +
      'ON CONFLICT (name) DO UPDATE SET\n' +
      '  default_trait = EXCLUDED.default_trait,\n' +
      '  breed_genetic_profile = EXCLUDED.breed_genetic_profile,\n' +
      '  updated_at = NOW();';

    const result = sanitizeSql(input);

    expect(result).toContain('"defaultTrait"');
    expect(result).toContain('"breedGeneticProfile"');
    expect(result).not.toContain('default_trait');
    expect(result).not.toContain('breed_genetic_profile');
    expect(result).not.toContain('updated_at');
    // Structural content should be preserved
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

// ---------------------------------------------------------------------------
// populateBreedsFromSql integration tests (mocked filesystem + Prisma)
// ---------------------------------------------------------------------------

describe('populateBreedsFromSql', () => {
  let readdirMock;
  let readFileMock;
  let mockPrisma;

  beforeEach(async () => {
    jest.resetModules();

    // Build a minimal valid breed SQL string (dollar-quoting uses $json$, not a JS template expression)
    const jsonTag = '$json$';
    const makeBreedSql = name =>
      'INSERT INTO breeds (name, default_trait, breed_genetic_profile) VALUES\n' +
      `('${name}', 'Trait', ${jsonTag}{"k":"v"}${jsonTag}::JSONB)\n` +
      'ON CONFLICT (name) DO UPDATE SET\n' +
      '  default_trait = EXCLUDED.default_trait,\n' +
      '  breed_genetic_profile = EXCLUDED.breed_genetic_profile,\n' +
      '  updated_at = NOW();';

    readdirMock = jest.fn().mockResolvedValue([
      'Arabian.txt',
      'Thoroughbred.txt',
      'populate_breed_ratings.sql', // should be skipped
      'seed.sql', // should be skipped
    ]);

    readFileMock = jest.fn().mockImplementation(filePath => {
      const file = filePath.split(/[\\/]/).pop();
      if (file === 'Arabian.txt') {
        return Promise.resolve(makeBreedSql('Arabian'));
      }
      if (file === 'Thoroughbred.txt') {
        return Promise.resolve(makeBreedSql('Thoroughbred'));
      }
      return Promise.reject(new Error(`Unexpected file: ${file}`));
    });

    mockPrisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      breed: { count: jest.fn().mockResolvedValue(42) },
    };

    jest.unstable_mockModule('fs/promises', () => ({
      readdir: readdirMock,
      readFile: readFileMock,
    }));
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('processes all .txt files and skips non-.txt files', async () => {
    const { populateBreedsFromSql } = await import('../seed/populateBreedsFromSql.mjs');

    const result = await populateBreedsFromSql(mockPrisma);

    expect(result.processed).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(result.success).toBe(true);
  });

  it('skips populate_breed_ratings.sql and seed.sql', async () => {
    const { populateBreedsFromSql } = await import('../seed/populateBreedsFromSql.mjs');

    await populateBreedsFromSql(mockPrisma);

    // readFile should only be called for the two .txt files
    expect(readFileMock).toHaveBeenCalledTimes(2);
    const calledFiles = readFileMock.mock.calls.map(c => c[0].split(/[\\/]/).pop());
    expect(calledFiles).toContain('Arabian.txt');
    expect(calledFiles).toContain('Thoroughbred.txt');
    expect(calledFiles).not.toContain('seed.sql');
    expect(calledFiles).not.toContain('populate_breed_ratings.sql');
  });

  it('calls $executeRawUnsafe for each processed file', async () => {
    const { populateBreedsFromSql } = await import('../seed/populateBreedsFromSql.mjs');

    await populateBreedsFromSql(mockPrisma);

    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it('executes sanitized SQL (no updated_at, correct column names)', async () => {
    const { populateBreedsFromSql } = await import('../seed/populateBreedsFromSql.mjs');

    await populateBreedsFromSql(mockPrisma);

    const calls = mockPrisma.$executeRawUnsafe.mock.calls;
    calls.forEach(([sql]) => {
      expect(sql).not.toContain('updated_at');
      expect(sql).not.toContain('breed_genetic_profile');
      expect(sql).not.toContain('default_trait');
      expect(sql).toContain('"breedGeneticProfile"');
      expect(sql).toContain('"defaultTrait"');
    });
  });

  it('returns totalBreeds from breed.count()', async () => {
    const { populateBreedsFromSql } = await import('../seed/populateBreedsFromSql.mjs');

    const result = await populateBreedsFromSql(mockPrisma);
    expect(result.totalBreeds).toBe(42);
  });

  it('collects errors per-file without aborting other files', async () => {
    mockPrisma.$executeRawUnsafe
      .mockResolvedValueOnce(1) // Arabian succeeds
      .mockRejectedValueOnce(new Error('DB error')); // Thoroughbred fails

    const { populateBreedsFromSql } = await import('../seed/populateBreedsFromSql.mjs');

    const result = await populateBreedsFromSql(mockPrisma);

    expect(result.processed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toBe('Thoroughbred.txt');
    expect(result.errors[0].error).toBe('DB error');
    expect(result.success).toBe(false);
  });

  it('processes files in sorted (alphabetical) order', async () => {
    // Return files out of order to verify sorting
    readdirMock.mockResolvedValue(['Thoroughbred.txt', 'Arabian.txt']);

    const { populateBreedsFromSql } = await import('../seed/populateBreedsFromSql.mjs');

    await populateBreedsFromSql(mockPrisma);

    const calledFiles = readFileMock.mock.calls.map(c => c[0].split(/[\\/]/).pop());
    expect(calledFiles[0]).toBe('Arabian.txt');
    expect(calledFiles[1]).toBe('Thoroughbred.txt');
  });

  it('returns success:true when no errors occur', async () => {
    const { populateBreedsFromSql } = await import('../seed/populateBreedsFromSql.mjs');
    const result = await populateBreedsFromSql(mockPrisma);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('handles an empty directory gracefully', async () => {
    readdirMock.mockResolvedValue([]);
    const { populateBreedsFromSql } = await import('../seed/populateBreedsFromSql.mjs');
    const result = await populateBreedsFromSql(mockPrisma);
    expect(result.processed).toBe(0);
    expect(result.success).toBe(true);
  });
});
