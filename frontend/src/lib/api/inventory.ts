/**
 * Inventory API client (Equoria-rfsml).
 *
 *   GET  /api/v1/inventory         → InventoryData   (fetchWithAuth unwraps data.data)
 *   POST /api/v1/inventory/equip   → EquipResult
 *   POST /api/v1/inventory/unequip → UnequipResult
 */

import { apiClient } from '../http/apiClient.js';

export interface InventoryItem {
  id: string;
  itemId: string;
  category: 'saddle' | 'bridle' | 'feed';
  name: string;
  bonus?: string;
  quantity: number;
  equippedToHorseId?: number | null;
  equippedToHorseName?: string | null;
}

export interface InventoryData {
  items: InventoryItem[];
  total: number;
}

export interface EquipResult {
  items: InventoryItem[];
  equippedItem: InventoryItem;
}

export interface UnequipResult {
  items: InventoryItem[];
  unequippedItem: InventoryItem;
}

export const inventoryApi = {
  getInventory: () => apiClient.get<InventoryData>('/api/v1/inventory'),
  equipItem: (vars: { inventoryItemId: string; horseId: number }) =>
    apiClient.post<EquipResult>('/api/v1/inventory/equip', vars),
  unequipItem: (vars: { inventoryItemId: string }) =>
    apiClient.post<UnequipResult>('/api/v1/inventory/unequip', vars),
};
