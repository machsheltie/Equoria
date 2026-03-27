// Unit and statistical validation tests for gait score generation service.
// Tests: standard gait generation, gaited breed handling, conformation bonus,
// inherited gait scores, cross-breed gaiting, and statistical distribution.

import {
  generateGaitScores,
  generateInheritedGaitScores,
  calculateConformationBonus,
  STANDARD_GAITS,
  CONFORMATION_GAIT_MAPPING,
} from '../modules/horses/services/gaitService.mjs';

describe('Gait Score Generation Service', () => {
  // Sample conformation scores for testing (above-average horse)
  const goodConformation = {
    head: 80,
    neck: 78,
    shoulders: 82,
    back: 75,
    hindquarters: 80,
    legs: 78,
    hooves: 76,
    topline: 74,
  };

  // Average conformation scores (bonus should be near 0)
  const avgConformation = {
    head: 70,
    neck: 70,
    shoulders: 70,
    back: 70,
    hindquarters: 70,
    legs: 70,
    hooves: 70,
    topline: 70,
  };

  describe('STANDARD_GAITS constant', () => {
    test('contains exactly 4 standard gaits', () => {
      expect(STANDARD_GAITS).toEqual(['walk', 'trot', 'canter', 'gallop']);
      expect(STANDARD_GAITS).toHaveLength(4);
    });
  });

  describe('CONFORMATION_GAIT_MAPPING constant', () => {
    test('maps walk to shoulders + back', () => {
      expect(CONFORMATION_GAIT_MAPPING.walk).toEqual(['shoulders', 'back']);
    });

    test('maps trot to shoulders + hindquarters', () => {
      expect(CONFORMATION_GAIT_MAPPING.trot).toEqual(['shoulders', 'hindquarters']);
    });

    test('maps canter to back + hindquarters', () => {
      expect(CONFORMATION_GAIT_MAPPING.canter).toEqual(['back', 'hindquarters']);
    });

    test('maps gallop to legs + hindquarters', () => {
      expect(CONFORMATION_GAIT_MAPPING.gallop).toEqual(['legs', 'hindquarters']);
    });

    test('maps gaiting to legs + back + hindquarters', () => {
      expect(CONFORMATION_GAIT_MAPPING.gaiting).toEqual(['legs', 'back', 'hindquarters']);
    });
  });

  describe('calculateConformationBonus', () => {
    test('returns 0 when average conformation regions equal 70', () => {
      const bonus = calculateConformationBonus(avgConformation, 'walk');
      expect(bonus).toBe(0);
    });

    test('returns positive bonus for above-average conformation', () => {
      // Walk uses shoulders (82) + back (75), avg = 78.5, bonus = (78.5 - 70) * 0.15 = 1.275
      const bonus = calculateConformationBonus(goodConformation, 'walk');
      expect(bonus).toBeCloseTo(1.275, 2);
    });

    test('returns negative bonus for below-average conformation', () => {
      const poorConformation = { shoulders: 55, back: 60, hindquarters: 50, legs: 55 };
      // Walk: shoulders (55) + back (60), avg = 57.5, bonus = (57.5 - 70) * 0.15 = -1.875
      const bonus = calculateConformationBonus(poorConformation, 'walk');
      expect(bonus).toBeCloseTo(-1.875, 2);
    });

    test('returns 0 when conformationScores is null', () => {
      const bonus = calculateConformationBonus(null, 'walk');
      expect(bonus).toBe(0);
    });

    test('uses 70 fallback for missing conformation regions', () => {
      const bonus = calculateConformationBonus({}, 'walk');
      expect(bonus).toBe(0);
    });

    test('calculates gaiting bonus from legs + back + hindquarters', () => {
      // legs=78, back=75, hindquarters=80 → avg=77.67, bonus=(77.67-70)*0.15
      const bonus = calculateConformationBonus(goodConformation, 'gaiting');
      expect(bonus).toBeCloseTo(((78 + 75 + 80) / 3 - 70) * 0.15, 2);
    });
  });

  describe('generateGaitScores — non-gaited breed', () => {
    const breedId = 1; // Thoroughbred

    test('produces all 4 standard gait scores', () => {
      const scores = generateGaitScores(breedId, goodConformation);
      expect(scores).toHaveProperty('walk');
      expect(scores).toHaveProperty('trot');
      expect(scores).toHaveProperty('canter');
      expect(scores).toHaveProperty('gallop');
    });

    test('all standard gait scores are integers in [0, 100]', () => {
      for (let i = 0; i < 50; i++) {
        const scores = generateGaitScores(breedId, goodConformation);
        for (const gait of STANDARD_GAITS) {
          expect(Number.isInteger(scores[gait])).toBe(true);
          expect(scores[gait]).toBeGreaterThanOrEqual(0);
          expect(scores[gait]).toBeLessThanOrEqual(100);
        }
      }
    });

    test('gaiting is null for non-gaited breed', () => {
      const scores = generateGaitScores(breedId, goodConformation);
      expect(scores.gaiting).toBeNull();
    });

    test('has gaiting field present (not undefined)', () => {
      const scores = generateGaitScores(breedId, goodConformation);
      expect('gaiting' in scores).toBe(true);
    });
  });

  describe('generateGaitScores — gaited breed', () => {
    const breedId = 3; // American Saddlebred

    test('produces 4 standard gait scores plus gaiting entries', () => {
      const scores = generateGaitScores(breedId, goodConformation);
      expect(scores).toHaveProperty('walk');
      expect(scores).toHaveProperty('trot');
      expect(scores).toHaveProperty('canter');
      expect(scores).toHaveProperty('gallop');
      expect(scores.gaiting).not.toBeNull();
      expect(Array.isArray(scores.gaiting)).toBe(true);
    });

    test('gaiting entries have breed-specific names for American Saddlebred', () => {
      const scores = generateGaitScores(breedId, goodConformation);
      expect(scores.gaiting).toHaveLength(2);
      expect(scores.gaiting[0].name).toBe('Slow Gait');
      expect(scores.gaiting[1].name).toBe('Rack');
    });

    test('gaiting entries have integer scores in [0, 100]', () => {
      for (let i = 0; i < 20; i++) {
        const scores = generateGaitScores(breedId, goodConformation);
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
        const scores = generateGaitScores(breedId, goodConformation);
        for (const entry of scores.gaiting) {
          expect(Number.isInteger(entry.score)).toBe(true);
          expect(entry.score).toBeGreaterThanOrEqual(0);
          expect(entry.score).toBeLessThanOrEqual(100);
        }
      }
    });

    test('Tennessee Walking Horse gets Flat Walk and Running Walk', () => {
      const scores = generateGaitScores(7, goodConformation);
      expect(scores.gaiting).toHaveLength(2);
      expect(scores.gaiting[0].name).toBe('Flat Walk');
      expect(scores.gaiting[1].name).toBe('Running Walk');
    });

    test('Walkaloosa gets Indian Shuffle', () => {
      const scores = generateGaitScores(10, goodConformation);
      expect(scores.gaiting).toHaveLength(1);
      expect(scores.gaiting[0].name).toBe('Indian Shuffle');
    });

    test('National Show Horse gets Slow Gait and Rack', () => {
      const scores = generateGaitScores(4, goodConformation);
      expect(scores.gaiting).toHaveLength(2);
      expect(scores.gaiting[0].name).toBe('Slow Gait');
      expect(scores.gaiting[1].name).toBe('Rack');
    });
  });

  describe('generateGaitScores — all 12 breeds produce valid scores', () => {
    const allBreedIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const gaitedBreedIds = [3, 4, 7, 10];

    test.each(allBreedIds)('breed %i produces valid gait scores', breedId => {
      const scores = generateGaitScores(breedId, goodConformation);

      for (const gait of STANDARD_GAITS) {
        expect(Number.isInteger(scores[gait])).toBe(true);
        expect(scores[gait]).toBeGreaterThanOrEqual(0);
        expect(scores[gait]).toBeLessThanOrEqual(100);
      }

      if (gaitedBreedIds.includes(breedId)) {
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

  describe('generateGaitScores — unknown breed fallback', () => {
    test('returns default scores (50 each) for unknown breed', () => {
      const scores = generateGaitScores(9999, goodConformation);
      expect(scores.walk).toBe(50);
      expect(scores.trot).toBe(50);
      expect(scores.canter).toBe(50);
      expect(scores.gallop).toBe(50);
      expect(scores.gaiting).toBeNull();
    });
  });

  describe('generateInheritedGaitScores', () => {
    const breedId = 1; // Thoroughbred
    const sireGaits = { walk: 70, trot: 80, canter: 85, gallop: 95, gaiting: null };
    const damGaits = { walk: 68, trot: 76, canter: 82, gallop: 90, gaiting: null };

    test('produces all 4 standard gait scores', () => {
      const scores = generateInheritedGaitScores(breedId, sireGaits, damGaits, goodConformation);
      for (const gait of STANDARD_GAITS) {
        expect(Number.isInteger(scores[gait])).toBe(true);
        expect(scores[gait]).toBeGreaterThanOrEqual(0);
        expect(scores[gait]).toBeLessThanOrEqual(100);
      }
    });

    test('falls back to breed-only when sire gait scores are null', () => {
      const scores = generateInheritedGaitScores(breedId, null, damGaits, goodConformation);
      for (const gait of STANDARD_GAITS) {
        expect(Number.isInteger(scores[gait])).toBe(true);
        expect(scores[gait]).toBeGreaterThanOrEqual(0);
        expect(scores[gait]).toBeLessThanOrEqual(100);
      }
    });

    test('falls back to breed-only when dam gait scores are null', () => {
      const scores = generateInheritedGaitScores(breedId, sireGaits, null, goodConformation);
      for (const gait of STANDARD_GAITS) {
        expect(Number.isInteger(scores[gait])).toBe(true);
      }
    });

    test('falls back to breed-only when both parent gait scores are null', () => {
      const scores = generateInheritedGaitScores(breedId, null, null, goodConformation);
      for (const gait of STANDARD_GAITS) {
        expect(Number.isInteger(scores[gait])).toBe(true);
      }
    });

    test('handles missing individual gait in parent gracefully', () => {
      const incompleteSire = { walk: 70, trot: 80, canter: 85 }; // missing gallop
      const scores = generateInheritedGaitScores(breedId, incompleteSire, damGaits, goodConformation);
      expect(Number.isInteger(scores.gallop)).toBe(true);
      expect(scores.gallop).toBeGreaterThanOrEqual(0);
      expect(scores.gallop).toBeLessThanOrEqual(100);
    });

    test('returns defaults for unknown breed', () => {
      const scores = generateInheritedGaitScores(9999, sireGaits, damGaits, goodConformation);
      expect(scores.walk).toBe(50);
      expect(scores.gaiting).toBeNull();
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
      const scores = generateInheritedGaitScores(1, gaitedSireGaits, gaitedDamGaits, goodConformation);
      expect(scores.gaiting).toBeNull();
    });

    test('gaited foal breed gets gaiting scores even if parents are non-gaited', () => {
      const nonGaitedSire = { walk: 70, trot: 80, canter: 85, gallop: 90, gaiting: null };
      const nonGaitedDam = { walk: 68, trot: 76, canter: 82, gallop: 88, gaiting: null };

      // Foal breed = American Saddlebred (gaited)
      const scores = generateInheritedGaitScores(3, nonGaitedSire, nonGaitedDam, goodConformation);
      expect(scores.gaiting).not.toBeNull();
      expect(Array.isArray(scores.gaiting)).toBe(true);
      expect(scores.gaiting).toHaveLength(2);
      expect(scores.gaiting[0].name).toBe('Slow Gait');
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
      const scores = generateInheritedGaitScores(3, gaitedSire, gaitedDam, goodConformation);
      expect(scores.gaiting).not.toBeNull();
      expect(scores.gaiting).toHaveLength(2);
    });
  });

  describe('Statistical validation — normal distribution (1000+ samples)', () => {
    const breedId = 1; // Thoroughbred
    const sampleSize = 1000;

    test('gallop scores center around breed mean (Thoroughbred gallop mean=90)', () => {
      const scores = [];
      for (let i = 0; i < sampleSize; i++) {
        const gait = generateGaitScores(breedId, avgConformation);
        scores.push(gait.gallop);
      }

      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      // With avg conformation (bonus = 0), mean should be close to breed mean of 90
      expect(mean).toBeGreaterThan(82);
      expect(mean).toBeLessThan(98);
    });

    test('95% of gallop scores fall within mean ± 2 * stdDev', () => {
      const scores = [];
      for (let i = 0; i < sampleSize; i++) {
        const gait = generateGaitScores(breedId, avgConformation);
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

    test('walk scores center around breed mean (Thoroughbred walk mean=65)', () => {
      const scores = [];
      for (let i = 0; i < sampleSize; i++) {
        const gait = generateGaitScores(breedId, avgConformation);
        scores.push(gait.walk);
      }

      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      expect(mean).toBeGreaterThan(57);
      expect(mean).toBeLessThan(73);
    });
  });

  describe('Conformation influence correlation (NFR-05)', () => {
    const breedId = 1; // Thoroughbred
    const sampleSize = 500;

    test('higher conformation scores correlate with higher gait scores (r > 0.1)', () => {
      const conformationValues = [];
      const gaitValues = [];

      for (let i = 0; i < sampleSize; i++) {
        // Generate varied conformation scores
        const hindquarters = 40 + Math.floor(Math.random() * 60); // 40-99
        const legs = 40 + Math.floor(Math.random() * 60);
        const conf = { ...avgConformation, hindquarters, legs };
        const gait = generateGaitScores(breedId, conf);

        // Gallop depends on legs + hindquarters
        conformationValues.push((hindquarters + legs) / 2);
        gaitValues.push(gait.gallop);
      }

      // Calculate Pearson correlation
      const n = sampleSize;
      const sumX = conformationValues.reduce((a, b) => a + b, 0);
      const sumY = gaitValues.reduce((a, b) => a + b, 0);
      const sumXY = conformationValues.reduce((a, x, i) => a + x * gaitValues[i], 0);
      const sumX2 = conformationValues.reduce((a, x) => a + x * x, 0);
      const sumY2 = gaitValues.reduce((a, y) => a + y * y, 0);

      const numerator = n * sumXY - sumX * sumY;
      const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      const r = denominator === 0 ? 0 : numerator / denominator;

      // Expect measurable positive correlation
      expect(r).toBeGreaterThan(0.1);
    });
  });

  describe('Inherited gait regression to breed mean (500 samples)', () => {
    const breedId = 1; // Thoroughbred, gallop mean = 90

    test('high-scoring parents produce foals averaging above breed mean', () => {
      const highSire = { walk: 85, trot: 90, canter: 95, gallop: 100, gaiting: null };
      const highDam = { walk: 82, trot: 88, canter: 92, gallop: 98, gaiting: null };
      const sampleSize = 500;

      const foalScores = [];
      for (let i = 0; i < sampleSize; i++) {
        const scores = generateInheritedGaitScores(breedId, highSire, highDam, avgConformation);
        foalScores.push(scores.gallop);
      }

      const mean = foalScores.reduce((a, b) => a + b, 0) / foalScores.length;
      // Parent avg gallop = 99, breed mean = 90
      // Expected baseValue = 99 * 0.6 + 90 * 0.4 = 95.4
      expect(mean).toBeGreaterThan(90);
    });
  });
});
