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
// Equoria-oey96.6 — the talent-tree selection shape is defined once in the
// component types module (mirrors the backend groomTalentService). Reuse it so
// the api layer and the GroomTalentTree component agree on one contract.
import type { TalentSelections } from '../../types/groomTalent.js';

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
  // Equoria-oey96.6 — talent-tree read. Backend GET /grooms/:id/talents returns
  // { success, data: selections || 'none' }; apiClient unwraps `.data`, so this
  // resolves to EITHER the GroomTalentSelections row ({ id, groomId, tier1,
  // tier2, tier3 }) OR the literal string 'none' when the groom has no
  // selections yet. Normalise both to `TalentSelections | null` — the BACKEND
  // is the source of truth for what is selected (types/groomTalent constants
  // are display metadata only).
  getTalents: async (groomId: number): Promise<TalentSelections | null> => {
    const res = await apiClient.get<unknown>(`/api/v1/grooms/${groomId}/talents`);
    if (res === null || res === undefined || res === 'none' || typeof res !== 'object') {
      return null;
    }
    const row = res as { tier1?: string | null; tier2?: string | null; tier3?: string | null };
    return {
      tier1: row.tier1 ?? null,
      tier2: row.tier2 ?? null,
      tier3: row.tier3 ?? null,
    };
  },
  // Equoria-oey96.6 — talent-tree write. Backend POST /grooms/:id/talents/select
  // with { tier, talentId } returns { success, data: { success, selection,
  // talent }, message } on success (apiClient unwraps `.data`), or HTTP 400
  // { success:false, message } on an invalid selection — the transport layer
  // throws that message as an ApiError, so callers surface it (no silent
  // swallow). Field names (`tier`, `talentId`) match the route's
  // express-validator chain exactly.
  selectTalent: (groomId: number, body: { tier: 'tier1' | 'tier2' | 'tier3'; talentId: string }) =>
    apiClient.post<{
      success: boolean;
      selection: {
        id: number;
        groomId: number;
        tier1: string | null;
        tier2: string | null;
        tier3: string | null;
      };
      talent: { id: string; name: string; description: string; effect: Record<string, number> };
    }>(`/api/v1/grooms/${groomId}/talents/select`, body),
};
