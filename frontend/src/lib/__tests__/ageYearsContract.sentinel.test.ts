/**
 * ageYears is read straight off the server's horse, with no `age` fallback
 * (Equoria-x49d).
 *
 * The backend serves `ageYears` (game-years from dateOfBirth, utils/horseAge.mjs)
 * on GET /horses, GET /horses/:id and the trainable list, since Equoria-lvjy
 * (2026-05-15). The transitional `horse.ageYears ?? horse.age` fallback kept
 * working silently if a response ever regressed to the cached `age` column only,
 * which is a different unit of truth. Removing it makes that regression loud,
 * and HorseSummary.ageYears is now required so the compiler checks every site.
 *
 * toBreedingHorse (lib/api/breedingHorse.ts) still reads `ageYears || age`: its test
 * (breedingHorse.test.ts) pins that fallback, so retiring it needs an owner nod.
 *
 * Sentinel-positive: each assertion fails if a fallback is put back.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const read = (relative: string) => readFileSync(join(__dirname, relative), 'utf8');

const SITES: Array<[string, string]> = [
  ['HorseCard', '../../components/horse/HorseCard.tsx'],
  ['StableView', '../../pages/StableView.tsx'],
  ['MyStablePage', '../../pages/MyStablePage.tsx'],
  ['CommunityPage', '../../pages/CommunityPage.tsx'],
];

describe('ageYears has no transitional fallback (Equoria-x49d)', () => {
  it.each(SITES)('%s does not fall back from ageYears to age', (_name, path) => {
    const source = read(path);

    expect(source).not.toMatch(/ageYears\s*(\?\?|\|\|)\s*[\w.]*\bage\b/);
  });

  it('HorseSummary.ageYears is required, not optional', () => {
    const types = read('../api/types.ts');
    const summary = /export interface HorseSummary \{[\s\S]*?\n\}/.exec(types)?.[0] ?? '';

    expect(summary).toMatch(/\n\s+ageYears: number;/);
    expect(summary).not.toMatch(/\n\s+ageYears\?: number;/);
  });
});
