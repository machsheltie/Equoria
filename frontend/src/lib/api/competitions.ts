/**
 * Competition Entry System API Functions
 *
 * Provides API functions for the competition entry system:
 * - Fetching competitions with filtering
 * - Fetching competition details
 * - Checking horse eligibility for competitions
 * - Submitting competition entries
 *
 * Uses the centralized apiClient for authentication and error handling.
 */

import { apiClient } from '@/lib/api-client';

/**
 * Competition filter options for list queries
 */
export interface CompetitionFilters {
  discipline?: string;
  dateRange?: 'all' | 'today' | 'week' | 'month';
  entryFee?: 'all' | 'free' | 'under100' | 'range' | 'over500';
}

/**
 * Competition data structure
 */
export interface CompetitionData {
  id: number;
  name: string;
  description?: string;
  discipline: string;
  date: string;
  location?: string;
  prizePool?: number;
  entryFee: number;
  maxEntries: number;
  currentEntries: number;
  status: 'open' | 'closed' | 'running' | 'completed';
  requirements?: {
    minAge?: number;
    maxAge?: number;
    minLevel?: number;
    requiredTraits?: string[];
  };
}

/**
 * Horse with eligibility status for a specific competition
 */
export interface EligibleHorse {
  id: number;
  name: string;
  breed: string;
  age: number;
  level: number;
  healthStatus: string;
  isEligible: boolean;
  eligibilityReasons?: string[];
  alreadyEntered: boolean;
}

/**
 * Entry data for submitting to a competition
 */
export interface EntryData {
  competitionId: number;
  horseIds: number[];
}

/**
 * Result of a competition entry submission
 */
export interface EntryResult {
  success: boolean;
  entryIds: number[];
  totalCost: number;
  message: string;
  failedEntries?: Array<{
    horseId: number;
    reason: string;
  }>;
}

/**
 * API Error structure
 */
export interface CompetitionApiError {
  message: string;
  status: string;
  statusCode: number;
}

/**
 * Build query string from competition filters
 */
function buildFilterQuery(filters?: CompetitionFilters): string {
  if (!filters) return '';

  const params = new URLSearchParams();

  if (filters.discipline && filters.discipline !== 'all') {
    params.append('discipline', filters.discipline);
  }

  if (filters.dateRange && filters.dateRange !== 'all') {
    params.append('dateRange', filters.dateRange);
  }

  if (filters.entryFee && filters.entryFee !== 'all') {
    params.append('entryFee', filters.entryFee);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Fetch list of competitions with optional filters
 *
 * @param filters - Optional filters for discipline, date range, entry fee
 * @returns Promise<CompetitionData[]> - List of competitions matching filters
 *
 * @example
 * // Fetch all competitions
 * const competitions = await fetchCompetitions();
 *
 * // Fetch dressage competitions this week
 * const filtered = await fetchCompetitions({
 *   discipline: 'dressage',
 *   dateRange: 'week'
 * });
 */
export async function fetchCompetitions(
  filters?: CompetitionFilters
): Promise<CompetitionData[]> {
  const queryString = buildFilterQuery(filters);
  return apiClient.get<CompetitionData[]>(`/api/competitions${queryString}`);
}

/**
 * Fetch detailed information for a specific competition
 *
 * @param id - Competition ID
 * @returns Promise<CompetitionData> - Detailed competition data
 *
 * @example
 * const competition = await fetchCompetitionDetails(123);
 */
export async function fetchCompetitionDetails(
  id: number
): Promise<CompetitionData> {
  return apiClient.get<CompetitionData>(`/api/competitions/${id}`);
}

/**
 * Fetch user's horses with eligibility status for a specific competition
 *
 * Eligibility is calculated based on:
 * - Horse age meeting competition requirements
 * - Horse level meeting minimum requirements
 * - Horse health status (must be healthy)
 * - Whether horse is already entered in this competition
 *
 * @param competitionId - Competition ID to check eligibility for
 * @param userId - User ID to fetch horses for
 * @returns Promise<EligibleHorse[]> - List of user's horses with eligibility status
 *
 * @example
 * const eligibleHorses = await fetchHorseEligibility(123, 'user-uuid');
 * const canEnter = eligibleHorses.filter(h => h.isEligible && !h.alreadyEntered);
 */
export async function fetchHorseEligibility(
  competitionId: number,
  userId: string
): Promise<EligibleHorse[]> {
  return apiClient.get<EligibleHorse[]>(
    `/api/competitions/${competitionId}/eligibility/${userId}`
  );
}

/**
 * Submit an entry to a competition
 *
 * Validates:
 * - User has sufficient funds for entry fees
 * - All horses are eligible for the competition
 * - Horses are not already entered
 *
 * On success:
 * - Deducts entry fee from user balance
 * - Creates entry records for each horse
 * - Updates competition participant count
 *
 * @param entry - Entry data containing competition ID and horse IDs
 * @returns Promise<EntryResult> - Result of the entry submission
 *
 * @example
 * const result = await submitCompetitionEntry({
 *   competitionId: 123,
 *   horseIds: [1, 2, 3]
 * });
 *
 * if (result.success) {
 *   console.log(`Entered ${result.entryIds.length} horses`);
 * }
 */
export async function submitCompetitionEntry(
  entry: EntryData
): Promise<EntryResult> {
  return apiClient.post<EntryResult>('/api/competitions/enter', entry);
}

/**
 * Export all types for external use
 */
export type {
  CompetitionFilters as Filters,
  CompetitionData as Competition,
  EligibleHorse,
  EntryData,
  EntryResult,
};
