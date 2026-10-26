/**
 * Vet Clinic API client (Equoria-rfsml; two services since Equoria-7dmzp).
 *
 *   GET  /api/v1/vet/services          -> VetService[]
 *   GET  /api/v1/vet/horses            -> VetHorse[]  (horses under 21, with vetted / tested state)
 *   POST /api/v1/vet/book-appointment  -> VetAppointmentResult
 */

import { apiClient } from '../http/apiClient.js';

export interface VetService {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** The verb on the service's button, e.g. "Vet Horse". */
  actionLabel: string;
}

/** A horse the vet may see: retired horses (21+) are never listed. */
export interface VetHorse {
  id: number;
  name: string;
  /** Vet health is still Excellent: another health check would change nothing. */
  vetted: boolean;
  /** The colour genetics panel has already been run. */
  geneticsTested: boolean;
}

export interface VetAppointmentResult {
  horse: { id: number; name: string; lastVettedDate: string | null; colorGeneticsTested: boolean };
  service: VetService;
  cost: number;
  remainingMoney: number;
}

export const vetApi = {
  getServices: () => apiClient.get<VetService[]>('/api/v1/vet/services'),
  getHorses: () => apiClient.get<VetHorse[]>('/api/v1/vet/horses'),
  bookAppointment: (data: { horseId: number; serviceId: string }) =>
    apiClient.post<VetAppointmentResult>('/api/v1/vet/book-appointment', data),
};
