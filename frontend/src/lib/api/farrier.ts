/**
 * Farrier API client (Equoria-rfsml; one weekly action since Equoria-zmqzf).
 *
 *   POST /api/v1/farrier/shoe-horse → FarrierShoeingResult
 */

import { apiClient } from '../http/apiClient.js';

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
  shoeHorse: (data: { horseId: number }) =>
    apiClient.post<FarrierShoeingResult>('/api/v1/farrier/shoe-horse', data),
};
