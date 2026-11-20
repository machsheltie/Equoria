/**
 * seedTraitRoster.test.mjs
 *
 * Equoria-aib2f: the dev seed scripts wrote invented free-text labels such as
 * 'Speed Demon' or 'Agile' into horses.trait. The owner's twenty-trait roster
 * (2026-10-27) is the only trait source, and the stored value of horses.trait
 * is a roster id or null (migration 20261027140000_trait_roster_existing_horses).
 * horseSeed's exported sampleHorses must carry no off-roster trait.
 */

import { describe, it, expect } from '@jest/globals';
import { isRosterTrait } from '../utils/epigeneticTraits.mjs';
import { sampleHorses } from './horseSeed.mjs';

describe('seed scripts write only roster traits (Equoria-aib2f)', () => {
  it('sampleHorses carry no trait outside the roster', () => {
    const offRoster = sampleHorses
      .filter(horse => horse.trait !== undefined && horse.trait !== null)
      .filter(horse => !isRosterTrait(horse.trait))
      .map(horse => `${horse.name}: ${horse.trait}`);
    expect(offRoster).toEqual([]);
  });
});
