/**
 * Trainer API client (Equoria-rfsml, Epic 13-5).
 *
 * Path registry:
 *   GET  /api/v1/trainers/user/:userId        → TrainerEntry[]
 *   GET  /api/v1/trainers/assignments         → TrainerAssignmentEntry[]
 *   GET  /api/v1/trainers/marketplace         → TrainerMarketplaceData
 *   POST /api/v1/trainers/marketplace/hire    → { success, data: { trainer, cost } }
 *   POST /api/v1/trainers/marketplace/refresh → TrainerMarketplaceData
 *   POST /api/v1/trainers/assignments         → { success }
 *   DELETE /api/v1/trainers/assignments/:id   → { success }
 *   DELETE /api/v1/trainers/:id/dismiss       → { success }
 *   GET  /api/v1/trainers/:id/discovery       → TrainerDiscoveryData
 */

import { apiClient } from '../http/apiClient.js';

export interface TrainerEntry {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  skillLevel: string; // novice | developing | expert
  personality: string; // focused | encouraging | technical | competitive | patient
  speciality: string;
  sessionRate: number;
  experience: number;
  level: number;
  careerWeeks: number;
  retired: boolean;
  bio?: string;
  assignedHorseId?: number | null;
}

export interface MarketplaceTrainer {
  marketplaceId: string;
  firstName: string;
  lastName: string;
  skillLevel: string;
  personality: string;
  speciality: string;
  sessionRate: number;
  bio: string;
  availability: boolean;
}

export interface TrainerMarketplaceData {
  trainers: MarketplaceTrainer[];
  lastRefresh: string;
  nextFreeRefresh: string;
  refreshCost: number;
  canRefreshFree: boolean;
}

export interface TrainerAssignmentEntry {
  id: number;
  trainerId: number;
  horseId: number;
  horseName: string;
  trainerName: string;
  startDate: string;
  isActive: boolean;
}

export type TrainerDiscoveryCategory =
  | 'discipline_specialization'
  | 'training_method'
  | 'horse_compatibility';

export interface TrainerDiscoveryTrait {
  id: string;
  label: string;
  description: string;
  icon: string;
  strength: 'mild' | 'moderate' | 'strong';
}

export interface TrainerDiscoverySlot {
  slotIndex: number;
  category: TrainerDiscoveryCategory;
  discovered: boolean;
  trait?: TrainerDiscoveryTrait;
}

export interface TrainerDiscoveryData {
  trainerId: number;
  totalSlots: number;
  discoveredCount: number;
  slots: TrainerDiscoverySlot[];
  nextDiscoveryAt?: number;
}

export const trainersApi = {
  getUserTrainers: (userId: string | number) =>
    apiClient.get<TrainerEntry[]>(`/api/v1/trainers/user/${userId}`),
  getAssignments: () => apiClient.get<TrainerAssignmentEntry[]>('/api/v1/trainers/assignments'),
  getMarketplace: () => apiClient.get<TrainerMarketplaceData>('/api/v1/trainers/marketplace'),
  hireTrainer: (marketplaceId: string) =>
    apiClient.post<{
      success: boolean;
      data: { trainer: TrainerEntry; cost: number; remainingMoney: number };
    }>('/api/v1/trainers/marketplace/hire', { marketplaceId }),
  refreshMarketplace: (force: boolean = false) =>
    apiClient.post<TrainerMarketplaceData>('/api/v1/trainers/marketplace/refresh', { force }),
  assignTrainer: (data: { trainerId: number; horseId: number; notes?: string }) =>
    apiClient.post<{ success: boolean }>('/api/v1/trainers/assignments', data),
  deleteAssignment: (assignmentId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/v1/trainers/assignments/${assignmentId}`),
  dismissTrainer: (trainerId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/v1/trainers/${trainerId}/dismiss`),
  getDiscovery: (trainerId: number) =>
    apiClient.get<TrainerDiscoveryData>(`/api/v1/trainers/${trainerId}/discovery`),
};
