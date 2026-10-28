/**
 * Horses API client (Equoria-jog8w, Equoria-aodym slice 2).
 *
 * Owns the coat-color genetics/color response types (31E-4, Equoria-lsdb)
 * alongside the horsesApi surface that consumes them.
 */

import { apiClient } from '../http/apiClient.js';
import type { HorseListItemDto } from './horseList.js';
import type { HorseSummary, HorseTrainingAnalytics, HorseXP } from './types.js';

/**
 * 31E-4 — coat-color genetics & color response types (Equoria-lsdb).
 * Both endpoints return the canonical envelope { success, message, data } where
 * `data === null` for legacy horses that pre-date the color-genetics system.
 */
export type HorseGeneticsResponse =
  | {
      horseId: number;
      horseName: string;
      colorGeneticsTested: true;
      colorGenotype: Record<string, string>;
      phenotype: Record<string, unknown> | null;
    }
  | {
      // Owner ruling 2026-10-26 (q72): until the Vet's Genetic Testing is paid
      // for, the server sends no genotype at all.
      horseId: number;
      horseName: string;
      colorGeneticsTested: false;
    };

/**
 * GET /api/v1/horses/:id/breeding-data — the per-horse breeding summary. Only
 * the fields the frontend reads are named (Equoria-q4uem.12: the hook used to
 * cast the `unknown` this endpoint was declared to return).
 */
