/**
 * gaitService — unit tests (Equoria-rr7)
 *
 * Tests pure helpers and breed-profile-backed generators (file-based,
 * no DB). No Prisma required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  STANDARD_GAITS,
  CONFORMATION_GAIT_MAPPING,
  calculateConformationBonus,
  hasValidGaitScores,
  validateGaitScores,
  generateGaitScores,
  generateInheritedGaitScores,
} from '../../modules/horses/services/gaitService.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe('STANDARD_GAITS', () => {
  it('has exactly 4 gaits', () => {
    expect(STANDARD_GAITS).toHaveLength(4);
  });

  it('includes walk, trot, canter, gallop', () => {
    expect(STANDARD_GAITS).toContain('walk');
    expect(STANDARD_GAITS).toContain('trot');
    expect(STANDARD_GAITS).toContain('canter');
    expect(STANDARD_GAITS).toContain('gallop');
  });
});

describe('CONFORMATION_GAIT_MAPPING', () => {
  it('has entries for all 4 standard gaits plus gaiting', () => {
    for (const gait of [...STANDARD_GAITS, 'gaiting']) {
      expect(CONFORMATION_GAIT_MAPPING[gait]).toBeDefined();
    }
  });

  it('each entry is a non-empty array', () => {
    for (const regions of Object.values(CONFORMATION_GAIT_MAPPING)) {
      expect(Array.isArray(regions)).toBe(true);
      expect(regions.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// calculateConformationBonus
// ---------------------------------------------------------------------------
describe('calculateConformationBonus', () => {
  it('returns 0 when conformationScores is null', () => {
    expect(calculateConformationBonus(null, 'walk')).toBe(0);
  });

  it('returns 0 for unknown gait key', () => {
    expect(calculateConformationBonus({ shoulders: 80, back: 80 }, 'unknown_gait')).toBe(0);
  });

  it('returns 0 when all mapped regions are at neutral baseline (70)', () => {
    const scores = { shoulders: 70, back: 70 };
    expect(calculateConformationBonus(scores, 'walk')).toBeCloseTo(0, 5);
  });

  it('returns positive bonus when mapped regions are above 70', () => {
    const scores = { shoulders: 100, back: 100 };
    // avg = 100, bonus = (100 - 70) * 0.15 = 4.5
    expect(calculateConformationBonus(scores, 'walk')).toBeCloseTo(4.5, 5);
  });

  it('returns negative bonus when mapped regions are below 70', () => {
    const scores = { shoulders: 40, back: 40 };
    // avg = 40, bonus = (40 - 70) * 0.15 = -4.5
    expect(calculateConformationBonus(scores, 'walk')).toBeCloseTo(-4.5, 5);
  });

  it('uses 70 as default for missing regions', () => {
    // Only shoulders provided for walk (needs shoulders + back)
    // back defaults to 70 → avg = (100 + 70) / 2 = 85 → bonus = (85 - 70) * 0.15 = 2.25
    const scores = { shoulders: 100 };
    expect(calculateConformationBonus(scores, 'walk')).toBeCloseTo(2.25, 5);
  });

  it('handles gallop correctly (uses legs + hindquarters)', () => {
    const scores = { legs: 100, hindquarters: 100 };
    expect(calculateConformationBonus(scores, 'gallop')).toBeCloseTo(4.5, 5);
  });
});

// ---------------------------------------------------------------------------
// hasValidGaitScores
// ---------------------------------------------------------------------------
describe('hasValidGaitScores', () => {
  it('returns false for null', () => {
    expect(hasValidGaitScores(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasValidGaitScores(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(hasValidGaitScores({})).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(hasValidGaitScores('string')).toBe(false);
    expect(hasValidGaitScores(42)).toBe(false);
  });

  it('returns true when walk score is present', () => {
    expect(hasValidGaitScores({ walk: 70 })).toBe(true);
  });

  it('returns true when all 4 standard gaits are present', () => {
    expect(hasValidGaitScores({ walk: 70, trot: 75, canter: 80, gallop: 85 })).toBe(true);
  });

  it('returns false when only gaiting (non-standard) key is present', () => {
    expect(hasValidGaitScores({ gaiting: [{ name: 'Rack', score: 80 }] })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateGaitScores
// ---------------------------------------------------------------------------
describe('validateGaitScores', () => {
  it('returns defaults for null input', () => {
    const result = validateGaitScores(null);
    expect(result.walk).toBe(50);
    expect(result.trot).toBe(50);
    expect(result.canter).toBe(50);
    expect(result.gallop).toBe(50);
    expect(result.gaiting).toBeNull();
  });

  it('returns defaults for non-object input', () => {
    const result = validateGaitScores('bad');
    expect(result.walk).toBe(50);
    expect(result.gaiting).toBeNull();
  });

  it('preserves valid integer scores', () => {
    const scores = { walk: 75, trot: 80, canter: 85, gallop: 90 };
    const result = validateGaitScores(scores);
    expect(result.walk).toBe(75);
    expect(result.trot).toBe(80);
    expect(result.canter).toBe(85);
    expect(result.gallop).toBe(90);
  });

  it('clamps out-of-range values', () => {
    const scores = { walk: -10, trot: 150, canter: 70, gallop: 80 };
    const result = validateGaitScores(scores);
    expect(result.walk).toBe(0);
    expect(result.trot).toBe(100);
  });

  it('replaces missing gaits with 50', () => {
    const result = validateGaitScores({});
    for (const gait of STANDARD_GAITS) {
      expect(result[gait]).toBe(50);
    }
  });

  it('preserves valid gaiting array', () => {
    const scores = {
      walk: 75,
      trot: 80,
      canter: 85,
      gallop: 90,
      gaiting: [{ name: 'Rack', score: 88 }],
    };
    const result = validateGaitScores(scores);
    expect(Array.isArray(result.gaiting)).toBe(true);
    expect(result.gaiting[0].name).toBe('Rack');
    expect(result.gaiting[0].score).toBe(88);
  });

  it('sets gaiting to null for empty gaiting array', () => {
    const scores = { walk: 75, trot: 80, canter: 85, gallop: 90, gaiting: [] };
    const result = validateGaitScores(scores);
    expect(result.gaiting).toBeNull();
  });

  it('normalizes gaiting entry with invalid score', () => {
    const scores = {
      walk: 75,
      trot: 80,
      canter: 85,
      gallop: 90,
      gaiting: [{ name: 'Rack', score: NaN }],
    };
    const result = validateGaitScores(scores);
    expect(result.gaiting[0].score).toBe(50);
  });

  it('normalizes gaiting entry with missing name', () => {
    const scores = {
      walk: 75,
      trot: 80,
      canter: 85,
      gallop: 90,
      gaiting: [{ score: 80 }],
    };
    const result = validateGaitScores(scores);
    expect(result.gaiting[0].name).toBe('Unknown Gait');
  });
});

// ---------------------------------------------------------------------------
// generateGaitScores (breed profile backed — file, not DB)
// ---------------------------------------------------------------------------
describe('generateGaitScores', () => {
  const neutralConformation = {
    head: 70,
    neck: 70,
    shoulders: 70,
    back: 70,
    hindquarters: 70,
    legs: 70,
    hooves: 70,
    topline: 70,
  };

  it('returns all 4 standard gaits for a valid breed', () => {
    const result = generateGaitScores('Thoroughbred', neutralConformation);
    for (const gait of STANDARD_GAITS) {
      expect(typeof result[gait]).toBe('number');
      expect(result[gait]).toBeGreaterThanOrEqual(0);
      expect(result[gait]).toBeLessThanOrEqual(100);
    }
  });

  it('returns gaiting=null for non-gaited breed (Thoroughbred)', () => {
    const result = generateGaitScores('Thoroughbred', neutralConformation);
    expect(result.gaiting).toBeNull();
  });

  it('all scores are integers', () => {
    const result = generateGaitScores('Arabian', neutralConformation);
    for (const gait of STANDARD_GAITS) {
      expect(Number.isInteger(result[gait])).toBe(true);
    }
  });

  it('throws for unknown breed', () => {
    expect(() => generateGaitScores('NotARealBreed_xyz', neutralConformation)).toThrow();
  });

  it('accepts numeric breedId for canonical-12 breeds', () => {
    const result = generateGaitScores(1, neutralConformation);
    expect(typeof result.walk).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// generateInheritedGaitScores
// ---------------------------------------------------------------------------
describe('generateInheritedGaitScores', () => {
  const neutralConformation = {
    head: 70,
    neck: 70,
    shoulders: 70,
    back: 70,
    hindquarters: 70,
    legs: 70,
    hooves: 70,
    topline: 70,
  };
  const sireGaits = { walk: 80, trot: 75, canter: 85, gallop: 90, gaiting: null };
  const damGaits = { walk: 70, trot: 65, canter: 75, gallop: 80, gaiting: null };

  it('returns all 4 standard gaits', () => {
    const result = generateInheritedGaitScores('Thoroughbred', sireGaits, damGaits, neutralConformation);
    for (const gait of STANDARD_GAITS) {
      expect(typeof result[gait]).toBe('number');
    }
  });

  it('falls back to breed-only when sire gait scores are null', () => {
    const result = generateInheritedGaitScores('Thoroughbred', null, damGaits, neutralConformation);
    expect(typeof result.walk).toBe('number');
  });

  it('falls back to breed-only when dam gait scores are null', () => {
    const result = generateInheritedGaitScores('Thoroughbred', sireGaits, null, neutralConformation);
    expect(typeof result.walk).toBe('number');
  });

  it('all scores are integers in [0, 100]', () => {
    const result = generateInheritedGaitScores('Arabian', sireGaits, damGaits, neutralConformation);
    for (const gait of STANDARD_GAITS) {
      expect(Number.isInteger(result[gait])).toBe(true);
      expect(result[gait]).toBeGreaterThanOrEqual(0);
      expect(result[gait]).toBeLessThanOrEqual(100);
    }
  });

  it('throws for unknown breed', () => {
    expect(() => generateInheritedGaitScores('NotARealBreed_xyz', sireGaits, damGaits, neutralConformation)).toThrow();
  });
});
