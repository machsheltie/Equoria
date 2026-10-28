/**
 * Daily groom care (Equoria-j765w.2; owner ruling q67, 2026-10-26).
 *
 * The player presses "Groom horse" once per Eastern game day; for a foal under
 * 3 she first picks one of today's activities. Contract: the care agent's
 * GET /api/v1/grooms/care/:horseId, POST /api/v1/grooms/care/:horseId/groom
 * and GET /api/v1/grooms/care/ungroomed-today (v1, 2026-10-26).
 *
 * Every `label` and `refusal.message` is authored text from the server and may
 * be shown. `id` / `code` values are for logic only and are never shown
 * (owner ruling 2026-10-23: players never see code names).
 */

import { apiClient } from '@/lib/api-client';

export interface CareChoice {
  id: string;
  label: string;
}

export type CareRefusalCode = 'alreadyGroomedToday' | 'noGroomAssigned' | 'groomCannotWork';

export interface CareStatus {
  horseId: number;
  horseName: string;
  bond: number;
  lastGroomedAt: string | null;
  groomedToday: boolean;
  canGroomToday: boolean;
  refusal: { code: CareRefusalCode; message: string } | null;
  /** starLevel: Equoria-nawn5, the groom's star level. */
  groom: { id: number; name: string; starLevel?: string } | null;
  foal: {
    day: number;
    band: { id: string; label: string; firstDay: number; lastDay: number };
    activities: CareChoice[];
    todaysActivity: CareChoice | null;
  } | null;
}

export interface UngroomedHorse {
  horseId: number;
  horseName: string;
  isFoal: boolean;
  canGroomToday: boolean;
}

export function fetchCareStatus(horseId: number): Promise<CareStatus> {
  return apiClient.get<CareStatus>(`/api/v1/grooms/care/${horseId}`);
}

/** Groom the horse. `activity` is required for a foal and refused for an adult. */
export function groomHorse(horseId: number, activity?: string): Promise<CareStatus> {
  return apiClient.post<CareStatus>(
    `/api/v1/grooms/care/${horseId}/groom`,
    activity ? { activity } : {}
  );
}

export async function fetchUngroomedToday(): Promise<UngroomedHorse[]> {
  const data = await apiClient.get<{ horses?: UngroomedHorse[] }>(
    '/api/v1/grooms/care/ungroomed-today'
  );
  return data.horses ?? [];
}
