import { describe, it, expect } from '@jest/globals';
import {
  HORSE_SEX,
  HORSE_SEX_VALUES,
  HORSE_TEMPERAMENT,
  HORSE_TEMPERAMENT_VALUES,
  HORSE_HEALTH_STATUS,
  HORSE_HEALTH_STATUS_VALUES,
  DISCIPLINES,
  DISCIPLINE_VALUES,
  CONFORMATION_CLASSES,
  CONFORMATION_CLASS_VALUES,
  COMPETITION_PLACEMENTS,
  COMPETITION_PLACEMENT_VALUES,
  GROOM_SPECIALTIES,
  GROOM_SPECIALTY_VALUES,
  GROOM_SKILL_LEVELS,
  GROOM_SKILL_LEVEL_VALUES,
  GROOM_PERSONALITIES,
  GROOM_PERSONALITY_VALUES,
  GROOM_INTERACTION_TYPES,
  GROOM_INTERACTION_TYPE_VALUES,
  HORSE_STATS,
  HORSE_STAT_VALUES,
  TRAINING_LIMITS,
  COMPETITION_LIMITS,
  BREEDING_LIMITS,
  FOAL_LIMITS,
  USER_PROGRESSION,
  SCORE_RANGES,
  isValidHorseSex,
} from '../../constants/schema.mjs';

// ─── HORSE_SEX ────────────────────────────────────────────────────────────────

describe('HORSE_SEX', () => {
  it('is an object', () => {
    expect(typeof HORSE_SEX).toBe('object');
    expect(HORSE_SEX).not.toBeNull();
  });

  it('has STALLION', () => {
    expect(HORSE_SEX.STALLION).toBe('Stallion');
  });

  it('has MARE', () => {
    expect(HORSE_SEX.MARE).toBe('Mare');
  });

  it('has COLT', () => {
    expect(typeof HORSE_SEX.COLT).toBe('string');
  });

  it('has FILLY', () => {
    expect(typeof HORSE_SEX.FILLY).toBe('string');
  });

  it('has RIG', () => {
    expect(typeof HORSE_SEX.RIG).toBe('string');
  });
});

describe('HORSE_SEX_VALUES', () => {
  it('is an array', () => {
    expect(Array.isArray(HORSE_SEX_VALUES)).toBe(true);
  });

  it('has at least 4 entries', () => {
    expect(HORSE_SEX_VALUES.length).toBeGreaterThanOrEqual(4);
  });

  it('contains Stallion', () => {
    expect(HORSE_SEX_VALUES).toContain('Stallion');
  });

  it('contains Mare', () => {
    expect(HORSE_SEX_VALUES).toContain('Mare');
  });

  it('all values are strings', () => {
    for (const v of HORSE_SEX_VALUES) {
      expect(typeof v).toBe('string');
    }
  });
});

// ─── HORSE_TEMPERAMENT ────────────────────────────────────────────────────────

