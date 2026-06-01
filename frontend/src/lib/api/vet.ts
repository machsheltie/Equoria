/**
 * Vet Clinic API client (Equoria-rfsml).
 *
 *   GET  /api/v1/vet/services          → VetService[]
 *   POST /api/v1/vet/book-appointment  → VetAppointmentResult
 */

import { apiClient } from '../http/apiClient.js';

export interface VetService {
  id: string;
  name: string;
  description: string;
  duration: string;
  cost: number;
  healthOutcome: string | null;
}

export interface VetAppointmentResult {
  horse: { id: number; name: string; healthStatus: string | null; lastVettedDate: string | null };
  service: VetService;
  cost: number;
  remainingMoney: number;
}

export const vetApi = {
  getServices: () => apiClient.get<VetService[]>('/api/v1/vet/services'),
  bookAppointment: (data: { horseId: number; serviceId: string }) =>
    apiClient.post<{ success: boolean; data: VetAppointmentResult }>(
      '/api/v1/vet/book-appointment',
      data
    ),
};
