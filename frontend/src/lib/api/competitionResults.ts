/**
 * Competition Results API Functions
 *
 * Provides API functions for the competition results system:
 * - Fetching full competition results with rankings
 * - Fetching horse competition history and statistics
 * - Fetching user-wide competition statistics
 *
 * Uses the centralized apiClient for authentication and error handling.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/** A post-show stat gain, e.g. `{ stat: 'intelligence', gain: 1 }`. */
export interface StatGain {
  stat: string;
  gain: number;
}

/** A conformation show's award: the ribbon and the title points it carried. */
export interface ConformationAward {
  ribbon: string;
  titlePoints: number;
}

/**
 * One result row of GET /api/v1/competition/show/:showId/results — the backend's
 * scoped DTO (backend/modules/competition/services/competitionResultRecord.mjs,
 * Equoria-q4uem.10, owner ruling R4). Unrecorded values are null, never 0.
 */
export interface ShowResultRow {
  resultId: number;
  horseId: number;
  horseName: string | null;
  ownerName: string | null;
  /** True for the signed-in player's own horses. */
  isViewerHorse: boolean;
  placement: number | null;
  score: number;
  /** null for conformation results, which pay no prize money. */
  prizeWon: number | null;
  runDate: string | null;
  /** null on results settled before Horse Points were recorded. */
  horsePointsAwarded: number | null;
  /** Filled only on the viewer's own horses (owner ruling R7). */
  statGain: StatGain | null;
  conformationAward: ConformationAward | null;
}

/** The show header of the show-results DTO; null when the show does not exist. */
export interface ShowResultsShow {
  id: number;
  name: string;
  discipline: string;
  showType: string;
  status: string;
  scheduledRunDate: string | null;
  executedAt: string | null;
  prize: number;
}

/** The envelope of GET /api/v1/competition/show/:showId/results (no `data` key). */
export interface ShowResultsEnvelope {
  success: boolean;
  showId: number;
  count: number;
  show: ShowResultsShow | null;
  results: ShowResultRow[];
}

/**
 * Individual participant result in a competition
 */
export interface ParticipantResult {
  rank: number | null;
  horseId: number;
  horseName: string | null;
  ownerName: string | null;
  finalScore: number;
  prizeWon: number | null;
  isCurrentUser: boolean;
  horsePointsAwarded: number | null;
  statGain: StatGain | null;
  conformationAward: ConformationAward | null;
}

/**
 * Full competition results data, as the results modal renders it. Built from the
 * show-results DTO by `toCompetitionResults`.
 */
export interface CompetitionResults {
  competitionId: number;
  competitionName: string | null;
  discipline: string | null;
  showType: string | null;
  date: string | null;
  totalParticipants: number;
  /** null for conformation shows (no prize money) or a missing show. */
  prizePool: number | null;
  /** What each podium place was actually paid; null where nobody took it. */
  prizeDistribution: {
    first: number | null;
    second: number | null;
    third: number | null;
  } | null;
  results: ParticipantResult[];
}

/**
 * Map the show-results DTO to the modal's CompetitionResults. The prize
 * distribution is read from the recorded payouts of placements 1–3, never
 * recomputed from the 50/30/20 rule, so a two-horse show shows no third prize.
 */
export function toCompetitionResults(envelope: ShowResultsEnvelope): CompetitionResults {
  const { show, results } = envelope;
  const paysPrizes = show !== null && show.showType !== 'conformation';
  const paidFor = (placement: number): number | null =>
    results.find((r) => r.placement === placement)?.prizeWon ?? null;

  return {
    competitionId: envelope.showId,
    competitionName: show?.name ?? null,
    discipline: show?.discipline ?? null,
    showType: show?.showType ?? null,
    date: results[0]?.runDate ?? show?.executedAt ?? null,
    totalParticipants: envelope.count,
    prizePool: paysPrizes ? show.prize : null,
    prizeDistribution: paysPrizes
      ? { first: paidFor(1), second: paidFor(2), third: paidFor(3) }
      : null,
    results: results.map((r) => ({
      rank: r.placement,
      horseId: r.horseId,
      horseName: r.horseName,
      ownerName: r.ownerName,
      finalScore: r.score,
      prizeWon: r.prizeWon,
      isCurrentUser: r.isViewerHorse,
      horsePointsAwarded: r.horsePointsAwarded,
      statGain: r.statGain,
      conformationAward: r.conformationAward,
    })),
  };
}

/**
 * Individual competition entry in history
 */
export interface CompetitionEntry {
  competitionId: number;
  competitionName: string;
  discipline: string;
  date: string;
  placement: number;
  totalParticipants: number;
  finalScore: number;
  prizeMoney: number;
  /** Not persisted in CompetitionResult schema; omitted by backend until Equoria-aenc schema migration lands. */
  xpGained?: number;
}

