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
import type {
  LeaderboardCategory,
  TimePeriod,
} from '@/components/leaderboard/LeaderboardCategorySelector';
import type { LeaderboardEntryData } from '@/components/leaderboard/LeaderboardEntry';
import type { CategoryRanking, BestRanking } from '@/components/leaderboard/UserRankDashboard';

/**
 * API response for a leaderboard query.
 * Matches the actual backend response shape.
 */
export interface LeaderboardResponse {
  entries: LeaderboardEntryData[];
  currentPage: number;
  totalPages: number;
  totalEntries?: number;
  /** Legacy shape — kept for backwards compatibility */
  leaderboard?: LeaderboardEntryData[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
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
 * A single rank data point in a category's historical series.
 */
export interface RankHistoryPoint {
  /** The user's rank at this snapshot (lower is better). */
  rank: number;
  /** ISO-8601 timestamp the snapshot was captured. */
  capturedAt: string;
}

/**
 * One category's ascending rank time-series.
 */
export interface RankHistorySeries {
  /** Raw category key: 'level' | 'xp' | 'horse-earnings' | 'horse-performance'. */
  category: string;
  /** Human-readable label for the legend/axis. */
  categoryLabel: string;
  /** Ascending-by-time list of rank points. */
  points: RankHistoryPoint[];
}

/**
 * API response for a user's historical rank time-series.
 */
export interface RankHistoryResponse {
  userId: string;
  /** Lookback window in days that was applied. */
  days: number;
  /** One series per category that has at least one snapshot. */
  series: RankHistorySeries[];
}

/**
 * Real horse profile returned by GET /api/leaderboards/horse/:horseId.
 *
 * Only the fields the backend actually computes are present here — there are
 * no fabricated placeholders. Fields the leaderboard horse-profile endpoint
 * does NOT provide (e.g. owner stable size, achievements, per-competition
 * history) are intentionally absent and must be sourced elsewhere or shown
 * as honest empty state by the consumer.
 */
export interface LeaderboardHorseProfile {
  horseId: number;
  name: string;
  /** Breed display name, or null when the horse has no breed recorded. */
  breed: string | null;
  /** Age in game-years (canonical getHorseAgeYears unit). */
  age: number;
  sex: string;
  stats: {
    speed: number;
    stamina: number;
    agility: number;
    balance: number;
    precision: number;
    intelligence: number;
    boldness: number;
    flexibility: number;
    obedience: number;
    focus: number;
  };
  totalEarnings: number;
  competitionWins: number;
  topThreeFinishes: number;
}

export interface LeaderboardHorseProfileResponse {
  success: boolean;
  data: LeaderboardHorseProfile;
}

/**
 * Custom error class for leaderboard API operations.
 */
export class LeaderboardApiError extends Error {
  constructor(
    message: string,
    public _status?: number,
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
  const path = `/api/v1/leaderboards/${params.category}`;

  const queryParams = new URLSearchParams();

  queryParams.append('period', params.period);

  if (params.discipline) {
    queryParams.append('discipline', params.discipline);
  }

  if (params.page != null) {
    queryParams.append('page', params.page.toString());
  }

  if (params.limit != null) {
    queryParams.append('limit', params.limit.toString());
  }

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return apiClient.get<LeaderboardResponse>(`${path}${queryString}`);
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
): Promise<UserRankSummaryResponse | null> {
  return apiClient.get<UserRankSummaryResponse>(`/api/v1/leaderboards/user-summary/${userId}`);
}

/**
 * Fetch a user's historical rank time-series across all categories.
 *
 * Ownership-enforced server-side — only returns the authenticated user's
 * own history. Empty `series` when no snapshots have been captured yet.
 *
 * @param userId - User UUID to fetch history for (must be the caller's own)
 * @param days - Optional lookback window in days (1..365, default 365)
 * @returns Promise<RankHistoryResponse>
 *
 * @example
 * const history = await fetchUserRankHistory('user-123', 90);
 * console.log(`${history.series.length} categories have rank history`);
 */
export async function fetchUserRankHistory(
  userId: string,
  days?: number
): Promise<RankHistoryResponse> {
  const qs = days != null ? `?days=${days}` : '';
  return apiClient.get<RankHistoryResponse>(`/api/v1/leaderboards/rank-history/${userId}${qs}`);
}

/**
 * Fetch the real horse profile (breed, age, sex, stats, earnings, competition
 * tallies) backing a leaderboard entry.
 *
 * Used by the leaderboard horse-detail modal so it renders real persisted
 * data instead of fabricated placeholders (Equoria-8nfc). apiClient unwraps
 * the `{ success, data }` envelope to the profile; throws on 404/error.
 *
 * @param horseId - Positive integer horse id from the leaderboard entry
 * @returns Promise<LeaderboardHorseProfile>
 */
export async function fetchLeaderboardHorseProfile(
  horseId: number
): Promise<LeaderboardHorseProfile> {
  // apiClient.get already unwraps the standard `{ success, data }` envelope
  // (returns `data.data` when present), exactly like the sibling fetchers
  // fetchLeaderboard / fetchUserRankSummary above. The previous `res.data`
  // here double-unwrapped, yielding `undefined` for the documented
  // LeaderboardHorseProfileResponse contract — the leaderboard horse-detail
  // modal therefore never received real data in production OR test
  // (Equoria-8qnv7). Returning the apiClient result directly fixes both.
  return apiClient.get<LeaderboardHorseProfile>(`/api/v1/leaderboards/horse/${horseId}`);
}
