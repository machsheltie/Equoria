/**
 * horseModelTraitHelpers — unit tests (Equoria-rr7)
 *
 * Pure utility functions, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  _addTraitSafely,
  _removeTraitSafely,
  _getAllTraits,
  hasTrait,
  getTraitCategory,
  moveTraitBetweenCategories,
  countTraits,
  countTraitsByCategory,
  validateTraitStructure,
} from '../../../utils/horseModelTraitHelpers.mjs';

const emptyTraits = () => ({ positive: [], negative: [], hidden: [] });

// ---------------------------------------------------------------------------
// _addTraitSafely
// ---------------------------------------------------------------------------
describe('_addTraitSafely', () => {
  it('adds trait to positive category', () => {
    const result = _addTraitSafely(emptyTraits(), 'resilient', 'positive');
    expect(result.positive).toContain('resilient');
  });

  it('adds trait to negative category', () => {
    const result = _addTraitSafely(emptyTraits(), 'fearful', 'negative');
    expect(result.negative).toContain('fearful');
  });

  it('adds trait to hidden category', () => {
    const result = _addTraitSafely(emptyTraits(), 'hidden_boost', 'hidden');
    expect(result.hidden).toContain('hidden_boost');
  });

  it('does not duplicate an existing trait', () => {
    const traits = { positive: ['resilient'], negative: [], hidden: [] };
    const result = _addTraitSafely(traits, 'resilient', 'positive');
    expect(result.positive.filter(t => t === 'resilient').length).toBe(1);
  });

  it('does not mutate the original traits object', () => {
    const traits = { positive: [], negative: [], hidden: [] };
    _addTraitSafely(traits, 'resilient', 'positive');
    expect(traits.positive).toHaveLength(0);
  });

  it('throws for null traits', () => {
    expect(() => _addTraitSafely(null, 'resilient', 'positive')).toThrow('Traits object is required');
  });

  it('throws for empty trait name', () => {
    expect(() => _addTraitSafely(emptyTraits(), '', 'positive')).toThrow('Valid trait name is required');
  });

  it('throws for invalid category', () => {
    expect(() => _addTraitSafely(emptyTraits(), 'resilient', 'amazing')).toThrow('Valid category is required');
  });

  it('preserves traits in other categories', () => {
    const traits = { positive: ['existing'], negative: ['bad_trait'], hidden: [] };
    const result = _addTraitSafely(traits, 'new_trait', 'positive');
    expect(result.negative).toContain('bad_trait');
  });
});

// ---------------------------------------------------------------------------
// _removeTraitSafely
// ---------------------------------------------------------------------------
describe('_removeTraitSafely', () => {
  it('removes existing trait from positive', () => {
    const traits = { positive: ['resilient', 'bold'], negative: [], hidden: [] };
    const result = _removeTraitSafely(traits, 'resilient', 'positive');
    expect(result.positive).not.toContain('resilient');
    expect(result.positive).toContain('bold');
  });

  it('does not error when trait not in category', () => {
    expect(() => _removeTraitSafely(emptyTraits(), 'nonexistent', 'positive')).not.toThrow();
  });

  it('does not mutate original', () => {
    const traits = { positive: ['resilient'], negative: [], hidden: [] };
    _removeTraitSafely(traits, 'resilient', 'positive');
    expect(traits.positive).toContain('resilient');
  });

  it('throws for null traits', () => {
    expect(() => _removeTraitSafely(null, 'resilient', 'positive')).toThrow();
  });

  it('throws for invalid category', () => {
    expect(() => _removeTraitSafely(emptyTraits(), 'resilient', 'invalid')).toThrow();
  });

  it('throws for empty trait name (line 71: Valid trait name is required)', () => {
    expect(() => _removeTraitSafely(emptyTraits(), '', 'positive')).toThrow('Valid trait name is required');
  });

  it('throws for null trait name (line 71: Valid trait name is required)', () => {
    expect(() => _removeTraitSafely(emptyTraits(), null, 'positive')).toThrow('Valid trait name is required');
  });
});

// ---------------------------------------------------------------------------
// _getAllTraits
// ---------------------------------------------------------------------------
describe('_getAllTraits', () => {
  it('returns all traits flattened', () => {
    const traits = { positive: ['resilient'], negative: ['fearful'], hidden: ['secret'] };
    const result = _getAllTraits(traits);
    expect(result).toContain('resilient');
    expect(result).toContain('fearful');
    expect(result).toContain('secret');
    expect(result).toHaveLength(3);
  });

  it('returns empty array for empty traits', () => {
    expect(_getAllTraits(emptyTraits())).toHaveLength(0);
  });

  it('returns empty array for null input', () => {
    expect(_getAllTraits(null)).toHaveLength(0);
  });

  it('handles missing categories gracefully', () => {
    const result = _getAllTraits({ positive: ['x'] });
    expect(result).toContain('x');
  });
});

// ---------------------------------------------------------------------------
// hasTrait
// ---------------------------------------------------------------------------
describe('hasTrait', () => {
  it('returns true when trait is in positive', () => {
    const traits = { positive: ['resilient'], negative: [], hidden: [] };
    expect(hasTrait(traits, 'resilient')).toBe(true);
  });

  it('returns true when trait is in negative', () => {
    const traits = { positive: [], negative: ['fearful'], hidden: [] };
    expect(hasTrait(traits, 'fearful')).toBe(true);
  });

  it('returns true when trait is in hidden', () => {
    const traits = { positive: [], negative: [], hidden: ['secret'] };
    expect(hasTrait(traits, 'secret')).toBe(true);
  });

  it('returns false when trait is absent', () => {
    expect(hasTrait(emptyTraits(), 'resilient')).toBe(false);
  });

  it('returns false for null traits', () => {
    expect(hasTrait(null, 'resilient')).toBe(false);
  });

  it('returns false for null traitName', () => {
    expect(hasTrait(emptyTraits(), null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getTraitCategory
// ---------------------------------------------------------------------------
describe('getTraitCategory', () => {
  it('returns "positive" for a positive trait', () => {
    const traits = { positive: ['resilient'], negative: [], hidden: [] };
    expect(getTraitCategory(traits, 'resilient')).toBe('positive');
  });

  it('returns "negative" for a negative trait', () => {
    const traits = { positive: [], negative: ['fearful'], hidden: [] };
    expect(getTraitCategory(traits, 'fearful')).toBe('negative');
  });

  it('returns "hidden" for a hidden trait', () => {
    const traits = { positive: [], negative: [], hidden: ['secret'] };
    expect(getTraitCategory(traits, 'secret')).toBe('hidden');
  });

  it('returns null when trait not found', () => {
    expect(getTraitCategory(emptyTraits(), 'nonexistent')).toBeNull();
  });

  it('returns null for null traits', () => {
    expect(getTraitCategory(null, 'resilient')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// moveTraitBetweenCategories
// ---------------------------------------------------------------------------
describe('moveTraitBetweenCategories', () => {
  it('moves trait from positive to negative', () => {
    const traits = { positive: ['resilient'], negative: [], hidden: [] };
    const result = moveTraitBetweenCategories(traits, 'resilient', 'positive', 'negative');
    expect(result.positive).not.toContain('resilient');
    expect(result.negative).toContain('resilient');
  });

  it('moves trait from hidden to positive', () => {
    const traits = { positive: [], negative: [], hidden: ['secret'] };
    const result = moveTraitBetweenCategories(traits, 'secret', 'hidden', 'positive');
    expect(result.positive).toContain('secret');
    expect(result.hidden).not.toContain('secret');
  });

  it('throws when missing any required param', () => {
    expect(() => moveTraitBetweenCategories(null, 'x', 'positive', 'negative')).toThrow();
  });

  it('throws for invalid fromCategory', () => {
    expect(() => moveTraitBetweenCategories(emptyTraits(), 'x', 'invalid', 'negative')).toThrow('Invalid category');
  });
});

// ---------------------------------------------------------------------------
// countTraits
// ---------------------------------------------------------------------------
describe('countTraits', () => {
  it('sums traits across all categories', () => {
    const traits = { positive: ['a', 'b'], negative: ['c'], hidden: ['d', 'e'] };
    expect(countTraits(traits)).toBe(5);
  });

  it('returns 0 for empty traits', () => {
    expect(countTraits(emptyTraits())).toBe(0);
  });

  it('returns 0 for null input', () => {
    expect(countTraits(null)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// countTraitsByCategory
// ---------------------------------------------------------------------------
describe('countTraitsByCategory', () => {
  it('counts traits in positive category', () => {
    const traits = { positive: ['a', 'b', 'c'], negative: [], hidden: [] };
    expect(countTraitsByCategory(traits, 'positive')).toBe(3);
  });

  it('returns 0 for empty category', () => {
    expect(countTraitsByCategory(emptyTraits(), 'negative')).toBe(0);
  });

  it('returns 0 for null traits', () => {
    expect(countTraitsByCategory(null, 'positive')).toBe(0);
  });

  it('returns 0 for invalid category (caught internally)', () => {
    expect(countTraitsByCategory(emptyTraits(), 'amazing')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// validateTraitStructure
// ---------------------------------------------------------------------------
describe('validateTraitStructure', () => {
  it('returns true for valid structure', () => {
    expect(validateTraitStructure({ positive: [], negative: [], hidden: [] })).toBe(true);
  });

  it('returns true when categories are undefined (optional)', () => {
    expect(validateTraitStructure({})).toBe(true);
  });

  it('returns false for null input', () => {
    expect(validateTraitStructure(null)).toBe(false);
  });

  it('returns false when a category is not an array', () => {
    expect(validateTraitStructure({ positive: 'not-an-array' })).toBe(false);
  });

  it('returns false for non-object input', () => {
    expect(validateTraitStructure('string')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Catch-block coverage via Proxy (lines 128-129, 179-182, 244-245, 295-298)
// ---------------------------------------------------------------------------

const throwingProxy = () =>
  new Proxy(
    {},
    {
      get(_, key) {
        if (typeof key === 'string') {
          throw new Error('proxy bomb');
        }
        return undefined;
      },
    },
  );

describe('_getAllTraits — catch block (lines 128-129)', () => {
  it('returns [] and does not throw when Proxy triggers property-access error', () => {
    const result = _getAllTraits(throwingProxy());
    expect(result).toEqual([]);
  });
});

describe('getTraitCategory — catch block (lines 179-182)', () => {
  it('returns null and does not throw when Proxy triggers property-access error', () => {
    const result = getTraitCategory(throwingProxy(), 'resilient');
    expect(result).toBeNull();
  });
});

describe('countTraits — catch block (lines 244-245)', () => {
  it('returns 0 and does not throw when Proxy triggers property-access error', () => {
    const result = countTraits(throwingProxy());
    expect(result).toBe(0);
  });
});

describe('validateTraitStructure — catch block (lines 295-298)', () => {
  it('returns false and does not throw when Proxy triggers property-access error', () => {
    const result = validateTraitStructure(throwingProxy());
    expect(result).toBe(false);
  });
});
