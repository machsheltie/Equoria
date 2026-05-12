/**
 * conformationService — unit tests (Equoria-rr7)
 *
 * Tests pure-function helpers only. generateConformationScores /
 * generateInheritedConformationScores are tested via real breed profiles
 * (breedProfiles.json is file-based, not DB). No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  clampScore,
  calculateOverallConformation,
  hasValidConformationScores,
  validateConformationScores,
  generateConformationScores,
  generateInheritedConformationScores,
  CONFORMATION_REGIONS,
} from '../../modules/horses/services/conformationService.mjs';

// ---------------------------------------------------------------------------
// CONFORMATION_REGIONS
// ---------------------------------------------------------------------------
describe('CONFORMATION_REGIONS', () => {
  it('has exactly 8 regions', () => {
    expect(CONFORMATION_REGIONS).toHaveLength(8);
  });

  it('includes all expected region names', () => {
    for (const region of ['head', 'neck', 'shoulders', 'back', 'hindquarters', 'legs', 'hooves', 'topline']) {
      expect(CONFORMATION_REGIONS).toContain(region);
    }
  });
});

// ---------------------------------------------------------------------------
// clampScore
// ---------------------------------------------------------------------------
describe('clampScore', () => {
  it('returns integer 50 for normal value', () => {
    expect(clampScore(50)).toBe(50);
  });

  it('clamps values below 0 to 0', () => {
    expect(clampScore(-10)).toBe(0);
    expect(clampScore(-0.001)).toBe(0);
  });

  it('clamps values above 100 to 100', () => {
    expect(clampScore(110)).toBe(100);
    expect(clampScore(100.5)).toBe(100);
  });

  it('rounds fractional values', () => {
    expect(clampScore(50.6)).toBe(51);
    expect(clampScore(50.4)).toBe(50);
  });

  it('returns 50 for NaN (non-finite fallback)', () => {
    expect(clampScore(NaN)).toBe(50);
  });

  it('returns 50 for Infinity (non-finite fallback)', () => {
    expect(clampScore(Infinity)).toBe(50);
    expect(clampScore(-Infinity)).toBe(50);
  });

  it('handles boundary values exactly', () => {
    expect(clampScore(0)).toBe(0);
    expect(clampScore(100)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// calculateOverallConformation
// ---------------------------------------------------------------------------
describe('calculateOverallConformation', () => {
  it('returns 50 for null input', () => {
    expect(calculateOverallConformation(null)).toBe(50);
  });

  it('returns 50 for non-object input', () => {
    expect(calculateOverallConformation('bad')).toBe(50);
    expect(calculateOverallConformation(42)).toBe(50);
  });

  it('returns 0 for empty object (all regions default to 0)', () => {
    expect(calculateOverallConformation({})).toBe(0);
  });

  it('returns 80 when all 8 regions are 80', () => {
    const scores = {};
    for (const r of CONFORMATION_REGIONS) {
      scores[r] = 80;
    }
    expect(calculateOverallConformation(scores)).toBe(80);
  });

  it('averages all 8 regions correctly', () => {
    const scores = {};
    // 4 regions at 60, 4 regions at 100 → avg = 80
    CONFORMATION_REGIONS.forEach((r, i) => {
      scores[r] = i < 4 ? 60 : 100;
    });
    expect(calculateOverallConformation(scores)).toBe(80);
  });

  it('ignores extra keys beyond the 8 regions', () => {
    const scores = {};
    for (const r of CONFORMATION_REGIONS) {
      scores[r] = 70;
    }
    scores.extraKey = 9999;
    expect(calculateOverallConformation(scores)).toBe(70);
  });
});

// ---------------------------------------------------------------------------
// hasValidConformationScores
// ---------------------------------------------------------------------------
describe('hasValidConformationScores', () => {
  it('returns false for null', () => {
    expect(hasValidConformationScores(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasValidConformationScores(undefined)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(hasValidConformationScores('string')).toBe(false);
    expect(hasValidConformationScores(42)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(hasValidConformationScores({})).toBe(false);
  });

  it('returns true when at least one region has a finite numeric score', () => {
    expect(hasValidConformationScores({ head: 70 })).toBe(true);
  });

  it('returns true when all regions are present', () => {
    const scores = {};
    for (const r of CONFORMATION_REGIONS) {
      scores[r] = 65;
    }
    expect(hasValidConformationScores(scores)).toBe(true);
  });

  it('returns false when only non-region keys are present', () => {
    expect(hasValidConformationScores({ overallConformation: 70, extraKey: 80 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateConformationScores
// ---------------------------------------------------------------------------
describe('validateConformationScores', () => {
  it('returns neutral 50 defaults for null input', () => {
    const result = validateConformationScores(null);
    for (const r of CONFORMATION_REGIONS) {
      expect(result[r]).toBe(50);
    }
    expect(result.overallConformation).toBe(50);
  });

  it('returns neutral 50 defaults for non-object input', () => {
    const result = validateConformationScores('bad');
    expect(result.head).toBe(50);
  });

  it('preserves valid integer region scores', () => {
    const scores = {};
    for (const r of CONFORMATION_REGIONS) {
      scores[r] = 80;
    }
    const result = validateConformationScores(scores);
    for (const r of CONFORMATION_REGIONS) {
      expect(result[r]).toBe(80);
    }
  });

  it('clamps out-of-range values', () => {
    const scores = { head: -5, neck: 120 };
    for (const r of CONFORMATION_REGIONS) {
      if (!scores[r]) {
        scores[r] = 70;
      }
    }
    const result = validateConformationScores(scores);
    expect(result.head).toBe(0);
    expect(result.neck).toBe(100);
  });

  it('replaces missing regions with 50', () => {
    const result = validateConformationScores({});
    for (const r of CONFORMATION_REGIONS) {
      expect(result[r]).toBe(50);
    }
  });

  it('sets overallConformation from region values', () => {
    const scores = {};
    for (const r of CONFORMATION_REGIONS) {
      scores[r] = 60;
    }
    const result = validateConformationScores(scores);
    expect(result.overallConformation).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// generateConformationScores (requires real breed profile JSON)
// ---------------------------------------------------------------------------
describe('generateConformationScores', () => {
  it('returns scores with all 8 regions for a valid breed', () => {
    const result = generateConformationScores('Thoroughbred');
    for (const r of CONFORMATION_REGIONS) {
      expect(typeof result[r]).toBe('number');
      expect(result[r]).toBeGreaterThanOrEqual(0);
      expect(result[r]).toBeLessThanOrEqual(100);
    }
  });

  it('includes overallConformation in result', () => {
    const result = generateConformationScores('Thoroughbred');
    expect(typeof result.overallConformation).toBe('number');
    expect(result.overallConformation).toBeGreaterThanOrEqual(0);
    expect(result.overallConformation).toBeLessThanOrEqual(100);
  });

  it('throws for unknown breed', () => {
    expect(() => generateConformationScores('NotARealBreed_xyz')).toThrow();
  });

  it('generates scores in valid range for Arabian', () => {
    const result = generateConformationScores('Arabian');
    expect(result.overallConformation).toBeGreaterThanOrEqual(0);
    expect(result.overallConformation).toBeLessThanOrEqual(100);
  });

  it('scores are integers (clampScore rounds)', () => {
    const result = generateConformationScores('American Quarter Horse');
    for (const r of CONFORMATION_REGIONS) {
      expect(Number.isInteger(result[r])).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// generateInheritedConformationScores
// ---------------------------------------------------------------------------
describe('generateInheritedConformationScores', () => {
  const sireScores = {
    head: 80,
    neck: 75,
    shoulders: 85,
    back: 70,
    hindquarters: 80,
    legs: 75,
    hooves: 80,
    topline: 75,
  };
  const damScores = {
    head: 70,
    neck: 65,
    shoulders: 75,
    back: 60,
    hindquarters: 70,
    legs: 65,
    hooves: 70,
    topline: 65,
  };

  it('returns scores with all 8 regions', () => {
    const result = generateInheritedConformationScores('Thoroughbred', sireScores, damScores);
    for (const r of CONFORMATION_REGIONS) {
      expect(typeof result[r]).toBe('number');
    }
  });

  it('falls back to breed-only generation when sire scores are null', () => {
    const result = generateInheritedConformationScores('Thoroughbred', null, damScores);
    expect(typeof result.overallConformation).toBe('number');
  });

  it('falls back to breed-only generation when dam scores are null', () => {
    const result = generateInheritedConformationScores('Thoroughbred', sireScores, null);
    expect(typeof result.overallConformation).toBe('number');
  });

  it('all region scores are integers in [0, 100]', () => {
    const result = generateInheritedConformationScores('Arabian', sireScores, damScores);
    for (const r of CONFORMATION_REGIONS) {
      expect(Number.isInteger(result[r])).toBe(true);
      expect(result[r]).toBeGreaterThanOrEqual(0);
      expect(result[r]).toBeLessThanOrEqual(100);
    }
  });

  it('throws for unknown breed', () => {
    expect(() => generateInheritedConformationScores('NotARealBreed_xyz', sireScores, damScores)).toThrow();
  });
});
