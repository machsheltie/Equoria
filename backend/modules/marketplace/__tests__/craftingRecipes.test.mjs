import { describe, it, expect } from '@jest/globals';
import { CRAFTING_RECIPES, findRecipe } from '../../../modules/crafting/index.mjs';

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
  'bonus',
  'numericBonus',
  'isCosmetic',
];
const MATERIAL_KEYS = ['leather', 'cloth', 'dye', 'metal', 'thread'];
const VALID_TIERS = [0, 1, 2, 3];
const VALID_CATEGORIES = ['saddle', 'bridle', 'halter', 'blanket', 'cosmetic'];

describe('CRAFTING_RECIPES', () => {
  it('is an array', () => {
    expect(Array.isArray(CRAFTING_RECIPES)).toBe(true);
  });

  it('contains at least 8 recipes', () => {
    expect(CRAFTING_RECIPES.length).toBeGreaterThanOrEqual(8);
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

  it('cosmetic recipes have numericBonus === 0', () => {
    const cosmetics = CRAFTING_RECIPES.filter(r => r.isCosmetic);
    expect(cosmetics.length).toBeGreaterThan(0);
    for (const recipe of cosmetics) {
      expect(recipe.numericBonus).toBe(0);
    }
  });

  it('non-cosmetic recipes have numericBonus > 0', () => {
    const functional = CRAFTING_RECIPES.filter(r => !r.isCosmetic);
    expect(functional.length).toBeGreaterThan(0);
    for (const recipe of functional) {
      expect(recipe.numericBonus).toBeGreaterThan(0);
    }
  });

  it('tier-0 recipes are all cosmetic', () => {
    const tier0 = CRAFTING_RECIPES.filter(r => r.tier === 0);
    expect(tier0.length).toBeGreaterThan(0);
    for (const recipe of tier0) {
      expect(recipe.isCosmetic).toBe(true);
    }
  });

  it('includes simple-bridle (tier 0, cosmetic, cost 100)', () => {
    const recipe = CRAFTING_RECIPES.find(r => r.id === 'simple-bridle');
    expect(recipe).toBeDefined();
    expect(recipe.tier).toBe(0);
    expect(recipe.isCosmetic).toBe(true);
    expect(recipe.cost).toBe(100);
    expect(recipe.resultCategory).toBe('bridle');
  });

  it('includes legacy-tack-set (tier 3, non-cosmetic)', () => {
    const recipe = CRAFTING_RECIPES.find(r => r.id === 'legacy-tack-set');
    expect(recipe).toBeDefined();
    expect(recipe.tier).toBe(3);
    expect(recipe.isCosmetic).toBe(false);
    expect(recipe.numericBonus).toBeGreaterThan(0);
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
    const recipe = findRecipe('simple-bridle');
    expect(recipe).toBeDefined();
    expect(recipe.id).toBe('simple-bridle');
    expect(recipe.name).toBe('Simple Bridle');
  });

  it('returns undefined for an unknown id', () => {
    expect(findRecipe('nonexistent-id')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(findRecipe('')).toBeUndefined();
  });

  it('returns the correct tier-1 recipe (dyed-bridle)', () => {
    const recipe = findRecipe('dyed-bridle');
    expect(recipe).toBeDefined();
    expect(recipe.tier).toBe(1);
    expect(recipe.isCosmetic).toBe(false);
    expect(recipe.numericBonus).toBe(1);
  });

  it('returns the correct tier-2 recipe (precision-bridle)', () => {
    const recipe = findRecipe('precision-bridle');
    expect(recipe).toBeDefined();
    expect(recipe.tier).toBe(2);
    expect(recipe.numericBonus).toBe(2);
    expect(recipe.resultCategory).toBe('bridle');
  });

  it('returns the legacy-tack-set recipe', () => {
    const recipe = findRecipe('legacy-tack-set');
    expect(recipe).toBeDefined();
    expect(recipe.tier).toBe(3);
    expect(recipe.cost).toBe(1000);
  });

  it('returns the event-saddle recipe with agility bonus', () => {
    const recipe = findRecipe('event-saddle');
    expect(recipe).toBeDefined();
    expect(recipe.resultCategory).toBe('saddle');
    expect(recipe.tier).toBe(2);
    expect(recipe.materials.leather).toBe(2);
  });

  it('findRecipe result is the same object as in CRAFTING_RECIPES', () => {
    const viaFind = findRecipe('basic-halter');
    const viaArray = CRAFTING_RECIPES.find(r => r.id === 'basic-halter');
    expect(viaFind).toBe(viaArray);
  });
});
