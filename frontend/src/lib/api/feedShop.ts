/**
 * Feed Shop + per-horse feed API client (Equoria-rfsml; feed-system redesign
 * 2026-04-29).
 *
 *   GET  /api/v1/feed-shop/catalog          → FeedItem[]   (5 tiers)
 *   POST /api/v1/feed-shop/purchase         → FeedPurchaseResult (bulk pack)
 *   POST /api/v1/horses/:id/feed            → FeedHorseResponse
 *   POST /api/v1/horses/:id/equip-feed      → set equippedFeedType
 *   POST /api/v1/horses/:id/unequip-feed    → clear equippedFeedType
 *   GET  /api/v1/horses/:id/equippable      → EquippableResponse (tack + feed)
 */

import { apiClient } from '../http/apiClient.js';
import type { InventoryItem } from './inventory.js';

/**
 * 5-tier FEED_CATALOG entry (feed-system redesign 2026-04-29).
 * Matches backend/modules/services/controllers/feedShopController.mjs FEED_CATALOG.
 */
export interface FeedItem {
  id: 'basic' | 'performance' | 'performancePlus' | 'highPerformance' | 'elite';
  name: string;
  description: string;
  packPrice: number;
  perUnit: number;
  statRollPct: number;
  pregnancyBonusPct: number;
}

/**
 * Bulk-pack purchase result. 100 units per pack; all packs of a tier
 * accumulate on the user's pooled inventory row (User.settings.inventory).
 */
export interface FeedPurchaseResult {
  remainingMoney: number;
  inventoryItem: {
    id: string;
    itemId: string;
    category: 'feed';
    name: string;
    quantity: number;
  };
}

/**
 * Per-horse feed action result (POST /api/v1/horses/:id/feed).
 * `skipped: 'retired'` means the horse is age >= 21 — no inventory mutation,
 * no stat boost. `equippedFeedClearedDueToEmpty` signals to the UI that the
 * horse's equipped tier was auto-cleared because inventory hit 0.
 */
export interface FeedHorseResponse {
  horse: {
    id: number;
    name: string;
    lastFedDate: string | null;
    equippedFeedType: string | null;
  };
  feed?: { tier: string; name: string };
  remainingUnits?: number;
  statBoost?: { stat: string; amount: number } | null;
  equippedFeedClearedDueToEmpty?: boolean;
  skipped?: 'retired';
}

/**
 * Equippable items for a horse (GET /api/v1/horses/:id/equippable).
 * Tack equipped to a different horse is excluded; feed of all 5 tiers in
 * the user's inventory with quantity > 0 is returned, each tagged with
 * `isCurrentlyEquippedToThisHorse`.
 */
export interface EquippableResponse {
  tack: InventoryItem[];
  feed: Array<{
    feedType: string;
    name: string;
    quantity: number;
    isCurrentlyEquippedToThisHorse: boolean;
  }>;
}

export const feedShopApi = {
  getCatalog: () => apiClient.get<FeedItem[]>('/api/v1/feed-shop/catalog'),
  purchase: (data: { feedTier: FeedItem['id']; packs: number }) =>
    apiClient.post<FeedPurchaseResult>('/api/v1/feed-shop/purchase', data),
};

export const horseFeedApi = {
  feed: (horseId: number) => apiClient.post<FeedHorseResponse>(`/api/v1/horses/${horseId}/feed`),
  equipFeed: (horseId: number, feedType: FeedItem['id']) =>
    apiClient.post<{ horseId: number; equippedFeedType: string }>(
      `/api/v1/horses/${horseId}/equip-feed`,
      { feedType }
    ),
  unequipFeed: (horseId: number) =>
    apiClient.post<{ horseId: number; equippedFeedType: null }>(
      `/api/v1/horses/${horseId}/unequip-feed`
    ),
  getEquippable: (horseId: number) =>
    apiClient.get<EquippableResponse>(`/api/v1/horses/${horseId}/equippable?t=${Date.now()}`),
};
