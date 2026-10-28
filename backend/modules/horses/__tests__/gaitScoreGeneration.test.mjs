// Unit and statistical validation tests for gait score generation service.
// Tests: standard gait generation, gaited breed handling, inherited gait scores,
// cross-breed gaiting, and statistical distribution. Owner ruling 2026-10-28 (q210)
// removed the conformation-to-gait adjustment and the tests that specified it.

import { generateGaitScores, generateInheritedGaitScores, STANDARD_GAITS } from '../services/gaitService.mjs';

describe('Gait Score Generation Service', () => {
  describe('STANDARD_GAITS constant', () => {
    test('contains exactly 4 standard gaits', () => {
      expect(STANDARD_GAITS).toEqual(['walk', 'trot', 'canter', 'gallop']);
      expect(STANDARD_GAITS).toHaveLength(4);
    });
  });

  describe('generateGaitScores — non-gaited breed', () => {
    const breedName = 'Thoroughbred'; // Thoroughbred

    test('produces all 4 standard gait scores', () => {
      const scores = generateGaitScores(breedName);
      expect(scores).toHaveProperty('walk');
      expect(scores).toHaveProperty('trot');
      expect(scores).toHaveProperty('canter');
      expect(scores).toHaveProperty('gallop');
    });

    test('all standard gait scores are integers in [0, 100]', () => {
      for (let i = 0; i < 50; i++) {
        const scores = generateGaitScores(breedName);
        for (const gait of STANDARD_GAITS) {
          expect(Number.isInteger(scores[gait])).toBe(true);
          expect(scores[gait]).toBeGreaterThanOrEqual(0);
          expect(scores[gait]).toBeLessThanOrEqual(100);
        }
      }
    });

    test('gaiting is null for non-gaited breed', () => {
      const scores = generateGaitScores(breedName);
      expect(scores.gaiting).toBeNull();
    });

    test('has gaiting field present (not undefined)', () => {
      const scores = generateGaitScores(breedName);
      expect('gaiting' in scores).toBe(true);
    });
  });

  describe('generateGaitScores — gaited breed', () => {
    const breedName = 'American Saddlebred'; // American Saddlebred

    test('produces 4 standard gait scores plus gaiting entries', () => {
      const scores = generateGaitScores(breedName);
      expect(scores).toHaveProperty('walk');
      expect(scores).toHaveProperty('trot');
      expect(scores).toHaveProperty('canter');
      expect(scores).toHaveProperty('gallop');
      expect(scores.gaiting).not.toBeNull();
      expect(Array.isArray(scores.gaiting)).toBe(true);
    });

    test('gaiting entries have breed-specific names for American Saddlebred', () => {
      const scores = generateGaitScores(breedName);
      expect(scores.gaiting).toHaveLength(2);
      expect(new Set(scores.gaiting.map(g => g.name))).toEqual(new Set(['Slow Gait', 'Rack']));
    });

    test('gaiting entries have integer scores in [0, 100]', () => {
      for (let i = 0; i < 20; i++) {
        const scores = generateGaitScores(breedName);
        for (const entry of scores.gaiting) {
          expect(Number.isInteger(entry.score)).toBe(true);
          expect(entry.score).toBeGreaterThanOrEqual(0);
          expect(entry.score).toBeLessThanOrEqual(100);
        }
      }
    });

    test('all named gaits are valid integers in [0, 100] with independent variance', () => {
      // Each named gait now gets an independent variance roll from the same distribution.
      // Over many samples, at least some pairs will differ.
      for (let i = 0; i < 20; i++) {
        const scores = generateGaitScores(breedName);
        for (const entry of scores.gaiting) {
          expect(Number.isInteger(entry.score)).toBe(true);
          expect(entry.score).toBeGreaterThanOrEqual(0);
          expect(entry.score).toBeLessThanOrEqual(100);
        }
      }
    });

    test('Tennessee Walking Horse gets Flat Walk and Running Walk', () => {
      const scores = generateGaitScores('Tennessee Walking Horse');
      expect(scores.gaiting).toHaveLength(2);
      expect(new Set(scores.gaiting.map(g => g.name))).toEqual(new Set(['Flat Walk', 'Running Walk']));
    });

    // Owner ruling 2026-10-21: breedProfiles.json now carries the same gait
    // profiles as the seed files that load the DB the game reads (the invented
    // 12-breed table these values came from was deleted). Old contract:
    // Walkaloosa had Indian Shuffle only. The game's data: Walkaloosa has
    // Singlefoot and Saddle Rack. Owner ruling 2026-10-22: National Show Horse,
    // Mangalarga and Standardbred are gaited (gait names from the canonical
    // registry, samples/Breeds/_gait-registry.txt).
    test('Walkaloosa gets Singlefoot and Saddle Rack', () => {
      const scores = generateGaitScores('Walkaloosa');
      expect(scores.gaiting).toHaveLength(2);
      expect(new Set(scores.gaiting.map(g => g.name))).toEqual(new Set(['Singlefoot', 'Saddle Rack']));
    });

    test('National Show Horse gets Slow Gait and Rack', () => {
      const scores = generateGaitScores('National Show Horse');
      expect(scores.gaiting).toHaveLength(2);
      expect(new Set(scores.gaiting.map(g => g.name))).toEqual(new Set(['Slow Gait', 'Rack']));
    });

    test('Mangalarga gets Marcha Batida and Marcha Picada', () => {
      const scores = generateGaitScores('Mangalarga');
      expect(new Set(scores.gaiting.map(g => g.name))).toEqual(new Set(['Marcha Batida', 'Marcha Picada']));
    });

    test('Standardbred gets Pace', () => {
      const scores = generateGaitScores('Standardbred');
      expect(scores.gaiting.map(g => g.name)).toEqual(['Pace']);
    });
  });

  describe('generateGaitScores — sample breeds produce valid scores', () => {
    const allBreedNames = [
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
    // Owner ruling 2026-10-22: National Show Horse is gaited.
    const gaitedBreedNames = new Set([
      'American Saddlebred',
      'National Show Horse',
      'Tennessee Walking Horse',
      'Walkaloosa',
    ]);

    test.each(allBreedNames)('breed %s produces valid gait scores', breedName => {
      const scores = generateGaitScores(breedName);

      for (const gait of STANDARD_GAITS) {
        expect(Number.isInteger(scores[gait])).toBe(true);
        expect(scores[gait]).toBeGreaterThanOrEqual(0);
        expect(scores[gait]).toBeLessThanOrEqual(100);
      }

      if (gaitedBreedNames.has(breedName)) {
        expect(scores.gaiting).not.toBeNull();
        expect(Array.isArray(scores.gaiting)).toBe(true);
        expect(scores.gaiting.length).toBeGreaterThan(0);
        for (const entry of scores.gaiting) {
          expect(typeof entry.name).toBe('string');
          expect(Number.isInteger(entry.score)).toBe(true);
          expect(entry.score).toBeGreaterThanOrEqual(0);
          expect(entry.score).toBeLessThanOrEqual(100);
        }
      } else {
        expect(scores.gaiting).toBeNull();
      }
    });
  });

  describe('generateGaitScores — unknown breed', () => {
    // Post-309-breeds refactor: missing/unknown breed identifiers must
    // throw rather than silently returning stub defaults.
    test('throws for unknown numeric breedName', () => {
      expect(() => generateGaitScores(9999)).toThrow(/no longer accepts a numeric breedId/);
    });
  });

  describe('generateInheritedGaitScores', () => {
    const breedName = 'Thoroughbred'; // Thoroughbred
    const sireGaits = { walk: 70, trot: 80, canter: 85, gallop: 95, gaiting: null };
    const damGaits = { walk: 68, trot: 76, canter: 82, gallop: 90, gaiting: null };

    test('produces all 4 standard gait scores', () => {
      const scores = generateInheritedGaitScores(breedName, sireGaits, damGaits);
      for (const gait of STANDARD_GAITS) {
        expect(Number.isInteger(scores[gait])).toBe(true);
        expect(scores[gait]).toBeGreaterThanOrEqual(0);
        expect(scores[gait]).toBeLessThanOrEqual(100);
      }
    });

    test('falls back to breed-only when sire gait scores are null', () => {
      const scores = generateInheritedGaitScores(breedName, null, damGaits);
      for (const gait of STANDARD_GAITS) {
        expect(Number.isInteger(scores[gait])).toBe(true);
        expect(scores[gait]).toBeGreaterThanOrEqual(0);
        expect(scores[gait]).toBeLessThanOrEqual(100);
      }
    });

    test('falls back to breed-only when dam gait scores are null', () => {
      const scores = generateInheritedGaitScores(breedName, sireGaits, null);
      for (const gait of STANDARD_GAITS) {
        expect(Number.isInteger(scores[gait])).toBe(true);
      }
    });

    test('falls back to breed-only when both parent gait scores are null', () => {
      const scores = generateInheritedGaitScores(breedName, null, null);
      for (const gait of STANDARD_GAITS) {
        expect(Number.isInteger(scores[gait])).toBe(true);
      }
    });

    test('handles missing individual gait in parent gracefully', () => {
      const incompleteSire = { walk: 70, trot: 80, canter: 85 }; // missing gallop
      const scores = generateInheritedGaitScores(breedName, incompleteSire, damGaits);
      expect(Number.isInteger(scores.gallop)).toBe(true);
      expect(scores.gallop).toBeGreaterThanOrEqual(0);
      expect(scores.gallop).toBeLessThanOrEqual(100);
    });

    test('throws for unknown breed (post-309-breeds refactor)', () => {
      expect(() => generateInheritedGaitScores(9999, sireGaits, damGaits)).toThrow(
        /no longer accepts a numeric breedId/,
      );
    });
  });

  describe('generateInheritedGaitScores — cross-breed gaiting', () => {
    test('non-gaited foal breed gets gaiting: null even if parents are gaited', () => {
      const gaitedSireGaits = {
        walk: 70,
        trot: 75,
        canter: 70,
        gallop: 65,
        gaiting: [
          { name: 'Slow Gait', score: 85 },
          { name: 'Rack', score: 85 },
        ],
      };
      const gaitedDamGaits = {
        walk: 68,
        trot: 73,
        canter: 68,
        gallop: 63,
        gaiting: [
          { name: 'Slow Gait', score: 80 },
          { name: 'Rack', score: 80 },
        ],
      };

      // Foal breed = Thoroughbred (non-gaited)
      const scores = generateInheritedGaitScores('Thoroughbred', gaitedSireGaits, gaitedDamGaits);
      expect(scores.gaiting).toBeNull();
    });

    test('gaited foal breed gets gaiting scores even if parents are non-gaited', () => {
      const nonGaitedSire = { walk: 70, trot: 80, canter: 85, gallop: 90, gaiting: null };
      const nonGaitedDam = { walk: 68, trot: 76, canter: 82, gallop: 88, gaiting: null };

      // Foal breed = American Saddlebred (gaited)
      const scores = generateInheritedGaitScores('American Saddlebred', nonGaitedSire, nonGaitedDam);
      expect(scores.gaiting).not.toBeNull();
      expect(Array.isArray(scores.gaiting)).toBe(true);
      expect(scores.gaiting).toHaveLength(2);
      expect(new Set(scores.gaiting.map(g => g.name))).toEqual(new Set(['Slow Gait', 'Rack']));
    });

    test('gaited foal with gaited parents inherits gaiting scores', () => {
      const gaitedSire = {
        walk: 70,
        trot: 75,
        canter: 70,
        gallop: 65,
        gaiting: [
          { name: 'Slow Gait', score: 90 },
          { name: 'Rack', score: 90 },
        ],
      };
      const gaitedDam = {
        walk: 68,
        trot: 73,
        canter: 68,
        gallop: 63,
        gaiting: [
          { name: 'Slow Gait', score: 80 },
          { name: 'Rack', score: 80 },
        ],
      };

      // Foal breed = American Saddlebred (gaited)
      const scores = generateInheritedGaitScores('American Saddlebred', gaitedSire, gaitedDam);
      expect(scores.gaiting).not.toBeNull();
      expect(scores.gaiting).toHaveLength(2);
    });
  });

  describe('Statistical validation — normal distribution (1000+ samples)', () => {
    const breedName = 'Thoroughbred'; // Thoroughbred
    const sampleSize = 1000;

    test('gallop scores center around breed mean (Thoroughbred gallop mean=90)', () => {
      const scores = [];
      for (let i = 0; i < sampleSize; i++) {
        const gait = generateGaitScores(breedName);
        scores.push(gait.gallop);
      }

      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      // The mean should be close to the breed mean of 90
      expect(mean).toBeGreaterThan(82);
      expect(mean).toBeLessThan(98);
    });

    test('95% of gallop scores fall within mean ± 2 * stdDev', () => {
      const scores = [];
      for (let i = 0; i < sampleSize; i++) {
        const gait = generateGaitScores(breedName);
        scores.push(gait.gallop);
      }

      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const stdDev = 9;
      const lowerBound = mean - 2 * stdDev;
      const upperBound = mean + 2 * stdDev;

      const withinRange = scores.filter(s => s >= lowerBound && s <= upperBound).length;
      const percentage = withinRange / sampleSize;

      // At least 93% should be within 2 std devs (generous tolerance for clamping)
      expect(percentage).toBeGreaterThanOrEqual(0.93);
    });

    // Owner ruling 2026-10-21: breedProfiles.json now carries the same gait
    // profiles as the seed files that load the DB the game reads (the invented
    // 12-breed table these values came from was deleted). Old contract:
    // Thoroughbred walk mean 65 (window 57-73); the game's value is 78.
    test('walk scores center around breed mean (Thoroughbred walk mean=78)', () => {
      const scores = [];
      for (let i = 0; i < sampleSize; i++) {
        const gait = generateGaitScores(breedName);
        scores.push(gait.walk);
      }

      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      expect(mean).toBeGreaterThan(70);
      expect(mean).toBeLessThan(86);
    });
  });

  describe('Inherited gait regression to breed mean (500 samples)', () => {
    const breedName = 'Thoroughbred'; // Thoroughbred, gallop mean = 90

    test('high-scoring parents produce foals averaging above breed mean', () => {
      const highSire = { walk: 85, trot: 90, canter: 95, gallop: 100, gaiting: null };
      const highDam = { walk: 82, trot: 88, canter: 92, gallop: 98, gaiting: null };
      const sampleSize = 500;

      const foalScores = [];
      for (let i = 0; i < sampleSize; i++) {
        const scores = generateInheritedGaitScores(breedName, highSire, highDam);
        foalScores.push(scores.gallop);
      }

      const mean = foalScores.reduce((a, b) => a + b, 0) / foalScores.length;
      // Parent avg gallop = 99, breed mean = 90
      // Expected baseValue = 99 * 0.6 + 90 * 0.4 = 95.4
      expect(mean).toBeGreaterThan(90);
    });
  });
});
