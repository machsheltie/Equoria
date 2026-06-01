/**
 * Farrier API client (Equoria-rfsml).
 *
 *   GET  /api/v1/farrier/services     → FarrierService[]
 *   POST /api/v1/farrier/book-service → FarrierBookingResult
 */

import { apiClient } from '../http/apiClient.js';

export interface FarrierService {
  id: string;
  name: string;
  description: string;
  duration: string;
  cost: number;
  hoofConditionOutcome: string;
  includesShoing: boolean;
  icon?: string;
}

export interface FarrierBookingResult {
  horse: {
    id: number;
    name: string;
    hoofCondition: string | null;
    lastFarrierDate: string | null;
    lastShod: string | null;
  };
  service: FarrierService;
  cost: number;
  remainingMoney: number;
}

export const farrierApi = {
  getServices: () => apiClient.get<FarrierService[]>('/api/v1/farrier/services'),
  bookService: (data: { horseId: number; serviceId: string }) =>
    apiClient.post<{ success: boolean; data: FarrierBookingResult }>(
      '/api/v1/farrier/book-service',
      data
    ),
};
