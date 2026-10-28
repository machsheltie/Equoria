/**
 * seedTraitRoster.test.mjs
 *
 * Equoria-aib2f: the dev seed scripts wrote invented free-text labels such as
 * 'Speed Demon' or 'Agile' into horses.trait. The owner's twenty-trait roster
 * (2026-10-27) is the only trait source, and the stored value of horses.trait
 * is a roster id or null (migration 20261027140000_trait_roster_existing_horses).
 *
 * NO-DB sentinel: the seed scripts mutate the database when executed, so they
 * are never run here. Instead:
 *   1. horseSeed's exported sampleHorses carry no off-roster trait.
 *   2. No seed source writes a `trait:` string literal that is not a roster id.
 *      The detector is proven to fire on a planted violation.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { isRosterTrait } from '../utils/epigeneticTraits.mjs';
import { sampleHorses } from './horseSeed.mjs';

const seedDir = dirname(fileURLToPath(import.meta.url));

/** Every `trait: '<literal>'` in a source text that is not a roster id. */
function offRosterTraitLiterals(source) {
  const found = [];
  for (const match of source.matchAll(/\btrait\s*:\s*(['"`])([^'"`]*)\1/g)) {
    if (!isRosterTrait(match[2])) {
      found.push(match[2]);
    }
  }
  return found;
}

const seedSources = readdirSync(seedDir)
  .filter(file => file.endsWith('.mjs') && !file.endsWith('.test.mjs'))
  .map(file => ({ file, source: readFileSync(join(seedDir, file), 'utf8') }));

describe('seed scripts write only roster traits (Equoria-aib2f)', () => {
  it('sampleHorses carry no trait outside the roster', () => {
    const offRoster = sampleHorses
      .filter(horse => horse.trait !== undefined && horse.trait !== null)
      .filter(horse => !isRosterTrait(horse.trait))
      .map(horse => `${horse.name}: ${horse.trait}`);
    expect(offRoster).toEqual([]);
  });

  it('the detector fires on an invented label and passes a roster id', () => {
    expect(offRosterTraitLiterals("{ name: 'x', trait: 'Speed Demon' }")).toEqual(['Speed Demon']);
    expect(offRosterTraitLiterals("{ name: 'x', trait: 'brave', other: null }")).toEqual([]);
  });

  it('reads the seed sources it guards', () => {
    expect(seedSources.map(({ file }) => file)).toEqual(expect.arrayContaining(['horseSeed.mjs', 'seedDevData.mjs']));
  });

  it.each(seedSources.map(({ file, source }) => [file, source]))(
    '%s writes no off-roster trait literal',
    (_file, source) => {
      expect(offRosterTraitLiterals(source)).toEqual([]);
    },
  );
});
