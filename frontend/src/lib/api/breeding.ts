/**
 * Breeding / Foal API client (Equoria-jog8w, Equoria-aodym slice 2).
 *
 * normalizeFoalDevelopment + getFoalDevelopment stay together here: the
 * normalizer is the shared contract the foal-development sentinel
 * (frontend/src/lib/__tests__/foalDevelopmentContract.test.ts, Equoria-n3yw6)
 * asserts on. There is no client call that sets or advances a foal's
 * development day (Equoria-mwjst): only the nightly job moves it.
 *
 * Path registry:
 *   POST /api/v1/horses/foals                  → BreedResponse
 *   GET  /api/v1/foals/:foalId                  → Foal
 *   GET  /api/v1/foals/:foalId/development      → FoalDevelopment | null
 *   GET  /api/v1/foals/:foalId/activities       → FoalActivity[]
 *
 * No player-run enrichment, activity or graduation calls (Equoria-fr2kg;
 * owner ruling 2026-10-14/15: foal enrichment is the groom's job), and no
 * trait reveal call (Equoria-gu8jk; owner ruling 2026-10-20: players never
 * reveal traits).
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
  const maxDay = dev.maxDay ?? raw.maxDay ?? 6;
  return {
    currentDay,
    maxDay,
    bondingLevel,
    stressLevel,
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
};
