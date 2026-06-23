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
  // Equoria-j2a51: the real backend returns { success, grooms: [...], ... }
  // (NO top-level `data` key, so apiClient hands back the whole envelope, not
  // the array) and each row's specialty field is the British-spelled
  // `speciality` (Prisma) — the frontend Groom type uses `specialty`. Extract
  // the array and normalise the field here so the dashboard renders real grooms
  // instead of crashing (finalGrooms.filter / formatSpecialty(undefined)).
  getUserGrooms: async (userId: string | number): Promise<Groom[]> => {
    const res = await apiClient.get<unknown>(`/api/v1/grooms/user/${userId}`);
    const list: unknown[] = Array.isArray(res)
      ? res
      : ((res as { grooms?: unknown[] } | null | undefined)?.grooms ?? []);
    return list.map((g) => {
      const row = g as Record<string, unknown>;
      return { ...row, specialty: (row.specialty ?? row.speciality ?? '') as string } as Groom;
    });
  },
  // Equoria-j2a51: GET /groom-assignments returns { data: { assignments: [...] } };
  // apiClient unwraps .data → { assignments, ... }, so extract the array here.
  getAssignments: async (): Promise<GroomAssignment[]> => {
    const res = await apiClient.get<unknown>('/api/v1/groom-assignments');
    return Array.isArray(res)
      ? (res as GroomAssignment[])
      : ((res as { assignments?: GroomAssignment[] } | null | undefined)?.assignments ?? []);
  },
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
