/**
 * Prizes API Functions
 *
 * Provides API functions for the prize system:
 * - Fetching user prize transaction history
 * - Fetching horse prize summaries
 * - Claiming competition prizes
 *
 * Uses the centralized apiClient for authentication and error handling.
 */

import { apiClient } from '@/lib/api-client';

/**
 * Filter options for prize transaction history
 */
export interface TransactionFilters {
  dateRange?: 'all' | '7days' | '30days' | '90days';
  horseId?: number;
  discipline?: string;
}

/**
 * Individual prize transaction record
 */
export interface PrizeTransaction {
  transactionId: string;
  date: string;
  competitionId: number;
  competitionName: string;
  horseId: number;
  horseName: string;
  discipline: string;
  placement: number;
  prizeMoney: number;
  xpGained: number;
  claimed: boolean;
  claimedAt?: string;
}

/**
 * Detailed prize information for claim results
 */
export interface PrizeDetails {
  horseId: number;
  horseName: string;
  competitionId: number;
  competitionName: string;
  discipline: string;
  date: string;
  placement: number;
  totalParticipants: number;
  prizeMoney: number;
  xpGained: number;
  claimed: boolean;
  claimedAt?: string;
}

/**
 * Summary of a horse's prize earnings
 */
export interface HorsePrizeSummary {
  horseId: number;
  horseName: string;
  totalCompetitions: number;
  totalPrizeMoney: number;
  totalXpGained: number;
  firstPlaces: number;
  secondPlaces: number;
  thirdPlaces: number;
  unclaimedPrizes: number;
  recentPrizes: PrizeTransaction[];
}

/**
 * Result of claiming prizes
 */
export interface PrizeClaimResult {
  success: boolean;
  prizesClaimed: PrizeDetails[];
  newBalance: number;
  message: string;
  errors?: string[];
}

/**
 * API Error structure for prize operations
 */
export interface PrizeApiError {
  message: string;
  status: string;
  statusCode: number;
}

/**
 * Fetch user's prize transaction history with optional filters
 *
 * Returns all prize transactions for a user, optionally filtered
 * by date range, horse, or discipline.
 *
 * @param userId - User ID to fetch history for
 * @param filters - Optional filter criteria
 * @returns Promise<PrizeTransaction[]> - List of prize transactions
 *
 * @example
 * const transactions = await fetchPrizeHistory('user-uuid');
 * console.log(`Total transactions: ${transactions.length}`);
 *
 * @example
 * // With filters
 * const recent = await fetchPrizeHistory('user-uuid', { dateRange: '30days' });
 */
export async function fetchPrizeHistory(
  userId: string,
  filters?: TransactionFilters
): Promise<PrizeTransaction[]> {
  const params = new URLSearchParams();

  if (filters?.dateRange) {
    params.append('dateRange', filters.dateRange);
  }
  if (filters?.horseId !== undefined) {
    params.append('horseId', filters.horseId.toString());
  }
  if (filters?.discipline) {
    params.append('discipline', filters.discipline);
  }

  const queryString = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<PrizeTransaction[]>(`/api/users/${userId}/prize-history${queryString}`);
}

/**
 * Fetch prize summary for a specific horse
 *
 * Returns aggregated prize statistics for a horse,
 * including total earnings, placements, and recent prizes.
 *
 * @param horseId - Horse ID to fetch summary for
 * @returns Promise<HorsePrizeSummary> - Horse's prize summary
 *
 * @example
 * const summary = await fetchHorsePrizeSummary(123);
 * console.log(`Total prize money: $${summary.totalPrizeMoney}`);
 */
export async function fetchHorsePrizeSummary(
  horseId: number
): Promise<HorsePrizeSummary> {
  return apiClient.get<HorsePrizeSummary>(`/api/horses/${horseId}/prize-summary`);
}

/**
 * Claim prizes from a competition
 *
 * Processes prize claim for a competition, transferring
 * prize money to user's balance and marking prizes as claimed.
 *
 * @param competitionId - Competition ID to claim prizes from
 * @returns Promise<PrizeClaimResult> - Result of the claim operation
 *
 * @example
 * const result = await claimCompetitionPrizes(456);
 * if (result.success) {
 *   console.log(`Claimed $${result.prizesClaimed.reduce((sum, p) => sum + p.prizeMoney, 0)}`);
 *   console.log(`New balance: $${result.newBalance}`);
 * }
 */
export async function claimCompetitionPrizes(
  competitionId: number
): Promise<PrizeClaimResult> {
  return apiClient.post<PrizeClaimResult>(`/api/competitions/${competitionId}/claim-prizes`);
}
