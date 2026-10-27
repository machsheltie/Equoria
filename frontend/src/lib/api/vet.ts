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
  /** The base price; the health check's fee for a horse is on VetHorse.healthCheckFee. */
  cost: number;
  /** How the price varies, when it does (the health check). */
  costNote?: string;
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
  /** Vet health word: Excellent, Very Good, Good, Fair or Bad. */
  vetHealth: string;
  /** What a health check costs this horse (100 per level below Excellent); null at Excellent. */
  healthCheckFee: number | null;
}

export interface VetAppointmentResult {
  horse: {
    id: number;
    name: string;
    lastVettedDate: string | null;
    colorGeneticsTested: boolean;
    vetHealth?: string;
    feedHealth?: string;
    displayedHealth?: string;
  };
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