export interface HorseBreedingData {
  horseName: string;
  breedingQuality: string;
  traitSummary: {
    totalTraits: number;
    [key: string]: unknown;
  };
  temperamentInfluence?: {
    temperament?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * One offspring from GET /api/v1/horses/:id/offspring (Equoria-oey96.55): its id
 * and name only — a foal sold to another player exposes nothing more.
 */
export interface HorseOffspring {
  id: number;
  name: string;
}

/**
 * One line of GET /api/v1/horses/:id/discipline-scores (Equoria-a0fim): the
 * horse's score in a discipline (its three stats 50/30/20, its training there
 * and its saddle and bridle; no show-day modifiers) and that score's level.
 * `discipline` is the authored discipline name ('Show Jumping').
 */
export interface HorseDisciplineScore {
  discipline: string;
  score: number;
  level: number;
}

/** POST /api/v1/horses/:id/allocate-stat answer. */
export interface AllocateStatResult {
  statName: string;
  newStatValue: number;
  remainingStatPoints: number;
}

/** One page of GET /api/v1/horses (Equoria-6tda3): the envelope with its keyset pageInfo. */
interface HorseListPage {
  data?: HorseListItemDto[];
  pageInfo?: { nextCursor?: string | null; hasMore?: boolean };
}

export const horsesApi = {
  // NOTE (Equoria-6p398.2, 2026-09-05 audit Finding 2): there is deliberately
  // no `create` here. `POST /api/v1/horses` handed any authenticated player a
  // free horse and is now closed (403). Players acquire horses through the
  // Horse Trader (`marketplaceApi` store purchase), through breeding, or as
  // the starter horse registration grants them. Do not re-add a generic
  // create helper; it would only ever receive a 403.
  // NOTE (Equoria-9tque, owner ruling 2026-09-08): there is deliberately no
  // `delete` here either — "players are not allowed to delete horses".
  // `DELETE /api/v1/horses/:id` is closed (403) for every caller. A player parts
  // with a horse by listing it in the marketplace, never by destroying it. Do not
  // add a delete helper or a "remove from stable" affordance that calls one.
  /**
   * The whole stable (Equoria-6tda3). GET /api/v1/horses answers at most 200
   * horses a page with keyset `pageInfo` (Equoria-cmw85.19); this follows
   * `pageInfo.nextCursor` to the last page, so a stable of more than 200 horses
   * is read in full. A failed page fails the whole read: never a partial stable.
   */
  list: async (): Promise<HorseListItemDto[]> => {
    const horses: HorseListItemDto[] = [];
    const cursorsUsed = new Set<string>();
    let cursor: string | null = null;
    for (;;) {
      const query: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const page: HorseListPage | HorseListItemDto[] = await apiClient.getEnvelope<
        HorseListPage | HorseListItemDto[]
      >(`/api/v1/horses?t=${Date.now()}${query}`);
      if (Array.isArray(page)) {
        horses.push(...page);
        return horses;
      }
      horses.push(...(page.data ?? []));
      const next: string | null = page.pageInfo?.hasMore
        ? (page.pageInfo.nextCursor ?? null)
        : null;
      if (!next) {
        return horses;
      }
      // A repeated cursor would loop for ever: fail the read rather than show part of the stable.
      if (cursorsUsed.has(next)) {
        throw { message: 'The horse list repeated a page.', status: 'error', statusCode: 500 };
      }
      cursorsUsed.add(next);
      cursor = next;
    }
  },
  get: (horseId: number) =>
    apiClient.get<HorseSummary>(`/api/v1/horses/${horseId}?t=${Date.now()}`),
  getTrainingHistory: (horseId: number) =>
    apiClient.get<HorseTrainingAnalytics>(`/api/v1/horses/${horseId}/training-history`),
  getOffspring: (horseId: number) =>
    apiClient.get<HorseOffspring[]>(`/api/v1/horses/${horseId}/offspring`),
  getBreedingData: (horseId: number) =>
    apiClient.get<HorseBreedingData>(`/api/v1/horses/${horseId}/breeding-data`),
  getXP: (horseId: number) => apiClient.get<HorseXP>(`/api/v1/horses/${horseId}/xp`),
  getDisciplineScores: (horseId: number) =>
    apiClient.get<{ disciplines: HorseDisciplineScore[] }>(
      `/api/v1/horses/${horseId}/discipline-scores`
    ),
  /** Spend one earned stat allocation on `statName` (every 1,000 Horse Points earns one). */
  allocateStat: (horseId: number, statName: string) =>
    apiClient.post<AllocateStatResult>(`/api/v1/horses/${horseId}/allocate-stat`, { statName }),
  // NOTE (Equoria-4fnro, owner ruling 2026-09-14): there is deliberately no
  // `update` here any more. It existed to carry `{ name }` to PUT
  // /api/v1/horses/:id; renaming now has its own endpoint (`rename` below) and
  // the PUT route REFUSES any body containing `name`, which left this helper —
  // and the `useUpdateHorse` hook above it — with no caller. PUT /horses/:id
  // still accepts sex, gender, dateOfBirth, sireId and damId on the server; if a
  // surface ever needs one of those, add a helper for THAT, never one that takes
  // a name.
  /**
   * Rename a horse — the ONE way a player's chosen name reaches `horses.name`
   * after birth (Equoria-4fnro). PATCH /api/v1/horses/:id/name accepts exactly
   * `{ name }`, holds it to the shared name policy (1-40 characters, no `<`),
   * and answers `{ id, name }` with the name that was actually committed.
   */
  rename: (horseId: number, name: string) =>
    apiClient.patch<{ id: number; name: string }>(`/api/v1/horses/${horseId}/name`, { name }),
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
  // Equoria-876o — temperament reference definitions (all 12 types)
  getTemperamentDefinitions: () =>
    apiClient.get<{
      count: number;
      definitions: {
        name: string;
        description: string;
        prevalenceNote: string;
        bestGroomPersonalities: string[];
      }[];
    }>(`/api/v1/horses/temperament-definitions`),
  // Equoria-lsdb — 31E-4 coat-color genetics endpoint.
  // Returns null when the horse has no genotype data (legacy horse), not an
  // error. Consumers should branch on `data === null` to render fallback UI.
  getGenetics: (horseId: number | string) =>
    apiClient.get<HorseGeneticsResponse | null>(`/api/v1/horses/${horseId}/genetics`),
};
