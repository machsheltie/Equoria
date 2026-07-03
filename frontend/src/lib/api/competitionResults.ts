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

import { apiClient } from '@/lib/api-client';

/**
 * Score breakdown for a competition participant
 * Only visible for current user's horses
 */
export interface ScoreBreakdown {
  baseStatScore: number;
  traitBonus: number;
  trainingScore: number;
  equipmentBonus: number;
  riderBonus: number;
  healthModifier: number;
  randomLuck: number;
}

/**
 * Individual participant result in a competition
 */
export interface ParticipantResult {
  rank: number;
  horseId: number;
  horseName: string;
  ownerId: string;
  ownerName: string;
  finalScore: number;
  prizeWon: number;
  isCurrentUser: boolean;
  scoreBreakdown?: ScoreBreakdown;
}

/**
 * Full competition results data
 */
export interface CompetitionResults {
  competitionId: number;
  competitionName: string;
  discipline: string;
  date: string;
  totalParticipants: number;
  prizePool: number;
  prizeDistribution: {
    first: number;
    second: number;
    third: number;
  };
  results: ParticipantResult[];
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
 * Fetch full results for a specific competition
 *
 * Returns the complete results table with all participants,
 * their rankings, scores, and prize distribution.
 *
 * @param competitionId - Competition ID to fetch results for
 * @returns Promise<CompetitionResults> - Full competition results
 *
 * @example
 * const results = await fetchCompetitionResults(123);
 * console.log(`Winner: ${results.results[0].horseName}`);
 */
export async function fetchCompetitionResults(competitionId: number): Promise<CompetitionResults> {
  return apiClient.get<CompetitionResults>(`/api/v1/competitions/${competitionId}/results`);
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
  /** Currently 0 - not stored in CompetitionResult (Equoria-aenc parity). */
  xpGained: number;
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
 * Export all types for external use
 * Note: Types are already exported with their interface declarations above
 */
