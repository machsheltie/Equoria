/**
 * Every breed's birth discipline is the owner's approved list, the same in the
 * seed files, breedProfiles.json and the database (Equoria-cdmk1, Equoria-n7ph5).
 *
 * Owner ruling 2026-10-28 (q232): the per-breed default discipline list is
 * approved as written; gaited breeds are always Gaited. A store or starter horse
 * is born with its breed's discipline at +5 (birthDiscipline.mjs reads
 * breeds."defaultTrait"). Before, every breed held the placeholder 'Trait', so a
 * non-gaited store or starter horse was born with no discipline.
 *
 * The seed files (backend/data/breeds/*.txt, default_trait) own the value; the
 * 20261028150000_breed_default_disciplines migration writes the same values to
 * existing databases. breedProfiles.json carries no discipline field, only the
 * gaited flag, which must agree.
 *
 * Real database read; no mocks.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { DISCIPLINES } from '../../../constants/schema.mjs';
import { breedDefaultDiscipline } from '../services/birthDiscipline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const backend = resolve(here, '../../..');
const breedsDir = resolve(backend, 'data/breeds');
const profiles = JSON.parse(readFileSync(resolve(backend, 'data/breedProfiles.json'), 'utf8'));
const migration = readFileSync(
  resolve(backend, '../packages/database/prisma/migrations/20261028150000_breed_default_disciplines/migration.sql'),
  'utf8',
);
const disciplines = new Set(Object.values(DISCIPLINES));

const seed = readdirSync(breedsDir)
  .filter(file => file.endsWith('.txt'))
  .map(file => {
    const body = readFileSync(resolve(breedsDir, file), 'utf8');
    const match = /VALUES\s*\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'/.exec(body);
    return {
      file,
      name: match?.[1].replace(/''/g, "'"),
      discipline: match?.[2].replace(/''/g, "'"),
      gaited: /"isGaitedBreed"\s*:\s*true/.test(body),
    };
  });

describe('breed default disciplines (q232)', () => {
  it('every one of the 312 seed breeds names a real discipline, never the placeholder', () => {
    expect(seed).toHaveLength(312);
    const bad = seed.filter(row => !row.name || !disciplines.has(row.discipline));
    expect(bad).toEqual([]);
  });

  it('gaited breeds are Gaited and no other breed is, in the seed and in breedProfiles.json', () => {
    const wrong = seed.filter(
      row =>
        (row.discipline === 'Gaited') !== row.gaited ||
        Boolean(profiles[row.name]?.ratingProfiles?.isGaitedBreed) !== row.gaited,
    );
    expect(wrong.map(row => row.name)).toEqual([]);
  });

  it('the migration writes exactly the seed values', () => {
    const pairs = [...migration.matchAll(/\('((?:[^']|'')*)', '((?:[^']|'')*)'\)/g)].map(m => [
      m[1].replace(/''/g, "'"),
      m[2].replace(/''/g, "'"),
    ]);
    const expected = seed.map(row => [row.name, row.discipline]);
    expect(pairs.sort()).toEqual(expected.sort());
  });

  it('the database holds the same discipline for every breed, and store horses get it', async () => {
    const rows = await prisma.breed.findMany({
      where: { name: { in: seed.map(row => row.name) } },
      select: { name: true, defaultTrait: true, breedGeneticProfile: true },
    });
    expect(rows).toHaveLength(seed.length);
    const byName = new Map(rows.map(row => [row.name, row]));
    const mismatched = seed.filter(row => byName.get(row.name)?.defaultTrait !== row.discipline);
    expect(mismatched.map(row => row.name)).toEqual([]);
    const notBorn = seed.filter(row => breedDefaultDiscipline(byName.get(row.name)) !== row.discipline);
    expect(notBorn.map(row => row.name)).toEqual([]);
  }, 30000);
});
