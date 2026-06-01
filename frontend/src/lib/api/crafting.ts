/**
 * Crafting System API client (Equoria-rfsml).
 *
 * Owns the crafting endpoint wrappers and their response types. Uses the
 * shared transport from ../http/apiClient.
 */

import { apiClient } from '../http/apiClient.js';

export interface CraftingMaterials {
  leather: number;
  cloth: number;
  dye: number;
  metal: number;
  thread: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  tier: number;
  cost: number;
  materials: CraftingMaterials;
  result: string;
  resultName: string;
  resultCategory: string;
  bonus: string;
  numericBonus: number;
  isCosmetic: boolean;
  locked: boolean;
  affordable: boolean;
  deficit?: string;
  lockReason?: string;
}

export interface CraftedItem {
  id: string;
  itemId: string;
  category: string;
  name: string;
  bonus: string;
  numericBonus: number;
  isCosmetic: boolean;
  quantity: number;
  origin: 'crafted';
  craftedAt: string;
  equippedToHorseId: number | null;
  equippedToHorseName: string | null;
}

export interface CraftResult {
  item: CraftedItem;
  remainingMaterials: CraftingMaterials;
  coinsSpent: number;
  newBalance: number;
}

export const craftingApi = {
  getMaterials: () =>
    apiClient.get<{ materials: CraftingMaterials; workshopTier: number }>(
      '/api/v1/crafting/materials'
    ),

  getRecipes: () =>
    apiClient.get<{ workshopTier: number; recipes: CraftingRecipe[] }>('/api/v1/crafting/recipes'),

  craftItem: (recipeId: string) =>
    apiClient.post<CraftResult>('/api/v1/crafting/craft', { recipeId }),
};
