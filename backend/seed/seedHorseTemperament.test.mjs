/**
 * seedHorseTemperament.test.mjs
 *
 * Equoria-o7pnn — the dev/test SEED scripts that bulk-create horses must inject
 * a permanent breed-weighted temperament so dev databases never contain
 * NULL-temperament horses. Before the fix the seed scripts omitted temperament
 * entirely, while register/advanceOnboarding correctly assigned it.
 *
 * This is a NO-DB sentinel suite. The seed scripts are one-shot dev scripts that
 * mutate the canonical DB when executed (CLAUDE.md §2 forbids running them in a
 * test), so we do NOT run them here. Instead we prove the fix two ways:
 *
 *   1. The canonical generator (generateTemperamentWithDefault) — the SAME fn the
 *      seed scripts now call — returns one of the 11 canonical temperament types
 *      for every breed name the seed scripts use. This exercises the real data
 *      wiring (breedProfileLoader + breedGeneticProfiles), no DB, no mocks.
 *   2. Each fixed seed source file injects `temperament:` immediately adjacent to
 *      a horse-create. Sentinel-positive: this assertion FAILS if a future edit
 *      removes the temperament injection from any seed script — the exact
 *      regression this issue exists to prevent.
 *
 * NO MOCKS. NO DB MUTATION.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  generateTemperamentWithDefault,
} from '../modules/horses/services/temperamentService.mjs';
import { TEMPERAMENT_TYPES } from '../modules/horses/data/breedGeneticProfiles.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoBackend = join(__dirname, '..');

// Breed names used across the fixed seed scripts (seedDevData.mjs HORSES +
// seedPerformanceData.mjs canonical pool + userSeed/createTestData defaults).
const SEED_BREED_NAMES = [
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
    it.each(SEED_BREED_NAMES)(
      'generateTemperamentWithDefault(%s) returns a canonical temperament type',
      breedName => {
        const temperament = generateTemperamentWithDefault(breedName);
        expect(typeof temperament).toBe('string');
        expect(TEMPERAMENT_TYPES).toContain(temperament);
      },
    );

    it('falls back to a valid temperament for an unknown breed (never returns null)', () => {
      const temperament = generateTemperamentWithDefault('No Such Breed 12345');
      expect(TEMPERAMENT_TYPES).toContain(temperament);
    });

    it('falls back to a valid temperament for a null breed (breedless rows)', () => {
      const temperament = generateTemperamentWithDefault(null);
      expect(TEMPERAMENT_TYPES).toContain(temperament);
    });
  });

  describe('every horse-creating seed script injects temperament (sentinel-positive)', () => {
    const seedFiles = [
      join(repoBackend, 'seed', 'seedDevData.mjs'),
      join(repoBackend, 'seed', 'seedPerformanceData.mjs'),
      join(repoBackend, 'seed', 'userSeed.mjs'),
      join(repoBackend, 'scripts', 'createTestData.mjs'),
    ];

    it.each(seedFiles)(
      '%s imports the temperament generator and injects temperament on horse create',
      filePath => {
        const src = readFileSync(filePath, 'utf8');
        // Must reuse the canonical generator (not a hardcoded literal).
        expect(src).toMatch(/generateTemperamentWithDefault/);
        // Must inject temperament into a create payload. If a future edit drops
        // the injection this assertion fails — preventing the NULL-temperament
        // regression from silently returning.
        expect(src).toMatch(/temperament:\s*generateTemperamentWithDefault\(/);
      },
    );
  });

  // Equoria-hlnik — horseSeed.mjs hardcoded non-canonical temperament literals
  // ('Curious', 'Gentle') that are NOT among the 11 canonical types. Its live
  // create path now uses the generator; its static sampleHorses export uses
  // canonical literals. This is a pure-data (no-DB) sentinel: any future edit
  // that reintroduces a non-canonical temperament literal into horseSeed.mjs
  // fails this assertion.
  describe('horseSeed.mjs temperament values are all canonical (Equoria-hlnik)', () => {
    it('every temperament: literal in horseSeed.mjs is one of the 11 canonical types', () => {
      const src = readFileSync(join(repoBackend, 'seed', 'horseSeed.mjs'), 'utf8');
      const literals = [...src.matchAll(/temperament:\s*'([^']+)'/g)].map(m => m[1]);
      // There must be at least one literal (proves the regex matches the file shape).
      expect(literals.length).toBeGreaterThan(0);
      for (const literal of literals) {
        expect(TEMPERAMENT_TYPES).toContain(literal);
      }
    });

    it('the live seed-create path uses the canonical breed-weighted generator', () => {
      const src = readFileSync(join(repoBackend, 'seed', 'horseSeed.mjs'), 'utf8');
      expect(src).toMatch(/generateTemperamentWithDefault/);
      expect(src).toMatch(/temperament:\s*generateTemperamentWithDefault\(/);
    });
  });
});
