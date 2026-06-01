/**
 * Horses API client (Equoria-jog8w, Equoria-aodym slice 2).
 *
 * Owns the coat-color genetics/color response types (31E-4, Equoria-lsdb)
 * alongside the horsesApi surface that consumes them.
 */

import { apiClient } from '../http/apiClient.js';
import type {
  HorseAge,
  HorseProgression,
  HorseStats,
  HorseSummary,
  HorseTrainingAnalytics,
  HorseXP,
  HorseXPHistory,
  RecentGains,
  StatHistory,
} from './types.js';

/**
 * 31E-4 — coat-color genetics & color response types (Equoria-lsdb).
 * Both endpoints return the canonical envelope { success, message, data } where
 * `data === null` for legacy horses that pre-date the color-genetics system.
 */
export interface HorseGeneticsResponse {
  horseId: number;
  horseName: string;
  colorGenotype: Record<string, string>;
  phenotype: Record<string, unknown> | null;
}

export interface HorseColorResponse {
  horseId: number;
  horseName: string;
  colorName: string | null;
  shade: string | null;
  faceMarking: string | null;
  legMarkings: Record<string, string> | string[] | null;
  advancedMarkings: Record<string, unknown> | string[] | null;
  modifiers: Record<string, unknown> | null;
}

export const horsesApi = {
  create: (data: {
    name: string;
    breedId: number;
    sex?: 'Stallion' | 'Mare' | 'Colt' | 'Filly' | 'Rig';
    gender?: 'Stallion' | 'Mare' | 'Colt' | 'Filly' | 'Rig';
    age?: number;
  }) => apiClient.post<HorseSummary>('/api/v1/horses', data),
  list: () => apiClient.get<HorseSummary[]>(`/api/v1/horses?t=${Date.now()}`),
  get: (horseId: number) =>
    apiClient.get<HorseSummary>(`/api/v1/horses/${horseId}?t=${Date.now()}`),
  getTrainingHistory: (horseId: number) =>
    apiClient.get<HorseTrainingAnalytics>(`/api/v1/horses/${horseId}/training-history`),
  getBreedingData: (horseId: number) =>
    apiClient.get<unknown>(`/api/v1/horses/${horseId}/breeding-data`),
  getXP: (horseId: number) => apiClient.get<HorseXP>(`/api/v1/horses/${horseId}/xp`),
  getXPHistory: (horseId: number, options?: { limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<HorseXPHistory>(`/api/v1/horses/${horseId}/xp-history${queryString}`);
  },
  getAge: (horseId: number) => apiClient.get<HorseAge>(`/api/v1/horses/${horseId}/age`),
  getStats: (horseId: number) => apiClient.get<HorseStats>(`/api/v1/horses/${horseId}/stats`),
  getProgression: (horseId: number) =>
    apiClient.get<HorseProgression>(`/api/v1/horses/${horseId}/progression`),
  getStatHistory: (horseId: number, timeRange = '30d') =>
    apiClient.get<StatHistory>(`/api/v1/horses/${horseId}/stats/history?range=${timeRange}`),
  getRecentGains: (horseId: number, days = 30) =>
    apiClient.get<RecentGains>(`/api/v1/horses/${horseId}/gains/recent?days=${days}`),
  update: (horseId: number, data: { name?: string }) =>
    apiClient.put<HorseSummary>(`/api/v1/horses/${horseId}`, data),
  /** List a stallion at stud (Equoria-q072). POST /api/v1/horses/:id/stud-listing */
  listAtStud: (horseId: number, studFee: number) =>
    apiClient.post<{
      id: number;
      name: string;
      sex: string;
      studStatus: string;
      studFee: number;
    }>(`/api/v1/horses/${horseId}/stud-listing`, { studFee }),
  /** Unlist a stallion from stud (Equoria-q072). DELETE /api/v1/horses/:id/stud-listing */
  unlistAtStud: (horseId: number) =>
    apiClient.delete<{
      id: number;
      name: string;
      sex: string;
      studStatus: string;
      studFee: number;
    }>(`/api/v1/horses/${horseId}/stud-listing`),
  getConformation: (horseId: number | string) =>
    apiClient.get<{
      horseId: number;
      horseName: string;
      breedId: number;
      conformationScores: {
        head: number;
        neck: number;
        shoulders: number;
        back: number;
        hindquarters: number;
        legs: number;
        hooves: number;
        topline: number;
        overallConformation: number;
      };
    }>(`/api/v1/horses/${horseId}/conformation`),
  getBreedAverages: (breedId: number | string) =>
    apiClient.get<{
      breedId: string;
      breedName: string;
      averages: {
        head: number;
        neck: number;
        shoulders: number;
        back: number;
        hindquarters: number;
        legs: number;
        hooves: number;
        topline: number;
        overallConformation: number;
      };
    }>(`/api/v1/breeds/${breedId}/conformation-averages`),
  // Equoria-ac5y — per-region percentile ranking vs same-breed population
  getConformationAnalysis: (horseId: number | string) =>
    apiClient.get<{
      horseId: number;
      horseName: string;
      breedId: number;
      breedName: string;
      breedMeanAvailable: boolean;
      totalHorsesInBreed: number;
      analysis: Record<string, { score: number; breedMean: number | null; percentile: number }>;
      overallConformation: { score: number; breedMean: number | null; percentile: number };
    }>(`/api/v1/horses/${horseId}/conformation/analysis`),
  // Equoria-aa6b — gait scores endpoint
  getGaits: (horseId: number | string) =>
    apiClient.get<{
      horseId: number;
      horseName: string;
      breedId: number;
      gaitScores: {
        walk: number;
        trot: number;
        canter: number;
        gallop: number;
        gaiting: { name: string; score: number }[] | null;
      };
    } | null>(`/api/v1/horses/${horseId}/gaits`),
  // Equoria-876o — temperament reference definitions (all 11 types)
  getTemperamentDefinitions: () =>
    apiClient.get<{
      count: number;
      definitions: {
        name: string;
        description: string;
        prevalenceNote: string;
        trainingModifiers: { xpModifier: number; scoreModifier: number };
        competitionModifiers: { riddenModifier: number; conformationModifier: number };
        bestGroomPersonalities: string[];
      }[];
    }>(`/api/v1/horses/temperament-definitions`),
  // Equoria-lsdb — 31E-4 coat-color genetics endpoint.
  // Returns null when the horse has no genotype data (legacy horse), not an
  // error. Consumers should branch on `data === null` to render fallback UI.
  getGenetics: (horseId: number | string) =>
    apiClient.get<HorseGeneticsResponse | null>(`/api/v1/horses/${horseId}/genetics`),
  // Equoria-lsdb — 31E-4 player-facing coat-color endpoint.
  // Returns null when the horse has no phenotype data (legacy horse).
  getColor: (horseId: number | string) =>
    apiClient.get<HorseColorResponse | null>(`/api/v1/horses/${horseId}/color`),
};