/**
 * Horse competition statistics summary
 */
export interface HorseCompetitionStatistics {
  totalCompetitions: number;
  wins: number;
  /** 2nd-place finishes (Equoria-b4msy). */
  secondPlaces: number;
  /** 3rd-place finishes (Equoria-b4msy). */
  thirdPlaces: number;
  top3Finishes: number;
  winRate: number;
  totalPrizeMoney: number;
  averagePlacement: number;
  bestPlacement: number;
}

/**
 * Full horse competition history data
 */
export interface CompetitionHistoryData {
  horseId: number;
  horseName: string;
  statistics: HorseCompetitionStatistics;
  competitions: CompetitionEntry[];
}

/**
 * User competition statistics
 */
export interface UserCompetitionStats {
  userId: string;
  totalCompetitions: number;
  totalWins: number;
  totalTop3: number;
  winRate: number;
  totalPrizeMoney: number;
  /** Not persisted in CompetitionResult schema; omitted by backend until Equoria-aenc schema migration lands. */
  totalXpGained?: number;
  bestPlacement: number;
  mostSuccessfulDiscipline: string;
  recentCompetitions: CompetitionEntry[];
}

/**
 * API Error structure
 */
export interface CompetitionResultsApiError {
  message: string;
  status: string;
  statusCode: number;
}

/**
 * Fetch one show's results for the results modal: GET
 * /api/v1/competition/show/:showId/results (owner ruling R4), mapped by
 * `toCompetitionResults`.
 *
 * @param competitionId - The show's id.
 * @returns Promise<CompetitionResults> - Full competition results
 */
export async function fetchCompetitionResults(competitionId: number): Promise<CompetitionResults> {
  const envelope = await apiClient.get<ShowResultsEnvelope>(
    `/api/v1/competition/show/${competitionId}/results`
  );
  return toCompetitionResults(envelope);
}

/**
 * Fetch a horse's complete competition history
 *
 * Returns all past competitions the horse has participated in,
 * along with aggregated statistics (wins, placement averages, etc.).
 *
 * @param horseId - Horse ID to fetch history for
 * @returns Promise<CompetitionHistoryData> - Horse's competition history and stats
 *
 * @example
 * const history = await fetchHorseCompetitionHistory(456);
 * console.log(`Win rate: ${history.statistics.winRate}%`);
 */
export async function fetchHorseCompetitionHistory(
  horseId: number
): Promise<CompetitionHistoryData> {
  return apiClient.get<CompetitionHistoryData>(`/api/v1/horses/${horseId}/competition-history`);
}

/**
 * Fetch user's overall competition statistics
 *
 * Returns aggregated statistics across all the user's horses,
 * including total competitions, wins, prizes, and recent activity.
 *
 * @param userId - User ID to fetch stats for
 * @returns Promise<UserCompetitionStats> - User's competition statistics
 *
 * @example
 * const stats = await fetchUserCompetitionStats('user-uuid');
 * console.log(`Total prize money: $${stats.totalPrizeMoney}`);
 */
export async function fetchUserCompetitionStats(userId: string): Promise<UserCompetitionStats> {
  return apiClient.get<UserCompetitionStats>(`/api/v1/users/${userId}/competition-stats`);
}

/**
 * Per-horse result summary for a single show, as consumed by
 * CompetitionResultsList.
 */
export interface CompetitionResultUserRow {
  horseId: number;
  horseName: string;
  rank: number;
  score: number;
  prizeWon: number;
  /**
   * Horse Points recorded at settlement; null for results settled before they
   * were recorded (Equoria-q4uem.10, owner rulings R6/R7). Never a fake 0.
   */
  horsePointsAwarded: number | null;
  /**
   * True when this result is the horse's first-ever win (its earliest 1st
   * place; Equoria-oey96.41). Absent reads as false: never a celebration.
   */
  isFirstWin?: boolean;
  /** Whether the player has opened this result yet (the server's viewedAt latch). */
  viewed?: boolean;
}

/**
 * The Horse Points recorded across rows, or null when any row has none recorded:
 * an unknown total is never a partial sum or a fake 0 (Equoria-q4uem.10, owner
 * rulings R6/R7).
 */
export function sumHorsePoints(
  rows: ReadonlyArray<{ horsePointsAwarded: number | null }>
): number | null {
  const points = rows.map((r) => r.horsePointsAwarded);
  return points.every((p): p is number => p !== null)
    ? points.reduce((sum, p) => sum + p, 0)
    : null;
}

