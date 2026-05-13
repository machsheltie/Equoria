/**
 * ultraRareTraits — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  ULTRA_RARE_TRAITS,
  EXOTIC_TRAITS,
  getUltraRareTraitDefinition,
  getAllUltraRareTraits,
  getAllExoticTraits,
  isUltraRareOrExotic,
  getTraitRarityTier,
} from '../../../utils/ultraRareTraits.mjs';

// ---------------------------------------------------------------------------
// ULTRA_RARE_TRAITS constant
// ---------------------------------------------------------------------------
describe('ULTRA_RARE_TRAITS', () => {
  it('is a non-empty object', () => {
    expect(typeof ULTRA_RARE_TRAITS).toBe('object');
    expect(Object.keys(ULTRA_RARE_TRAITS).length).toBeGreaterThan(0);
  });

  it('includes phoenix-born', () => {
    expect(ULTRA_RARE_TRAITS['phoenix-born']).toBeDefined();
  });

  it('includes iron-willed', () => {
    expect(ULTRA_RARE_TRAITS['iron-willed']).toBeDefined();
  });

  it('includes stormtouched', () => {
    expect(ULTRA_RARE_TRAITS['stormtouched']).toBeDefined();
  });

  it('each entry has name, rarity, type, mechanicalEffects', () => {
    for (const [, trait] of Object.entries(ULTRA_RARE_TRAITS)) {
      expect(typeof trait.name).toBe('string');
      expect(typeof trait.rarity).toBe('string');
      expect(typeof trait.type).toBe('string');
      expect(typeof trait.mechanicalEffects).toBe('object');
    }
  });

  it('phoenix-born has stressDecayMultiplier in mechanicalEffects', () => {
    expect(ULTRA_RARE_TRAITS['phoenix-born'].mechanicalEffects.stressDecayMultiplier).toBeDefined();
    expect(ULTRA_RARE_TRAITS['phoenix-born'].mechanicalEffects.stressDecayMultiplier).toBeGreaterThan(1);
  });

  it('iron-willed has burnoutImmunity', () => {
    expect(ULTRA_RARE_TRAITS['iron-willed'].mechanicalEffects.burnoutImmunity).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EXOTIC_TRAITS constant
// ---------------------------------------------------------------------------
describe('EXOTIC_TRAITS', () => {
  it('is a non-empty object', () => {
    expect(typeof EXOTIC_TRAITS).toBe('object');
    expect(Object.keys(EXOTIC_TRAITS).length).toBeGreaterThan(0);
  });

  it('includes ghostwalker', () => {
    expect(EXOTIC_TRAITS['ghostwalker']).toBeDefined();
  });

  it('includes fey-kissed', () => {
    expect(EXOTIC_TRAITS['fey-kissed']).toBeDefined();
  });

  it('includes dreamtwin', () => {
    expect(EXOTIC_TRAITS['dreamtwin']).toBeDefined();
  });

  it('ghostwalker has stressImmunity', () => {
    expect(EXOTIC_TRAITS['ghostwalker'].mechanicalEffects.stressImmunity).toBe(true);
  });

  it('fey-kissed has allStatBonus', () => {
    expect(typeof EXOTIC_TRAITS['fey-kissed'].mechanicalEffects.allStatBonus).toBe('number');
    expect(EXOTIC_TRAITS['fey-kissed'].mechanicalEffects.allStatBonus).toBeGreaterThan(0);
  });

  it('each exotic entry has name and mechanicalEffects', () => {
    for (const [, trait] of Object.entries(EXOTIC_TRAITS)) {
      expect(typeof trait.name).toBe('string');
      expect(typeof trait.mechanicalEffects).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// getUltraRareTraitDefinition
// ---------------------------------------------------------------------------
describe('getUltraRareTraitDefinition', () => {
  it('returns definition for phoenix-born', () => {
    const def = getUltraRareTraitDefinition('phoenix-born');
    expect(def).not.toBeNull();
    expect(def.name).toBeDefined();
  });

  it('adds tier: ultra-rare for ultra-rare traits', () => {
    const def = getUltraRareTraitDefinition('phoenix-born');
    expect(def.tier).toBe('ultra-rare');
  });

  it('adds tier: exotic for exotic traits', () => {
    const def = getUltraRareTraitDefinition('ghostwalker');
    expect(def.tier).toBe('exotic');
  });

  it('returns null for completely unknown trait', () => {
    expect(getUltraRareTraitDefinition('telekinesis')).toBeNull();
  });

  it('normalizes trait name: uppercase letters lowercased', () => {
    const def = getUltraRareTraitDefinition('Phoenix-Born');
    expect(def).not.toBeNull();
    expect(def.tier).toBe('ultra-rare');
  });

  it('normalizes trait name: spaces become dashes', () => {
    const def = getUltraRareTraitDefinition('iron willed');
    expect(def).not.toBeNull();
  });

  it('returns definition for iron-willed', () => {
    const def = getUltraRareTraitDefinition('iron-willed');
    expect(def).not.toBeNull();
    expect(def.tier).toBe('ultra-rare');
  });

  it('returns definition for fey-kissed exotic', () => {
    const def = getUltraRareTraitDefinition('fey-kissed');
    expect(def).not.toBeNull();
    expect(def.tier).toBe('exotic');
  });
});

// ---------------------------------------------------------------------------
// getAllUltraRareTraits
// ---------------------------------------------------------------------------
describe('getAllUltraRareTraits', () => {
  it('returns the ULTRA_RARE_TRAITS object', () => {
    const result = getAllUltraRareTraits();
    expect(result).toEqual(ULTRA_RARE_TRAITS);
  });

  it('is a non-empty object', () => {
    expect(Object.keys(getAllUltraRareTraits()).length).toBeGreaterThan(0);
  });

  it('includes phoenix-born', () => {
    expect(getAllUltraRareTraits()['phoenix-born']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getAllExoticTraits
// ---------------------------------------------------------------------------
describe('getAllExoticTraits', () => {
  it('returns the EXOTIC_TRAITS object', () => {
    const result = getAllExoticTraits();
    expect(result).toEqual(EXOTIC_TRAITS);
  });

  it('is a non-empty object', () => {
    expect(Object.keys(getAllExoticTraits()).length).toBeGreaterThan(0);
  });

  it('includes ghostwalker', () => {
    expect(getAllExoticTraits()['ghostwalker']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// isUltraRareOrExotic
// ---------------------------------------------------------------------------
describe('isUltraRareOrExotic', () => {
  it('returns true for an ultra-rare trait (phoenix-born)', () => {
    expect(isUltraRareOrExotic('phoenix-born')).toBe(true);
  });

  it('returns true for an exotic trait (ghostwalker)', () => {
    expect(isUltraRareOrExotic('ghostwalker')).toBe(true);
  });

  it('returns true for iron-willed', () => {
    expect(isUltraRareOrExotic('iron-willed')).toBe(true);
  });

  it('returns false for an unknown trait', () => {
    expect(isUltraRareOrExotic('ordinary-trait')).toBe(false);
  });

  it('returns false for common traits like resilient', () => {
    expect(isUltraRareOrExotic('resilient')).toBe(false);
  });

  it('is case-insensitive via normalization', () => {
    expect(isUltraRareOrExotic('PHOENIX-BORN')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTraitRarityTier
// ---------------------------------------------------------------------------
describe('getTraitRarityTier', () => {
  it('returns ultra-rare for phoenix-born', () => {
    expect(getTraitRarityTier('phoenix-born')).toBe('ultra-rare');
  });

  it('returns exotic for ghostwalker', () => {
    expect(getTraitRarityTier('ghostwalker')).toBe('exotic');
  });

  it('returns exotic for fey-kissed', () => {
    expect(getTraitRarityTier('fey-kissed')).toBe('exotic');
  });

  it('returns null for unknown trait', () => {
    expect(getTraitRarityTier('telekinesis')).toBeNull();
  });

  it('returns null for common traits', () => {
    expect(getTraitRarityTier('resilient')).toBeNull();
  });

  it('handles normalization (iron willed → iron-willed)', () => {
    expect(getTraitRarityTier('iron willed')).toBe('ultra-rare');
  });
});
