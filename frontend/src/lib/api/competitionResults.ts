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
  xpGained: number;
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
  totalXpGained: number;
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
export async function fetchCompetitionResults(
  competitionId: number
): Promise<CompetitionResults> {
  return apiClient.get<CompetitionResults>(`/api/competitions/${competitionId}/results`);
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
  return apiClient.get<CompetitionHistoryData>(`/api/horses/${horseId}/competition-history`);
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
export async function fetchUserCompetitionStats(
  userId: string
): Promise<UserCompetitionStats> {
  return apiClient.get<UserCompetitionStats>(`/api/users/${userId}/competition-stats`);
}

/**
 * Export all types for external use
 * Note: Types are already exported with their interface declarations above
 */
