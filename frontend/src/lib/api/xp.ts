/**
 * XP API Functions
 *
 * Provides API functions for the XP and leveling system:
 * - Fetching horse level information and progress
 * - Fetching XP gain history with optional filters
 *
 * READ-ONLY BY CONTRACT (Equoria-6p398.3, audit Finding 3): there is no
 * client-side XP writer. `addXp()` used to POST an arbitrary
 * { amount, reason } to /api/v1/horses/:id/award-xp, an endpoint whose only
 * authorization was horse ownership — a player could mint 1000 XP and ten stat
 * points for their own horse. That endpoint is now 410 Gone. Horse XP is
 * awarded server-side from competition results; the client only reads it here
 * and spends EARNED stat points through the allocate-stat surface.
 *
 * Uses the centralized apiClient for authentication and error handling.
 */

import { apiClient } from '@/lib/api-client';

/**
 * Horse level and XP progress information
 * Matches GET /api/horses/:horseId/xp backend response shape.
 */
export interface HorseLevelInfo {
  horseId: number;
  horseName: string;
  currentXP: number;
  availableStatPoints: number;
  nextStatPointAt: number;
  xpToNextStatPoint: number;
}

/**
 * Individual XP gain event record
 */
export interface XpGain {
  xpGainId: string;
  horseId: number;
  horseName: string;
  source: 'competition' | 'training' | 'achievement' | 'bonus';
  sourceId: number;
  sourceName: string;
  xpAmount: number;
  timestamp: string;
  oldLevel: number;
  newLevel: number;
  oldXp: number;
  newXp: number;
  leveledUp: boolean;
}

/**
 * Filter options for XP history queries
 */
export interface XpHistoryFilters {
  dateRange?: 'all' | '7days' | '30days' | '90days';
  source?: 'competition' | 'training' | 'achievement' | 'bonus';
}

/**
 * Custom error class for XP API operations
 */
export class XpApiError extends Error {
  constructor(
    message: string,
    public _status?: number,
    public _code?: string
  ) {
    super(message);
    this.name = 'XpApiError';
  }
}

/**
 * Fetch horse level and XP progress information
 *
 * Returns current level, XP progress, and level thresholds for a horse.
 *
 * @param horseId - Horse ID to fetch level info for
 * @returns Promise<HorseLevelInfo> - Horse's level and XP data
 *
 * @example
 * const levelInfo = await fetchHorseLevelInfo(123);
 * console.log(`Level ${levelInfo.currentLevel}: ${levelInfo.progressPercent}% to next`);
 */
export async function fetchHorseLevelInfo(horseId: number): Promise<HorseLevelInfo> {
  return apiClient.get<HorseLevelInfo>(`/api/v1/horses/${horseId}/xp`);
}

/**
 * Fetch XP gain history for a horse with optional filters
 *
 * Returns all XP gain events for a horse, optionally filtered
 * by date range or source type.
 *
 * @param horseId - Horse ID to fetch history for
 * @param filters - Optional filter criteria (dateRange, source)
 * @returns Promise<XpGain[]> - List of XP gain events
 *
 * @example
 * const history = await fetchXpHistory(123);
 * console.log(`Total XP events: ${history.length}`);
 *
 * @example
 * // With filters
 * const recent = await fetchXpHistory(123, { dateRange: '30days', source: 'competition' });
 */
export async function fetchXpHistory(
  horseId: number,
  filters?: XpHistoryFilters
): Promise<XpGain[]> {
  const params = new URLSearchParams();

  if (filters?.dateRange) {
    params.append('dateRange', filters.dateRange);
  }
  if (filters?.source) {
    params.append('source', filters.source);
  }

  const queryString = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<XpGain[]>(`/api/v1/horses/${horseId}/xp-history${queryString}`);
}
