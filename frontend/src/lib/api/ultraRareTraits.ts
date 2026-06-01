/**
 * Ultra-rare / exotic trait API client (Equoria-rfsml, Equoria-gt6j).
 */

import { apiClient } from '../http/apiClient.js';

/**
 * Ultra-rare / exotic trait event for a horse (Equoria-gt6j).
 * Returned by GET /api/v1/ultra-rare-traits/horse/:horseId in `recentEvents`.
 */
export interface UltraRareTraitEvent {
  id: number;
  horseId: number;
  traitName: string;
  traitType?: string | null;
  revealMethod?: string | null;
  timestamp: string;
}

export interface HorseUltraRareTraitsResponse {
  horse: { id: number; name: string };
  traits: {
    ultraRare: Array<{ name: string; definition?: unknown }>;
    exotic: Array<{ name: string; definition?: unknown }>;
  };
  recentEvents: UltraRareTraitEvent[];
  totalTraits: number;
}

export const ultraRareTraitsApi = {
  getForHorse: (horseId: number) =>
    apiClient.get<HorseUltraRareTraitsResponse>(`/api/v1/ultra-rare-traits/horse/${horseId}`),
};
