/**
 * Farrier API client (Equoria-rfsml; one weekly action since Equoria-zmqzf;
 * shoe types are data since Equoria-zz14s).
 *
 *   GET  /api/v1/farrier/shoe-types -> FarrierService[]
 *   GET  /api/v1/farrier/horses     -> FarrierHorse[]  (horses under 21, with shod state)
 *   POST /api/v1/farrier/shoe-horse -> FarrierShoeingResult
 */

import { apiClient } from '../http/apiClient.js';

export interface FarrierService {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** The verb on the service's button, e.g. "Shoe Horse". */
  actionLabel: string;
}

/** A horse the farrier may see: retired horses (21+) are never listed. */
export interface FarrierHorse {
  id: number;
  name: string;
  /** Shod within the week: not shoeable again yet. */
  shod: boolean;
}

export interface FarrierShoeingResult {
  horse: {
    id: number;
    name: string;
    lastShod: string | null;
  };
  /** The stat that gained +1 from this shoeing (for now). */
  statGained: string;
  cost: number;
  remainingMoney: number;
}

export const farrierApi = {
  getServices: () => apiClient.get<FarrierService[]>('/api/v1/farrier/shoe-types'),
  getHorses: () => apiClient.get<FarrierHorse[]>('/api/v1/farrier/horses'),
  shoeHorse: (data: { horseId: number; serviceId: string }) =>
    apiClient.post<FarrierShoeingResult>('/api/v1/farrier/shoe-horse', data),
};
