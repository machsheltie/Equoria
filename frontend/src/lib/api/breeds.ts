/**
 * Breeds API client (Equoria-jog8w, Equoria-aodym slice 2).
 *
 * Path registry:
 *   GET /api/v1/breeds → Breed[]  (all breeds in the DB catalog, sorted A–Z)
 */

import { apiClient } from '../http/apiClient.js';

export interface Breed {
  id: number;
  name: string;
  description?: string;
}

/**
 * Breeds API surface
 *   GET /api/v1/breeds → Breed[]  (all breeds in the DB catalog, sorted A–Z)
 */
export const breedsApi = {
  list: () => apiClient.get<Breed[]>('/api/v1/breeds'),
};
