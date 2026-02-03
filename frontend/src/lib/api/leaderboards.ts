/**
 * Leaderboards API Functions
 *
 * Provides API functions for the leaderboard system:
 * - Fetching ranked leaderboard data by category and period
 * - Fetching user rank summaries across all categories
 *
 * Uses the centralized apiClient for authentication and error handling.
 *
 * Story 5-5: Leaderboards - Task 5
 */

import { apiClient } from '@/lib/api-client';
import type { LeaderboardCategory, TimePeriod } from '@/components/leaderboard/LeaderboardCategorySelector';
import type { LeaderboardEntryData } from '@/components/leaderboard/LeaderboardEntry';
import type { CategoryRanking, BestRanking } from '@/components/leaderboard/UserRankDashboard';

/**
 * API response for a leaderboard query, including paginated entries
 * and the current user's rank information.
 */
export interface LeaderboardResponse {
  category: string;
  period: string;
  totalEntries: number;
  currentPage: number;
  totalPages: number;
  entries: LeaderboardEntryData[];
  userRank?: {
    rank: number;
    entry: LeaderboardEntryData;
  };
  lastUpdated: string;
}

/**
 * API response for a user's ranking summary across all leaderboard categories.
 */
export interface UserRankSummaryResponse {
  userId: string;
  userName: string;
  rankings: CategoryRanking[];
  bestRankings: BestRanking[];
}

/**
 * Custom error class for leaderboard API operations.
 */
export class LeaderboardApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public _code?: string
  ) {
    super(message);
    this.name = 'LeaderboardApiError';
  }
}

/**
 * Parameters for fetching leaderboard data.
 */
export interface FetchLeaderboardParams {
  category: LeaderboardCategory;
  period: TimePeriod;
  discipline?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetch leaderboard data for a specific category and time period.
 *
 * Constructs the appropriate URL with query parameters and returns
 * paginated leaderboard entries with the user's rank.
 *
 * @param params - Leaderboard query parameters
 * @returns Promise<LeaderboardResponse> - Paginated leaderboard data
 *
 * @example
 * const data = await fetchLeaderboard({
 *   category: 'level',
 *   period: 'monthly',
 *   page: 1,
 *   limit: 50,
 * });
 * console.log(`Page ${data.currentPage} of ${data.totalPages}`);
 */
export async function fetchLeaderboard(
  params: FetchLeaderboardParams
): Promise<LeaderboardResponse> {
  const queryParams = new URLSearchParams();

  queryParams.append('period', params.period);

  if (params.discipline) {
    queryParams.append('discipline', params.discipline);
  }
  if (params.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }
  if (params.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return apiClient.get<LeaderboardResponse>(
    `/api/leaderboards/${params.category}${queryString}`
  );
}

/**
 * Fetch a user's ranking summary across all leaderboard categories.
 *
 * Returns the user's rank in each category along with their best
 * ranking achievements.
 *
 * @param userId - User ID to fetch summary for
 * @returns Promise<UserRankSummaryResponse> - User's rankings across categories
 *
 * @example
 * const summary = await fetchUserRankSummary('user-123');
 * console.log(`User has rankings in ${summary.rankings.length} categories`);
 */
export async function fetchUserRankSummary(
  userId: string
): Promise<UserRankSummaryResponse> {
  return apiClient.get<UserRankSummaryResponse>(
    `/api/leaderboards/user-summary/${userId}`
  );
}
