import { describe, it, expect } from '@jest/globals';
import { CRAFTING_RECIPES, findRecipe } from '../data/craftingRecipes.mjs';

const REQUIRED_FIELDS = [
  'id',
  'name',
  'description',
  'tier',
  'cost',
  'materials',
  'result',
  'resultName',
  'resultCategory',
  'isCosmetic',
];
const MATERIAL_KEYS = ['leather', 'cloth', 'dye', 'metal', 'thread'];
const VALID_TIERS = [0, 1, 2, 3];
const VALID_CATEGORIES = ['saddle', 'bridle', 'halter', 'blanket', 'cosmetic'];

describe('CRAFTING_RECIPES', () => {
  it('is an array', () => {
    expect(Array.isArray(CRAFTING_RECIPES)).toBe(true);
  });

  // Owner ruling q05 (2026-10-23) deleted four of the eight recipes.
  it('contains at least 4 recipes', () => {
    expect(CRAFTING_RECIPES.length).toBeGreaterThanOrEqual(4);
  });

  // Owner ruling q32 (2026-10-23): only a saddle or bridle has effect text; any
  // other crafted item is marked comingSoon.
  it('only saddles and bridles carry a bonus; everything else is comingSoon', () => {
    for (const recipe of CRAFTING_RECIPES) {
      if (['saddle', 'bridle'].includes(recipe.resultCategory)) {
        expect(typeof recipe.bonus).toBe('string');
        expect(recipe.comingSoon).toBeUndefined();
      } else {
        expect(recipe).not.toHaveProperty('bonus');
        expect(recipe.comingSoon).toBe(true);
      }
    }
  });

  it('every recipe has all required fields', () => {
    for (const recipe of CRAFTING_RECIPES) {
      for (const field of REQUIRED_FIELDS) {
        expect(recipe).toHaveProperty(field);
      }
    }
  });

  it('every recipe id is a non-empty string', () => {
    for (const recipe of CRAFTING_RECIPES) {
      expect(typeof recipe.id).toBe('string');
      expect(recipe.id.length).toBeGreaterThan(0);
    }
  });

  it('all recipe ids are unique', () => {
    const ids = CRAFTING_RECIPES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all recipe tiers are in the valid set [0,1,2,3]', () => {
    for (const recipe of CRAFTING_RECIPES) {
      expect(VALID_TIERS).toContain(recipe.tier);
    }
  });

  it('all costs are positive numbers', () => {
    for (const recipe of CRAFTING_RECIPES) {
      expect(typeof recipe.cost).toBe('number');
      expect(recipe.cost).toBeGreaterThan(0);
    }
  });

  it('all material values are non-negative integers', () => {
    for (const recipe of CRAFTING_RECIPES) {
      for (const key of MATERIAL_KEYS) {
        const val = recipe.materials[key];
        expect(typeof val).toBe('number');
        expect(val).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(val)).toBe(true);
      }
    }
  });

  it('all resultCategory values are valid', () => {
    for (const recipe of CRAFTING_RECIPES) {
      expect(VALID_CATEGORIES).toContain(recipe.resultCategory);
    }
  });

  it('no recipe carries a numericBonus (Equoria-lsudd: numericBonus retired (owner decision A, 2026-10-23: the item in the slot decides the tack points).)', () => {
    expect(CRAFTING_RECIPES.length).toBeGreaterThan(0);
    for (const recipe of CRAFTING_RECIPES) {
      expect(recipe).not.toHaveProperty('numericBonus');
    }
  });

  it('tier-0 recipes are all cosmetic', () => {
    const tier0 = CRAFTING_RECIPES.filter(r => r.tier === 0);
    expect(tier0.length).toBeGreaterThan(0);
    for (const recipe of tier0) {
      expect(recipe.isCosmetic).toBe(true);
    }
  });

  it('all recipes have at least one material with quantity > 0', () => {
    for (const recipe of CRAFTING_RECIPES) {
      const totalMaterials = MATERIAL_KEYS.reduce((sum, k) => sum + recipe.materials[k], 0);
      expect(totalMaterials).toBeGreaterThan(0);
    }
  });
});

describe('findRecipe', () => {
  it('returns the correct recipe for a known id', () => {
    const recipe = findRecipe('basic-halter');
    expect(recipe).toBeDefined();
    expect(recipe.id).toBe('basic-halter');
    expect(recipe.name).toBe('Basic Halter');
  });

  it('returns undefined for an unknown id', () => {
    expect(findRecipe('nonexistent-id')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(findRecipe('')).toBeUndefined();
  });

  it('returns the correct tier-2 recipe (precision-bridle)', () => {
    const recipe = findRecipe('precision-bridle');
    expect(recipe).toBeDefined();
    expect(recipe.tier).toBe(2);
    expect(recipe.resultCategory).toBe('bridle');
  });

  it('findRecipe result is the same object as in CRAFTING_RECIPES', () => {
    const viaFind = findRecipe('basic-halter');
    const viaArray = CRAFTING_RECIPES.find(r => r.id === 'basic-halter');
    expect(viaFind).toBe(viaArray);
  });
});
