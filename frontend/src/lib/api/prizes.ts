/**
 * Prizes API Functions
 *
 * Provides API functions for the prize system:
 * - Fetching user prize transaction history
 * - Fetching horse prize summaries
 *
 * Uses the centralized apiClient for authentication and error handling.
 *
 * NOTE (Equoria-o3try): the frontend prize-claim concept was removed. Prizes
 * auto-credit at competition settlement — there is no claimed/claimedAt/xpGained
 * backing in the CompetitionResult data model, so a "Claim" affordance would
 * lie about system state (Constitution §2). `claimCompetitionPrizes` and its
 * `PrizeClaimResult` type were deleted here; prize history is display-only.
 * The backend `POST /api/v1/competition/:id/claim-prizes` route still exists but
 * is now frontend-unused (recommended for separate backend cleanup).
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
 * Individual prize transaction record (UI shape consumed by the page/components).
 *
 * NOTE (Equoria-i3l23): this is the FRONTEND-facing shape. The real backend
 * `GET /api/v1/users/:userId/prize-history` does NOT emit this shape directly —
 * it returns an object `{ prizeHistory: BackendPrizeHistoryRow[], pagination }`
 * whose rows use different field names (`competitionResultId`, `runDate`) and a
 * STRING `placement` ("1st"/"2nd"/null), and which has no XP or claim-state
 * columns in the data model. `fetchPrizeHistory` unwraps + maps that real shape
 * into this UI shape via `mapBackendRowToTransaction`. The mock/MSW handlers
 * MUST emit the real backend shape so unit tests exercise the real mapper.
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
 * Raw per-row shape emitted by the real backend
 * `GET /api/v1/users/:userId/prize-history` (see
 * backend/modules/users/routes/userRoutes.mjs — the `formatted` map). The
 * backend serializes raw `CompetitionResult` rows, so:
 * - `competitionResultId` is the result PK (there is no separate competitionId);
 * - `placement` is a STRING ("1st" / "2nd" / null), not a number;
 * - `runDate` is the date (there is no `date`);
 * - there is NO `xpGained`, `claimed`, or `claimedAt` — the data model
 *   (CompetitionResult) has no XP or claim-state columns.
 */
export interface BackendPrizeHistoryRow {
  competitionResultId: number;
  competitionName: string;
  horseName: string;
  horseId: number;
  placement: string | number | null;
  prizeMoney: number;
  discipline: string;
  runDate: string;
  // Tolerated-if-present (a future backend may add these). The current backend
  // omits them; the mapper defaults them honestly when absent.
  xpGained?: number;
  claimed?: boolean;
  claimedAt?: string;
}

/**
 * Object shape the real backend wraps the rows in (after the api-client
 * unwraps the outer `{ success, data }` envelope). The page consumes the
 * mapped `prizeHistory`; `pagination` is currently unused by the page.
 */
export interface BackendPrizeHistoryResponse {
  prizeHistory: BackendPrizeHistoryRow[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Parse the backend's STRING placement ("1st", "2nd", "3rd", null) into the
 * numeric placement the UI components compare/sort on. A null or non-numeric
 * placement (placeholder results) maps to 0, which the row renderer displays
 * honestly as "-" (no medal), rather than fabricating a rank.
 */
export function parsePlacement(placement: string | number | null | undefined): number {
  if (typeof placement === 'number') return Number.isFinite(placement) ? placement : 0;
  if (typeof placement === 'string') {
    const parsed = parseInt(placement, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Map one real backend prize-history row to the UI `PrizeTransaction` shape.
 *
 * Field reconciliation (Equoria-i3l23):
 * - transactionId  ← String(competitionResultId)  (UI needs a stable key)
 * - competitionId  ← competitionResultId           (the claim endpoint keys off
 *                    the CompetitionResult id; POST /competition/:id/claim-prizes
 *                    does findUnique({ where: { id } }))
 * - date           ← runDate
 * - placement      ← parsePlacement(placement string)
 * - xpGained       ← row.xpGained ?? 0    (no XP column in the data model)
 * - claimed        ← row.claimed ?? true  (history rows are settled records;
 *                    the data model has no claim-state column, so there is no
 *                    honest per-row "unclaimed" status to surface)
 * - claimedAt      ← row.claimedAt ?? runDate
 */
export function mapBackendRowToTransaction(row: BackendPrizeHistoryRow): PrizeTransaction {
  return {
    transactionId: String(row.competitionResultId),
    date: row.runDate,
    competitionId: row.competitionResultId,
    competitionName: row.competitionName,
    horseId: row.horseId,
    horseName: row.horseName,
    discipline: row.discipline,
    placement: parsePlacement(row.placement),
    prizeMoney: Number(row.prizeMoney) || 0,
    xpGained: row.xpGained ?? 0,
    claimed: row.claimed ?? true,
    claimedAt: row.claimedAt ?? row.runDate,
  };
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

  // The api-client unwraps the outer `{ success, data }` envelope, so this
  // resolves to the backend's inner `data`: an OBJECT
  // `{ prizeHistory: BackendPrizeHistoryRow[], pagination }` — NOT a bare array
  // (Equoria-i3l23). Unwrap `.prizeHistory` and map each real row into the UI
  // `PrizeTransaction` shape the page/components consume. A defensive `?? []`
  // covers an unexpected/empty payload so the page shows an honest empty state
  // rather than throwing.
  const response = await apiClient.get<BackendPrizeHistoryResponse>(
    `/api/v1/users/${userId}/prize-history${queryString}`
  );

  return (response?.prizeHistory ?? []).map(mapBackendRowToTransaction);
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
export async function fetchHorsePrizeSummary(horseId: number): Promise<HorsePrizeSummary> {
  return apiClient.get<HorsePrizeSummary>(`/api/v1/horses/${horseId}/prize-summary`);
}
