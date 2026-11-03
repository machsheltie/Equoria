import { describe, it, expect } from '@jest/globals';
import {
  horseSex,
  horseSexValues,
  horseTemperament,
  horseTemperamentValues,
  horseHealthStatus,
  horseHealthStatusValues,
  DISCIPLINES,
  disciplineValues,
  conformationClasses,
  conformationClassValues,
  competitionPlacements,
  competitionPlacementValues,
  groomSpecialties,
  groomSpecialtyValues,
  groomSkillLevels,
  groomSkillLevelValues,
  groomPersonalities,
  groomPersonalityValues,
  groomInteractionTypes,
  groomInteractionTypeValues,
  horseStats,
  horseStatValues,
  trainingLimits,
  competitionLimits,
  breedingLimits,
  foalLimits,
  userProgression,
  scoreRanges,
  isValidHorseSex,
} from '../constants/schema.mjs';

// ─── horseSex ────────────────────────────────────────────────────────────────

describe('horseSex', () => {
  it('is an object', () => {
    expect(typeof horseSex).toBe('object');
    expect(horseSex).not.toBeNull();
  });

  it('has STALLION', () => {
    expect(horseSex.STALLION).toBe('Stallion');
  });

  it('has MARE', () => {
    expect(horseSex.MARE).toBe('Mare');
  });

  it('has COLT', () => {
    expect(typeof horseSex.COLT).toBe('string');
  });

  it('has FILLY', () => {
    expect(typeof horseSex.FILLY).toBe('string');
  });

  it('has no RIG (owner ruling 2026-08-19: no rigs, no geldings)', () => {
    expect(horseSex).not.toHaveProperty('RIG');
  });
});

describe('horseSexValues', () => {
  it('is an array', () => {
    expect(Array.isArray(horseSexValues)).toBe(true);
  });

  it('has at least 4 entries', () => {
    expect(horseSexValues.length).toBeGreaterThanOrEqual(4);
  });

  it('contains Stallion', () => {
    expect(horseSexValues).toContain('Stallion');
  });

  it('contains Mare', () => {
    expect(horseSexValues).toContain('Mare');
  });

  it('all values are strings', () => {
    for (const v of horseSexValues) {
      expect(typeof v).toBe('string');
    }
  });
});

// ─── horseTemperament ────────────────────────────────────────────────────────

