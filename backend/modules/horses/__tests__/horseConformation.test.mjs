/**
 * Horse Conformation Scoring System Tests
 *
 * Tests the conformation scoring logic via real function calls against the
 * live conformationService. No mocks of any kind.
 *
 * Coverage:
 *   - CONFORMATION_REGIONS structure (8 required regions)
 *   - clampScore: valid range enforcement and edge cases
 *   - calculateOverallConformation: arithmetic mean of all 8 regions
 *   - hasValidConformationScores: presence of at least one finite numeric region
 *   - validateConformationScores: normalises/fills missing values to 50
 *   - Default score object (all 20) passes validation unchanged
 *   - Real DB: conformationScores stored and retrieved correctly
 *
 * Fixtures: prefix TestFixture-HorseConformation-  Cleaned in beforeAll/afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../db/index.mjs';
import {
  CONFORMATION_REGIONS,
  clampScore,
  calculateOverallConformation,
  hasValidConformationScores,
  validateConformationScores,
} from '../../../modules/horses/services/conformationService.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const PREFIX = 'TestFixture-HorseConformation-';

// ─── setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
});

afterAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
});

// ─── CONFORMATION_REGIONS ─────────────────────────────────────────────────────

describe('CONFORMATION_REGIONS', () => {
  it('contains exactly 8 regions', () => {
    expect(CONFORMATION_REGIONS).toHaveLength(8);
  });

  it('contains all required region names', () => {
    const required = ['head', 'neck', 'shoulders', 'back', 'legs', 'hooves', 'topline', 'hindquarters'];

    for (const region of required) {
      expect(CONFORMATION_REGIONS).toContain(region);
    }
  });

  it('contains only strings', () => {
    for (const region of CONFORMATION_REGIONS) {
      expect(typeof region).toBe('string');
    }
  });
});

// ─── clampScore ───────────────────────────────────────────────────────────────

describe('clampScore', () => {
  it('returns value unchanged for integers in [0, 100]', () => {
    expect(clampScore(0)).toBe(0);
    expect(clampScore(1)).toBe(1);
    expect(clampScore(50)).toBe(50);
    expect(clampScore(99)).toBe(99);
    expect(clampScore(100)).toBe(100);
  });

  it('clamps values below 0 to 0', () => {
    expect(clampScore(-1)).toBe(0);
    expect(clampScore(-100)).toBe(0);
  });

  it('clamps values above 100 to 100', () => {
    expect(clampScore(101)).toBe(100);
    expect(clampScore(200)).toBe(100);
  });

  it('rounds non-integers', () => {
    expect(clampScore(50.4)).toBe(50);
    expect(clampScore(50.6)).toBe(51);
  });

  it('returns 50 for non-finite inputs (NaN, Infinity)', () => {
    expect(clampScore(NaN)).toBe(50);
    expect(clampScore(Infinity)).toBe(50);
    expect(clampScore(-Infinity)).toBe(50);
  });
});

// ─── calculateOverallConformation ─────────────────────────────────────────────

describe('calculateOverallConformation', () => {
  it('returns the arithmetic mean of all 8 region scores', () => {
    const scores = {
      head: 20,
      neck: 20,
      shoulders: 20,
      back: 20,
      hindquarters: 20,
      legs: 20,
      hooves: 20,
      topline: 20,
    };
    expect(calculateOverallConformation(scores)).toBe(20);
  });

  it('calculates mean for varied scores', () => {
    const scores = {
      head: 10,
      neck: 20,
      shoulders: 30,
      back: 40,
      hindquarters: 50,
      legs: 60,
      hooves: 70,
      topline: 80,
    };
    // (10+20+30+40+50+60+70+80) / 8 = 360 / 8 = 45
    expect(calculateOverallConformation(scores)).toBe(45);
  });

  it('treats missing regions as 0 in the mean calculation', () => {
    const scores = { head: 40, neck: 40 }; // 6 missing = 0
    // (40+40+0+0+0+0+0+0) / 8 = 80 / 8 = 10
    expect(calculateOverallConformation(scores)).toBe(10);
  });

  it('returns 50 for null input', () => {
    expect(calculateOverallConformation(null)).toBe(50);
  });

  it('returns 50 for undefined input', () => {
    expect(calculateOverallConformation(undefined)).toBe(50);
  });

  it('returns 50 for non-object input', () => {
    expect(calculateOverallConformation('string')).toBe(50);
    expect(calculateOverallConformation(42)).toBe(50);
  });
});

// ─── hasValidConformationScores ───────────────────────────────────────────────

describe('hasValidConformationScores', () => {
  it('returns true when at least one region has a finite numeric score', () => {
    expect(hasValidConformationScores({ head: 20 })).toBe(true);
    expect(hasValidConformationScores({ head: 0 })).toBe(true);
    expect(hasValidConformationScores({ head: 100 })).toBe(true);
  });

  it('returns false for null or undefined', () => {
    expect(hasValidConformationScores(null)).toBe(false);
    expect(hasValidConformationScores(undefined)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(hasValidConformationScores('string')).toBe(false);
    expect(hasValidConformationScores(42)).toBe(false);
  });

  it('returns false when no regions contain finite numbers', () => {
    expect(hasValidConformationScores({ head: 'invalid', neck: null })).toBe(false);
    expect(hasValidConformationScores({})).toBe(false);
  });
});

// ─── validateConformationScores ───────────────────────────────────────────────

describe('validateConformationScores', () => {
  it('returns all 8 regions plus overallConformation for a complete input', () => {
    const input = {
      head: 20,
      neck: 20,
      shoulders: 20,
      back: 20,
      hindquarters: 20,
      legs: 20,
      hooves: 20,
      topline: 20,
    };

    const result = validateConformationScores(input);

    for (const region of CONFORMATION_REGIONS) {
      expect(result[region]).toBe(20);
    }
    expect(result.overallConformation).toBe(20);
  });

  it('fills missing regions with 50 and computes overallConformation', () => {
    const input = { head: 80, neck: 80 };

    const result = validateConformationScores(input);

    expect(result.head).toBe(80);
    expect(result.neck).toBe(80);
    // Other 6 regions default to 50
    for (const region of CONFORMATION_REGIONS) {
      if (region !== 'head' && region !== 'neck') {
        expect(result[region]).toBe(50);
      }
    }
    expect(typeof result.overallConformation).toBe('number');
  });

  it('returns neutral 50 defaults for null input', () => {
    const result = validateConformationScores(null);

    for (const region of CONFORMATION_REGIONS) {
      expect(result[region]).toBe(50);
    }
    expect(result.overallConformation).toBe(50);
  });

  it('clamps out-of-range values into [0, 100]', () => {
    const input = {
      head: -10,
      neck: 200,
      shoulders: 50,
      back: 50,
      hindquarters: 50,
      legs: 50,
      hooves: 50,
      topline: 50,
    };

    const result = validateConformationScores(input);

    expect(result.head).toBe(0);
    expect(result.neck).toBe(100);
  });
});

// ─── default score object ─────────────────────────────────────────────────────

describe('default conformation score object (all 20)', () => {
  const defaults = {
    head: 20,
    neck: 20,
    shoulders: 20,
    back: 20,
    legs: 20,
    hooves: 20,
    topline: 20,
    hindquarters: 20,
  };

  it('has all 8 required regions each set to 20', () => {
    for (const region of CONFORMATION_REGIONS) {
      expect(defaults[region]).toBe(20);
    }
  });

  it('produces overallConformation of 20 when validated', () => {
    const result = validateConformationScores(defaults);
    expect(result.overallConformation).toBe(20);
  });
});

// ─── real DB: conformationScores persistence ─────────────────────────────────

describe('conformationScores persistence (real DB)', () => {
  it('stores and retrieves a conformationScores object correctly', async () => {
    const scores = {
      head: 75,
      neck: 80,
      shoulders: 70,
      back: 85,
      hindquarters: 60,
      legs: 90,
      hooves: 65,
      topline: 75,
      overallConformation: 75,
    };

    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${PREFIX}Persist`,
        sex: 'Colt',
        dateOfBirth: new Date('2020-01-01'),
        conformationScores: scores,
      },
    });

    try {
      const fetched = await prisma.horse.findUnique({ where: { id: horse.id } });
      expect(fetched.conformationScores).toEqual(scores);
    } finally {
      await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
    }
  });
});
