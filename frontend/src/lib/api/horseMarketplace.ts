/**
 * Horse Marketplace API client (Equoria-jog8w, Equoria-aodym slice 2, Epic 21).
 *
 * Path registry:
 *   GET    /api/v1/marketplace/search     → all-horses search (for sale and/or at stud)
 *   GET    /api/v1/marketplace/colors     → every coat color in the game (color dropdown)
 *   POST   /api/v1/marketplace/list       → list horse for sale
 *   DELETE /api/v1/marketplace/list/:id   → delist horse
 *   POST   /api/v1/marketplace/buy/:id    → purchase horse
 *   GET    /api/v1/marketplace/my-listings → seller's active listings
 *   GET    /api/v1/marketplace/history     → sale history
 *   POST   /api/v1/marketplace/store/buy  → buy store horse (Horse Trader)
 */

import { apiClient } from '../http/apiClient.js';
import type { HorseSummary } from './types.js';

export interface MarketplaceListing {
  id: number;
  name: string;
  breed: string;
  age: number | null;
  sex: string;
  salePrice: number;
  seller: string;
  stats: {
    speed: number;
    stamina: number;
    agility: number;
    precision: number;
    strength: number;
    intelligence: number;
    boldness: number;
  };
  imageUrl: string | null;
}

export interface MarketplacePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** One horse in the all-horses search: for sale, at stud, or both (Equoria-q4uem.9.1). */
export interface MarketplaceSearchHorse {
  id: number;
  name: string;
  breed: string;
  age: number | null;
  sex: string;
  color: string | null;
  owner: { username: string };
  stats: MarketplaceListing['stats'];
  /** Revealed traits only; the server never sends a hidden one. */
  revealedTraits: { positive: string[]; negative: string[] };
  imageUrl: string | null;
  sale: { price: number } | null;
  stud: { mode: 'public' | 'private'; fee: number } | null;
}

export interface MarketplaceSearchResult {
  horses: MarketplaceSearchHorse[];
  pagination: MarketplacePagination;
}

export interface MarketplaceSearchFilters {
  /** At least one of forSale / atStud must be true. */
  forSale: boolean;
  atStud: boolean;
  name?: string;
  breedId?: number;
  /** 'Mare' | 'Stallion' (the server matches the whole sex group). */
  sex?: string;
  color?: string;
  minAge?: number;
  maxAge?: number;
  minPrice?: number;
  maxPrice?: number;
  minStudFee?: number;
  maxStudFee?: number;
  studMode?: 'public' | 'private';
  sort?: 'priceAsc' | 'priceDesc' | 'newest' | 'youngest';
  page?: number;
}

export interface MyListing {
  id: number;
  name: string;
  breed: string;
  age: number | null;
  sex: string;
  salePrice: number;
  imageUrl: string | null;
}

export interface SaleHistoryEntry {
  id: number;
  horseName: string;
  salePrice: number;
  soldAt: string;
  type: 'sold' | 'bought';
  counterparty: string;
}

export interface BuyHorseResult {
  horseName: string;
  salePrice: number;
  sellerUsername: string;
  saleId: number;
  newBalance: number;
}

export const horseMarketplaceApi = {
  search: (filters: MarketplaceSearchFilters) => {
    const params = new URLSearchParams();
    params.set('forSale', String(filters.forSale));
    params.set('atStud', String(filters.atStud));
    const optional: Array<[string, string | number | undefined]> = [
      ['name', filters.name],
      ['breedId', filters.breedId],
      ['sex', filters.sex],
      ['color', filters.color],
      ['minAge', filters.minAge],
      ['maxAge', filters.maxAge],
      ['minPrice', filters.minPrice],
      ['maxPrice', filters.maxPrice],
      ['minStudFee', filters.minStudFee],
      ['maxStudFee', filters.maxStudFee],
      ['studMode', filters.studMode],
      ['sort', filters.sort],
      ['page', filters.page],
    ];
    for (const [key, value] of optional) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    return apiClient.get<MarketplaceSearchResult>(
      `/api/v1/marketplace/search?${params.toString()}`
    );
  },
  /** Every coat color in the game, alphabetical (Equoria-merxy). */
  coatColors: () => apiClient.get<string[]>('/api/v1/marketplace/colors'),
  listHorse: (data: { horseId: number; price: number }) =>
    apiClient.post<{ horseId: number; salePrice: number }>('/api/v1/marketplace/list', data),
  delistHorse: (horseId: number) => apiClient.delete<void>(`/api/v1/marketplace/list/${horseId}`),
  buyHorse: (horseId: number) =>
    apiClient.post<BuyHorseResult>(`/api/v1/marketplace/buy/${horseId}`, {}),
  myListings: () => apiClient.get<MyListing[]>('/api/v1/marketplace/my-listings'),
  saleHistory: () => apiClient.get<SaleHistoryEntry[]>('/api/v1/marketplace/history'),
  buyStoreHorse: (breedId: number, sex: 'Mare' | 'Stallion') =>
    apiClient.post<{ horse: HorseSummary; pricePaid: number; newBalance: number }>(
      '/api/v1/marketplace/store/buy',
      { breedId, sex }
    ),
};