describe('horseTemperament', () => {
  it('is an object', () => {
    expect(typeof horseTemperament).toBe('object');
    expect(horseTemperament).not.toBeNull();
  });

  it('all values are strings', () => {
    for (const v of Object.values(horseTemperament)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('horseTemperamentValues', () => {
  it('is an array of strings', () => {
    expect(Array.isArray(horseTemperamentValues)).toBe(true);
    for (const v of horseTemperamentValues) {
      expect(typeof v).toBe('string');
    }
  });
});

// ─── horseHealthStatus ──────────────────────────────────────────────────────

describe('horseHealthStatus', () => {
  it('is an object with string values', () => {
    expect(typeof horseHealthStatus).toBe('object');
    for (const v of Object.values(horseHealthStatus)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('horseHealthStatusValues', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(horseHealthStatusValues)).toBe(true);
    expect(horseHealthStatusValues.length).toBeGreaterThan(0);
  });
});

// ─── DISCIPLINES ──────────────────────────────────────────────────────────────

describe('DISCIPLINES', () => {
  it('is an object', () => {
    expect(typeof DISCIPLINES).toBe('object');
    expect(DISCIPLINES).not.toBeNull();
  });

  it('all values are strings', () => {
    for (const v of Object.values(DISCIPLINES)) {
      expect(typeof v).toBe('string');
    }
  });

  it('has at least 5 entries', () => {
    expect(Object.keys(DISCIPLINES).length).toBeGreaterThanOrEqual(5);
  });
});

describe('disciplineValues', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(disciplineValues)).toBe(true);
    expect(disciplineValues.length).toBeGreaterThan(0);
    for (const v of disciplineValues) {
      expect(typeof v).toBe('string');
    }
  });
});

// ─── conformationClasses ─────────────────────────────────────────────────────

describe('conformationClasses', () => {
  it('is an object with string values', () => {
    expect(typeof conformationClasses).toBe('object');
    for (const v of Object.values(conformationClasses)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('conformationClassValues', () => {
  it('is an array', () => {
    expect(Array.isArray(conformationClassValues)).toBe(true);
  });
});

// ─── competitionPlacements ───────────────────────────────────────────────────

describe('competitionPlacements', () => {
  it('is an object with string values', () => {
    expect(typeof competitionPlacements).toBe('object');
    for (const v of Object.values(competitionPlacements)) {
      expect(typeof v).toBe('string');
    }
  });

  it('has FIRST place', () => {
    expect(competitionPlacements.FIRST).toBe('1st');
  });
});

describe('competitionPlacementValues', () => {
  it('is an array', () => {
    expect(Array.isArray(competitionPlacementValues)).toBe(true);
  });
});

// ─── GROOM constants ──────────────────────────────────────────────────────────

describe('groomSpecialties', () => {
  it('is an object with string values', () => {
    expect(typeof groomSpecialties).toBe('object');
    for (const v of Object.values(groomSpecialties)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('groomSpecialtyValues', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(groomSpecialtyValues)).toBe(true);
    expect(groomSpecialtyValues.length).toBeGreaterThan(0);
  });
});

describe('groomSkillLevels', () => {
  it('is an object with string values', () => {
    expect(typeof groomSkillLevels).toBe('object');
    for (const v of Object.values(groomSkillLevels)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('groomSkillLevelValues', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(groomSkillLevelValues)).toBe(true);
    expect(groomSkillLevelValues.length).toBeGreaterThan(0);
  });
});

describe('groomPersonalities', () => {
  it('is an object with string values', () => {
    expect(typeof groomPersonalities).toBe('object');
    for (const v of Object.values(groomPersonalities)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('groomPersonalityValues', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(groomPersonalityValues)).toBe(true);
    expect(groomPersonalityValues.length).toBeGreaterThan(0);
  });
});

describe('groomInteractionTypes', () => {
  it('is an object with string values', () => {
    expect(typeof groomInteractionTypes).toBe('object');
    for (const v of Object.values(groomInteractionTypes)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('groomInteractionTypeValues', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(groomInteractionTypeValues)).toBe(true);
    expect(groomInteractionTypeValues.length).toBeGreaterThan(0);
  });
});

// ─── horseStats ──────────────────────────────────────────────────────────────

describe('horseStats', () => {
  it('is an object', () => {
    expect(typeof horseStats).toBe('object');
    expect(horseStats).not.toBeNull();
  });

  it('all values are strings', () => {
    for (const v of Object.values(horseStats)) {
      expect(typeof v).toBe('string');
    }
  });

  it('has at least 8 stat types', () => {
    expect(Object.keys(horseStats).length).toBeGreaterThanOrEqual(8);
  });
});

describe('horseStatValues', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(horseStatValues)).toBe(true);
    expect(horseStatValues.length).toBeGreaterThan(0);
    for (const v of horseStatValues) {
      expect(typeof v).toBe('string');
    }
  });
});

// ─── Limit constants ──────────────────────────────────────────────────────────

describe('trainingLimits', () => {
  it('is an object with numeric values', () => {
    expect(typeof trainingLimits).toBe('object');
    for (const v of Object.values(trainingLimits)) {
      expect(typeof v).toBe('number');
    }
  });
});

describe('competitionLimits', () => {
  it('is an object with numeric values', () => {
    expect(typeof competitionLimits).toBe('object');
    for (const v of Object.values(competitionLimits)) {
      expect(typeof v).toBe('number');
    }
  });
});

describe('breedingLimits', () => {
  it('is an object with numeric values', () => {
    expect(typeof breedingLimits).toBe('object');
    for (const v of Object.values(breedingLimits)) {
      expect(typeof v).toBe('number');
    }
  });
});

describe('foalLimits', () => {
  it('is an object', () => {
    expect(typeof foalLimits).toBe('object');
    expect(foalLimits).not.toBeNull();
  });
});

// ─── userProgression and scoreRanges ───────────────────────────────────────

describe('userProgression', () => {
  it('is an object', () => {
    expect(typeof userProgression).toBe('object');
    expect(userProgression).not.toBeNull();
  });

  it('has numeric values', () => {
    for (const v of Object.values(userProgression)) {
      expect(typeof v).toBe('number');
    }
  });
});

describe('scoreRanges', () => {
  it('is an object', () => {
    expect(typeof scoreRanges).toBe('object');
    expect(scoreRanges).not.toBeNull();
  });
});

// ─── isValidHorseSex ──────────────────────────────────────────────────────────

describe('isValidHorseSex', () => {
  it('is a function', () => {
    expect(typeof isValidHorseSex).toBe('function');
  });

  it('returns true for Stallion', () => {
    expect(isValidHorseSex('Stallion')).toBe(true);
  });

  it('returns true for Mare', () => {
    expect(isValidHorseSex('Mare')).toBe(true);
  });

  it('returns true for Colt', () => {
    expect(isValidHorseSex('Colt')).toBe(true);
  });

  it('returns true for Filly', () => {
    expect(isValidHorseSex('Filly')).toBe(true);
  });

  it('returns false for invalid sex', () => {
    expect(isValidHorseSex('Gelding')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidHorseSex('')).toBe(false);
  });

  it('returns false for lowercase stallion', () => {
    expect(isValidHorseSex('stallion')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidHorseSex(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidHorseSex(undefined)).toBe(false);
  });

  it('returns a boolean', () => {
    expect(typeof isValidHorseSex('Stallion')).toBe('boolean');
  });
});
