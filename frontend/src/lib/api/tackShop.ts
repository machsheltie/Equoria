/**
 * Tack Shop API client (Equoria-rfsml).
 *
 *   GET  /api/v1/tack-shop/inventory              → TackInventoryData
 *   POST /api/v1/tack-shop/purchase               → TackPurchaseResult
 *   POST /api/v1/tack-shop/unequip-decoration     → TackUnequipDecorationResult
 */

import { apiClient } from '../http/apiClient.js';

export interface TackItem {
  id: string;
  category:
    | 'saddle'
    | 'bridle'
    | 'halter'
    | 'saddlePad'
    | 'legWraps'
    | 'reins'
    | 'girth'
    | 'breastplate'
    | 'decorative';
  name: string;
  description: string;
  cost: number;
  /** What the item scores (saddles and bridles only); absent for Coming soon tack. */
  bonus?: string;
  /** True for tack that does not score yet (owner ruling 2026-10-23). */
  comingSoon?: boolean;
  /** Presence bonus for parade shows (decorative items only) */
  presenceBonus?: number;
  tier: 'basic' | 'quality' | 'premium';
  disciplines: string[];
  icon?: string;
  image?: string;
  ageRestriction?: number;
  /** True for decorative/cosmetic items that affect parade presentation only */
  isCosmetic?: boolean;
  /** Limited-use count (e.g. Glitter Spray has 3 applications) */
  limitedUse?: number;
  /** Seasonal tag for grouping under seasonal sub-header (e.g. 'winter', 'summer') */
  seasonalTag?: string;
}

export interface TackInventoryData {
  items: TackItem[];
  categories: Record<string, TackItem[]>;
  categoryDisplayNames?: Record<string, string>;
}

export interface TackPurchaseResult {
  item: TackItem;
  cost: number;
  remainingMoney: number;
}

export interface TackUnequipDecorationResult {
  horse: { id: number; name: string; tack: Record<string, unknown> };
  removedItemId: string;
}

export const tackShopApi = {
  getInventory: () => apiClient.get<TackInventoryData>('/api/v1/tack-shop/inventory'),
  /** Buying puts the tack in the player's inventory; equipping happens elsewhere. */
  purchaseItem: (data: { itemId: string }) =>
    apiClient.post<TackPurchaseResult>('/api/v1/tack-shop/purchase', data),
  unequipDecoration: (data: { horseId: number; itemId: string }) =>
    apiClient.post<TackUnequipDecorationResult>('/api/v1/tack-shop/unequip-decoration', data),
};