/**
 * One competition summary row rendered by the CompetitionResultsList.
 * Structurally compatible with `CompetitionResultSummary` in that
 * component - so the hook return value drops straight in as `results`.
 */
export interface UserCompetitionResultSummary {
  competitionId: number;
  competitionName: string;
  discipline: string;
  /** ISO date string. */
  date: string;
  totalParticipants: number;
  prizePool: number;
  userResults: CompetitionResultUserRow[];
}

/**
 * Envelope returned by GET /api/v1/competition/user-results.
 * The apiClient does not auto-unwrap this because there is no `data` key.
 */
interface UserCompetitionResultsEnvelope {
  success: boolean;
  results: UserCompetitionResultSummary[];
  count: number;
}

/**
 * Fetch the authenticated users competition results across ALL of their
 * horses. The endpoint scopes by req.user.id, so ownership is enforced
 * server-side (no userId query param passed here - IDOR guard).
 *
 * @returns Promise resolving to the pre-grouped summary array (already
 *   sorted newest first by the backend).
 *
 * @example
 *   const results = await fetchUserCompetitionResults();
 *   console.log(`Competitions entered:`, results.length);
 */
export async function fetchUserCompetitionResults(): Promise<UserCompetitionResultSummary[]> {
  const envelope = await apiClient.get<UserCompetitionResultsEnvelope>(
    '/api/v1/competition/user-results'
  );
  // Defensive: the transport auto-unwraps envelopes with a `data` key.
  // Ours uses `results`, so we extract explicitly.
  return envelope?.results ?? [];
}

/**
 * Tell the server the player has now seen the results for these shows
 * (Equoria-oey96.28).
 *
 * The Hub's `check-results` next-action keeps nudging while any of the
 * player's results still has `viewedAt` NULL; this is the write that clears
 * it. Ownership is enforced server-side through the horse relation, so the
 * caller passes show ids only — never a userId.
 *
 * @param showIds - Ids of the competitions whose results were just shown.
 * @returns How many results the server newly marked viewed.
 */
export async function markCompetitionResultsViewed(showIds: number[]): Promise<number> {
  const envelope = await apiClient.post<{ success: boolean; markedCount: number }>(
    '/api/v1/competition/results/viewed',
    { showIds }
  );
  return envelope?.markedCount ?? 0;
}

/** Rows per page of a horse's show record (A6; the route's default). */
export const horseShowResultsPageSize = 50;

/**
 * One row of GET /api/v1/competition/results/horse/:horseId (owner ruling R7;
 * backend competitionResultRecord.toHorseShowRow). Every show the horse was
 * entered in, run and unrun. Unrecorded values are null, never 0.
 */
export interface HorseShowResultRow {
  showId: number;
  showName: string | null;
  competitionType: { showType: string; discipline: string | null };
  /** 'upcoming' before the show runs, 'running' while it settles, then 'completed'. */
  status: 'upcoming' | 'running' | 'completed';
  date: string | null;
  placement: number | null;
  horsePointsAwarded: number | null;
  winnings: number | null;
  /** The owner's post-show stat gain (the route is owner-only). */
  statGain: StatGain | null;
  conformationAward: ConformationAward | null;
}

/** The route's pagination block (backend utils/paginationHelper). */
export interface HorseShowResultsPagination {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/** One page of a horse's show record. */
export interface HorseShowResultsPage {
  rows: HorseShowResultRow[];
  pagination: HorseShowResultsPagination;
}

/**
 * Fetch one page of a horse's show record (upcoming first, then newest first,
 * as the server orders it).
 */
export async function fetchHorseShowResults(
  horseId: number,
  page: number
): Promise<HorseShowResultsPage> {
  const envelope = await apiClient.getEnvelope<{
    data?: HorseShowResultRow[];
    pagination?: HorseShowResultsPagination;
  }>(`/api/v1/competition/results/horse/${horseId}?page=${page}&limit=${horseShowResultsPageSize}`);
  return {
    rows: envelope?.data ?? [],
    pagination: envelope?.pagination ?? {
      currentPage: page,
      pageSize: horseShowResultsPageSize,
      totalRecords: envelope?.data?.length ?? 0,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: page > 1,
    },
  };
}

/** One page of a horse's show record; keeps the previous page on screen while paging. */
export function useHorseShowResults(horseId: number, page: number) {
  return useQuery({
    queryKey: ['horseShowResults', horseId, page],
    queryFn: () => fetchHorseShowResults(horseId, page),
    enabled: Number.isInteger(horseId) && horseId > 0,
    placeholderData: keepPreviousData,
  });
}

/**
 * Export all types for external use
 * Note: Types are already exported with their interface declarations above
 */
