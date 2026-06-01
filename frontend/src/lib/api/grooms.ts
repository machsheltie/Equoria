/**
 * Groom API client (Equoria-jog8w, Equoria-aodym slice 2).
 *
 * Path registry:
 *   GET    /api/v1/grooms/user/:userId                       → Groom[]
 *   GET    /api/v1/groom-assignments                          → GroomAssignment[]
 *   GET    /api/v1/groom-salaries/summary                     → SalarySummary
 *   GET    /api/v1/groom-marketplace                          → MarketplaceData
 *   GET    /api/v1/groom-marketplace/stats                    → MarketplaceStats
 *   POST   /api/v1/groom-marketplace/hire                     → hire result
 *   POST   /api/v1/groom-marketplace/refresh                  → MarketplaceData
 *   POST   /api/v1/groom-assignments                          → { success }
 *   DELETE /api/v1/groom-assignments/:id                      → { success }
 *   GET    /api/v1/grooms/:groomId/horses/:horseId/synergy    → synergy preview
 *   GET    /api/v1/grooms/:groomId/profile                    → { success, groom }
 *   GET    /api/v1/grooms/:groomId/assignment-logs            → { success, logs }
 */

import { apiClient } from '../http/apiClient.js';
import type {
  Groom,
  GroomAssignment,
  GroomAssignmentLogEntry,
  GroomProfile,
  MarketplaceData,
  MarketplaceStats,
  SalarySummary,
} from './types.js';

export const groomsApi = {
  getUserGrooms: (userId: string | number) =>
    apiClient.get<Groom[]>(`/api/v1/grooms/user/${userId}`),
  getAssignments: () => apiClient.get<GroomAssignment[]>('/api/v1/groom-assignments'),
  getSalarySummary: () => apiClient.get<SalarySummary>('/api/v1/groom-salaries/summary'),
  getMarketplace: () => apiClient.get<MarketplaceData>('/api/v1/groom-marketplace'),
  getMarketplaceStats: () => apiClient.get<MarketplaceStats>('/api/v1/groom-marketplace/stats'),
  hireGroom: (marketplaceId: string) =>
    apiClient.post<{
      success: boolean;
      data: { groom: Groom; cost: number; remainingMoney: number };
    }>('/api/v1/groom-marketplace/hire', { marketplaceId }),
  refreshMarketplace: (force: boolean = false) =>
    apiClient.post<MarketplaceData>('/api/v1/groom-marketplace/refresh', { force }),
  assignGroom: (data: {
    groomId: number;
    horseId: number;
    priority: number;
    notes?: string;
    replacePrimary?: boolean;
  }) => apiClient.post<{ success: boolean }>('/api/v1/groom-assignments', data),
  deleteAssignment: (assignmentId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/v1/groom-assignments/${assignmentId}`),
  // Equoria-w1vq — temperament x personality synergy preview for a groom/horse pair
  getSynergy: (groomId: number, horseId: number) =>
    apiClient.get<{
      synergyModifier: number;
      temperament: string | null;
      personality: string | null;
      message: string;
    }>(`/api/v1/grooms/${groomId}/horses/${horseId}/synergy`),
  // Equoria-cbkw — backend returns { success, groom: profile }; no .data key
  // so apiClient.get returns the whole body. Caller reads `.groom`.
  getProfile: (groomId: number) =>
    apiClient.get<{ success: boolean; groom: GroomProfile }>(`/api/v1/grooms/${groomId}/profile`),
  // Equoria-cbkw — backend returns { success, logs }; no .data key.
  getAssignmentLogs: (groomId: number) =>
    apiClient.get<{ success: boolean; logs: GroomAssignmentLogEntry[] }>(
      `/api/v1/grooms/${groomId}/assignment-logs`
    ),
};
