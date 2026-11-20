/**
 * seedHorseTemperament.test.mjs
 *
 * Equoria-o7pnn — the dev/test SEED scripts that bulk-create horses must inject
 * a permanent breed-weighted temperament so dev databases never contain
 * NULL-temperament horses. Before the fix the seed scripts omitted temperament
 * entirely, while register/advanceOnboarding correctly assigned it.
 *
 * The seed scripts are one-shot dev scripts that mutate the canonical DB when
 * executed, so they are not run here. The canonical generator
 * (generateTemperamentWithDefault) — the SAME fn the seed scripts call — returns
 * one of the 12 temperament types for every breed name the seed scripts use.
 * This exercises the real data wiring (breedProfileLoader + the DB breed cache
 * backend/tests/setup.mjs preloads), no DB writes, no mocks.
 *
 * NO MOCKS. NO DB MUTATION.
 */

import { describe, it, expect } from '@jest/globals';
import { generateTemperamentWithDefault } from '../modules/horses/services/temperamentService.mjs';
import { temperamentTypes } from '../modules/horses/data/temperamentTypes.mjs';

// Breed names used across the fixed seed scripts (seedDevData.mjs HORSES +
// seedPerformanceData.mjs canonical pool + userSeed/createTestData defaults).
const seedBreedNames = [
  'Thoroughbred',
  'Arabian',
  'American Saddlebred',
  'National Show Horse',
  'Pony Of The Americas',
  'Appaloosa',
  'Tennessee Walking Horse',
  'Andalusian',
  'American Quarter Horse',
  'Walkaloosa',
  'Lusitano',
  'Paint Horse',
];

describe('SEED: horses receive a permanent breed-weighted temperament (Equoria-o7pnn)', () => {
  describe('canonical generator returns a valid temperament for every seeded breed', () => {
    it.each(seedBreedNames)('generateTemperamentWithDefault(%s) returns a canonical temperament type', breedName => {
      const temperament = generateTemperamentWithDefault(breedName);
      expect(typeof temperament).toBe('string');
      expect(temperamentTypes).toContain(temperament);
    });

    it('falls back to a valid temperament for an unknown breed (never returns null)', () => {
      const temperament = generateTemperamentWithDefault('No Such Breed 12345');
      expect(temperamentTypes).toContain(temperament);
    });

    it('falls back to a valid temperament for a null breed (breedless rows)', () => {
      const temperament = generateTemperamentWithDefault(null);
      expect(temperamentTypes).toContain(temperament);
    });
  });
});
