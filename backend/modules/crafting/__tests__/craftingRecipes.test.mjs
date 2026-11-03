import { describe, it, expect } from '@jest/globals';
import { craftingRecipes, findRecipe } from '../data/craftingRecipes.mjs';

const requiredFields = [
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
const materialKeys = ['leather', 'cloth', 'dye', 'metal', 'thread'];
const validTiers = [0, 1, 2, 3];
const validCategories = ['saddle', 'bridle', 'halter', 'blanket', 'cosmetic'];

describe('craftingRecipes', () => {
  it('is an array', () => {
    expect(Array.isArray(craftingRecipes)).toBe(true);
  });

  // Owner ruling q05 (2026-10-23) deleted four of the eight recipes.
  it('contains at least 4 recipes', () => {
    expect(craftingRecipes.length).toBeGreaterThanOrEqual(4);
  });

  // Owner ruling q32 (2026-10-23): only a saddle or bridle has effect text; any
  // other crafted item is marked comingSoon.
  it('only saddles and bridles carry a bonus; everything else is comingSoon', () => {
    for (const recipe of craftingRecipes) {
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
    for (const recipe of craftingRecipes) {
      for (const field of requiredFields) {
        expect(recipe).toHaveProperty(field);
      }
    }
  });

  it('every recipe id is a non-empty string', () => {
    for (const recipe of craftingRecipes) {
      expect(typeof recipe.id).toBe('string');
      expect(recipe.id.length).toBeGreaterThan(0);
    }
  });

  it('all recipe ids are unique', () => {
    const ids = craftingRecipes.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all recipe tiers are in the valid set [0,1,2,3]', () => {
    for (const recipe of craftingRecipes) {
      expect(validTiers).toContain(recipe.tier);
    }
  });

  it('all costs are positive numbers', () => {
    for (const recipe of craftingRecipes) {
      expect(typeof recipe.cost).toBe('number');
      expect(recipe.cost).toBeGreaterThan(0);
    }
  });

  it('all material values are non-negative integers', () => {
    for (const recipe of craftingRecipes) {
      for (const key of materialKeys) {
        const val = recipe.materials[key];
        expect(typeof val).toBe('number');
        expect(val).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(val)).toBe(true);
      }
    }
  });

  it('all resultCategory values are valid', () => {
    for (const recipe of craftingRecipes) {
      expect(validCategories).toContain(recipe.resultCategory);
    }
  });

  it('no recipe carries a numericBonus (Equoria-lsudd: numericBonus retired (owner decision A, 2026-10-23: the item in the slot decides the tack points).)', () => {
    expect(craftingRecipes.length).toBeGreaterThan(0);
    for (const recipe of craftingRecipes) {
      expect(recipe).not.toHaveProperty('numericBonus');
    }
  });

  it('tier-0 recipes are all cosmetic', () => {
    const tier0 = craftingRecipes.filter(r => r.tier === 0);
    expect(tier0.length).toBeGreaterThan(0);
    for (const recipe of tier0) {
      expect(recipe.isCosmetic).toBe(true);
    }
  });

  it('all recipes have at least one material with quantity > 0', () => {
    for (const recipe of craftingRecipes) {
      const totalMaterials = materialKeys.reduce((sum, k) => sum + recipe.materials[k], 0);
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

  it('findRecipe result is the same object as in craftingRecipes', () => {
    const viaFind = findRecipe('basic-halter');
    const viaArray = craftingRecipes.find(r => r.id === 'basic-halter');
    expect(viaFind).toBe(viaArray);
  });
});