describe('HORSE_TEMPERAMENT', () => {
  it('is an object', () => {
    expect(typeof HORSE_TEMPERAMENT).toBe('object');
    expect(HORSE_TEMPERAMENT).not.toBeNull();
  });

  it('all values are strings', () => {
    for (const v of Object.values(HORSE_TEMPERAMENT)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('HORSE_TEMPERAMENT_VALUES', () => {
  it('is an array of strings', () => {
    expect(Array.isArray(HORSE_TEMPERAMENT_VALUES)).toBe(true);
    for (const v of HORSE_TEMPERAMENT_VALUES) {
      expect(typeof v).toBe('string');
    }
  });
});

// ─── HORSE_HEALTH_STATUS ──────────────────────────────────────────────────────

describe('HORSE_HEALTH_STATUS', () => {
  it('is an object with string values', () => {
    expect(typeof HORSE_HEALTH_STATUS).toBe('object');
    for (const v of Object.values(HORSE_HEALTH_STATUS)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('HORSE_HEALTH_STATUS_VALUES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(HORSE_HEALTH_STATUS_VALUES)).toBe(true);
    expect(HORSE_HEALTH_STATUS_VALUES.length).toBeGreaterThan(0);
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

describe('DISCIPLINE_VALUES', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(DISCIPLINE_VALUES)).toBe(true);
    expect(DISCIPLINE_VALUES.length).toBeGreaterThan(0);
    for (const v of DISCIPLINE_VALUES) {
      expect(typeof v).toBe('string');
    }
  });
});

// ─── CONFORMATION_CLASSES ─────────────────────────────────────────────────────

describe('CONFORMATION_CLASSES', () => {
  it('is an object with string values', () => {
    expect(typeof CONFORMATION_CLASSES).toBe('object');
    for (const v of Object.values(CONFORMATION_CLASSES)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('CONFORMATION_CLASS_VALUES', () => {
  it('is an array', () => {
    expect(Array.isArray(CONFORMATION_CLASS_VALUES)).toBe(true);
  });
});

// ─── COMPETITION_PLACEMENTS ───────────────────────────────────────────────────

describe('COMPETITION_PLACEMENTS', () => {
  it('is an object with string values', () => {
    expect(typeof COMPETITION_PLACEMENTS).toBe('object');
    for (const v of Object.values(COMPETITION_PLACEMENTS)) {
      expect(typeof v).toBe('string');
    }
  });

  it('has FIRST place', () => {
    expect(COMPETITION_PLACEMENTS.FIRST).toBe('1st');
  });
});

describe('COMPETITION_PLACEMENT_VALUES', () => {
  it('is an array', () => {
    expect(Array.isArray(COMPETITION_PLACEMENT_VALUES)).toBe(true);
  });
});

// ─── GROOM constants ──────────────────────────────────────────────────────────

describe('GROOM_SPECIALTIES', () => {
  it('is an object with string values', () => {
    expect(typeof GROOM_SPECIALTIES).toBe('object');
    for (const v of Object.values(GROOM_SPECIALTIES)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('GROOM_SPECIALTY_VALUES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(GROOM_SPECIALTY_VALUES)).toBe(true);
    expect(GROOM_SPECIALTY_VALUES.length).toBeGreaterThan(0);
  });
});

describe('GROOM_SKILL_LEVELS', () => {
  it('is an object with string values', () => {
    expect(typeof GROOM_SKILL_LEVELS).toBe('object');
    for (const v of Object.values(GROOM_SKILL_LEVELS)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('GROOM_SKILL_LEVEL_VALUES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(GROOM_SKILL_LEVEL_VALUES)).toBe(true);
    expect(GROOM_SKILL_LEVEL_VALUES.length).toBeGreaterThan(0);
  });
});

describe('GROOM_PERSONALITIES', () => {
  it('is an object with string values', () => {
    expect(typeof GROOM_PERSONALITIES).toBe('object');
    for (const v of Object.values(GROOM_PERSONALITIES)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('GROOM_PERSONALITY_VALUES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(GROOM_PERSONALITY_VALUES)).toBe(true);
    expect(GROOM_PERSONALITY_VALUES.length).toBeGreaterThan(0);
  });
});

describe('GROOM_INTERACTION_TYPES', () => {
  it('is an object with string values', () => {
    expect(typeof GROOM_INTERACTION_TYPES).toBe('object');
    for (const v of Object.values(GROOM_INTERACTION_TYPES)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('GROOM_INTERACTION_TYPE_VALUES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(GROOM_INTERACTION_TYPE_VALUES)).toBe(true);
    expect(GROOM_INTERACTION_TYPE_VALUES.length).toBeGreaterThan(0);
  });
});

// ─── HORSE_STATS ──────────────────────────────────────────────────────────────

describe('HORSE_STATS', () => {
  it('is an object', () => {
    expect(typeof HORSE_STATS).toBe('object');
    expect(HORSE_STATS).not.toBeNull();
  });

  it('all values are strings', () => {
    for (const v of Object.values(HORSE_STATS)) {
      expect(typeof v).toBe('string');
    }
  });

  it('has at least 8 stat types', () => {
    expect(Object.keys(HORSE_STATS).length).toBeGreaterThanOrEqual(8);
  });
});

describe('HORSE_STAT_VALUES', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(HORSE_STAT_VALUES)).toBe(true);
    expect(HORSE_STAT_VALUES.length).toBeGreaterThan(0);
    for (const v of HORSE_STAT_VALUES) {
      expect(typeof v).toBe('string');
    }
  });
});

// ─── Limit constants ──────────────────────────────────────────────────────────

describe('TRAINING_LIMITS', () => {
  it('is an object with numeric values', () => {
    expect(typeof TRAINING_LIMITS).toBe('object');
    for (const v of Object.values(TRAINING_LIMITS)) {
      expect(typeof v).toBe('number');
    }
  });
});

describe('COMPETITION_LIMITS', () => {
  it('is an object with numeric values', () => {
    expect(typeof COMPETITION_LIMITS).toBe('object');
    for (const v of Object.values(COMPETITION_LIMITS)) {
      expect(typeof v).toBe('number');
    }
  });
});

describe('BREEDING_LIMITS', () => {
  it('is an object with numeric values', () => {
    expect(typeof BREEDING_LIMITS).toBe('object');
    for (const v of Object.values(BREEDING_LIMITS)) {
      expect(typeof v).toBe('number');
    }
  });
});

describe('FOAL_LIMITS', () => {
  it('is an object', () => {
    expect(typeof FOAL_LIMITS).toBe('object');
    expect(FOAL_LIMITS).not.toBeNull();
  });
});

// ─── USER_PROGRESSION and SCORE_RANGES ───────────────────────────────────────

describe('USER_PROGRESSION', () => {
  it('is an object', () => {
    expect(typeof USER_PROGRESSION).toBe('object');
    expect(USER_PROGRESSION).not.toBeNull();
  });

  it('has numeric values', () => {
    for (const v of Object.values(USER_PROGRESSION)) {
      expect(typeof v).toBe('number');
    }
  });
});

describe('SCORE_RANGES', () => {
  it('is an object', () => {
    expect(typeof SCORE_RANGES).toBe('object');
    expect(SCORE_RANGES).not.toBeNull();
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
