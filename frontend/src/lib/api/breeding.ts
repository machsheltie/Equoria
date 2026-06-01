/**
 * Breeding / Foal API client (Equoria-jog8w, Equoria-aodym slice 2).
 *
 * normalizeFoalDevelopment + getFoalDevelopment/developFoal stay together
 * here: the normalizer is the shared contract the foal-development sentinel
 * (frontend/src/lib/__tests__/foalDevelopmentContract.test.ts, Equoria-n3yw6)
 * asserts on, and both breedingApi reads flow through it.
 *
 * Path registry:
 *   POST /api/v1/horses/foals                  → BreedResponse
 *   GET  /api/v1/foals/:foalId                  → Foal
 *   GET  /api/v1/foals/:foalId/development      → FoalDevelopment | null
 *   GET  /api/v1/foals/:foalId/activities       → FoalActivity[]
 *   POST /api/v1/foals/:foalId/activity         → FoalActivity
 *   POST /api/v1/foals/:foalId/enrich           → FoalActivity
 *   POST /api/v1/foals/:foalId/reveal-traits    → { traits }
 *   PUT  /api/v1/foals/:foalId/develop          → FoalDevelopment | null
 *   POST /api/v1/foals/:foalId/graduate         → graduation result
 */

import { apiClient } from '../http/apiClient.js';
import type {
  BreedRequest,
  BreedResponse,
  Foal,
  FoalActivity,
  FoalDevelopment,
  RawFoalDevelopmentBody,
} from './types.js';

/**
 * Flatten the GET /development envelope-body into the canonical flat
 * FoalDevelopment. Tolerates both the nested GET shape ({ development: {...} })
 * and the already-flat PUT /develop shape. Equoria-n3yw6.
 *
 * Returns `null` when the backend genuinely has no development data
 * (envelope `data: null` → no FoalDevelopment record). This preserves the
 * honest empty-state path in consumers that branch on `!development`; it does
 * NOT fabricate a zeroed record where none exists. When data IS present, any
 * individual missing sub-field falls back to a safe default.
 */
export function normalizeFoalDevelopment(
  raw: RawFoalDevelopmentBody | null | undefined
): FoalDevelopment | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const dev = raw.development ?? {};
  // Prefer the nested `development` block (GET shape); fall back to top-level
  // fields (PUT /develop returns a flat body).
  const currentDay = dev.currentDay ?? raw.currentDay ?? 0;
  const bondingLevel = dev.bondingLevel ?? raw.bondingLevel ?? 0;
  const stressLevel = dev.stressLevel ?? raw.stressLevel ?? 0;
  const completedActivities = dev.completedActivities ?? raw.completedActivities ?? {};
  const maxDay = dev.maxDay ?? raw.maxDay ?? 6;
  return {
    currentDay,
    maxDay,
    bondingLevel,
    stressLevel,
    completedActivities,
    enrichmentDay: dev.enrichmentDay,
    enrichmentWindowOpen: dev.enrichmentWindowOpen,
    availableEnrichmentActivities: raw.availableEnrichmentActivities ?? [],
  };
}

export const breedingApi = {
  breedFoal: (payload: BreedRequest) => {
    return apiClient.post<BreedResponse>('/api/v1/horses/foals', payload);
  },
  getFoal: (foalId: number) => {
    return apiClient.get<Foal>(`/api/v1/foals/${foalId}`);
  },
  getFoalDevelopment: async (foalId: number): Promise<FoalDevelopment | null> => {
    // Equoria-n3yw6: the backend nests development stats under
    // data.development; normalize the unwrapped envelope-body to the flat
    // FoalDevelopment contract the UI reads. Returns null when the backend
    // has no development record (envelope data: null) so consumers render
    // an honest empty state rather than a fabricated zeroed record.
    const raw = await apiClient.get<RawFoalDevelopmentBody | null>(
      `/api/v1/foals/${foalId}/development`
    );
    return normalizeFoalDevelopment(raw);
  },
  getFoalActivities: (foalId: number) => {
    return apiClient.get<FoalActivity[]>(`/api/v1/foals/${foalId}/activities`);
  },
  logFoalActivity: (foalId: number, activity: FoalActivity) => {
    return apiClient.post<FoalActivity>(`/api/v1/foals/${foalId}/activity`, activity);
  },
  enrichFoal: (foalId: number, activity: FoalActivity) => {
    return apiClient.post<FoalActivity>(`/api/v1/foals/${foalId}/enrich`, activity);
  },
  revealTraits: (foalId: number) => {
    return apiClient.post<{ traits: string[] }>(`/api/v1/foals/${foalId}/reveal-traits`);
  },
  developFoal: async (
    foalId: number,
    updates: Partial<FoalDevelopment>
  ): Promise<FoalDevelopment | null> => {
    // PUT /develop returns an already-flat body; normalize for shape parity
    // with getFoalDevelopment (Equoria-n3yw6).
    const raw = await apiClient.put<RawFoalDevelopmentBody | null>(
      `/api/v1/foals/${foalId}/develop`,
      updates
    );
    return normalizeFoalDevelopment(raw);
  },
  graduateFoal: (foalId: number) => {
    return apiClient.post<{
      horse: { id: number; name: string; breed: string };
      graduation: {
        clearedAssignments: number;
        bondScore: number;
        isFirstGraduation: boolean;
      };
    }>(`/api/v1/foals/${foalId}/graduate`);
  },
};
