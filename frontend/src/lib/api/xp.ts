/**
 * XP API Functions
 *
 * Provides API functions for the XP and leveling system:
 * - Fetching horse level information and progress
 * - Fetching XP gain history with optional filters
 * - Adding XP to horses via mutations
 *
 * Uses the centralized apiClient for authentication and error handling.
 */

import { apiClient } from '@/lib/api-client';

/**
 * Horse level and XP progress information
 */
export interface HorseLevelInfo {
  horseId: number;
  horseName: string;
  currentLevel: number;
  currentXp: number;
  xpForCurrentLevel: number;
  xpToNextLevel: number;
  totalXp: number;
  progressPercent: number;
  levelThresholds: { [level: number]: number };
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
 * Request payload for adding XP to a horse
 */
export interface AddXpRequest {
  horseId: number;
  xpAmount: number;
  source: 'competition' | 'training' | 'achievement' | 'bonus';
  sourceId: number;
  sourceName: string;
}

/**
 * Result of adding XP to a horse
 */
export interface AddXpResult {
  success: boolean;
  xpGain: XpGain;
  leveledUp: boolean;
  newLevel: number;
  message: string;
}

/**
 * Custom error class for XP API operations
 */
export class XpApiError extends Error {
  constructor(
    message: string,
    public status?: number,
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
  return apiClient.get<HorseLevelInfo>(`/api/horses/${horseId}/level-info`);
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
  return apiClient.get<XpGain[]>(`/api/horses/${horseId}/xp-history${queryString}`);
}

/**
 * Add XP to a horse
 *
 * Submits a request to add XP from a specific source.
 * Returns the result including whether a level-up occurred.
 *
 * @param request - XP addition request details
 * @returns Promise<AddXpResult> - Result of the XP addition
 *
 * @example
 * const result = await addXp({
 *   horseId: 123,
 *   xpAmount: 50,
 *   source: 'competition',
 *   sourceId: 456,
 *   sourceName: 'Spring Championship',
 * });
 * if (result.leveledUp) {
 *   console.log(`Leveled up to ${result.newLevel}!`);
 * }
 */
export async function addXp(request: AddXpRequest): Promise<AddXpResult> {
  return apiClient.post<AddXpResult>('/api/horses/add-xp', request);
}
